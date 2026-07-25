"""
Project Knowledge Index — Incremental Refresh

Detects when repository state changes and triggers targeted index refresh.
Avoids full rescans whenever possible.

Compliant with Constitution §1.7 (Performance First) and §1.8 (Incremental Context).
"""

import os
import subprocess
import time
from pathlib import Path
from typing import Any, Callable

from platform.shared import (
    ProjectIndex, ProjectIndexConfig,
    TelemetryEnvelope, Outcome,
)


class RefreshTrigger(str):
    """Types of refresh triggers."""
    GIT_COMMIT = "git_commit"
    DOC_CHANGE = "documentation_change"
    COMPONENT_CHANGE = "component_change"
    CONFIG_CHANGE = "configuration_change"
    MANUAL = "manual"
    FULL_RESCAN = "full_rescan"


class IncrementalRefresh:
    """Detects repository changes and triggers targeted index refresh.

    Each trigger type maps to a specific scope of refresh, avoiding
    full rescans for minor changes. Cooldown periods prevent thrashing.
    """

    def __init__(
        self,
        builder_fn: Callable[..., ProjectIndex | None],
        cache_manager: Any,
        config: ProjectIndexConfig | None = None,
    ):
        self._builder = builder_fn
        self._cache = cache_manager
        self.config = config or ProjectIndexConfig()
        self._last_trigger: dict[str, tuple[str, float]] = {}

    def check_and_refresh(
        self,
        repo_path: str,
        repo_name: str,
        current_index: ProjectIndex | None = None,
    ) -> tuple[ProjectIndex | None, str | None, TelemetryEnvelope]:
        """Check if refresh is needed and perform it if so.

        Args:
            repo_path: Absolute path to the repository.
            repo_name: Repository name.
            current_index: The currently cached index, if any.

        Returns:
            Tuple of:
              - Refreshed ProjectIndex, or None if refresh was not needed.
              - Trigger name that fired, or None.
              - Telemetry envelope.
        """
        import time as _time
        start = _time.perf_counter()
        decision_path: list[str] = ["refresh:trigger_detection"]
        triggers: list[str] = []

        # Check each trigger
        trigger = self._detect_trigger(repo_path, repo_name, current_index)
        if trigger:
            triggers.append(trigger)
            decision_path.append(f"refresh:{trigger}")

            # Check cooldown
            if self._in_cooldown(repo_name, trigger):
                duration = (_time.perf_counter() - start) * 1000
                telemetry = TelemetryEnvelope(
                    service="project-index.refresh",
                    operation="check_and_refresh",
                    duration_ms=round(duration, 2),
                    decision_path=decision_path + ["cooldown:skipped"],
                    outcome=Outcome.SUCCESS,
                    extra={
                        "repo_name": repo_name,
                        "trigger_detected": trigger,
                        "cooldown_active": True,
                    },
                )
                return None, None, telemetry

            # Perform refresh
            self._record_trigger(repo_name, trigger)
            refreshed = self._builder(str(Path(repo_path) / self.config.index_filename))
            if refreshed:
                self._cache.set(repo_name, refreshed)

                duration = (_time.perf_counter() - start) * 1000
                telemetry = TelemetryEnvelope(
                    service="project-index.refresh",
                    operation="check_and_refresh",
                    duration_ms=round(duration, 2),
                    decision_path=decision_path,
                    outcome=Outcome.SUCCESS,
                    extra={
                        "repo_name": repo_name,
                        "trigger": trigger,
                        "refresh_type": "incremental",
                    },
                )
                return refreshed, trigger, telemetry

        # No refresh needed
        duration = (_time.perf_counter() - start) * 1000
        telemetry = TelemetryEnvelope(
            service="project-index.refresh",
            operation="check_and_refresh",
            duration_ms=round(duration, 2),
            decision_path=decision_path + ["no_refresh_needed"],
            outcome=Outcome.SUCCESS,
            extra={
                "repo_name": repo_name,
                "trigger_detected": trigger or "none",
            },
        )
        return None, None, telemetry

    def _detect_trigger(
        self,
        repo_path: str,
        repo_name: str,
        current_index: ProjectIndex | None,
    ) -> str | None:
        """Detect what type of change occurred, if any."""
        repo = Path(repo_path)
        index_file = repo / self.config.index_filename

        # Config change: index file modified
        if index_file.exists():
            mtime = index_file.stat().st_mtime
            if current_index and current_index.metadata:
                try:
                    import dateutil.parser
                    # Compare mtime with last_indexed timestamp
                    last_indexed = current_index.metadata.last_indexed
                    if isinstance(last_indexed, str):
                        last_ts = dateutil.parser.parse(last_indexed).timestamp()
                    else:
                        last_ts = last_indexed.timestamp()
                    if mtime > last_ts:
                        return RefreshTrigger.CONFIG_CHANGE
                except Exception:
                    # If we can't compare, assume change
                    return RefreshTrigger.CONFIG_CHANGE

        # Git change: HEAD hash changed
        if self.config.git_check_enabled:
            head = self._get_head_hash(repo_path)
            if head and current_index and head != self._get_cached_hash(repo_name):
                return RefreshTrigger.GIT_COMMIT

        return None

    def _in_cooldown(self, repo_name: str, trigger: str) -> bool:
        """Check if we're in the cooldown period for a trigger."""
        last = self._last_trigger.get(repo_name)
        if not last:
            return False

        last_trigger, last_time = last
        elapsed = time.time() - last_time

        if last_trigger == trigger:
            return elapsed < self.config.cooldown_same_trigger
        return elapsed < self.config.cooldown_diff_trigger

    def _record_trigger(self, repo_name: str, trigger: str) -> None:
        """Record a trigger event for cooldown tracking."""
        self._last_trigger[repo_name] = (trigger, time.time())

    def _get_head_hash(self, repo_path: str) -> str | None:
        """Get the current git HEAD hash."""
        try:
            result = subprocess.run(
                ["git", "rev-parse", "HEAD"],
                capture_output=True, text=True, cwd=repo_path, timeout=5,
            )
            if result.returncode == 0:
                return result.stdout.strip()
        except (subprocess.TimeoutExpired, OSError):
            pass
        return None

    def _get_cached_hash(self, repo_name: str) -> str | None:
        """Get the cached HEAD hash from L1 or L2 cache."""
        # Check L1
        idx, layer = self._cache.get(repo_name)
        if idx and idx.repo_path:
            # Read from the actual repo — more reliable than cache
            return self._get_head_hash(idx.repo_path)
        return None