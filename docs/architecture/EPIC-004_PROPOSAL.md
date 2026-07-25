# EPIC-004 PROPOSAL

**Document type:** Design proposal ONLY — no implementation. (Phase 4 of EPIC-003-006 closeout)
**Date:** 2026-07-20
**Guiding principle:** *"Should Hermes OWN this capability, or should Hermes CONTROL this capability?"*

Hermes should **own** capabilities that are core to its trust/audit/multi-tenant
guarantees (the boundaries it must never delegate), and **control** (via the
provider seam) capabilities that are inherently external (deployment, remote tools).

---

## 1. Context

EPIC-003-006 established the *contracts* for identity, agent runtime, audit, and
provider loading — all in-memory, all unenforced at the API edge. The PHASE 2
review and PHASE 3 debt inventory show the dominant gap is **durability +
enforcement**, not new features. EPIC-004 should close that gap before adding
surface area.

---

## 2. Candidate Directions

### Option A — Deployment Operations Agent
- **Scope:** GitHub (PR/CI status, branch ops), Cloudflare (Worker deploy, DNS,
  KV/D1), CI/CD diagnosis, environment validation.
- **Own vs Control:** Hermes should **CONTROL** deployment, not own it. Deployment
  is an external provider action — it fits the existing `ProviderBundle` /
  `CapabilityRegistry` seam (Cloudflare is already a first-class provider).
- **Pros:** high user value; reuses provider seam; Cloudflare adapter exists.
- **Cons:** deployment state lives outside Hermes; owning it duplicates provider
  logic; risk of conflating "deploy" with "operate".
- **Fit:** Important, but should be delivered as *controlled capabilities*, not a
  core Hermes subsystem. Lower priority for V1.

### Option B — MCP / External Capability Platform
- **Scope:** dynamic provider loading, remote providers, external tools via MCP.
- **Own vs Control:** Hermes should **OWN the registry/loader contract** (already
  done in M5) and **CONTROL** remote providers through it. MCP is a *transport*,
  not a Hermes-owned concern.
- **Pros:** extends "what can run here" to remote/MCP tools; leverages M5 seam;
  vendor-neutral.
- **Cons:** needs capability bootstrap (A3) + typed `CapabilityHandler` (B6)
  first; remote execution adds latency/trust surface.
- **Fit:** Natural evolution of M5. Depends on A3/B6. Good V1.x candidate once
  durability exists.

### Option C — Persistent Operations Platform
- **Scope:** durable audit (D1 `AuditStore`), durable workflow/agent state
  (D1 registries), memory/state persistence across deploys.
- **Own vs Control:** Hermes must **OWN** this. Audit integrity, tenant isolation,
  and workflow durability are the core trust guarantees — they cannot be delegated
  to an external system without losing the platform's reason to exist.
- **Pros:** closes A1/A3; makes every other epic real (audit survives restart,
  workflows resume, agents persist); directly unblocks multi-deploy production use.
- **Cons:** D1 schema + migration work; requires careful idempotency.
- **Fit:** Highest leverage. Turns today's correct *contracts* into correct
  *runtime behavior*. This is the V1 completion epic.

---

## 3. Recommendation

**Primary: Option C (Persistent Operations Platform) as EPIC-004.**

Rationale (against the guiding principle):
- The single biggest gap (PHASE 2 §6 maturity 0.65) is that all trust boundaries
  are in-memory. Owning durable audit + state is non-delegable — Hermes MUST own it.
- Options A and B are *control* problems that the existing provider seam (M5)
  already addresses structurally; they can be delivered as controlled capabilities
  on top of C, but they should not precede C.
- C has the highest leverage-to-risk ratio: interfaces are already designed
  (AuditStore, CapabilityRegistry, agent/workflow registries), so EPIC-004 is
  mostly *implementation behind stable interfaces*, not new architecture.

**Sequencing:**
1. **EPIC-004 (C):** D1 `AuditStore` + durable agent/workflow registries + wire
   `withinTenantScope` into mutators (A2) + capability bootstrap (A3) + activation
   authz (A4) + Authorizer impl (A5). This is the V1 completion epic.
2. **EPIC-004.x (B):** close Category B debt — test-file types (B2), dual
   AuditEvent (B3), unused audit fields (B4), `Capability.impl` typing (B6),
   scope env check (B7).
3. **EPIC-005 (B — MCP/External Capabilities):** remote/MCP loader on top of the
   now-durable, bootstrapped capability registry. (Option B.)
4. **EPIC-006 (A — Deployment Operations, controlled):** GitHub/Cloudflare
   deployment capabilities *controlled* through the provider seam. (Option A.)

This sequencing honors "own the trust boundaries first, control the rest through
the seam."

---

## 4. EPIC-004 (Option C) — Proposed Shape (design only)

### 4.1 Durable Audit
- New `hermes/audit/store.d1.ts` implementing `AuditStore` against D1
  (`INSERT`, `SELECT` with the existing `AuditQuery` filter shape).
- `defaultAuditStore` swaps to D1 in production, Memory in dev/test (env-driven).
- `emitAudit` populates `category`/`decision` (closes B4).

### 4.2 Durable Agent & Workflow State
- `D1AgentRegistry` behind the existing `REGISTRY` interface; `setState` persists.
- `D1WorkflowStore` behind the execution queue's in-memory store.
- Idempotent writes; resume on startup.

### 4.3 Edge Enforcement
- `withinTenantScope` called inside registry/lifecycle/agent mutators (A2).
- `activateAgent` gated by authorized `Principal` (A4).
- `Authorizer` implemented; all checks routed through it (A5).

### 4.4 Capability Bootstrap
- Startup loads Cloudflare `ProviderBundle` manifest into `defaultCapabilityRegistry`
  (A3); `Capability.impl` typed via `CapabilityHandler` (B6).

### 4.5 Out of scope for EPIC-004
- MCP/remote providers (→ EPIC-005)
- Deployment agent (→ EPIC-006)
- api-server port (→ tracked under B1, separate change)

---

## 5. Open Questions (for user decision before EPIC-004 kickoff)
1. Is D1 the right durable store, or should Hermes support a pluggable
   `StateStore` (D1 + future Postgres)? (Recommend: D1 now, interface-ready.)
2. Should audit be **durable + synchronous** (block on insert) or **durable +
   async** (queue + flush)? (Recommend: async/non-blocking to preserve M3's
   non-blocking guarantee; D1 write in a waitUntil.)
3. Approval records — persist in EPIC-004 (C5) or defer to V2? (Recommend: persist
   lightweight approval records as part of durable audit.)
4. Confirm EPIC-004 = Option C primary, with A/B as later controlled epics.

---

## 6. Decision Required
This document is a **proposal**. EPIC-004 implementation MUST NOT begin without
explicit user approval of: (a) Option C as primary, (b) the sequencing above,
(c) the open-question answers.
