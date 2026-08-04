# Volume 05: Implementation Specification

> **Version:** 1.0 | **Date:** 2026-08-03
> **Authority:** PMO — Detailed implementation specifications for remaining capabilities
> **Status:** ⚡ RATIFIED — Implementation agents follow these specs

---

## 1. Scope

This volume defines implementation specifications for:
1. **Production readiness items** — Items where architecture exists but D1 backend or wiring is incomplete
2. **Deferred backlog** — Items deferred from foundation v1.0 that need activation
3. **Phase 3 planning** — Work that must occur before Phase 3 execution begins

**Does NOT include:**
- Completed capabilities (Phases 0-2)
- Phase 4 (not yet planned)

---

## 2. Specification Format

Every specification follows this structure:

```
## SPEC-XYZ: [Capability Name]
- Priority: [P0/P1/P2]
- Dependencies: [Required preconditions]
- Status: [Architecture/Implementation/Deferred]

### Specification
[Detailed spec — what to build]

### Interfaces
[Exact interfaces/types to implement]

### Acceptance Criteria
[Measurable verification conditions]

### Files Affected
[Exact file paths]

### Tests Required
[Test scenarios to cover]
```

---

## 3. Immediate Activation Items

### SPEC-001: D1 Workflow Backend Activation

**Priority:** P1 (foundation readiness)
**Dependencies:** SPEC-002 (Secret Refresh)
**Status:** Architecture complete, D1 schema exists, not wired

#### Specification
Activate the D1-based workflow persistence backend for Hermes workforce operations. Currently, the system uses `MemoryWorkflowBackend` as the default. Replace with `D1WorkflowBackend` to provide durable persistence across Worker restarts.

The `D1WorkflowStore` schema already exists in migration `0005_workforce_persistence.sql` with 9 workforce tables (`workforce_agents`, `agent_activation_requests`, `agent_audit_events`, `workforce_metrics`, `workflows`, plus workflow engine tables from 0010).

#### Interfaces
```typescript
// Existing interface — do not change
interface WorkforceRepository {
  getAgent(agentId: string): Promise<AgentState | null>
  listAgents(filter?: AgentFilter): Promise<AgentState[]>
  saveAgent(agent: AgentState): Promise<void>
  getActivationRequest(requestId: string): Promise<ActivationRequest | null>
  listActivationRequests(filter?: ActivationFilter): Promise<ActivationRequest[]>
  saveActivationRequest(request: ActivationRequest): Promise<void>
  getAuditEvent(eventId: string): Promise<AuditEvent | null>
  listAuditEvents(filter?: AuditFilter): Promise<AuditEvent[]>
  saveAuditEvent(event: AuditEvent): Promise<void>
  getMetric(metricId: string): Promise<WorkforceMetric | null>
  saveMetric(metric: WorkforceMetric): Promise<void>
  getWorkflow(workflowId: string): Promise<Workflow | null>
  saveWorkflow(workflow: Workflow): Promise<void>
}
```

#### Implementation Path
1. Wire `D1WorkflowBackend` in the dependency injection root
2. Add D1 binding to `wrangler.toml` for the hermes worker
3. Ensure `MemoryWorkflowBackend` remains as fallback
4. Test graceful degradation when D1 is unavailable

#### Acceptance Criteria
- All 31 workforce persistence tests pass with D1 backend
- Graceful fallback to memory works when D1 unavailable
- Data survives Worker redeployment (verified via integration test)
- No data loss on concurrent operations

#### Files Affected
- `hermes/persistence/execution-store.ts` — Wire D1 backend
- `hermes/services/workforce/persistence.ts` — Update backend selection
- `hermes/services/workforce/d1-backend.ts` — Verify/review
- `workers/wrangler.toml` — Ensure D1 binding exists
- `workers/src/platform/was/was-persistence.ts` — Verify D1 connection

#### Tests Required
- 31 existing persistence tests (must still pass)
- New integration test: "D1 backend survives worker restart"
- New test: "Graceful degradation on D1 timeout"

---

### SPEC-002: Cloudflare Token Auto-Rotation

**Priority:** P0 (blocking for deployment)
**Dependencies:** None
**Status:** Known issue — current 53-char token stale

#### Specification
Implement automated Cloudflare API token rotation. The current token is 53 characters (old format) and returns 401 on API calls. New Cloudflare Workers tokens are 100 characters.

#### Implementation
1. Create `scripts/rotate-cf-token.sh` that:
   - Checks current token validity via `curl -I https://api.cloudflare.com/client/v4/user/tokens/verify`
   - If stale, prompts human for new token
   - Validates new token (100-char format, 401 check)
2. Store token as GitHub secret `CLOUDFLARE_API_TOKEN`
3. Document in runbook

#### Acceptance Criteria
- Fresh 100-char token verified working
- `wrangler deploy` succeeds
- CI/CD pipeline authenticates

---

### SPEC-003: In-Memory Engine → D1 Migration (Appointments & Messaging)

**Priority:** P2
**Dependencies:** SPEC-001
**Status:** `InMemoryAppointmentEngine` and `InMemoryMessageEngine` exist

#### Specification
The appointment and messaging engines currently use in-memory storage. Replace with D1-backed implementations to provide persistence across Worker restarts.

Files exist: `workers/src/platform/appointments/in-memory-appointment-engine.ts`, `workers/src/platform/messaging/in-memory-message-engine.ts`

#### Acceptance Criteria
- All existing appointment and messaging tests pass
- D1-backed engine passes same tests
- Data survives Worker cold start

---

## 4. Deferred Backlog Activation Items

### SPEC-004: Memory Service — Full Implementation

**Priority:** P2
**Dependencies:** None
**Status:** Stub exists; knowledge capture via audit + events

#### Specification
Replace the Memory Service stub with a functional implementation. Current knowledge capture works through audit events and workforce events, but a dedicated Memory Service would provide structured cross-session knowledge.

#### Acceptance Criteria
- Store and retrieve structured knowledge
- Support versioned knowledge entries
- Integrate with audit framework
- Existing test coverage passes

---

### SPEC-005: Provider Runtime Guard → Gateway Wiring

**Priority:** P2
**Dependencies:** None
**Status:** Code exists (`hermes/services/providers/runtime/guard.ts`), not wired to execution gateway

#### Specification
Wire the 8-dimension Provider Runtime Guard into the Execution Gateway. Currently the guard exists independently but is not activated during execution.

#### Dimensions:
1. Provider identity verification
2. Capability authorization
3. Resource limits
4. Execution time limits
5. Network access control
6. Filesystem access control
7. Audit logging
8. Failure isolation

#### Acceptance Criteria
- All 8 guard dimensions enforced during execution
- Graceful degradation when guard unavailable
- Audit events emitted for each guard check
- Existing tests pass

---

### SPEC-006: Provider Violation Model Integration

**Priority:** P2
**Dependencies:** SPEC-005
**Status:** Code exists (`hermes/services/providers/runtime/violation-model.ts`), not wired

#### Specification
Wire the Provider Violation Model into the Runtime Guard for automated violation detection and response when providers violate runtime constraints.

---

## 5. Phase 3 Planning Items

### SPEC-007: Phase 3 Architecture ADR

**Priority:** Pre-Phase-3
**Dependencies:** Phase 3 activation decision
**Status:** Not started

#### Specification
Before Phase 3 execution begins, produce an ADR that:
1. Defines Phase 3 scope boundaries
2. Lists new components required
3. Identifies architectural seams to use
4. Estimates effort per component
5. Identifies risks

---

### SPEC-008: Clinic Portal Frontend

**Priority:** Phase 3
**Dependencies:** SPEC-007
**Status:** Planned

#### Specification
React frontend under `/clinic/` route group with:
- Clinic login/registration
- Dashboard (shared patient views)
- Document management
- Appointment coordination
- Messaging with concierge

#### Architectural Seam
- Add `/clinic/*` routes to React Router
- No new authorization framework — add Clinic-staff `IdentityResolver`
- Existing D1 tables support clinic data

---

### SPEC-009: Clinic API Routes

**Priority:** Phase 3
**Dependencies:** SPEC-008
**Status:** Planned

#### Specification
New API routes under `/api/v1/clinic/*`:
- `GET /api/v1/clinic/patients` — View assigned patients
- `GET /api/v1/clinic/patients/:id` — Patient details
- `GET /api/v1/clinic/patients/:id/documents` — Patient documents
- `POST /api/v1/clinic/documents` — Upload clinic-side docs
- `GET /api/v1/clinic/messages` — Clinic messages
- `POST /api/v1/clinic/messages` — Send message

---

## 6. Configuration & Environment Specifications

### SPEC-010: Environment Variable Registry

**Priority:** P0 (maintenance)
**Dependencies:** None
**Status:** Existing docs need consolidation

#### Required Variables

| Variable | Source | Required For | Current Status |
|----------|--------|-------------|----------------|
| `CLOUDFLARE_API_TOKEN` | Cloudflare | wrangler deploy | ⚠️ Stale (53-char) |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare | wrangler | ✅ Set |
| `D1_DATABASE_ID` | Cloudflare D1 | Worker binding | ✅ Set |
| `R2_BUCKET_NAME` | Cloudflare R2 | Document storage | ✅ Set |
| `JWT_SECRET` | Application | Auth middleware | ✅ Set |
| `TELEGRAM_BOT_TOKEN` | BotFather | Bot webhooks | ✅ Set |
| `TELEGRAM_OPS_BOT_TOKEN` | BotFather | Ops bot | ✅ Set |
| `TELEGRAM_ADMIN_BOT_TOKEN` | BotFather | Admin bot | ✅ Set |
| `GITHUB_TOKEN` | GitHub | CI/CD | ✅ Set |
| `TURNSTILE_SITE_KEY` | Cloudflare | CAPTCHA | ✅ Set |
| `TURNSTILE_SECRET_KEY` | Cloudflare | CAPTCHA | ✅ Set |
| `ENVIRONMENT` | Config | Runtime mode | ✅ Set |
| `CORS_ORIGIN` | Config | CORS headers | ✅ Set |

---

## 7. Specification Summary

| ID | Capability | Priority | Status | Estimated Effort |
|----|-----------|----------|--------|-----------------|
| SPEC-001 | D1 Workflow Backend Activation | P1 | Ready to implement | 1-2 days |
| SPEC-002 | Cloudflare Token Rotation | P0 | Blocking | 2 hours |
| SPEC-003 | In-Memory → D1 Migration | P2 | Deferred | 2-3 days |
| SPEC-004 | Memory Service Full Implementation | P2 | Deferred | 3-5 days |
| SPEC-005 | Runtime Guard → Gateway Wiring | P2 | Ready to implement | 1 day |
| SPEC-006 | Violation Model Integration | P2 | Depends on SPEC-005 | 1 day |
| SPEC-007 | Phase 3 Architecture ADR | Pre-3 | Not started | 1 day |
| SPEC-008 | Clinic Portal Frontend | Phase 3 | Planned | 2-3 weeks |
| SPEC-009 | Clinic API Routes | Phase 3 | Planned | 1-2 weeks |
| SPEC-010 | Env Variable Registry | P0 | Needs consolidation | 1 day |

---

*End of Volume 05 — Implementation specifications for all remaining capabilities.*