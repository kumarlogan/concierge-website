"""
Intent Engine — Validator

Validates structured Hermes execution prompts against a schema.
Only invoked for Mode 1 (Structured Prompt) requests.

Compliant with Constitution §1.4 (Fail Closed) — invalid prompts are rejected,
never auto-fixed or re-interpreted.
"""

import re
from typing import Any

from platform.shared import TelemetryEnvelope, Outcome, IntentEngineConfig


# Required top-level sections in a Hermes execution prompt
REQUIRED_SECTIONS = [
    "objective",
    "deliverables",
    "scope",
]

# Sections that are optional but commonly expected
OPTIONAL_SECTIONS = [
    "initiative",
    "constitutional compliance",
    "acceptance criteria",
    "success criteria",
    "rules",
]


class Validator:
    """Validates structured Hermes execution prompts.

    Checks:
      - Required sections are present
      - No contradictory instructions
      - Scope boundaries are defined
      - Deliverables are concrete (not ambiguous)
    """

    def __init__(self, config: IntentEngineConfig | None = None):
        self.config = config or IntentEngineConfig()

    def validate(
        self, request: str
    ) -> tuple[bool, list[str], TelemetryEnvelope]:
        """Validate a structured Hermes execution prompt.

        Returns:
            Tuple of (is_valid, validation_errors, telemetry_envelope).
        """
        import time
        start = time.perf_counter()
        decision_path: list[str] = ["rule:section_check"]
        errors: list[str] = []
        lower = request.lower()

        # Check required sections
        decision_path.append("rule:required_sections")
        for section in REQUIRED_SECTIONS:
            # Look for the section header in markdown-style format
            if not self._section_exists(lower, section):
                errors.append(f"Missing required section: {section}")

        # Check for executable deliverables
        decision_path.append("rule:deliverable_check")
        if not self._has_deliverables(request):
            errors.append(
                "No concrete deliverables found — specify what to create, "
                "modify, or produce"
            )

        # Check for scope definition
        decision_path.append("rule:scope_check")
        if not self._has_scope_boundaries(request):
            errors.append(
                "Scope not explicitly defined — add a scope section with "
                "'do' and 'do not' boundaries"
            )

        # Check for contradictory instructions
        decision_path.append("rule:contradiction_check")
        contradictions = self._find_contradictions(request)
        errors.extend(contradictions)

        is_valid = len(errors) == 0
        duration = (time.perf_counter() - start) * 1000

        telemetry = TelemetryEnvelope(
            service="intent.validator",
            operation="validate",
            duration_ms=round(duration, 2),
            decision_path=decision_path,
            errors=errors,
            outcome=Outcome.SUCCESS if is_valid else Outcome.BLOCKED,
            extra={
                "error_count": len(errors),
                "is_valid": is_valid,
            },
        )

        return is_valid, errors, telemetry

    def _section_exists(self, lower_text: str, section_name: str) -> bool:
        """Check if a section exists in the prompt text."""
        # Match pattern: "## Section Name" or "Section Name" at start of line
        pattern = rf"(?:^|\n)#{{1,3}}\s*{re.escape(section_name)}"
        if re.search(pattern, lower_text, re.MULTILINE):
            return True
        # Also check for bold-style headers: **Section Name**
        bold_pattern = rf"\*\*{re.escape(section_name)}\*\*"
        if re.search(bold_pattern, lower_text, re.MULTILINE | re.IGNORECASE):
            return True
        # Check for ⸻ delimiter headers
        delim_pattern = rf"(?:^|\n)⸻\s*\n\s*{re.escape(section_name)}"
        if re.search(delim_pattern, lower_text, re.MULTILINE):
            return True
        return False

    def _has_deliverables(self, request: str) -> bool:
        """Check if the prompt specifies concrete deliverables."""
        deliverable_patterns = [
            r"create\s+",
            r"implement\s+",
            r"build\s+",
            r"generate\s+",
            r"write\s+",
            r"produce\s+",
            r"deliver",
            r"deliverable",
            r"services/",
            r"docs/",
        ]
        for pattern in deliverable_patterns:
            if re.search(pattern, request, re.IGNORECASE):
                return True
        return False

    def _has_scope_boundaries(self, request: str) -> bool:
        """Check if the prompt defines scope boundaries."""
        scope_patterns = [
            r"do\s+not",
            r"scope\s*(limited|restricted|confined)",
            r"out\s+of\s+scope",
            r"not\s+in\s+scope",
            r"boundar",
            r"no\s+(auto|automated)",
            r"stop\s+after",
            r"halt\s+when",
            r"only\s+if",
        ]
        for pattern in scope_patterns:
            if re.search(pattern, request, re.IGNORECASE):
                return True
        return False

    def _find_contradictions(self, request: str) -> list[str]:
        """Find contradictory instructions in the prompt.

        Looks for patterns like "deploy" + "do not deploy" or
        "create files" + "read-only".
        """
        contradictions: list[str] = []
        lower = request.lower()

        # Deploy vs do not deploy
        if "deploy" in lower and "do not deploy" in lower:
            contradictions.append(
                "Contradiction: 'deploy' and 'do not deploy' both present"
            )

        # Create files vs read-only
        if re.search(r"create|write|implement", lower) and "read.only" in lower:
            contradictions.append(
                "Contradiction: write operation requested with read-only constraint"
            )

        # Commit vs do not commit
        if "commit" in lower and "do not commit" in lower:
            contradictions.append(
                "Contradiction: 'commit' and 'do not commit' both present"
            )

        return contradictions


# Convenience function
def validate(
    request: str, config: IntentEngineConfig | None = None
) -> tuple[bool, list[str], TelemetryEnvelope]:
    return Validator(config).validate(request)