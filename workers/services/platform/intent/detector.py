"""
Intent Engine — Detector

Classifies an incoming request as one of three modes:
  - Structured prompt (Hermes execution format)
  - Deterministic command (known command registry)
  - Natural language (everything else)

Compliant with Constitution §1.2 (Deterministic Before AI) — pure rule engine.
"""

import re
from typing import Any

from platform.shared import DetectionMode, TelemetryEnvelope, Outcome
from platform.shared import IntentEngineConfig


class Detector:
    """Classifies incoming requests using deterministic pattern matching.

    Tier 1 (Rule Engine) only. No AI reasoning.
    """

    def __init__(self, config: IntentEngineConfig | None = None):
        self.config = config or IntentEngineConfig()
        # Pre-compile structured prompt patterns for performance
        self._structured_patterns = [
            re.compile(p, re.IGNORECASE | re.MULTILINE)
            for p in self.config.structured_patterns
        ]

    def detect(self, request: str) -> tuple[DetectionMode, str | None, TelemetryEnvelope]:
        """Detect the execution mode of a request.

        Returns:
            Tuple of (detection_mode, matched_command_or_none, telemetry_envelope)
        """
        import time
        start = time.perf_counter()
        decision_path: list[str] = []
        errors: list[str] = []

        # Tier 1: Check structured prompt patterns
        decision_path.append("rule:structured_patterns")
        if self._is_structured_prompt(request):
            duration = (time.perf_counter() - start) * 1000
            telemetry = TelemetryEnvelope(
                service="intent.detector",
                operation="detect",
                duration_ms=round(duration, 2),
                decision_path=decision_path,
                outcome=Outcome.SUCCESS,
                extra={"detected_mode": DetectionMode.STRUCTURED.value},
            )
            return DetectionMode.STRUCTURED, None, telemetry

        # Tier 1: Check deterministic command registry
        decision_path.append("rule:command_registry")
        matched_command = self._match_deterministic_command(request)
        if matched_command:
            duration = (time.perf_counter() - start) * 1000
            telemetry = TelemetryEnvelope(
                service="intent.detector",
                operation="detect",
                duration_ms=round(duration, 2),
                decision_path=decision_path,
                outcome=Outcome.SUCCESS,
                extra={
                    "detected_mode": DetectionMode.DETERMINISTIC.value,
                    "matched_command": matched_command,
                },
            )
            return DetectionMode.DETERMINISTIC, matched_command, telemetry

        # Fallback: Natural language
        decision_path.append("fallback:nl")
        duration = (time.perf_counter() - start) * 1000
        telemetry = TelemetryEnvelope(
            service="intent.detector",
            operation="detect",
            duration_ms=round(duration, 2),
            decision_path=decision_path,
            outcome=Outcome.SUCCESS,
            extra={"detected_mode": DetectionMode.NATURAL_LANGUAGE.value},
        )
        return DetectionMode.NATURAL_LANGUAGE, None, telemetry

    def _is_structured_prompt(self, request: str) -> bool:
        """Check if the request matches any structured prompt pattern.

        Uses pre-compiled regex patterns for performance (Tier 1).
        """
        stripped = request.strip()
        for pattern in self._structured_patterns:
            if pattern.search(stripped):
                return True
        # Additional heuristic: YAML-style frontmatter with --- delimiters
        if stripped.startswith("---\n") and "\n---" in stripped[4:]:
            return True
        return False

    def _match_deterministic_command(self, request: str) -> str | None:
        """Check if the request matches a known deterministic command.

        Matches against the registered command patterns. If no commands
        are registered, no commands can match — this is permissive by
        default, not presumptive.
        """
        stripped = request.strip().lower()
        commands = self.config.deterministic_commands

        # Direct key match
        if stripped in commands:
            return stripped

        # Pattern match: check if command key appears as a known prefix
        for cmd_key in commands:
            cmd_info = commands[cmd_key]
            pattern = cmd_info.get("pattern", cmd_key)
            if isinstance(pattern, str) and re.match(
                rf"^{re.escape(pattern)}(\s|$)", stripped, re.IGNORECASE
            ):
                return cmd_key

        return None


# Convenience function for single-use detection
def detect(request: str, config: IntentEngineConfig | None = None) -> tuple[DetectionMode, str | None, TelemetryEnvelope]:
    """One-shot detection without instantiating a Detector."""
    return Detector(config).detect(request)