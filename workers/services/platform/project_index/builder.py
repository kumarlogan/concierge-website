"""
Project Knowledge Index — Builder

Constructs the in-memory index from disk sources.
Reads .hermes/project-index.yaml files from workspace directories
and builds ProjectIndex data structures.

Compliant with Constitution §1.8 (Incremental Context) — only loads
index files; does not scan repository contents.
"""

import os
import yaml
from datetime import datetime
from pathlib import Path
from typing import Any

from platform.shared import (
    ProjectIndex, ProjectInfo, TechnologyInfo, DocumentationPaths,
    Component, OperationsInfo, MetadataInfo, ProjectIndexConfig,
    TelemetryEnvelope, Outcome,
)


class IndexBuilder:
    """Builds ProjectIndex entries from on-disk index files.

    Reads .hermes/project-index.yaml files from registered repositories
    and constructs the corresponding ProjectIndex data structures.
    """

    def __init__(self, config: ProjectIndexConfig | None = None):
        self.config = config or ProjectIndexConfig()

    def build_all(self) -> tuple[dict[str, ProjectIndex], TelemetryEnvelope]:
        """Discover and build indices for all repositories.

        Scans configured workspace directories for .hermes/project-index.yaml
        files and builds ProjectIndex entries for each.

        Returns:
            Tuple of {repo_name: ProjectIndex} and telemetry envelope.
        """
        import time
        start = time.perf_counter()
        decision_path: list[str] = ["discovery:workspace_scan"]
        errors: list[str] = []
        indices: dict[str, ProjectIndex] = {}

        if not self.config.auto_discover:
            duration = (time.perf_counter() - start) * 1000
            telemetry = TelemetryEnvelope(
                service="project-index.builder",
                operation="build_all",
                duration_ms=round(duration, 2),
                decision_path=decision_path,
                outcome=Outcome.SUCCESS,
                extra={"repo_count": 0, "auto_discover": False},
            )
            return indices, telemetry

        # Scan each workspace directory for index files
        for workspace_dir in self.config.workspace_dirs:
            workspace_path = Path(workspace_dir).expanduser()
            if not workspace_path.exists():
                continue

            index_files = list(workspace_path.rglob(self.config.index_filename))
            for index_file in index_files:
                try:
                    idx = self.build_from_file(str(index_file))
                    if idx and idx.project.name:
                        indices[idx.project.name] = idx
                        idx.repo_path = str(index_file.parent)
                except Exception as e:
                    errors.append(f"Failed to build index from {index_file}: {e}")

        duration = (time.perf_counter() - start) * 1000
        telemetry = TelemetryEnvelope(
            service="project-index.builder",
            operation="build_all",
            duration_ms=round(duration, 2),
            decision_path=decision_path,
            cache_hits=0,
            cache_misses=0,
            errors=errors,
            outcome=Outcome.SUCCESS,
            extra={
                "repo_count": len(indices),
                "repos_found": list(indices.keys()),
                "directories_scanned": len(self.config.workspace_dirs),
            },
        )

        return indices, telemetry

    def build_from_file(self, file_path: str) -> ProjectIndex | None:
        """Build a ProjectIndex from a single .hermes/project-index.yaml file."""
        path = Path(file_path)
        if not path.exists():
            return None

        try:
            with open(path) as f:
                raw = yaml.safe_load(f)
        except (yaml.YAMLError, OSError) as e:
            return None

        if not raw or "project" not in raw:
            return None

        return self._parse_index(raw, str(path.parent))

    def build_from_dict(
        self, data: dict[str, Any], repo_path: str | None = None
    ) -> ProjectIndex | None:
        """Build a ProjectIndex from a parsed dictionary."""
        return self._parse_index(data, repo_path)

    def _parse_index(
        self, raw: dict[str, Any], repo_path: str | None = None
    ) -> ProjectIndex:
        """Parse a raw YAML dictionary into a ProjectIndex."""
        # Project info
        proj = raw.get("project", {})
        project_info = ProjectInfo(
            name=proj.get("name", "unknown"),
            description=proj.get("description", ""),
            status=proj.get("status", "active"),
        )

        # Technology info
        tech = raw.get("technology", {})
        technology_info = TechnologyInfo(
            framework=tech.get("framework", "unknown"),
            language=tech.get("language", "unknown"),
            runtime=tech.get("runtime", "unknown"),
            package_manager=tech.get("package_manager", "unknown"),
        )

        # Documentation paths
        docs = raw.get("documentation", {})
        doc_paths = DocumentationPaths(
            roadmap=docs.get("roadmap"),
            architecture=docs.get("architecture"),
            operations=docs.get("operations"),
            security=docs.get("security"),
            database=docs.get("database"),
            api=docs.get("api"),
        )

        # Components
        components_raw = raw.get("components", [])
        components = [
            Component(
                name=c.get("name", "unknown"),
                path=c.get("path", ""),
                type=c.get("type", "shared"),
            )
            for c in components_raw
        ]

        # Operations
        ops = raw.get("operations", {})
        operations_info = OperationsInfo(
            build=ops.get("build", ""),
            test=ops.get("test", ""),
            deployment_targets=ops.get("deployment_targets", ["production"]),
            environments=ops.get("environments", ["production", "staging"]),
        )

        # Metadata
        meta = raw.get("metadata", {})
        last_indexed_raw = meta.get("last_indexed")
        last_indexed: datetime | str = datetime.utcnow()
        if last_indexed_raw:
            try:
                last_indexed = datetime.fromisoformat(
                    last_indexed_raw.replace("Z", "+00:00")
                )
            except (ValueError, TypeError):
                last_indexed = last_indexed_raw

        metadata_info = MetadataInfo(
            version=meta.get("version", "1.0.0"),
            last_indexed=last_indexed,
            active_branch=meta.get("active_branch", "main"),
        )

        return ProjectIndex(
            project=project_info,
            technology=technology_info,
            documentation=doc_paths,
            components=components,
            operations=operations_info,
            metadata=metadata_info,
            repo_path=repo_path,
            cache_status="fresh",
        )


# Convenience function
def build_all(config: ProjectIndexConfig | None = None) -> tuple[dict[str, ProjectIndex], TelemetryEnvelope]:
    return IndexBuilder(config).build_all()