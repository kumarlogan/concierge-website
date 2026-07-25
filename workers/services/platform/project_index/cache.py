"""
Project Knowledge Index — Cache Manager

Maintains the in-memory and on-disk cache of ProjectIndex entries.
Implements L1 (memory) and L2 (disk) cache layers with TTL-based expiry.

Compliant with Constitution §1.7 (Performance First) — minimises
redundant reads through a two-layer cache hierarchy.
"""

import json
import os
import time
from pathlib import Path
from dataclasses import dataclass
from typing import Any

from platform.shared import ProjectIndex, ProjectIndexConfig


# Type alias for the index store
IndexStore = dict[str, ProjectIndex]


class CacheManager:
    """Manages the PKI cache hierarchy.

    Cache layers:
      L1 — In-memory dict (session lifetime, LRU eviction)
      L2 — JSON file per repository (configurable TTL)

    The L3 layer (source of truth) is the on-disk YAML file,
    managed by the Builder module.
    """

    def __init__(self, config: ProjectIndexConfig | None = None):
        self.config = config or ProjectIndexConfig()
        self._l1_cache: dict[str, _CacheEntry] = {}
        self._l2_cache_dir = Path.home() / ".hermes" / "cache" / "project-index"
        self._l2_cache_dir.mkdir(parents=True, exist_ok=True)

    def get(self, repo_name: str) -> tuple[ProjectIndex | None, str]:
        """Get a cached ProjectIndex by repository name.

        Checks L1, then L2. Returns (index, cache_layer).

        Args:
            repo_name: Name of the repository.

        Returns:
            Tuple of (ProjectIndex or None, layer: "l1"|"l2"|"miss").
        """
        # L1: In-memory cache
        entry = self._l1_cache.get(repo_name)
        if entry and not self._is_stale(entry.timestamp, self.config.cache_ttl_l1):
            return entry.index, "l1"

        # L2: Disk cache
        l2_path = self._l2_path(repo_name)
        if l2_path.exists():
            try:
                data = json.loads(l2_path.read_text())
                idx = self._deserialize_index(data)
                if idx:
                    # Promote to L1
                    self._set_l1(repo_name, idx, data.get("_cached_at", 0))
                    return idx, "l2"
            except (json.JSONDecodeError, OSError):
                pass

        # L2 stale or missing — clear L1 entry
        self._l1_cache.pop(repo_name, None)
        return None, "miss"

    def set(self, repo_name: str, index: ProjectIndex) -> None:
        """Store a ProjectIndex in both L1 and L2 caches.

        Args:
            repo_name: Name of the repository.
            index: The ProjectIndex to cache.
        """
        timestamp = time.time()
        self._set_l1(repo_name, index, timestamp)
        self._set_l2(repo_name, index, timestamp)

    def invalidate(self, repo_name: str) -> None:
        """Mark a repository's cache as stale.

        Removes both L1 and L2 entries.

        Args:
            repo_name: Name of the repository to invalidate.
        """
        self._l1_cache.pop(repo_name, None)
        l2_path = self._l2_path(repo_name)
        if l2_path.exists():
            l2_path.unlink()

    def clear_all(self) -> None:
        """Clear all cached entries (L1 and L2)."""
        self._l1_cache.clear()
        for f in self._l2_cache_dir.glob("*.json"):
            f.unlink()

    def get_stats(self) -> dict[str, Any]:
        """Get cache statistics."""
        l2_files = list(self._l2_cache_dir.glob("*.json"))
        return {
            "l1_entries": len(self._l1_cache),
            "l2_entries": len(l2_files),
            "l1_max": self.config.max_l1_entries,
            "l2_cache_dir": str(self._l2_cache_dir),
        }

    # ── Internal helpers ──────────────────────────────────────────

    def _set_l1(self, repo_name: str, index: ProjectIndex, timestamp: float) -> None:
        """Set a value in L1 cache with LRU eviction."""
        if len(self._l1_cache) >= self.config.max_l1_entries:
            # Evict oldest entry
            oldest = min(
                self._l1_cache.keys(),
                key=lambda k: self._l1_cache[k].timestamp,
            )
            self._l1_cache.pop(oldest, None)

        self._l1_cache[repo_name] = _CacheEntry(
            index=index, timestamp=timestamp
        )

    def _set_l2(self, repo_name: str, index: ProjectIndex, timestamp: float) -> None:
        """Persist a ProjectIndex to the L2 disk cache."""
        data = self._serialize_index(index)
        data["_cached_at"] = timestamp
        try:
            self._l2_path(repo_name).write_text(
                json.dumps(data, indent=2, default=str)
            )
        except OSError:
            pass

    def _l2_path(self, repo_name: str) -> Path:
        """Get the L2 cache file path for a repository."""
        safe_name = repo_name.replace("/", "_").replace("\\", "_")
        return self._l2_cache_dir / f"{safe_name}.json"

    def _is_stale(self, timestamp: float, ttl: int) -> bool:
        """Check if a cache entry is stale based on TTL."""
        return (time.time() - timestamp) > ttl

    def _serialize_index(self, index: ProjectIndex) -> dict[str, Any]:
        """Serialize a ProjectIndex for disk storage."""
        return {
            "project": {
                "name": index.project.name,
                "description": index.project.description,
                "status": index.project.status,
            },
            "technology": {
                "framework": index.technology.framework,
                "language": index.technology.language,
                "runtime": index.technology.runtime,
                "package_manager": index.technology.package_manager,
            },
            "documentation": {
                "roadmap": index.documentation.roadmap,
                "architecture": index.documentation.architecture,
                "operations": index.documentation.operations,
                "security": index.documentation.security,
                "database": index.documentation.database,
                "api": index.documentation.api,
            },
            "components": [
                {"name": c.name, "path": c.path, "type": c.type}
                for c in index.components
            ],
            "operations": {
                "build": index.operations.build,
                "test": index.operations.test,
                "deployment_targets": index.operations.deployment_targets,
                "environments": index.operations.environments,
            },
            "metadata": {
                "version": index.metadata.version if index.metadata else "1.0.0",
                "last_indexed": str(index.metadata.last_indexed) if index.metadata else "",
                "active_branch": index.metadata.active_branch if index.metadata else "main",
            },
            "repo_path": index.repo_path,
        }

    def _deserialize_index(self, data: dict[str, Any]) -> ProjectIndex | None:
        """Deserialize a ProjectIndex from stored data."""
        from platform.shared import (
            ProjectIndex as PI, ProjectInfo, TechnologyInfo,
            DocumentationPaths, Component, OperationsInfo, MetadataInfo,
        )
        from datetime import datetime

        proj = data.get("project", {})
        tech = data.get("technology", {})
        docs = data.get("documentation", {})
        ops = data.get("operations", {})
        meta = data.get("metadata", {})

        try:
            return PI(
                project=ProjectInfo(
                    name=proj.get("name", "unknown"),
                    description=proj.get("description", ""),
                    status=proj.get("status", "active"),
                ),
                technology=TechnologyInfo(
                    framework=tech.get("framework", "unknown"),
                    language=tech.get("language", "unknown"),
                    runtime=tech.get("runtime", "unknown"),
                    package_manager=tech.get("package_manager", "unknown"),
                ),
                documentation=DocumentationPaths(
                    roadmap=docs.get("roadmap"),
                    architecture=docs.get("architecture"),
                    operations=docs.get("operations"),
                    security=docs.get("security"),
                    database=docs.get("database"),
                    api=docs.get("api"),
                ),
                components=[
                    Component(**c) for c in data.get("components", [])
                ],
                operations=OperationsInfo(
                    build=ops.get("build", ""),
                    test=ops.get("test", ""),
                    deployment_targets=ops.get("deployment_targets", ["production"]),
                    environments=ops.get("environments", ["production", "staging"]),
                ),
                metadata=MetadataInfo(
                    version=meta.get("version", "1.0.0"),
                    last_indexed=meta.get("last_indexed", str(datetime.utcnow())),
                    active_branch=meta.get("active_branch", "main"),
                ),
                repo_path=data.get("repo_path"),
                cache_status="cached",
            )
        except Exception:
            return None


@dataclass
class _CacheEntry:
    """Internal L1 cache entry."""
    index: ProjectIndex
    timestamp: float