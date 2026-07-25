"""
Intent Engine — Platform Service

The universal request entry point for the Hermes AI Platform.
See docs/platform/INTENT_ENGINE_v1.md for full specification.
"""

from platform.intent.detector import Detector, detect
from platform.intent.classifier import Classifier, classify
from platform.intent.clarification import ClarificationEngine, check
from platform.intent.compiler import Compiler, compile_plan
from platform.intent.validator import Validator, validate
from platform.intent.router import Router, resolve
from platform.intent.telemetry import TelemetryRecorder, record, get_summary

__all__ = [
    "Detector", "detect",
    "Classifier", "classify",
    "ClarificationEngine", "check",
    "Compiler", "compile_plan",
    "Validator", "validate",
    "Router", "resolve",
    "TelemetryRecorder", "record", "get_summary",
]