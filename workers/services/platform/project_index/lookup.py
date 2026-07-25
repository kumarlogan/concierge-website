"""
Project Knowledge Index — Lookup Service

Resolves repository identifiers to ProjectIndex entries.
Supports resolution by name, path, or matching criteria.

Compliant with Constitution §1.3 (No Assumptions) — never selects
when multiple repositories match; returns list for user selection.
"""

from typing import Any, Callable
from platform.shared import (
    ProjectIndex, ProjectIndexConfig,
    TelemetryEnvelope, Outcome,
)


class RepositoryLookup:
    """Resolves repository identifiers to ProjectIndex entries.

    The lookup service is the primary interface used by the Intent Engine
    to discover and select repositories.
    """

    def __init__(
        self,
        index_source: Callable[[], dict[str, ProjectIndex]] | None = None,
        config: ProjectIndexConfig | None = None,
    ):
        self._index_source = index_source or (lambda: {})
        self.config = config or ProjectIndexConfig()

    def resolve(
        self, identifier: str | None = None
    ) -> tuple[ProjectIndex | list[ProjectIndex] | None, TelemetryEnvelope]:
        """Resolve a repository by identifier.

        Args:
            identifier: Repository name, partial name, path, or None.
                None returns all known repositories.

        Returns:
            Tuple of:
              - Single ProjectIndex (exact match)
              - List of ProjectIndex (multiple matches, ambiguous)
              - None (no matches)
              - Telemetry envelope
        """
        import time
        start = time.perf_counter()
        decision_path: list[str] = ["lookup:index_source"]
        indices = self._index_source()

        if not indices:
            duration = (time.perf_counter() - start) * 1000
            telemetry = TelemetryEnvelope(
                service="project-index.lookup",
                operation="resolve",
                duration_ms=round(duration, 2),
                decision_path=decision_path,
                cache_hits=0,
                cache_misses=0,
                outcome=Outcome.SUCCESS,
                extra={"matched_count": 0, "identifier": identifier or "all"},
            )
            return None, telemetry

        # Return all if no identifier
        if identifier is None:
            all_indices = list(indices.values())
            duration = (time.perf_counter() - start) * 1000
            telemetry = TelemetryEnvelope(
                service="project-index.lookup",
                operation="resolve",
                duration_ms=round(duration, 2),
                decision_path=decision_path,
                cache_hits=len(all_indices),
                cache_misses=0,
                outcome=Outcome.SUCCESS,
                extra={
                    "matched_count": len(all_indices),
                    "identifier": "all",
                    "repos": [i.project.name for i in all_indices],
                },
            )
            return all_indices, telemetry

        decision_path.append("lookup:exact_match")
        # Exact match by name
        if identifier in indices:
            idx = indices[identifier]
            duration = (time.perf_counter() - start) * 1000
            telemetry = TelemetryEnvelope(
                service="project-index.lookup",
                operation="resolve",
                duration_ms=round(duration, 2),
                decision_path=decision_path,
                cache_hits=1,
                cache_misses=0,
                outcome=Outcome.SUCCESS,
                extra={
                    "matched_count": 1,
                    "matched_repo": identifier,
                    "match_type": "exact_name",
                },
            )
            return idx, telemetry

        # Partial match by name
        decision_path.append("lookup:partial_match")
        lower_ident = identifier.lower()
        partial_matches: list[ProjectIndex] = []
        for name, idx in indices.items():
            if lower_ident in name.lower():
                partial_matches.append(idx)

        if len(partial_matches) == 1:
            idx = partial_matches[0]
            duration = (time.perf_counter() - start) * 1000
            telemetry = TelemetryEnvelope(
                service="project-index.lookup",
                operation="resolve",
                duration_ms=round(duration, 2),
                decision_path=decision_path,
                cache_hits=1,
                cache_misses=0,
                outcome=Outcome.SUCCESS,
                extra={
                    "matched_count": 1,
                    "matched_repo": idx.project.name,
                    "match_type": "partial_name",
                },
            )
            return idx, telemetry

        if len(partial_matches) > 1:
            duration = (time.perf_counter() - start) * 1000
            telemetry = TelemetryEnvelope(
                service="project-index.lookup",
                operation="resolve",
                duration_ms=round(duration, 2),
                decision_path=decision_path,
                cache_hits=len(partial_matches),
                cache_misses=0,
                outcome=Outcome.SUCCESS,
                extra={
                    "matched_count": len(partial_matches),
                    "matched_repos": [i.project.name for i in partial_matches],
                    "match_type": "ambiguous",
                },
            )
            return partial_matches, telemetry

        # No match
        duration = (time.perf_counter() - start) * 1000
        telemetry = TelemetryEnvelope(
            service="project-index.lookup",
            operation="resolve",
            duration_ms=round(duration, 2),
            decision_path=decision_path,
            cache_hits=0,
            cache_misses=len(indices),
            outcome=Outcome.SUCCESS,
            extra={
                "matched_count": 0,
                "identifier": identifier,
                "match_type": "no_match",
            },
        )
        return None, telemetry

    def search(
        self, query: str
    ) -> tuple[list[ProjectIndex], TelemetryEnvelope]:
        """Search repositories by query string.

        Matches against project name, description, technology stack,
        and component names.

        Args:
            query: Search string.

        Returns:
            Tuple of (matching_indices, telemetry_envelope).
        """
        import time
        start = time.perf_counter()
        decision_path: list[str] = ["search:full_text"]
        indices = self._index_source()
        lower_query = query.lower()

        matches: list[ProjectIndex] = []
        for idx in indices.values():
            # Check name and description
            if lower_query in idx.project.name.lower():
                matches.append(idx)
                continue
            if lower_query in idx.project.description.lower():
                matches.append(idx)
                continue

            # Check technology stack
            tech = idx.technology
            if (lower_query in tech.framework.lower()
                    or lower_query in tech.language.lower()
                    or lower_query in tech.runtime.lower()):
                matches.append(idx)
                continue

            # Check component names
            for comp in idx.components:
                if lower_query in comp.name.lower():
                    matches.append(idx)
                    break

        duration = (time.perf_counter() - start) * 1000
        telemetry = TelemetryEnvelope(
            service="project-index.lookup",
            operation="search",
            duration_ms=round(duration, 2),
            decision_path=decision_path,
            outcome=Outcome.SUCCESS,
            extra={
                "query": query,
                "matched_count": len(matches),
                "total_indexed": len(indices),
            },
        )

        return matches, telemetry


# Convenience function
def resolve(
    identifier: str | None = None,
    index_source: Callable[[], dict[str, ProjectIndex]] | None = None,
) -> tuple[ProjectIndex | list[ProjectIndex] | None, TelemetryEnvelope]:
    return RepositoryLookup(index_source=index_source).resolve(identifier)