# Hermes Intent Engine v1

> **Status:** Experimental · **Namespace:** `intent/` · **Constitution:** v1.0.0
> **Version:** 1.0.0 · **Last Updated:** 2026-07-25

---

## Table of Contents

1. [Purpose](#1-purpose)
2. [Architecture Overview](#2-architecture-overview)
3. [Execution Pipeline](#3-execution-pipeline)
4. [Structured Prompt Detection](#4-structured-prompt-detection)
5. [Deterministic Command Routing](#5-deterministic-command-routing)
6. [Natural Language Compilation](#6-natural-language-compilation)
7. [Clarification Engine](#7-clarification-engine)
8. [Intent Classification](#8-intent-classification)
9. [Execution Modes](#9-execution-modes)
10. [Roadmap Validation](#10-roadmap-validation)
11. [Risk Gates](#11-risk-gates)
12. [Dry Run](#12-dry-run)
13. [Failure Behaviour](#13-failure-behaviour)
14. [Efficiency Requirements](#14-efficiency-requirements)
15. [Observability Contract](#15-observability-contract)
16. [Service Interface](#16-service-interface)
17. [Configuration Schema](#17-configuration-schema)
18. [Deferred Backlog](#18-deferred-backlog)

---

## 1. Purpose

The Intent Engine is the **universal request entry point** for the Hermes AI Platform.
Every incoming request — whether a structured Hermes execution prompt, a deterministic
command, or free-form natural language — passes through the Intent Engine before
planning, orchestration, workforce routing, or execution occurs.

It is a **reusable Hermes AI Platform capability**. It contains zero project-specific
logic, prompts, workflows, or policies.

### 1.1 — Constitutional Compliance

The Intent Engine implements the following principles from the
[Platform Constitution](PLATFORM_CONSTITUTION.md) without redefining them:

| Principle | How Intent Engine Satisfies It |
|-----------|-------------------------------|
| **Platform First** (§1.1) | No project-specific code; configuration-injected behaviour only |
| **Deterministic Before AI** (§1.2) | Rule engine and cache checked before any AI call |
| **No Assumptions** (§1.3) | Clarification engine halts on ambiguity; never infers |
| **Fail Closed** (§1.4) | Uncertainty blocks execution; no default execution on ambiguity |
| **Repository Agnostic** (§1.5) | All repo references via injected config or Project Knowledge Index |
| **Modular Design** (§1.6) | Each pipeline stage is an independent, replaceable module |
| **Performance First** (§1.7) | Cheapest resolution path is always tried first |
| **Incremental Context** (§1.8) | Loads only what is needed — no bulk repository loading |
| **Roadmap Discipline** (§1.10) | Validates against roadmap; defers out-of-scope work |
| **Backward Compatibility** (§1.11) | Preserves existing workflows; structured prompts pass through unchanged |
| **Platform Namespace** (§1.12) | Lives under `services/platform/intent/` |

---

## 2. Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                        INCOMING REQUEST                             │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      Structured Prompt?                              │
│   (detector.is_structured_prompt)                                    │
│                                                                      │
│   YES ──────────────────────────────► Validate ──► Route ──► Execute │
│                                                                      │
│   NO                                                                │
│       │                                                             │
│       ▼                                                             │
│   Deterministic Command?                                             │
│   (detector.is_deterministic_command)                                 │
│       │                                                             │
│       YES ──────────────────────────► Route ──► Execute Directly     │
│       │                                                             │
│       NO                                                            │
│       │                                                             │
│       ▼                                                             │
│   Clarification Needed?                                              │
│   (clarification.needs_clarification)                                 │
│       │                                                             │
│       YES ──────────────────────────► Ask Minimum ──► Await Response │
│       │                                       │                     │
│       │                                       ▼                     │
│       │                                  (re-enter at top with       │
│       │                                   enriched request)          │
│       NO                                                            │
│       │                                                             │
│       ▼                                                             │
│   Compile Natural Language ───► Classify Intent ──► Roadmap Validate │
│                                                        │            │
│                                                        ▼            │
│                                                  Generate Plan ──► Route ──► Execute
└─────────────────────────────────────────────────────────────────────┘
```

### 2.1 — Module Responsibilities

| Module | File | Responsibility |
|--------|------|----------------|
| **Detector** | `detector.py` | Classifies incoming request as structured prompt, deterministic command, or NL |
| **Classifier** | `classifier.py` | Assigns intent category (UI, Backend, Infra, Security, etc.) |
| **Clarification** | `clarification.py` | Identifies missing facts; generates minimum clarification questions |
| **Compiler** | `compiler.py` | Transforms validated NL into internal execution plan |
| **Validator** | `validator.py` | Validates structured prompts against schema |
| **Router** | `router.py` | Routes to correct execution mode pipeline |
| **Telemetry** | `telemetry.py` | Records observability data per §1.9 |

---

## 3. Execution Pipeline

```
Incoming Request
    │
    ├─► 1. Detect Mode                  (detector.py)
    │
    ├─► 2. Validate (if structured)     (validator.py)
    │     or
    │     Classify (if NL)              (classifier.py)
    │
    ├─► 3. Clarify (if ambiguous)       (clarification.py)
    │
    ├─► 4. Compile (if NL, no clarify)  (compiler.py)
    │
    ├─► 5. Roadmap Validate             (compiler.py / validator.py)
    │
    ├─► 6. Risk Gate                    (compiler.py)
    │
    ├─► 7. Dry Run (if med/high risk)   (compiler.py)
    │
    └─► 8. Router                       (router.py)
              │
              └─► Execute
```

Each step emits observability data via the telemetry module.

---

## 4. Structured Prompt Detection

### 4.1 — Detection Rules (Tier 1 — Rule Engine)

A request is classified as a **structured Hermes execution prompt** when it matches
one or more of the following deterministic patterns:

| Pattern | Example Match |
|---------|---------------|
| Begins with `HERMES EXECUTION` (case-insensitive) | `HERMES EXECUTION PROMPT\n\nInitialize…` |
| Begins with `⸻` followed by a command header | `⸻\n\n## Initialize` |
| Contains `# HERMES EXECUTION DIRECTIVE` | Full directive header |
| Contains `⸻HERMES` at start of a delimited block | Hermes-formatted block |
| Conforms to `KEY: VALUE` structured format with `---` YAML delimiters | YAML-frontmatter structured requests |

### 4.2 — Behaviour

Once detected:

1. **Bypass** NL compilation entirely.
2. **Bypass** clarification (assumes structured prompts are self-contained).
3. **Proceed** directly to validation.
4. **Execute** after validation passes.

### 4.3 — Never Recompile

If the request is already a structured prompt, it is passed through identically.
The Intent Engine never re-formats or re-interprets structured content.

---

## 5. Deterministic Command Routing

### 5.1 — Command Registry (Tier 1 — Rule Engine)

Deterministic commands match against a configurable registry of known command patterns.
The registry is a simple key-value lookup (not AI-driven).

| Command Pattern | Action | Example |
|-----------------|--------|---------|
| `status` | Report current platform state | `status` |
| `deploy <target>` | Execute deployment | `deploy staging` |
| `restart` | Restart service | `restart api` |
| `test(s)` | Run test suite | `test`, `tests` |
| `logs` | Fetch logs | `logs worker` |
| `rollback` | Revert last change | `rollback production` |
| `help` | Show help | `help` |

### 5.2 — Extensibility

The command registry is configured via configuration injection (see §17).
Projects register their own deterministic commands through the `commands` config key.
The Intent Engine never hardcodes project-specific commands.

### 5.3 — Execution

Matched deterministic commands are routed directly to execution without compilation,
classification, or clarification.

---

## 6. Natural Language Compilation

### 6.1 — When Compilation Occurs

Compilation is triggered **only** when ALL of the following are true:

1. The request is unstructured (not a structured prompt).
2. The request is not a deterministic command match.
3. Sufficient factual information exists (no ambiguity requiring clarification).
4. Clarification, if previously needed, has been completed.

### 6.2 — Compilation Process

Compilation transforms natural language into an **internal execution plan** with:

- **Goal**: One-line restatement of the requested outcome
- **Project**: Resolved project identity (from PKI or explicit)
- **Repository**: Resolved repository path
- **Target**: Deployment target or environment (if applicable)
- **Intent Category**: Classified intent (see §8)
- **Risk Level**: low / medium / high
- **Constraints**: Known boundaries (branch, environment, scope)
- **Recommended Actions**: Ordered list of actions to take

### 6.3 — Transparency

Compiler output is **internal**. It is not exposed to the user unless explicitly
requested (e.g., `--verbose` flag, `/explain` command).

---

## 7. Clarification Engine

### 7.1 — Principle

Per §1.3 (No Assumptions), Hermes shall **never** infer missing information.
If ambiguity exists regarding any required fact, execution stops and a clarification
signal is emitted.

### 7.2 — Ambiguity Detection

The clarification engine checks for missing facts in these dimensions:

| Dimension | Questions Asked | Resolvable Without Asking? |
|-----------|-----------------|---------------------------|
| **Project** | Which project? | Only if single project exists or PKI has unambiguous match |
| **Repository** | Which repository? | Only if single repo or request explicitly references one |
| **Workspace** | Which workspace? | Only if unambiguous |
| **Deployment Target** | Which target? | Only if context implies it |
| **Branch** | Which branch? | Only if implicit from project defaults |
| **Environment** | Which environment? | Only if unambiguous |
| **Component** | Which component? | Only if single-component project |
| **Scope** | What scope? | Never — always ask |

### 7.3 — Minimum Clarification

The engine asks the **minimum** number of questions required to resolve all ambiguities.
It bundles multiple missing facts into a single structured clarification response when
possible.

### 7.4 — PKI-First Resolution

Before asking the user, the engine checks:

1. **Project Knowledge Index** — can the PKI resolve this fact?
2. **Repository inspection** — can targeted repo inspection resolve it?
3. **Active context** — does the current session provide implicit values?

Only after exhausting these (tiers 1–3 per §1.2) does the engine emit a clarification
request.

### 7.5 — Example

```
User: "deploy to production"

Engine checks PKI → 2 repositories found, no explicit selection.
Engine checks context → no active repo selection.

Response: "Which repository? Options: [concierge-website, hermes-webui]"
```

---

## 8. Intent Classification

### 8.1 — Classification Categories

Every request that reaches compilation is classified into one intent category:

| Category | Tag | Typical Actions |
|----------|-----|-----------------|
| UI | `ui` | Components, pages, styles, layout |
| Backend | `backend` | API, logic, data processing |
| Infrastructure | `infrastructure` | Hosting, networking, secrets |
| Security | `security` | Auth, permissions, credentials |
| Documentation | `documentation` | Docs, comments, specs |
| Database | `database` | Migrations, schema, queries |
| Deployment | `deployment` | Build, release, rollback |
| Operations | `operations` | Monitoring, alerts, health |
| Architecture | `architecture` | Design, structure, patterns |
| Feature | `feature` | New capability |
| Bug | `bug` | Fix, regression |
| Refactor | `refactor` | Restructure, optimise, clean |

### 8.2 — Classification Method (Tier 1 — Rule Engine)

Classification uses **keyword-based pattern matching** against a configurable category
map. For example:

```yaml
categories:
  ui:
    keywords: [component, page, style, layout, hero, navigation, footer, button, modal]
  backend:
    keywords: [api, endpoint, route, handler, middleware, service, worker, websocket]
  database:
    keywords: [migration, schema, query, table, index, seed, drizzle, d1]
```

AI reasoning (§1.2, Tier 4) is used for classification **only** when keyword-based
matching produces no result with sufficient confidence (>0.6 match score).

### 8.3 — Planner Selection

Intent category determines the **planner selection** for downstream orchestration.
Each category maps to a planner service (e.g., `planner:ui`, `planner:backend`).

---

## 9. Execution Modes

### 9.1 — Mode 1: Structured Prompt

```
Input:  Structured Hermes prompt
Path:   Detection → Validation → Route → Execute
Steps:
  1. Detector matches structured prompt pattern (Tier 1)
  2. Validator checks schema conformance
  3. Router dispatches to execution
  4. Telemetry records outcome
```

**No compilation. No clarification. No AI reasoning.**

### 9.2 — Mode 2: Deterministic Command

```
Input:  Recognised command string
Path:   Detection → Route → Execute
Steps:
  1. Detector matches command registry (Tier 1)
  2. Router dispatches directly to execution handler
  3. Telemetry records outcome
```

**No compilation. No classification. No clarification. No AI reasoning.**

### 9.3 — Mode 3: Clarification

```
Input:  Ambiguous NL request
Path:   Detection → Clarification → [Await] → [Re-enter]
Steps:
  1. Detector classifies as NL (not structured, not deterministic)
  2. Clarification identifies missing facts
  3. Engine emits minimum clarification questions
  4. Execution halts until user responds
```

**No compilation until clarification complete.**

### 9.4 — Mode 4: Compilation

```
Input:  Unambiguous NL request
Path:   Detection → Classification → Compilation → Roadmap Validate
        → Risk Gate → Dry Run (if med/high) → Route → Execute
Steps:
  1. Detector classifies as NL
  2. Clarification passes (all facts present)
  3. Classifier assigns intent category
  4. Compiler generates internal execution plan
  5. Roadmap validation checks plan against approved scope
  6. Risk gate classifies risk level
  7. Dry run presented for med/high risk
  8. Router dispatches approved plan to execution
```

**AI reasoning only when rule engine (§8.2) cannot classify with sufficient confidence.**

---

## 10. Roadmap Validation

### 10.1 — Purpose

Ensure requested work belongs to the approved roadmap before any execution occurs.
Prevents scope creep at the point of request intake.

### 10.2 — Validation Check

The compiler (or validator for structured prompts) checks the resolved goal against
the project's known roadmap (from PKI metadata). If the goal maps to an approved
roadmap item, execution proceeds. Otherwise:

1. **Record** the request in the deferred backlog.
2. **Offer** the user: defer to backlog, or request roadmap modification.
3. **Do not execute** without explicit roadmap approval.

### 10.3 — No Auto-Expansion

The Intent Engine **never** automatically expands the roadmap. Roadmap modification
is a governance action, not a compiler side-effect.

---

## 11. Risk Gates

### 11.1 — Risk Classification

Every compiled execution plan is classified by risk level.

| Risk Level | Criteria | Examples |
|-----------|----------|----------|
| **Low** | Read-only, no side effects | Documentation, status, code review |
| **Medium** | Mutating but reversible | Feature work, refactor, staging deploy |
| **High** | Mutating, potentially destructive | Production deploy, credential change, DB migration, resource deletion |

### 11.2 — Classification Method (Tier 1 — Rule Engine)

Risk is determined by a deterministic rule table mapping intent category + target
environment + detected keywords to a risk level:

```yaml
risk_rules:
  - when:
      intent: deployment
      environment: production
    level: high
  - when:
      intent: database
    level: high
  - when:
      intent: security
    level: high
  - when:
      intent: deployment
      environment: staging
    level: medium
```

---

## 12. Dry Run

### 12.1 — When a Dry Run Is Required

For **Medium** and **High** risk operations, the Intent Engine generates a dry run
summary and awaits explicit user confirmation before proceeding.

### 12.2 — Dry Run Content

```
Affected Repositories:
  - concierge-website (/home/ubuntu/hermes-website)

Affected Files:
  - src/workers/api.ts (modify)
  - src/workers/db.ts (modify)

Estimated Changes: 2 files, ~50 lines

Rollback Available: Yes (git revert)

Required Approvals:
  - User confirmation (pending)
```

### 12.3 — Await Confirmation

Execution halts until the user explicitly approves the dry run. A declined dry run
is recorded in telemetry as `outcome: blocked`.

---

## 13. Failure Behaviour

### 13.1 — Fail Closed

Per §1.4, uncertainty **never** results in execution:

| Condition | Behaviour |
|-----------|-----------|
| Missing required fact | Stop → Clarify → Wait |
| Ambiguous repository selection | List options → Await explicit selection |
| Unclassifiable intent | Default to clarification (not execution) |
| Invalid structured prompt | Reject with validation errors (not auto-fix) |
| Roadmap violation | Defer → Do not execute |
| Dry run declined | Block → Record → Do not execute |
| Any error before decision | Halt → Report → No execution |

### 13.2 — No Inference

The Intent Engine does not guess, infer, or fabricate:

- Missing project? Stop and ask.
- Missing target? Stop and ask.
- Unknown intent? Ask for clarification.
- Unclear scope? Ask for specificity.

---

## 14. Efficiency Requirements

### 14.1 — Resolution Priority

Per §1.2 (Deterministic Before AI) and §1.7 (Performance First):

| Priority | Mechanism | Checked When |
|----------|-----------|--------------|
| 1 | **Rule Engine** (patterns, keywords, registry) | Every request |
| 2 | **Cached Metadata** (PKI) | Before repository inspection |
| 3 | **Project Knowledge Index** | Before repository inspection |
| 4 | **Targeted Repository Inspection** | Only when PKI insufficient |
| 5 | **AI Reasoning** | Only when tiers 1–4 exhausted |

### 14.2 — Incremental Context

Per §1.8:
- Repository inspection loads **only the files required** for the current request.
- Full repository scans occur **only** during explicit PKI refresh operations.
- The PKI is checked **before** any repository read.

### 14.3 — Latency Budget

| Stage | p50 Target | p95 Target |
|-------|-----------|-----------|
| Detection | 5ms | 20ms |
| Validation | 10ms | 50ms |
| Classification (rule-based) | 5ms | 25ms |
| Classification (AI) | 500ms | 2s |
| Clarification | 10ms | 50ms |
| Compilation | 10ms | 100ms |
| Roadmap Validation | 5ms | 20ms |
| Risk Gate | 5ms | 15ms |
| **Full pipeline (no AI)** | **60ms** | **300ms** |
| **Full pipeline (with AI)** | **600ms** | **3s** |

---

## 15. Observability Contract

The Intent Engine emits the mandatory observability fields per
[Constitution §1.9](PLATFORM_CONSTITUTION.md#19--observability-by-default).

### 15.1 — Standard Envelope

```json
{
  "service": "intent.engine",
  "operation": "resolve",
  "duration_ms": 142,
  "decision_path": ["rule", "cache", "pki", "ai"],
  "cache_hits": 2,
  "cache_misses": 1,
  "errors": [],
  "outcome": "success",
  "clarification_needed": false
}
```

### 15.2 — Per-Module Envelope

Each module emits its own envelope under the `intent.<module>` service name:

| Module | Service Name | Operation Example |
|--------|-------------|-------------------|
| Detector | `intent.detector` | `detect` |
| Validator | `intent.validator` | `validate` |
| Classifier | `intent.classifier` | `classify` |
| Clarification | `intent.clarification` | `check`, `resolve` |
| Compiler | `intent.compiler` | `compile` |
| Router | `intent.router` | `route` |
| Telemetry | `intent.telemetry` | `record` |

### 15.3 — Additional Fields

| Field | Module | Description |
|-------|--------|-------------|
| `detected_mode` | Detector | `structured`, `deterministic`, `nl` |
| `intent_category` | Classifier | Classified intent tag (see §8) |
| `risk_level` | Compiler | `low`, `medium`, `high` |
| `clarification_questions` | Clarification | Array of questions asked |
| `roadmap_match` | Compiler | Roadmap item key (or `none`) |
| `dry_run_presented` | Compiler | Boolean |

---

## 16. Service Interface

### 16.1 — Primary Entry Point

```python
def resolve(request: str, context: dict | None = None) -> IntentResult
```

### 16.2 — Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `request` | `str` | Yes | The raw incoming request text |
| `context` | `dict` | No | Optional execution context (session state, active project, PKI handle) |

### 16.3 — Return Type

```python
@dataclass
class IntentResult:
    mode: str                    # "structured" | "deterministic" | "clarification_needed" | "compiled"
    validation_errors: list[str]  # Empty if valid
    clarification: list[str] | None  # Questions if mode == "clarification_needed"
    execution_mode: str | None   # "mode1" | "mode2" | "mode3" | "mode4"
    intent_category: str | None  # Classified category
    risk_level: str | None       # "low" | "medium" | "high"
    execution_plan: dict | None  # Internal plan (compiler output)
    dry_run: dict | None         # Dry run summary (medium/high risk only)
    telemetry: dict              # Observability envelope
```

---

## 17. Configuration Schema

### 17.1 — Intent Engine Configuration

```yaml
# intent-engine config — injected per deployment, never hardcoded
intent_engine:
  structured_patterns:
    - "^HERMES EXECUTION"
    - "^⸻"
    - "# HERMES EXECUTION DIRECTIVE"
    - "^---\n[A-Z][A-Z_]+:"

  deterministic_commands:
    status:
      handler: "platform.execution.handlers.status"
      description: "Report current platform state"
    deploy:
      handler: "platform.execution.handlers.deploy"
      args_required: true
      description: "Deploy to target environment"
    restart:
      handler: "platform.execution.handlers.restart"
      description: "Restart a service"
    test:
      handler: "platform.execution.handlers.run_tests"
      pattern: "test(s)?"
    logs:
      handler: "platform.execution.handlers.logs"
      description: "Fetch service logs"
    rollback:
      handler: "platform.execution.handlers.rollback"
      description: "Rollback last deployment"
    help:
      handler: "platform.execution.handlers.help"
      description: "Show available commands"

  categories:
    ui:
      keywords: [component, page, style, layout, hero, navigation, footer, button, modal, ui, screen, view, theme]
    backend:
      keywords: [api, endpoint, route, handler, middleware, service, worker, websocket, backend, server, controller]
    infrastructure:
      keywords: [infra, hosting, networking, dns, domain, ssl, certificate, cloudflare, wrangler, deploy, pipeline, ci, cd]
    security:
      keywords: [security, auth, login, permission, role, credential, secret, token, encryption, ssl, tls, oauth, jwt]
    documentation:
      keywords: [doc, readme, guide, spec, specification, manual, wiki, comment, api-doc, swagger, openapi]
    database:
      keywords: [database, db, migration, schema, query, table, index, seed, sql, drizzle, d1, redis, cache, storage]
    deployment:
      keywords: [deploy, release, rollout, publish, ship, production, staging, preview, canary, blue-green]
    operations:
      keywords: [monitor, alert, health, log, metric, trace, observability, dashboard, incident, outage]
    architecture:
      keywords: [architecture, design, pattern, structure, module, dependency, interface, abstraction, contract]
    feature:
      keywords: [feature, new, add, implement, create, build, develop, introduce, support, enable]
    bug:
      keywords: [bug, fix, broken, error, crash, issue, defect, regression, incorrect, wrong, failing]
    refactor:
      keywords: [refactor, restructure, cleanup, tidy, simplify, extract, deduplicate, optimize, migrate]

  risk_rules:
    - when:
        intent: deployment
        environment: production
      level: high
    - when:
        intent: database
      level: high
    - when:
        intent: security
      level: high
    - when:
        intent: infrastructure
      level: high
    - when:
        intent: deployment
      level: medium
    - when:
        intent: refactor
      level: medium
    - when:
        intent: bug
      level: medium
    - default: low

  latency_budgets_ms:
    detection: {p50: 5, p95: 20}
    validation: {p50: 10, p95: 50}
    classification_rule: {p50: 5, p95: 25}
    classification_ai: {p50: 500, p95: 2000}
    clarification: {p50: 10, p95: 50}
    compilation: {p50: 10, p95: 100}
    roadmap_validation: {p50: 5, p95: 20}
    risk_gate: {p50: 5, p95: 15}
```

---

## 18. Deferred Backlog

The following improvements were identified during implementation but are outside scope.
See [Deferred Backlog](deferred-backlog.md) for the full list.

| # | Description | Rationale | Proposed Namespace |
|---|-------------|-----------|-------------------|
| IE-001 | Intent cache layer — memoise recent intent resolutions | Reduce latency for repeated patterns | `intent/` |
| IE-002 | Multi-request batching — compile batch of NL requests as a group | Improve throughput for planned work | `intent/` |
| IE-003 | AI fallback training data collector — log classification misses for model improvement | Improve classifier accuracy over time | `intent/` |
| IE-004 | Confidence threshold config — make classification confidence configurable per deployment | Allow project-specific tuning | `intent/` |