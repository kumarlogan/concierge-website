# Hermes AI Platform — Deferred Backlog

> **Status:** Adopted · **Updated:** 2026-07-25
>
> Enhancement ideas discovered during execution that are outside the current
> implementation scope. Per Constitution §1.10 (Roadmap Discipline), these
> are recorded here and left for future roadmap phases.
>
> Deferred items are **not** commitments. They are a structured capture
> mechanism to prevent scope creep while preserving institutional knowledge.

---

## Intent Engine (namespace: `intent/`)

| # | Description | Rationale | Discovered During |
|---|-------------|-----------|-------------------|
| IE-001 | **Intent Cache** — memoise recent intent resolutions to reduce latency for repeated patterns | Improves performance for common request patterns | Intent Engine v1 |
| IE-002 | **Multi-request Batching** — compile a group of NL requests as a single batch | Improves throughput for planned/scripted work | Intent Engine v1 |
| IE-003 | **AI Fallback Training** — collect classification misses for model improvement | Improves classifier accuracy over time via feedback loop | Intent Engine v1 |
| IE-004 | **Confidence Threshold Config** — make classification confidence threshold configurable per deployment | Allows project-specific tuning of AI-fallback sensitivity | Intent Engine v1 |
| IE-005 | **Structured Prompt Templates** — provide a library of reusable prompt templates | Reduces authoring cost for common execution patterns | Intent Engine v1 |
| IE-006 | **Rate Limiting** — enforce per-source rate limits at the Intent Engine intake | Prevents accidental or abusive request floods | Intent Engine v1 |

## Project Knowledge Index (namespace: `project-index/`)

| # | Description | Rationale | Discovered During |
|---|-------------|-----------|-------------------|
| PKI-001 | **Dependency Graph** — index inter-repository dependencies | Supports cross-repo orchestration and impact analysis | PKI v1 |
| PKI-002 | **Auto-generation** — generate `project-index.yaml` from repo inspection when absent | Reduces manual setup cost for new repositories | PKI v1 |
| PKI-003 | **Diff-based Refresh** — git-aware partial refresh using diffs instead of HEAD hash | Faster incremental refresh for large repositories | PKI v1 |
| PKI-004 | **Remote Repository Support** — index repos not on local filesystem | Supports CI/CD and headless environments | PKI v1 |
| PKI-005 | **Convention-based Component Discovery** — auto-detect components from directory structure | Reduces maintenance burden on index files | PKI v1 |

## Platform Foundations (general)

| # | Description | Rationale | Discovered During |
|---|-------------|-----------|-------------------|
| PF-001 | **Shared Type Library** — move `platform/shared/types.py` into the `shared/` namespace (§2) | Follows the namespace charter; shared/ is a first-class namespace | Intent Engine v1 |
| PF-002 | **Automated Conformance Checks** — implement the automated checks from Constitution §7.2 | Enforce platform compliance without manual review | Intent Engine v1 |
| PF-003 | **Platform CLI** — provide a hermetic CLI for platform-service operations | Simplifies testing and debugging of platform services | Intent Engine v1 |
| PF-004 | **Integration Test Suite** — add integration tests for Intent Engine → PKI pipeline | Ensures end-to-end correctness across service boundaries | Intent Engine v1 |

---

*To add an item: append to the appropriate table with a unique ID, description, rationale, and the ticket/session where it was discovered.*