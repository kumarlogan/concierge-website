"""
Intent Engine — Clarification Engine

Identifies missing factual information in a natural language request and
generates the minimum set of clarification questions required to proceed.

Compliant with Constitution §1.3 (No Assumptions) and §1.4 (Fail Closed).
Never infers missing information. Never fabricates context.
"""

import re
from typing import Any, Callable

from platform.shared import TelemetryEnvelope, Outcome
from platform.shared import IntentEngineConfig


# Known ambiguity dimensions that may require clarification
AMBIGUITY_DIMENSIONS = [
    "project",
    "repository",
    "workspace",
    "deployment_target",
    "branch",
    "environment",
    "component",
    "scope",
]


class ClarificationEngine:
    """Identifies and resolves missing factual information.

    Before asking the user, the engine checks:
      1. Project Knowledge Index (injected resolver function)
      2. Active context (session state)
      3. Targeted repository inspection (injected resolver)

    Only after exhausting deterministic resolution does it emit questions.
    """

    def __init__(
        self,
        config: IntentEngineConfig | None = None,
        pki_resolver: Callable | None = None,
        repo_inspector: Callable | None = None,
    ):
        self.config = config or IntentEngineConfig()
        # Injected resolvers for PKI and repo inspection (tiers 2-3)
        # These are callables that take (dimension, request) and return
        # the resolved value or None.
        self._pki_resolver = pki_resolver
        self._repo_inspector = repo_inspector

    def check(
        self,
        request: str,
        context: dict[str, Any] | None = None,
    ) -> tuple[list[str], dict[str, str], TelemetryEnvelope]:
        """Check a request for missing factual information.

        Returns:
            Tuple of:
              - clarification_questions: list of questions to ask the user
              - resolved_facts: dict of dimension -> resolved value
              - telemetry_envelope
        """
        import time
        start = time.perf_counter()
        decision_path: list[str] = []
        questions: list[str] = []
        resolved: dict[str, str] = {}
        context = context or {}

        # Check each ambiguity dimension
        for dimension in AMBIGUITY_DIMENSIONS:
            # Is this dimension relevant to the request?
            if not self._dimension_is_relevant(dimension, request):
                continue

            # Already in context?
            decision_path.append(f"context:{dimension}")
            if dimension in context and context[dimension]:
                resolved[dimension] = str(context[dimension])
                continue

            # Check PKI (Tier 2 — Cached Metadata)
            decision_path.append(f"pki:{dimension}")
            if self._pki_resolver:
                pki_value = self._pki_resolver(dimension, request)
                if pki_value:
                    resolved[dimension] = str(pki_value)
                    continue

            # Check repo inspection (Tier 3 — Repository Inspection)
            decision_path.append(f"repo_inspection:{dimension}")
            if self._repo_inspector:
                repo_value = self._repo_inspector(dimension, request)
                if repo_value:
                    resolved[dimension] = str(repo_value)
                    continue

            # Cannot resolve — need clarification (Tier 4 deferred — ask user)
            decision_path.append(f"clarification_needed:{dimension}")
            questions.append(self._question_for_dimension(dimension))

        duration = (time.perf_counter() - start) * 1000
        needs_clarification = len(questions) > 0

        telemetry = TelemetryEnvelope(
            service="intent.clarification",
            operation="check",
            duration_ms=round(duration, 2),
            decision_path=decision_path,
            outcome=Outcome.SUCCESS if not needs_clarification else Outcome.BLOCKED,
            clarification_needed=needs_clarification,
            extra={
                "dimensions_checked": len(AMBIGUITY_DIMENSIONS),
                "questions_count": len(questions),
                "resolved_facts": resolved,
            },
        )

        return questions, resolved, telemetry

    def _dimension_is_relevant(self, dimension: str, request: str) -> bool:
        """Check if a given ambiguity dimension is relevant to this request.

        Uses word-boundary keyword matching. Returns True for most dimensions
        by default — better to over-check than to miss (fail-closed).
        """
        import re
        lower = request.lower()
        # Tokenize: split on non-alpha boundaries
        tokens = set(re.findall(r"[a-z][a-z]+", lower))

        # Dimensions that are always relevant
        always_relevant = {"project", "repository", "scope"}
        if dimension in always_relevant:
            return True

        # Deployment-related dimensions
        if dimension in ("deployment_target", "environment", "workspace"):
            deploy_keywords = {"deploy", "release", "production", "staging",
                               "publish", "rollout", "preview"}
            return bool(tokens & deploy_keywords)

        # Branch-related
        if dimension == "branch":
            branch_keywords = {"branch", "merge", "pull", "pullrequest",
                               "commit", "push"}
            # Also check "pull request" as a phrase
            if "pull request" in lower or "pullrequest" in lower:
                return True
            return bool(tokens & branch_keywords)

        # Component-related
        if dimension == "component":
            component_keywords = {"component", "module", "feature", "section",
                                  "part", "area", "page"}
            return bool(tokens & component_keywords)

        return True

    def _question_for_dimension(self, dimension: str) -> str:
        """Generate a clarification question for a missing fact."""
        questions = {
            "project": "Which project?",
            "repository": "Which repository?",
            "workspace": "Which workspace?",
            "deployment_target": "Which deployment target?",
            "branch": "Which branch?",
            "environment": "Which environment?",
            "component": "Which component?",
            "scope": "What scope should this work cover?",
        }
        return questions.get(dimension, f"Please specify the {dimension}.")


# Convenience function
def check(
    request: str,
    context: dict[str, Any] | None = None,
    pki_resolver: Callable | None = None,
    config: IntentEngineConfig | None = None,
) -> tuple[list[str], dict[str, str], TelemetryEnvelope]:
    engine = ClarificationEngine(config=config, pki_resolver=pki_resolver)
    return engine.check(request, context)