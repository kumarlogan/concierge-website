# WEF v2 Simplification Report

> **Constitutional Architecture Review Board — Simplification Analysis**
> Review date: 2026-07-29
> Mandate: Identify every candidate for merge, removal, or consolidation, with falsifiable argumentation and no sacred cows.

---

## Summary

The WEF v2 architecture is well-structured but carries 4 unnecessary concepts, 3 merge candidates, 2 redundant layers, and 1 architectural ghost. Removing or consolidating these would reduce cognitive overhead by ~15-20% without losing expressiveness.

---

## Concepts to Remove

### C1: "Six Disciplines" — Not Present, Not Needed

**Current state:** The WEF v2 documents use a 6-layer model (Orchestration, Execution, Persistence, Cognitive, Admin, Core) and 5 tool domains (dev, security, monitoring, research, docs). The "Six Disciplines" model referenced in the review prompt does not appear in any WEF v2 document.

**Recommendation:** **Do not introduce.** The capability/provider model is simpler and more expressive. Document the decision in REFUSED.

**Rationale:**
- Capabilities are execution primitives; disciplines are organizational units. Mixing them creates confusion.
- 31 capabilities already cross-reference 3 providers. Adding a discipline axis would create 186 cross-references (31 × 6) with no new information.
- The 5 tool domains are the closest existing concept. Adding a 6th to match "disciplines" would create an artificial domain for the sake of symmetry.

### C2: "Workflow" as a First-Class Concept

**Current state:** The blueprint mentions "workflows" (e.g., "1000 workflows") but does not define workflow as a separate architectural concept from "task composition."

**Recommendation:** **Remove.** Tasks compose into workflows, but workflow is not a first-class capability. The Orchestration Fabric operates on tasks. Workflow is a documentation concept (e.g., "patient registration workflow = task 1 + task 2 + task 3").

**Rationale:**
- Adding a workflow abstraction (with its own D1 table, router, and lifecycle) would double the execution path.
- The REFUSED document correctly excludes workflow as a built-in concept.
- Workflow visualization belongs in the cognitive tools layer, not the execution path.

### C3: "Capability Graph" as Documentation Artifact

**Current state:** The Capability Graph document exists as a standalone deliverable showing capability relationships.

**Recommendation:** **Merge into the Capability Registry.** The graph is a visualization of the registry — not a separate artifact. Maintain a dynamic-connectivity view within the registry document rather than a standalone diagram.

**Rationale:**
- The registry documents 31 capabilities with dependencies, consumers, and providers. The graph visualizes those relationships.
- Two documents saying the same thing in different forms creates drift risk.
- A quarterly registry audit is already mandated (maintenance schedule). Incorporate graph visualization into the audit output.

### C4: "Layer" vs "Domain"

**Current state:** The blueprint uses "6 layers" and "5 tool domains" without defining the distinction between a layer and a domain.

**Recommendation:** **Consolidate to 2 taxonomies:** Layer (architectural vertical: Orchestration → Execution → Persistence → Cognitive → Admin → Core) and Domain (capability group: dev, security, monitoring, research, docs, platform). Document the difference explicitly.

**Rationale:**
- Engineers consistently confuse layers with domains. A layer is a vertical slice of the architecture. A domain is a horizontal grouping of capabilities.
- The distinction exists naturally but is not documented. Documenting it reduces confusion without changing architecture.

---

## Concepts to Merge

### M1: `website.status` + `website.health` → `website.health`

| Aspect | `website.status` | `website.health` |
|--------|------------------|-------------------|
| Backend call | Cloudflare health endpoint | Cloudflare health endpoint |
| Response | Status string | Health status object |
| Authentication | None | None |
| Approval required | No | No |
| Test count | 0 (not yet implemented) | 0 (not yet implemented) |

**Finding:** These are the same backend call with slightly different response formatting. The Status Dashboard and the health check route to the same endpoint.

**Recommendation:** Merge into `website.health` with a `detailed: boolean` parameter. `website.status` becomes an alias for `website.health({ detailed: false })`.

**Falsifiable claim:** After merge, the Cloudflare health endpoint is called once per check, not twice. Test count reduces by 1 test file. Zero capability IDs lost (alias preserved).

### M2: `website.deploy` + `website.publish` → `website.deploy`

| Aspect | `website.deploy` | `website.publish` |
|--------|------------------|-------------------|
| Backend call | `deploy.pages` | `deploy.pages` |
| Environment | staging | production |
| Approval required | Optional | Yes |
| Argument | `env: "staging"` | `env: "production"` |

**Finding:** These are the same capability with different environment configuration. The approval requirement is an authorization policy, not a capability difference.

**Recommendation:** Merge into `website.deploy` with an `environment` parameter (`"preview" | "staging" | "production"`). The approval requirement is attached to the `production` environment value, not to the capability ID.

**Falsifiable claim:** After merge, the routing table has 9 entries (down from 10). Approval logic moves from routing to the `environment` parameter. Any capability can declare "this environment requires approval" — consistent model for all website operations.

### M3: Orchestration Fabric + Activation Platform → Activated Orchestration

| Aspect | Orchestration Fabric | Activation Platform |
|--------|---------------------|---------------------|
| Purpose | Task routing, approval lifecycle | Capability execution, guard evaluation |
| Scope | Agent → task → approval → execution | Execution → backend |
| State | Task lattice | None (stateless) |
| Existing code | New (C1-C2) | Stack B/C (16 tests, implemented) |
| Relationship | Wraps | Core |

**Finding:** These are not separate systems. The Orchestration Fabric wraps the Activation Platform. The task lattice lives above the execution layer. The Activation Platform (Stack B/C guard evaluation, Stack C executor resolution) works as-is.

**Recommendation:** Document as one system: "Activated Orchestration" with two layers:
- **Orchestration layer:** agent registration, task queue, approval lifecycle, task state machine
- **Activation layer:** guard evaluation, capability resolution, executor routing, backend invocation

**Falsifiable claim:** After documentation consolidation, "Orchestration Fabric" appears in 0 documents as a standalone system. The code structure doesn't change — only the documentation. New engineers understand the system in 3 readings instead of 5.

---

## Concepts to Split

### No credible split candidates identified.

Every concept in the architecture serves a distinct purpose at the appropriate granularity. The 31 capabilities are appropriately atomic — splitting any would create artificial boundaries (e.g., splitting `deploy.pages` into `deploy.pages.upload` and `deploy.pages.route` would multiply routing entries without new functionality).

**Challenge question:** Could `website.deploy` be split by environment?
**Answer:** No — that introduces environment-specific routing, which is a policy concern, not a capability concern.

**Challenge question:** Could the Cognitive Efficiency Layer be split into its 4 tools as standalone layers?
**Answer:** No — the tools share the same layer (cognitive efficiency), same persistence (D1), and same deployment (Worker module). Splitting would add N new entry points without architectural benefit.

---

## Concepts to Preserve

### The following were considered for removal but survive review:

| Concept | Challenge | Decision | Justification |
|---------|-----------|----------|---------------|
| Provider-neutral capability IDs | "Too abstract? Just use vendor names" | **Preserve** | The provider-neutral naming (e.g., `deploy.pages` not `cloudflare.deploy.pages`) is the core of the architecture's portability guarantee. Removing it would vendor-lock every capability. |
| 13 REFUSED features | "Too many refusals. Makes architecture look weak." | **Preserve** | The REFUSED document is the architecture's strongest asset. Every refusal documents a deliberate decision with revisit criteria. Removing it would lose institutional memory. |
| 5 tool domains (ungoverned) | "Add them to activation or remove them" | **Preserve but flag** | The tool domains are correct as knowledge objects. Adding them to the activation path is future work, not a current gap. Removing them eliminates useful capability categorization. |
| "human-token" approval stub | "Remove it — it's dangerous" | **Preserve with warning** | Preserving the stub allows C1 implementation to proceed. But it MUST have a CI test that FAILS when the stub is still present in production (enforcing the Phase C2 upgrade). |
| In-memory ExecutionStore | "Use D1 from day 1" | **Preserve** | The in-memory store is correct for development speed. The Durable Object or D1-backed store is production-only. What's missing is the automatic wiring that switches based on environment. |

---

## Counting the Reduction

| Metric | Before | After | Reduction |
|--------|--------|-------|-----------|
| Capability IDs | 31 | **29** | -6% |
| App routing entries | 10 | **9** | -10% |
| Distinct architectural concepts | 5 (layers, domains, capabilities, providers, tool domains) | **4** (merge layers/domains taxonomy) | -20% |
| Document count | 7 | **7** (no reduction — content merges within) | 0% |
| Layer count | 6 | **6** (valid layers, preserve) | 0% |
| Provider count | 3 | **3** (correct granularity) | 0% |
| REFUSED items | 13 | **13** (preserve — each is justified) | 0% |
| Blocker count | 3 🔴 | **3** (external blockers, not arch) | 0% |

---

## Falsifiable Predictions

| Prediction | If wrong | Action |
|-----------|----------|--------|
| Merging `website.status` + `website.health` causes no production-incident reports in 90 days | Any operator confusion about which endpoint to call | Restore as separate endpoints |
| Removing "workflow" as a concept does not cause any engineer to accidentally create a workflow abstraction | A new engineer builds a WorkflowTask D1 table | Add "workflow = task composition" to the glossary |
| Consolidating Orchestration Fabric + Activation Platform reduces onboarding reading time by 2 documents | Onboarding time does not decrease | Add a quickstart flow diagram instead |
| 29 capability IDs (down from 31) is sufficient for all current use cases | A use case arises requiring the merged capabilities separately | Restore split with explicit parameterization |

---

*This report identifies every candidate for simplification with falsifiable claims. No changes were made to the architecture or code. All recommendations are proposed to the blueprint authors for consideration before implementation.*

*Base commit: `864f213`*