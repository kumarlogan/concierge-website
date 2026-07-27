# Wave 7 Execution Plan — Appointment Management & Messaging

> **Governance Header**
> Company: AGS | Platform: AI Platform | Product: Concierge | Public Brand: AG Synergy
> Repository: concierge-website | WEF: v1.1 | Phase: Phase 2 | Wave: Wave 7
> Status: Execution Plan | Date: 2026-07-27

---

## 1. Wave 7 Scope

| Capability | Type | Platform-First | Reusable | Concierge Website |
|---|---|---|---|---|
| Appointment Management | AI Platform Capability (Trust Runtime) | YES | YES — reusable across Phase 3 clinic workflows | YES — patient-facing UI |
| Messaging | AI Platform Capability (Trust Runtime) | YES | YES — reusable across all AGS products | YES — concierge and patient messaging |

## 2. Developer Agent — Implementation Tasks

### 2.1 Appointment Management Platform Capability

**Files to create:**
- `workers/src/platform/appointments/` directory with:
  - `appointment-engine.ts` — core appointment CRUD, scheduling, slot management
  - `appointment-types.ts` — TypeScript interfaces and enums
  - `appointment-validation.ts` — validation rules (no overlapping slots, time boundaries)
  - `appointment-audit.ts` — audit logging for all appointment operations
  - `index.ts` — public API exports

**Dependencies:**
- Trust Runtime (consent checks before appointment operations)
- Storage (D1 for appointment records, R2 for any attached documents)
- Security (RBAC authorization middleware)
- Observability (health checks, metrics)

### 2.2 Messaging Platform Capability

**Files to create:**
- `workers/src/platform/messaging/` directory with:
  - `message-engine.ts` — core message sending, threading, delivery status
  - `message-types.ts` — TypeScript interfaces and enums
  - `message-policy.ts` — policy enforcement (PHI boundary, consent checks)
  - `message-audit.ts` — audit logging for all messaging operations
  - `index.ts` — public API exports

**Dependencies:**
- Trust Runtime (PHI isolation, consent verification)
- Storage (D1 for message records)
- Security (RBAC, PHI boundary enforcement)

### 2.3 Concierge Website Integration

**Files to create/modify:**
- `workers/src/routes/appointments.ts` — REST API endpoints for appointments
- `workers/src/routes/messages.ts` — REST API endpoints for messaging
- `workers/src/router/index.ts` — register new routes
- `workers/src/index.ts` — wire new route handlers
- `artifacts/ags-fertility/src/lib/appointment-api.ts` — frontend API client
- `artifacts/ags-fertility/src/lib/message-api.ts` — frontend API client
- Frontend pages for appointment scheduling and messaging (patient portal)

## 3. QA Agent — Acceptance Criteria

### 3.1 Unit Tests
- Appointment engine: CRUD operations, slot conflict detection, time validation
- Message engine: send/receive, threading, delivery status tracking
- All new modules: type correctness, edge cases

### 3.2 Integration Tests
- End-to-end: create appointment → verify in D1 → retrieve → update → cancel
- End-to-end: send message → deliver → receive → thread retrieval
- PHI boundary: no PHI in message content or appointment metadata

### 3.3 Regression
- Existing 558 tests must continue passing
- No broken routes or type errors

### 3.4 Acceptance Criteria
- All new tests pass
- No regressions in existing test suite
- TypeScript compilation clean
- PHI isolation verified in audit logs

## 4. Security Agent — Review Checklist

### 4.1 PHI Review
- No PHI stored in message content fields (use opaque references)
- Appointment metadata encrypted at rest
- PHI boundary enforced in all API responses
- Audit logs capture access but not PHI payloads

### 4.2 Access Control
- RBAC enforced on all appointment and messaging endpoints
- Patient can only access own appointments/messages
- Concierge staff can access assigned patient data
- Role-based permission checks on allwrite operations

### 4.3 Policy Review
- Consent verification before messaging (patient must consent to communication)
- Data retention policy for messages (configurable TTL)
- PHI retention rules applied to appointment records

### 4.4 Trust Validation
- Identity verified before any appointment/message operation
- Session validation on every request
- Rate limiting on messaging endpoints

## 5. Documentation Agent

### 5.1 Documentation Updates
- `docs/platform/trust-identity/TRUST_AND_IDENTITY_ARCHITECTURE.md` — update with Wave 7 capabilities
- `docs/platform/capability-registry/CAPABILITY_REGISTRY.md` — register new capabilities
- New ADR for Appointment Management + Messaging

### 5.2 Architecture Updates
- Update `workers/docs/platform/PLATFORM_CONSTITUTION.md` if needed
- Update architecture diagrams if needed

### 5.3 ADR Impact
- Create ADR for Wave 7 capabilities
- Update capability dependencies

### 5.4 Governance Synchronization
- Update PSER resume point to Wave 7 complete
- Update CURRENT_SPRINT.md
- Update PROGRAM_STATUS.md
- Update PRODUCT_STATUS.md
- Update CHANGELOG.md

## 6. Monitoring Agent

### 6.1 Health Verification
- Health endpoint includes new capability status
- All new routes respond correctly

### 6.2 Observability
- Structured logging for all appointment/messaging operations
- Metrics: appointment bookings/min, messages sent/min, error rate

### 6.3 Operational Validation
- D1 schema migrations applied correctly
- R2 buckets configured for any document attachments
- No memory leaks in long-running operations

## 7. Dependencies & Risks

| Risk | Severity | Mitigation |
|---|---|---|
| Slot conflict logic edge cases | Medium | Comprehensive unit tests for overlapping slots |
| PHI leakage in message content | High | Strict PHI boundary enforcement, automated scan |
| D1 migration failure | Medium | Test migrations locally before integration |
| Type errors from new modules | Low | TypeScript compilation check before merge |