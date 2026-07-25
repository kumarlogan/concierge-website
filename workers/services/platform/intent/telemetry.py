"""
Intent Engine — Telemetry

Records and aggregates observability data from all Intent Engine modules.

Compliant with Constitution §1.9 (Observability by Default).
"""

import json
import time
from collections import defaultdict
from typing import Any

from platform.shared import TelemetryEnvelope


# In-memory store for session-level telemetry aggregation
_session_store: dict[str, list[dict[str, Any]]] = defaultdict(list)


class TelemetryRecorder:
    """Records and exposes observability data across the pipeline.

    Maintains an in-memory store for the current session. Future versions
    will persist to the `telemetry/` namespace (§2) when available.
    """

    def __init__(self, session_id: str = "default"):
        self.session_id = session_id

    def record(self, envelope: TelemetryEnvelope) -> None:
        """Record a telemetry envelope.

        Stores the envelope as a dict in the in-memory session store.
        """
        data = envelope.to_dict()
        data["timestamp"] = time.time()
        _session_store[self.session_id].append(data)

    def get_session_summary(self) -> dict[str, Any]:
        """Get a summary of all telemetry recorded in this session."""
        entries = _session_store.get(self.session_id, [])
        if not entries:
            return {"entries": 0, "operations": [], "total_duration_ms": 0}

        return {
            "entries": len(entries),
            "operations": [e.get("operation", "unknown") for e in entries],
            "total_duration_ms": round(
                sum(e.get("duration_ms", 0) for e in entries), 2
            ),
            "outcomes": {
                outcome: sum(1 for e in entries if e.get("outcome") == outcome)
                for outcome in {"success", "blocked", "failed", "deferred"}
            },
            "clarifications_requested": sum(
                1 for e in entries if e.get("clarification_needed", False)
            ),
        }

    def get_pipeline_trace(self) -> list[dict[str, Any]]:
        """Get the full ordered trace of pipeline events."""
        return list(_session_store.get(self.session_id, []))

    def clear(self) -> None:
        """Clear telemetry for this session."""
        _session_store[self.session_id] = []

    def export_json(self) -> str:
        """Export all telemetry as JSON."""
        return json.dumps(
            _session_store.get(self.session_id, []),
            indent=2,
            default=str,
        )

    @staticmethod
    def summary(entries: list[dict[str, Any]]) -> dict[str, Any]:
        """Static method: compute summary from raw entries."""
        if not entries:
            return {"entries": 0}
        return {
            "entries": len(entries),
            "total_duration_ms": round(
                sum(e.get("duration_ms", 0) for e in entries), 2
            ),
            "outcomes": {
                outcome: sum(1 for e in entries if e.get("outcome") == outcome)
                for outcome in {"success", "blocked", "failed", "deferred"}
            },
        }


# Convenience functions
def record(envelope: TelemetryEnvelope, session_id: str = "default") -> None:
    TelemetryRecorder(session_id).record(envelope)


def get_summary(session_id: str = "default") -> dict[str, Any]:
    return TelemetryRecorder(session_id).get_session_summary()


def get_trace(session_id: str = "default") -> list[dict[str, Any]]:
    return TelemetryRecorder(session_id).get_pipeline_trace()