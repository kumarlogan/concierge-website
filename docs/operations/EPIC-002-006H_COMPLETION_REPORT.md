# EPIC-002-006H — Governance and Closeout (Phase 7)

**Status:** ✅ Complete (governance closeout; Phase 1–6 foundations implemented and verified)
**Date:** 2026-07-19
**Parent epic lineage:** EPIC-002-006A → 006B → 006C → 006D → 006E → 006F → 006G → **006H**
**Author:** Hermes (Platform Continuation — Phase 7 Governance)
**Scope:** Documentation + governance closeout only. No scope expansion.

---

## 1. Objective

Finalize EPIC-002-006H (the Hermes Platform foundation-strengthening epic) by:

1. Reviewing whether a new ADR is required.
2. Producing the final completion + validation documentation.
3. Validating the final EPIC state against the six required foundations.
4. Running final validation evidence (tests, typecheck, secret scan, import boundary, tree status).
5. Creating reversible logical commits and reporting exact SHAs.

This epic does **not** introduce new production behavior beyond the six foundations already
implemented in Phases 1–6 (carried in the working tree at closeout start). Phase 7 is
governance-only.

---

## 2. Phase 1–6 Foundation Recap (already implemented, verified here)

| Phase | Foundation | Key deliverable |
|-------|-----------|-----------------|
| 1 | Authentication Provider Foundation | `hermes/identity/authn.ts` — Authenticator contract, session lifecycle, provider-neutral registry (Google/GitHub/Microsoft/hardware-key stubs, fail-closed). |
| 2 | Hermes Memory Foundation | `hermes/services/memory/architecture.ts` — scoped memory with `expiresAt` correctly calculated as `Date.now() + duration`; restricted-org + cross-app isolation enforced. |
| 3 | First Real Tool Capability | `hermes/services/tools/{tools-real,local-sandbox-backend,local-security-backend}.ts` — real local-sandbox + local-security backends; `tool:code.local-sandbox`, `tool:security.local-scanner` registered. |
| 4 | MCP Compatibility Layer | `hermes/services/mcp/` — `listHermesToolsAsMcp`, `mcpToolToHermesProvider`, `handleMcpToolCall`; Hermes tools exposed as MCP specs without vendor coupling. |
| 5 | Hermes Observability Layer | `hermes/admin/observability.ts` — `buildHealthDashboard` permission-gated (fail-closed), reports all-agents-disabled posture. |
| 6 | Security Hardening | `workers/tests/hermes.006h.security-hardening.test.ts` (16 tests) proving fail-closed posture across auth, memory, agents, tools, MCP. |

### Phase 6 fixes already completed (per continuation context)
1. **Memory expiration bug fixed** — `expiresAt` now correctly computes `Date.now() + duration`.
2. **Tool registry expanded** — capability assertions updated to reflect real backends:
   `tool:code.local-sandbox`, `tool:security.local-scanner`.

---

## 3. ADR Decision (Task 1)

**Decision: A NEW ADR (ADR-014) IS NOT REQUIRED.**

### Rationale
The architectural *decisions* underlying EPIC-002-006H were already recorded in existing ADRs:

| 006H foundation | Covered by |
|-----------------|-----------|
| Authentication provider foundation (provider neutrality, fail-closed) | ADR-012 (internal-only facade, permission-aware access, provider abstraction), ADR-013 (BFF receives verified human principal, never constructs one) |
| Memory foundation (scoped, isolated) | ADR-006 (Resource Registry / isolation), ADR-002 (multi-agent memory boundaries), reinforced in 006D/006G |
| Tool capability foundation (provider-neutral, real backends) | ADR-012 (provider-abstracted `ToolProvider`), ADR-013 (vendor-neutral capability model) |
| MCP compatibility boundary | ADR-012/013 (provider abstraction to avoid vendor lock-in) — MCP is one more provider behind `ToolProvider` |
| Observability foundation (fail-closed dashboard) | ADR-013 (six-domain IA, audit-read gating) |
| Security hardening (fail-closed posture) | ADR-001/003 (Zero Trust, least privilege), ADR-002 (agent-disabled-by-default) |

EPIC-002-006H **implements and hardens** already-ratified decisions; it does **not** introduce a
new architectural choice that lacks coverage. Per ADR governance (Roadmap §13: "every
architectural decision is recorded… before implementation"), no new decision was made in 006H that
is not already on record. The 006G addendum to ADR-013 already captured the runtime-boundary
decisions (verified-principal, non-autonomous workflow, MCP-ready adapter) that 006H builds upon.

**Conclusion:** Document the coverage (above) rather than author ADR-014. If a *new* decision
arises in a future epic (e.g. wiring a concrete MCP server or identity provider), that epic should
author its own ADR.

---

## 4. Final EPIC State Validation (Task 3)

| Required foundation | Status | Evidence |
|---------------------|--------|----------|
| ✅ Authentication provider foundation | Complete | `hermes/identity/authn.ts`; `createSession`/`validateSession` fail-closed; 006H auth tests pass |
| ✅ Memory foundation | Complete | `hermes/services/memory/architecture.ts`; expiration bug fixed; isolation tests pass |
| ✅ Tool capability foundation | Complete | `tools-real.ts` + local backends; registry expanded; phase3-4 tests updated |
| ✅ MCP compatibility boundary | Complete | `hermes/services/mcp/`; round-trip + fail-closed tests pass |
| ✅ Observability foundation | Complete | `hermes/admin/observability.ts`; permission-gated; posture test passes |
| ✅ Security hardening | Complete | 16 new 006H security tests; full suite 255/255 |

---

## 5. Commit Strategy (Task 4)

Per commit requirements:
- **Reversible logical commits** — each commit is independently revertable.
- **No `git add -A`** — files staged explicitly by logical group.
- **Exact SHAs reported** (see §7 of the validation report and the final summary).
- **Excluded from this epic:** two pre-existing working-tree modifications to AGS Fertility
  business code (`lib/db/src/schema/consultations.ts`,
  `artifacts/api-server/src/routes/consultations.ts`) are **out of 006H scope** and **flagged**
  for separate human review (see §9 Stop-Rule flags). They are NOT committed as part of 006H.

---

## 6. Stop-Rule Compliance

| Stop condition | Triggered? | Notes |
|---------------|-----------|-------|
| Architecture conflicts appear | No | All 006H modules import only contracts/types; boundaries preserved. |
| Security risk appears | No | Fail-closed posture verified by 16 new tests; no secrets in tree. |
| Production-impacting changes required | No | 006H is in-tree platform code, not deployed; no endpoint/schema/migration change. |
| Scope needs expansion | No | Phase 7 is governance-only; no new feature work. |

---

## 7. Files Created / Modified by EPIC-002-006H

### New files (untracked at closeout start)
- `hermes/identity/authn.ts`
- `hermes/services/memory/architecture.ts`
- `hermes/services/mcp/` (adapter + index)
- `hermes/services/tools/tools-real.ts`
- `hermes/services/tools/local-sandbox-backend.ts`
- `hermes/services/tools/local-security-backend.ts`
- `hermes/admin/observability.ts`
- `hermes/admin/console/{bff-client,render,session,tool-adapter,workflow}.ts`
- `workers/tests/{console.render.boundary,console.session,console.tool-adapter,console.workflow,hermes.006h.security-hardening}.test.ts`

### Modified files (tracked, 006H-scoped)
- `hermes/admin/bff.ts`, `hermes/admin/console/{app,permissions}.ts`, `hermes/admin/ui-contracts.ts`
- `hermes/services/tools/{dev-tools,index,security-tools}.ts`
- `workers/tests/hermes.tools.phase3-4.test.ts`
- `docs/adr/ADR-013-admin-bff-workforce-foundations.md` (addendum pointer)

### Excluded (flagged, NOT part of 006H)
- `lib/db/src/schema/consultations.ts` — AGS Fertility schema change
- `artifacts/api-server/src/routes/consultations.ts` — AGS Fertility route change

---

## 8. Remaining Limitations

- **AGS Fertility isolation verified but untouched** — no 006H code path reaches AGS business
  modules (import-boundary check clean).
- **Auth providers are stubs** — Google/GitHub/Microsoft/hardware-key authenticators are
  registered but unconfigured (fail-closed by design); wiring real IdP secrets is a deployment
  step, not a code change.
- **Session store is in-memory** — a durable backend (D1/KV) hooks in via `setSessionStore`
  without call-site changes; not attached in 006H (no D1/migration change per constraints).
- **MCP server not yet wired** — the compatibility layer is complete and tested; dropping in a
  concrete MCP server is a future, separately-ADR'd step.
- **Pre-existing tsc looseness** in committed test files (`integration/api.test.ts`,
  `globalSetup.ts`, `hermes.isolation.phase8`, `hermes.services.smoke`, `hermes.tools.phase3-4`)
  is unrelated to 006H and not introduced by it (006H's own modules type-clean).

---

## 9. Recommendation for Next Hermes Platform Review

The platform foundation is complete and locked by tests. The next review should consider:

1. **Wiring a concrete identity provider** (Telegram gateway auth already exists; add one
   interactive IdP as a config drop-in) — author **ADR-014** at that point if the integration
   choice is non-trivial.
2. **Durable session store** (D1/KV) behind the existing `setSessionStore` hook.
3. **Concrete MCP server integration** behind `ToolProvider` (no console change required).
4. **Resolve the flagged AGS Fertility working-tree modifications** (`consultations` schema +
   route) in a separate, AGS-scoped change with its own review — they do not belong to 006H.
5. **Address pre-existing test typecheck looseness** in a dedicated tech-debt epic (not 006H).

---

*EPIC-002-006H is complete. No new epic is started. This document is documentation/governance-only
for Phase 7; the Phase 1–6 implementation it closes out was already present in the working tree and
is committed via the reversible logical commits recorded in the validation report.*
