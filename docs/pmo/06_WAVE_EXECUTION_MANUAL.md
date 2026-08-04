# Volume 06: Wave Execution Manual

> **Version:** 1.0 | **Date:** 2026-08-03
> **Authority:** PMO — Breaking remaining work into execution waves
> **Status:** ⚡ RATIFIED — Implementation agents execute exactly one wave per session

---

## 1. Execution Wave Structure

Each wave follows this mandatory structure:

```
Wave N: [Title]
├── Objectives
├── Scope
├── Dependencies
├── Files Affected
├── Required Tests
├── Documentation Updates
├── Deployment Steps
├── Rollback Plan
├── Acceptance Criteria
├── Evidence Required
└── Definition of Done
```

**Implementation agents MUST complete every sub-item before marking a wave complete.**

---

## 2. Wave Inventory

| Wave | Title | Priority | Status | Dependencies |
|------|-------|----------|--------|-------------|
| **Wave 10** | Activation & Production Readiness | P0 | ✅ Ready | None |
| **Wave 11** | D1 Backend Activation | P1 | ✅ Ready | Wave 10 |
| **Wave 12** | Runtime Guard Integration | P2 | ✅ Ready | Wave 11 |
| **Wave 13** | Memory Service Implementation | P2 | ✅ Ready | None |
| **Wave 14** | In-Memory Engine Migration | P2 | ✅ Ready | Wave 11 |
| **Wave 15** | Phase 3 Planning | Pre-3 | 📋 Future | All prior waves |

---

## 3. Wave 10: Activation & Production Readiness

### Objectives
1. Refresh Cloudflare API token (blocker)
2. Verify all deployments work
3. Run full test suite and certify pass rate
4. Tag current state as production baseline
5. Verify CI/CD pipeline end-to-end

### Scope
Operations and verification only — no code changes beyond configuration.

### Dependencies
- Human approval to perform production verification

### Files Affected
- `.github/workflows/deploy.yml` (verify — no changes unless needed)
- `wrangler.toml` (verify bindings)

### Required Tests
- ✅ Full suite: `pnpm run typecheck && pnpm run test`
- ✅ Secret scan: `gitleaks detect`
- ✅ Build: `pnpm run build`

### Documentation Updates
- `docs/operations/DEPLOYMENT.md` — Update with latest token rotation info
- `CHANGELOG.md` — Record baseline snapshot

### Deployment Steps
1. Generate new 100-char Cloudflare token via Cloudflare dashboard
2. Update GitHub secret `CLOUDFLARE_API_TOKEN`
3. Verify: `wrangler whoami` returns valid auth
4. Trigger CI/CD: push to main
5. Verify preview deployment succeeds
6. Verify production deployment succeeds (with human approval)

### Rollback Plan
If deployment fails:
1. Revert commit if code changes were made
2. Restore previous token if rotation failed
3. Re-run CI/CD on last known-good commit

### Acceptance Criteria
- `wrangler deploy` succeeds for both preview and production
- CI/CD pipeline completes successfully
- All 614+ tests pass
- Secret scan reports zero findings
- TypeScript compilation clean

### Evidence Required
- CI/CD run log (link)
- Test run output
- Secret scan output
- Deployment verification (health endpoint)

### Definition of Done
All acceptance criteria met. Evidence logged to this wave's completion report.

---

## 4. Wave 11: D1 Backend Activation

### Objectives
1. Wire the D1 workflow backend as production default
2. Maintain memory backend as fallback
3. Verify all 31 persistence tests pass with D1
4. Verify graceful degradation on D1 unavailable

### Scope
`hermes/persistence/` and `workers/src/platform/was/` wiring only.

### Dependencies
- Wave 10 complete (token valid, CI/CD working)

### Files Affected
- `hermes/persistence/execution-store.ts` — Wire D1 backend
- `hermes/services/workforce/persistence.ts` — Update backend selection
- `workers/wrangler.toml` — Verify D1 binding exists
- `workers/src/platform/was/was-persistence.ts` — Verify connection

### Required Tests
- 31 workforce persistence tests (`workforce-persistence.test.ts`) must pass
- New integration test: "D1 backend survives worker restart"
- New test: "Graceful degradation on D1 timeout"

### Documentation Updates
- `ARCHITECTURE.md` — Update D1 status from "configured, unused" to "active"
- `FOUNDATION_v1_RELEASE_NOTES.md` — Update deferred item status

### Deployment Steps
1. Implement backend wiring
2. Test with Miniflare D1 (integration tests)
3. Typecheck + full test suite
4. Deploy to preview, verify persistence
5. Human approval for production

### Rollback Plan
Revert to memory backend via config toggle:
```typescript
const backend = process.env.D1_ENABLED ? new D1WorkflowBackend() : new MemoryWorkflowBackend()
```

### Acceptance Criteria
- All 31 persistence tests pass with D1 backend
- Graceful fallback to memory on D1 unavailability
- Data survives Worker restart (verified)
- Existing 614 tests still pass

### Evidence Required
- Test output showing 31/31 D1 persistence tests pass
- Integration test proving data survival
- CI/CD green run

### Definition of Done
D1 backend active in production. Memory fallback works. All tests pass.

---

## 5. Wave 12: Runtime Guard Integration

### Objectives
1. Wire the 8-dimension Provider Runtime Guard into the Execution Gateway
2. Verify all guard dimensions enforced during execution
3. Verify audit events emitted for each guard check

### Scope
`hermes/services/providers/runtime/` → `hermes/services/execution/` wiring.

### Dependencies
- Wave 11 complete

### Files Affected
- `hermes/services/providers/runtime/guard.ts` — No changes (verify)
- `hermes/services/execution/` — Wire guard into gateway
- `hermes/services/providers/runtime/index.ts` — Export guard
- Tests: New integration tests

### Acceptance Criteria
- All 8 guard dimensions enforced
- Graceful degradation when guard unavailable
- Audit events emitted per guard check
- Existing test suite passes

---

## 6. Wave 13: Memory Service Implementation

### Objectives
1. Replace Memory Service stub with full implementation
2. Structure knowledge capture beyond audit events
3. Support cross-session knowledge retrieval

### Scope
New `hermes/services/memory/` service module.

### Dependencies
None.

### Acceptance Criteria
- Store and retrieve structured knowledge
- Versioned knowledge entries
- Integration with audit framework
- Existing test suite passes

---

## 7. Wave 14: In-Memory Engine Migration

### Objectives
1. Replace `InMemoryAppointmentEngine` with D1-backed version
2. Replace `InMemoryMessageEngine` with D1-backed version
3. Maintain in-memory as fallback

### Dependencies
- Wave 11 complete (D1 backend active)

### Files Affected
- `workers/src/platform/appointments/in-memory-appointment-engine.ts`
- `workers/src/platform/messaging/in-memory-message-engine.ts`
- New D1-backed implementations
- Test files

---

## 8. Wave 15: Phase 3 Planning

### Objectives
1. Produce Phase 3 Architecture ADR
2. Define Phase 3 scope boundaries
3. Estimate effort for each Phase 3 wave
4. Identify risks and dependencies

### Deliverable
ADR documenting Phase 3 scope, architecture, and execution plan.

---

## 9. Execution Tracker

| Wave | Status | Start | End | Tests | Doc Updated | Deployed |
|------|--------|-------|-----|-------|-------------|----------|
| Wave 10 | Ready | — | — | — | — | — |
| Wave 11 | Ready | — | — | — | — | — |
| Wave 12 | Ready | — | — | — | — | — |
| Wave 13 | Ready | — | — | — | — | — |
| Wave 14 | Ready | — | — | — | — | — |
| Wave 15 | Planned | — | — | — | — | — |

---

## 10. Wave Execution Protocol

Every execution agent MUST:

1. **Load this manual** — Read Volume 06 before starting
2. **Load Volume 05** — Read the implementation specification
3. **Load Volume 02** — Understand current state
4. **Load relevant skills** — From skill registry
5. **Execute exactly one wave** — Do not expand scope
6. **Test fully** — No skipped tests
7. **Update docs** — In same branch as code
8. **Commit and push** — Open PR for review
9. **Await human approval** — Do not self-approve

---

*End of Volume 06*