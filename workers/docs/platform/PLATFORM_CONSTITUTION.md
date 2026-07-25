# Hermes AI Platform Constitution

> **Status:** Adopted · **Category:** Platform Standard · **Scope:** All Platform Services
> **Version:** 1.0.0 · **Last Updated:** 2026-07-25

---

## Preamble

The Hermes AI Platform is the foundational operating system for all present and future
platform services under the Hermes ecosystem. This Constitution defines the engineering
principles, architectural constraints, and behavioural standards to which every platform
service — whether internal, customer-facing, orchestration, or analytical — must conform.

This document is a **platform-level standard**. It governs the design and evolution of
reusable platform capabilities under `services/platform/` and `docs/platform/`. It shall
not prescribe project-specific behaviour; individual projects define their own conventions
within the boundaries established herein.

---

## Table of Contents

1. [Platform Principles](#1-platform-principles)
2. [Service Namespace Hierarchy](#2-service-namespace-hierarchy)
3. [Architecture & Interface Standards](#3-architecture--interface-standards)
4. [Lifecycle Governance](#4-lifecycle-governance)
5. [Observability Contract](#5-observability-contract)
6. [Deferred Backlog Process](#6-deferred-backlog-process)
7. [Breach & Enforcement](#7-breach--enforcement)
8. [Success Criteria](#8-success-criteria)
9. [Amendment Process](#9-amendment-process)

---

## 1. Platform Principles

Every platform service shall comply with the following twelve principles.

### 1.1 — Platform First

**Statement.** Reusable capabilities belong to the Hermes AI Platform. Project-specific
logic belongs within individual projects.

**Enforcement.**
- When a capability solves a problem generalisable beyond one project, it must be
  extracted into a platform service before a second project adopts it.
- Platform services must **never** hardcode behaviour, identifiers, routes, or structure
  for a specific project.
- Project-specific overrides shall be supplied via **injected configuration** or
  **policy**, never baked into platform code.

---

### 1.2 — Deterministic Before AI

**Statement.** AI reasoning is a last resort, not the default. Before invoking an AI
model, a platform service must exhaust all cheaper, deterministic paths.

**Resolution ladder (cheapest first):**

| Tier | Mechanism | Example |
|------|-----------|---------|
| 1 | **Rule Engine** | Regex, policy table, circuit breaker |
| 2 | **Cached Metadata** | Pre-computed index, memoised lookup |
| 3 | **Repository Inspection** | Git log, file tree, static analysis |
| 4 | **AI Reasoning** | LLM inference, classification, generation |
| 5 | **Execution** | Mutating operation after decision |

**Enforcement.**
- Every AI call must be justified by a comment or log entry explaining why tiers 1–3
  were insufficient.
- A platform service that calls an AI model without first consulting a deterministic
  fallback is non-conformant.

---

### 1.3 — No Assumptions

**Statement.** If required facts are unavailable: stop, request clarification, and wait.
Never infer missing information. Never fabricate context.

**Enforcement.**
- A platform service that reaches a branch dependent on an unprovided fact must emit a
  `needs:clarification` signal and **halt execution**.
- Default values are permitted only for purely cosmetic or performance-optimisation
  parameters where a safe universal default exists (e.g. timeout seconds).
- Data required for correct execution must never be guessed.

---

### 1.4 — Fail Closed

**Statement.** Uncertainty never results in execution. Insufficient information always
blocks execution until resolved.

**Enforcement.**
- The default failure mode for any guard, check, or validation is **deny**.
- When a service cannot determine whether an operation is safe, it must refuse the
  operation, record the uncertainty, and surface the decision in observability output.
- The only exception is a time-bounded graceful degradation path explicitly declared in
  the service's interface contract and approved by platform governance.

---

### 1.5 — Repository Agnostic

**Statement.** Every platform capability must operate across all Hermes-managed
repositories. Platform services must never depend on a specific repository structure.

**Enforcement.**
- Repository identity, structure, and conventions must be supplied as **configuration**
  or discovered via a **Project Knowledge Index** — never hardcoded.
- A platform service that references a hardcoded path, branch name, or repository slug
  is non-conformant.
- Repository-specific adaptations must live in a project-index entry, not in platform
  code.

---

### 1.6 — Modular Design

**Statement.** Each platform capability must exist as an independent module with clearly
defined interfaces. Modules must be replaceable without affecting unrelated services.

**Enforcement.**
- Every service must expose a stable public interface (function signature, event schema,
  or API contract) and encapsulate all internal state.
- Services may communicate only through their public interfaces or a shared event bus.
- Internal module refactoring must never change the behaviour observed by another
  service.

---

### 1.7 — Performance First

**Statement.** Latency is a platform requirement. Every platform capability shall
minimise execution cost while preserving correctness.

**Avoid unnecessary:**

- AI reasoning (see §1.2)
- Repository scans (prefer incremental / cached)
- File loading (load on demand only)
- Context expansion (load what is needed, nothing more)
- Repeated discovery (cache once, reuse)

**Enforcement.**
- Each service shall document its expected p50/p95 latency budget.
- A service that exceeds 2× its documented budget for a standard input profile must be
  flagged for optimisation at the next governance review.

---

### 1.8 — Incremental Context

**Statement.** Load only the information required to satisfy the current request. Never
load complete repositories when targeted inspection is sufficient.

**Enforcement.**
- All file and directory reads must be scoped to the minimum set needed.
- A service that loads an entire workspace when a single file suffices is
  non-conformant.
- Bulk-loading shortcuts (e.g. `read all files`) are permitted only for indexing
  operations explicitly scoped to a Project Knowledge Index update.

---

### 1.9 — Observability by Default

**Statement.** Every platform service shall expose its execution path, timing, and
outcome. Platform behaviour must always be explainable.

**Mandatory observability fields:**

| Field | Description |
|-------|-------------|
| `service` | Service name |
| `operation` | Operation identifier |
| `duration_ms` | Wall-clock execution time |
| `decision_path` | Ordered list of resolution tiers used (see §1.2) |
| `cache_hits` | Number of cache lookups that succeeded |
| `cache_misses` | Number of cache lookups that failed |
| `errors` | List of non-fatal warnings or recoverable errors |
| `outcome` | `success`, `blocked`, `failed`, `deferred` |
| `clarification_needed` | Boolean; `true` when execution halted for missing facts |

**Enforcement.**
- A service that does not emit at minimum `service`, `operation`, `duration_ms`, and
  `outcome` on every execution is non-conformant.
- Observability output must be machine-parseable (JSON or structured log) and
  human-readable simultaneously.

---

### 1.10 — Roadmap Discipline

**Statement.** Platform services shall not expand implementation scope. Enhancement ideas
discovered during execution shall be recorded as deferred backlog items unless explicitly
approved.

**Enforcement.**
- When a developer encounters a desirable improvement outside the current scope, they
  must record it in the [Deferred Backlog](#6-deferred-backlog-process) and **continue
  with the planned work**.
- Scope creep that adds non-trivial feature work to an in-progress ticket without
  explicit approval is a governance violation.

---

### 1.11 — Backward Compatibility

**Statement.** New platform capabilities shall preserve existing workflows whenever
reasonably possible. Breaking changes require explicit approval.

**Enforcement.**
- Breaking changes to a published interface must be approved by platform governance and
  communicated via a deprecation notice at least one release cycle in advance.
- A change is considered breaking if it removes, renames, or changes the semantics of a
  public interface field, event, or function parameter.
- Breaking changes to internal implementation details (non-public) are exempt but
  encouraged to follow the same notice period when the change affects multiple
  downstream services.

---

### 1.12 — Platform Namespace

**Statement.** Reusable platform services shall reside under `services/platform/`.
Documentation shall reside under `docs/platform/`. Future platform capabilities shall
follow this structure by default.

**Enforcement.**
- Any new reusable service that provides cross-project value must be created inside
  `services/platform/<namespace>/`, not at the project root or inside a project
  directory.
- Corresponding documentation must be added to `docs/platform/`.
- Temporary scaffolding outside this namespace is permitted only for experimental
  services not yet adopted by a second project; adoption triggers migration.

---

## 2. Service Namespace Hierarchy

The following namespaces establish the long-term Hermes AI Platform architecture.
Services are implemented only as required by the current execution batch. Remaining
namespaces are scaffolded where necessary and reserved for future roadmap phases.

```
services/platform/
├── context/          # Context assembly, scoping, window management
├── execution/        # Workflow runner, action dispatcher, lifecycle hooks
├── intent/           # Intent resolution, goal decomposition, plan generation
├── memory/           # Persistent state, session store, cross-session recall
├── observability/    # Metrics, logging, tracing, audit trail
├── orchestration/    # Multi-agent coordination, task graph, dependency scheduling
├── permissions/      # Access control, capability grants, role resolution
├── policy/           # Rule engine, policy evaluation, circuit breakers
├── project-index/    # Repository metadata index, capability registry
├── registry/         # Service discovery, version catalog, dependency graph
├── shared/           # Common types, utilities, base classes
├── telemetry/        # Usage metrics, billing, cost attribution
└── workforce/        # Agent lifecycle, pool management, capability assignment
```

### 2.1 — Namespace Charter

Each namespace serves a single domain concern. Service-to-namespace mapping is
many-to-one: a namespace may contain multiple independent services.

| Namespace | Charter |
|-----------|---------|
| `context/` | Assemble, scope, and truncate execution context. No AI calls; deterministic assembly only. |
| `execution/` | Dispatch resolved actions, manage lifecycle callbacks, enforce timeouts. |
| `intent/` | Resolve free-form user intent into structured goals. May use AI (tier 4), but must first check intent cache (tier 2). |
| `memory/` | Store and retrieve persistent state across sessions. Deterministic CRUD; no side effects. |
| `observability/` | Collect and expose execution timing, decision paths, and outcomes (§1.9). |
| `orchestration/` | Coordinate multi-step, multi-agent workflows. Dependency graph must be deterministic (tier 1–2). |
| `permissions/` | Evaluate whether an actor may perform an action on a resource. Fail-closed by default. |
| `policy/` | Evaluate deterministic rule sets. The designated home for tier-1 logic. |
| `project-index/` | Cache repository metadata (structure, conventions, tags) for incremental context. |
| `registry/` | Maintain a catalog of all platform services and their interfaces. |
| `shared/` | Provide base classes, serialisation helpers, and common types used across namespaces. |
| `telemetry/` | Emit usage metrics for cost attribution, billing, and capacity planning. |
| `workforce/` | Manage agent pool, capability assignment, and lifecycle. |

---

## 3. Architecture & Interface Standards

### 3.1 — Interface Contract

Every service shall expose:

1. **A public function**, **event handler**, or **API endpoint** as its primary interface.
2. **A configuration schema** declaring all required and optional parameters with types and defaults.
3. **An observability envelope** fulfilling §1.9.

### 3.2 — Dependency Direction

- Services may depend on `shared/` and `policy/` freely.
- Services in `orchestration/` may call services in `context/`, `intent/`, `execution/`,
  and `project-index/`.
- Services in `execution/` may call services in `permissions/` and `policy/`.
- Services in `memory/` and `project-index/` must be leaf services (no platform-service
  dependencies).
- Circular dependencies between namespaces are prohibited.

### 3.3 — Configuration Injection

Platform services must accept all project- or deployment-specific values via explicit
configuration parameters. Configuration may be supplied as:

- Environment variables
- Configuration files (YAML/TOML/JSON)
- A `project-index` entry
- A policy document passed at invocation time

Hardcoded project names, repository URLs, or directory paths are prohibited.

---

## 4. Lifecycle Governance

### 4.1 — Service Maturity Model

| Stage | Criteria | Backward Compatibility |
|-------|----------|----------------------|
| **Experimental** | Single-project prototype; may be outside `services/platform/` | None guaranteed |
| **Stable** | Adopted by ≥2 projects; inside `services/platform/` | Full (§1.11) |
| **Deprecated** | Superseded; replacement announced | Read-only; no new adopters |
| **Retired** | Removed; consumers migrated | Removed from registry |

### 4.2 — Adoption Gate

A service reaches **Stable** status only when:

1. It has been adopted by at least two independent projects.
2. Its interface contract is documented.
3. It emits the mandatory observability fields.
4. It has passed a platform governance review.

---

## 5. Observability Contract

Every service execution must emit the following structure (JSON example):

```json
{
  "service": "intent.resolver",
  "operation": "resolve",
  "duration_ms": 142,
  "decision_path": ["rule", "cache", "ai"],
  "cache_hits": 1,
  "cache_misses": 0,
  "errors": [],
  "outcome": "success",
  "clarification_needed": false
}
```

Platform services may emit additional fields (e.g. `tokens_consumed`,
`repository_count`), but the mandatory envelope must always be present.

---

## 6. Deferred Backlog Process

When a developer or an autonomous agent encounters a desirable enhancement or feature
outside the current execution scope:

1. **Record** the idea in `docs/platform/deferred-backlog.md` with:
   - Description (one sentence)
   - Rationale (why it matters)
   - Proposed namespace (from §2)
   - Discovered during (ticket or session reference)
2. **Continue** the planned work without expanding scope.
3. The deferred item is reviewed at the next platform governance cycle.

Deferred items are **not** commitments; they are a structured capture mechanism to
prevent scope creep while preserving institutional knowledge.

---

## 7. Breach & Enforcement

### 7.1 — Conformance Levels

| Level | Meaning | Action |
|-------|---------|--------|
| ✅ Conformant | Full compliance | No action required |
| ⚠️ Warning | Minor deviation; fix recommended | Logged; fix within one release cycle |
| ❌ Violation | Principle breached | Blocked until remediated; reported to governance |
| 🚫 Critical | Fail-closed or no-assumptions breach | Immediate halt; root-cause analysis required |

### 7.2 — Automated Checks

Where practical, conformance checks shall be automated:
- **Namespace check**: Verify `services/platform/` placement for cross-project services.
- **Hardcode check**: Scan for hardcoded repository/project identifiers.
- **Observe check**: Verify mandatory observability fields are emitted.
- **Policy-first check**: Flag AI calls without a preceding deterministic tier.

### 7.3 — Escalation

Violations that could affect production safety, data integrity, or multi-tenant isolation
must be escalated to platform governance within one business day.

---

## 8. Success Criteria

The Hermes AI Platform shall be considered successfully established when:

| # | Criterion | Evidence |
|---|-----------|----------|
| 1 | **Reusable platform architecture** | At least one service under `services/platform/` adopted by ≥2 projects |
| 2 | **Standardised service hierarchy** | Namespace structure from §2 exists and is documented |
| 3 | **Project Knowledge Index** | A service in `project-index/` provides cached repository metadata |
| 4 | **Intent Engine** | A service in `intent/` resolves user intent into structured goals |
| 5 | **Architectural standards ratified** | This Constitution is adopted and enforced |
| 6 | **Scalable foundation** | At least three namespaces contain operational, tested services |
| 7 | **Observability baseline** | All platform services emit the mandatory observability envelope |
| 8 | **Roadmap discipline** | Deferred backlog exists and is used for out-of-scope enhancements |

---

## 9. Amendment Process

### 9.1 — Proposing an Amendment

Any platform contributor may propose an amendment by:

1. Opening a pull request against this document.
2. Adding a change record to the amendment log below.
3. Providing rationale and, where applicable, example code or migration guidance.

### 9.2 — Ratification

Amendments are adopted by **platform governance consensus**. A simple majority of
governance members is required; amendments affecting fail-closed or no-assumptions
principles (§1.3, §1.4) require a two-thirds supermajority.

### 9.3 — Amendment Log

| Date | Version | Author | Change |
|------|---------|--------|--------|
| 2026-07-25 | 1.0.0 | Hermes · Hermes AI Platform | Initial adoption |

---

*This Constitution is a living document. It evolves as the Hermes AI Platform grows,
but always with the discipline of backward compatibility, deterministic defaults, and
platform-first thinking. Every amendment preserves the principle that the platform is
the operating system — not a collection of project-specific hacks.*