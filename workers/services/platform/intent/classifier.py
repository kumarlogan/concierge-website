"""
Intent Engine — Classifier

Assigns an intent category to a natural language request using deterministic
keyword-based pattern matching (Tier 1). Falls back to a confidence check
that may signal the caller to use AI (Tier 4) only when keyword matching
fails to produce a result with sufficient confidence.

Compliant with Constitution §1.2 (Deterministic Before AI).
"""

import re
from typing import Any

from platform.shared import IntentCategory, TelemetryEnvelope, Outcome
from platform.shared import IntentEngineConfig


# Default category keyword map — used when no config overrides are provided
DEFAULT_CATEGORIES: dict[str, list[str]] = {
    "ui": ["component", "page", "style", "layout", "hero", "navigation",
           "footer", "button", "modal", "ui", "screen", "view", "theme"],
    "backend": ["api", "endpoint", "route", "handler", "middleware", "service",
                "worker", "websocket", "backend", "server", "controller"],
    "infrastructure": ["infra", "hosting", "networking", "dns", "domain",
                       "ssl", "certificate", "cloudflare", "wrangler",
                       "deploy", "pipeline", "ci", "cd"],
    "security": ["security", "auth", "login", "permission", "role",
                 "credential", "secret", "token", "encryption", "oauth", "jwt"],
    "documentation": ["doc", "documentation", "readme", "guide", "spec", "specification",
                      "manual", "wiki", "comment", "api-doc", "swagger", "openapi"],
    "database": ["database", "db", "migration", "schema", "query", "table",
                 "index", "seed", "sql", "drizzle", "d1", "redis", "cache", "storage"],
    "deployment": ["deploy", "release", "rollout", "publish", "ship",
                   "production", "staging", "preview", "canary"],
    "operations": ["monitor", "alert", "health", "log", "metric", "trace",
                   "observability", "dashboard", "incident", "outage"],
    "architecture": ["architecture", "design", "pattern", "structure",
                     "module", "dependency", "interface", "abstraction", "contract"],
    "feature": ["feature", "new", "add", "implement", "create", "build",
                "develop", "introduce", "support", "enable"],
    "bug": ["bug", "fix", "broken", "error", "crash", "issue", "defect",
            "regression", "incorrect", "wrong", "failing"],
    "refactor": ["refactor", "restructure", "cleanup", "tidy", "simplify",
                 "extract", "deduplicate", "optimize", "migrate"],
}


class Classifier:
    """Assigns intent categories using keyword-based rule engine.

    Tier 1 (Rule Engine) by default. The `classify` method returns a
    `needs_ai_fallback` flag so the caller can decide whether to invoke
    AI reasoning (Tier 4) for ambiguous requests.
    """

    def __init__(self, config: IntentEngineConfig | None = None):
        self.config = config or IntentEngineConfig()
        # Merge config categories with defaults (config overrides)
        self.categories: dict[str, list[str]] = dict(DEFAULT_CATEGORIES)
        if self.config.categories:
            for cat, keywords in self.config.categories.items():
                self.categories[cat] = keywords

    def classify(
        self, request: str
    ) -> tuple[IntentCategory, float, TelemetryEnvelope]:
        """Classify request into an intent category.

        Returns:
            Tuple of (category, confidence, telemetry_envelope).
            Confidence is 0.0–1.0. Below 0.6 signals the caller
            to consider AI fallback.
        """
        import time
        start = time.perf_counter()
        decision_path: list[str] = ["rule:keyword_classifier"]

        lower = request.lower()
        tokens = set(re.findall(r"[a-zA-Z][a-zA-Z0-9_]+", lower))
        total_tokens = len(tokens) or 1  # Avoid division by zero

        best_category = IntentCategory.UNKNOWN
        best_score = 0.0
        scores: dict[str, float] = {}

        for cat_name, keywords in self.categories.items():
            matched = sum(1 for kw in keywords if kw in tokens)
            if matched > 0:
                # Score is fraction of matched keywords relative to matched+unmatched
                # Normalized against the keyword list size to avoid short lists dominating
                score = matched / max(len(keywords), 1)
                scores[cat_name] = score
                if score > best_score:
                    best_score = score
                    best_category = IntentCategory(cat_name)

        # Confidence: best_score, clamped to [0, 1]
        confidence = min(best_score, 1.0)

        duration = (time.perf_counter() - start) * 1000

        telemetry = TelemetryEnvelope(
            service="intent.classifier",
            operation="classify",
            duration_ms=round(duration, 2),
            decision_path=decision_path,
            outcome=Outcome.SUCCESS,
            extra={
                "intent_category": best_category.value,
                "confidence": round(confidence, 3),
                "matched_tokens": len(tokens),
            },
        )

        return best_category, confidence, telemetry


# Convenience function
def classify(request: str, config: IntentEngineConfig | None = None) -> tuple[IntentCategory, float, TelemetryEnvelope]:
    return Classifier(config).classify(request)