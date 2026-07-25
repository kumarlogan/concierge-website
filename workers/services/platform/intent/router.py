"""
Intent Engine — Router

Routes resolved requests to the correct execution pipeline based on
detection mode, validation status, and compilation result.

Compliant with Constitution §1.6 (Modular Design) — the router is the
single dispatch point; execution handlers are separate replaceable modules.
"""

from typing import Any, Callable

from platform.shared import (
    DetectionMode, ExecutionMode, IntentResult, IntentCategory, RiskLevel,
    IntentEngineConfig, TelemetryEnvelope, Outcome,
)
from platform.intent.detector import Detector
from platform.intent.classifier import Classifier
from platform.intent.clarification import ClarificationEngine
from platform.intent.compiler import Compiler
from platform.intent.validator import Validator


class Router:
    """Routes requests to the correct execution path.

    The router is the final step in the Intent Engine pipeline.
    It determines which execution mode to use and dispatches accordingly.
    """

    def __init__(
        self,
        config: IntentEngineConfig | None = None,
        pki_resolver: Callable | None = None,
        execution_handlers: dict[str, Callable] | None = None,
    ):
        self.config = config or IntentEngineConfig()
        self.detector = Detector(config)
        self.classifier = Classifier(config)
        self.clarification = ClarificationEngine(config, pki_resolver=pki_resolver)
        self.compiler = Compiler(config)
        self.validator = Validator(config)
        # Injected execution handlers — called by route() for Mode 2
        self.execution_handlers = execution_handlers or {}

    def resolve(
        self,
        request: str,
        context: dict[str, Any] | None = None,
    ) -> IntentResult:
        """Process a request through the full Intent Engine pipeline.

        This is the primary entry point. It:
          1. Detects the mode
          2. Validates (structured) or classifies (NL)
          3. Clarifies (if needed)
          4. Compiles (if NL, no clarify)
          5. Routes to execution

        Args:
            request: The raw incoming request.
            context: Optional execution context (session state, active project).

        Returns:
            IntentResult containing the resolution outcome.
        """
        context = context or {}

        # Step 1: Detect mode
        mode, matched_command, detect_telemetry = self.detector.detect(request)

        # ── Mode 1: Structured Prompt ─────────────────────────────
        if mode == DetectionMode.STRUCTURED:
            is_valid, errors, validate_telemetry = self.validator.validate(request)
            if not is_valid:
                return IntentResult(
                    mode=mode,
                    execution_mode=ExecutionMode.MODE1_STRUCTURED,
                    validation_errors=errors,
                    telemetry=validate_telemetry,
                )
            return IntentResult(
                mode=mode,
                execution_mode=ExecutionMode.MODE1_STRUCTURED,
                validation_errors=[],
                telemetry=validate_telemetry,
            )

        # ── Mode 2: Deterministic Command ──────────────────────────
        if mode == DetectionMode.DETERMINISTIC and matched_command:
            telemetry = TelemetryEnvelope(
                service="intent.router",
                operation="resolve",
                duration_ms=detect_telemetry.duration_ms,
                decision_path=["rule:command_match", "dispatch:direct"],
                outcome=Outcome.SUCCESS,
                extra={
                    "matched_command": matched_command,
                    "execution_mode": ExecutionMode.MODE2_DETERMINISTIC.value,
                },
            )
            return IntentResult(
                mode=mode,
                execution_mode=ExecutionMode.MODE2_DETERMINISTIC,
                telemetry=telemetry,
            )

        # ── Mode 3: Clarification ──────────────────────────────────
        questions, resolved_facts, clarify_telemetry = self.clarification.check(
            request, context
        )
        if len(questions) > 0:
            return IntentResult(
                mode=mode,
                execution_mode=ExecutionMode.MODE3_CLARIFICATION,
                clarification=questions,
                telemetry=clarify_telemetry,
            )

        # ── Mode 4: Compilation ────────────────────────────────────
        # Classify intent
        category, confidence, classify_telemetry = self.classifier.classify(request)

        # Compile execution plan
        plan, compile_telemetry = self.compiler.compile(
            request, category, resolved_facts
        )

        # Generate dry run for medium/high risk
        dry_run = None
        if plan.risk_level in (RiskLevel.MEDIUM, RiskLevel.HIGH):
            dry_run = self._generate_dry_run(plan, resolved_facts)

        telemetry = TelemetryEnvelope(
            service="intent.router",
            operation="resolve",
            duration_ms=round(
                detect_telemetry.duration_ms
                + clarify_telemetry.duration_ms
                + classify_telemetry.duration_ms
                + compile_telemetry.duration_ms,
                2,
            ),
            decision_path=["detect", "clarify", "classify", "compile", "route"],
            outcome=Outcome.SUCCESS,
            extra={
                "execution_mode": ExecutionMode.MODE4_COMPILATION.value,
                "intent_category": category.value,
                "risk_level": plan.risk_level.value,
                "confidence": round(confidence, 3),
            },
        )

        return IntentResult(
            mode=mode,
            execution_mode=ExecutionMode.MODE4_COMPILATION,
            intent_category=category,
            risk_level=plan.risk_level,
            execution_plan={
                "goal": plan.goal,
                "project": plan.project,
                "repository": plan.repository,
                "target": plan.target,
                "actions": plan.recommended_actions,
                "roadmap_item": plan.roadmap_item,
            },
            dry_run=dry_run,
            telemetry=telemetry,
        )

    def _generate_dry_run(
        self,
        plan: Any,
        facts: dict[str, str],
    ) -> dict[str, Any]:
        """Generate a dry run summary for medium/high risk operations."""
        return {
            "goal": plan.goal,
            "affected_repositories": [plan.repository] if plan.repository else [],
            "affected_files": [],
            "estimated_changes": "Unknown until execution",
            "risk_level": plan.risk_level.value,
            "rollback_available": False,
            "required_approvals": ["User confirmation"],
            "confirmation_required": True,
        }


# Convenience function
def resolve(request: str, context: dict[str, Any] | None = None) -> IntentResult:
    return Router().resolve(request, context)