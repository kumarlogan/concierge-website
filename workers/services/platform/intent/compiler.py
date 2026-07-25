"""
Intent Engine — Compiler

Transforms validated natural language requests into internal execution plans.
Only invoked when:
  - The request is unstructured (not a structured prompt)
  - The request is not a deterministic command
  - Sufficient factual information exists (clarification complete)

Compiler output is internal and not exposed unless explicitly requested.

Compliant with Constitution §1.10 (Roadmap Discipline) and §1.4 (Fail Closed).
"""

import re
from typing import Any

from platform.shared import (
    IntentCategory, RiskLevel, ExecutionPlan, IntentEngineConfig,
    TelemetryEnvelope, Outcome,
)


class Compiler:
    """Compiles natural language requests into structured execution plans.

    The compiler:
      - Resolves the request into a goal statement
      - Identifies the target project/repository
      - Classifies risk level via deterministic rule table (Tier 1)
      - Performs roadmap validation
      - Generates a dry run summary for medium/high risk operations
    """

    def __init__(self, config: IntentEngineConfig | None = None):
        self.config = config or IntentEngineConfig()

    def compile(
        self,
        request: str,
        intent_category: IntentCategory,
        resolved_facts: dict[str, str] | None = None,
        roadmap_items: list[str] | None = None,
    ) -> tuple[ExecutionPlan, TelemetryEnvelope]:
        """Compile a validated NL request into an execution plan.

        Args:
            request: The original natural language request.
            intent_category: Classified intent category.
            resolved_facts: Facts resolved by the clarification engine.
            roadmap_items: Known roadmap items for roadmap validation.

        Returns:
            Tuple of (execution_plan, telemetry_envelope).
        """
        import time
        start = time.perf_counter()
        decision_path: list[str] = ["rule:goal_extraction"]
        errors: list[str] = []
        resolved_facts = resolved_facts or {}

        # Extract goal from request
        goal = self._extract_goal(request)

        # Determine risk level (Tier 1 — Rule Engine)
        decision_path.append("rule:risk_classification")
        risk_level = self._classify_risk(intent_category, resolved_facts)
        if risk_level is None:
            risk_level = RiskLevel.LOW

        # Roadmap validation (Tier 1 — Rule Engine)
        decision_path.append("rule:roadmap_validation")
        roadmap_match = None
        if roadmap_items:
            roadmap_match = self._match_roadmap(goal, roadmap_items)

        decision_path.append("rule:plan_generation")
        plan = ExecutionPlan(
            goal=goal,
            project=resolved_facts.get("project"),
            repository=resolved_facts.get("repository"),
            target=resolved_facts.get("deployment_target"),
            intent_category=intent_category,
            risk_level=risk_level,
            constraints={
                "branch": resolved_facts.get("branch", ""),
                "environment": resolved_facts.get("environment", ""),
            },
            recommended_actions=self._generate_actions(
                intent_category, risk_level, resolved_facts
            ),
            roadmap_item=roadmap_match,
        )

        duration = (time.perf_counter() - start) * 1000
        telemetry = TelemetryEnvelope(
            service="intent.compiler",
            operation="compile",
            duration_ms=round(duration, 2),
            decision_path=decision_path,
            errors=errors,
            outcome=Outcome.SUCCESS,
            extra={
                "risk_level": risk_level.value,
                "intent_category": intent_category.value,
                "roadmap_match": roadmap_match or "none",
            },
        )

        return plan, telemetry

    def _extract_goal(self, request: str) -> str:
        """Extract a concise one-line goal from the request.

        Uses deterministic heuristics:
          - Take the first sentence or meaningful line
          - Strip boilerplate (salutations, signatures)
          - Limit to 200 characters
        """
        # Strip leading/trailing whitespace and common salutations
        cleaned = request.strip()
        cleaned = re.sub(
            r"^(hey|hi|hello|ok|so|okay|please|could you|can you|would you)\s+",
            "", cleaned, flags=re.IGNORECASE
        )

        # Take first sentence or first non-empty line
        first_sentence = cleaned.split(".")[0].strip()
        first_line = cleaned.split("\n")[0].strip()

        goal = first_sentence if first_sentence else first_line
        goal = goal.strip()

        # Truncate to 200 characters
        if len(goal) > 200:
            goal = goal[:197] + "..."

        return goal

    def _classify_risk(
        self,
        intent_category: IntentCategory,
        facts: dict[str, str],
    ) -> RiskLevel | None:
        """Classify risk level using deterministic rule table (Tier 1)."""
        # Check configured risk rules first
        for rule in self.config.risk_rules:
            when = rule.get("when", {})
            match = True
            for key, expected_value in when.items():
                if key == "intent":
                    if intent_category.value != expected_value:
                        match = False
                elif key == "environment":
                    env = facts.get("environment", "").lower()
                    if env != expected_value:
                        match = False
                elif key not in facts or facts[key] != expected_value:
                    match = False
            if match:
                return RiskLevel(rule.get("level", "low"))

        # Default rules (used when config has none)
        if intent_category in (
            IntentCategory.DEPLOYMENT, IntentCategory.DATABASE,
            IntentCategory.SECURITY, IntentCategory.INFRASTRUCTURE,
        ):
            env = facts.get("environment", "").lower()
            if intent_category == IntentCategory.DEPLOYMENT and env == "production":
                return RiskLevel.HIGH
            return RiskLevel.HIGH

        if intent_category in (
            IntentCategory.BUG, IntentCategory.FEATURE, IntentCategory.REFACTOR,
        ):
            return RiskLevel.MEDIUM

        return RiskLevel.LOW

    def _match_roadmap(self, goal: str, roadmap_items: list[str]) -> str | None:
        """Check if the goal maps to a known roadmap item.

        Uses simple keyword matching. Returns the roadmap item key
        if a match is found, None otherwise.
        """
        goal_lower = goal.lower()
        for item in roadmap_items:
            item_lower = item.lower()
            # Check if goal contains the roadmap item keywords
            if any(word in goal_lower for word in item_lower.split()):
                return item
        return None

    def _generate_actions(
        self,
        intent_category: IntentCategory,
        risk_level: RiskLevel,
        facts: dict[str, str],
    ) -> list[str]:
        """Generate recommended actions based on intent category.

        This is a deterministic template — not AI-generated.
        """
        base = f"Execute {intent_category.value} work"
        actions = [base]

        repo = facts.get("repository")
        if repo:
            actions.append(f"Target repository: {repo}")

        if risk_level in (RiskLevel.MEDIUM, RiskLevel.HIGH):
            actions.append("Requires confirmation before execution")

        return actions


# Convenience function
def compile_plan(
    request: str,
    intent_category: IntentCategory,
    resolved_facts: dict[str, str] | None = None,
    config: IntentEngineConfig | None = None,
) -> tuple[ExecutionPlan, TelemetryEnvelope]:
    return Compiler(config).compile(request, intent_category, resolved_facts)