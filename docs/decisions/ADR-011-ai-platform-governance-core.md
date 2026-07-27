# ADR-011 — AI Platform Governance Core Capabilities

> **Status:** ✅ Accepted
> **Date:** 2026-07-26
> **Phase:** Phase 2 — Wave 2 (AI Platform Governance Core)

---

## Governance Header

```
Company:        AGS
Platform:       AI Platform
Product:        Concierge (consumer)
Public Brand:   AG Synergy
Repository:     concierge-website
ADR:            ADR-011 — AI Platform Governance Core
Status:         ✅ Accepted
Author:         AI Platform
```

---

## Context

Phase 2 Wave 1 established the Trust & Identity capability architecture. Before patient authentication can be implemented (planned for Wave 3), the AI Platform requires a complete governance framework:

- **Policy Engine** — How will the platform authorize actions across products? The existing RBAC engine is product-specific and doesn't support context-aware, time-based, or consent-based policy evaluation.
- **Consent & Trust** — How will patient consent be managed? No consent system exists, and PHI processing requires granular, auditable consent records per Canadian regulations (PIPEDA, PHIPA).
- **Capability Registry** — How will the platform track which capabilities exist, what they depend on, and who consumes them? Without a registry, capability discovery is tribal knowledge.
- **Engineering Standards** — What is the minimum engineering bar for every capability? Without standards, quality and security vary per capability.
- **Capability Maturity Model** — How does a capability progress from concept to production? Without a maturity model, capabilities enter production with inconsistent quality.
- **Workforce Identity** — The Phase 1 workforce identity model covered 3 agent types. Future agents (14+ types) need trust scoring, delegation, and expanded lifecycle management.

These capabilities must be designed **before** patient authentication implementation, because the patient auth implementation (Wave 3) depends on Policy Engine authorization and Consent & Trust verification.

---

## Decision

Create **5 new AI Platform governance capabilities** and **expand the Workforce Identity capability**:

### 1. Policy Engine

**Type:** AI Platform Capability (Architecture Complete)

**Scope:** Centralized, deterministic policy evaluation service that combines:
- RBAC (wraps existing `workers/src/auth/` engine)
- ABAC (attribute-based conditions)
- Time-based policies
- Context-aware policies
- Consent-based evaluation (delegated to Consent & Trust)
- Trust-based evaluation (delegated to Trust & Identity)
- Delegation chain validation

**Key decisions:**
- Existing RBAC engine is NOT replaced — it's adopted as one strategy
- Products may continue using RBAC directly for backward compatibility
- New products use the Policy Engine exclusively
- Default decision: DENY (fail-closed)
- Policy hierarchy: Global → Product → Resource → Context
- Conflict resolution: Explicit DENY wins, more specific wins, most restrictive wins

**Design doc:** `docs/platform/policy-engine/POLICY_ENGINE_ARCHITECTURE.md`

### 2. Consent & Trust

**Type:** AI Platform Capability (Architecture Complete)

**Scope:** Reusable consent management and trust evaluation for all products:
- 10 consent types (privacy, medical, marketing, cookie, terms, research, document, data sharing, communication)
- Product-agnostic vs product-specific consent types
- Immutable consent records (append-only, never UPDATE/DELETE)
- Consent lifecycle: Grant → Active → Revoke/Expire/Re-consent
- Consent snapshots bound to sessions
- Trust evaluation: 6 dimensions (identity, device, location, behavioral, session, consent)
- Right to delete workflow
- Full data export for regulatory compliance

**Key decisions:**
- Provider-agnostic (swappable backends)
- Independent from Identity (consent records separate from identity records)
- Independent from Policy (Policy Engine consumes consent, doesn't own definitions)
- PIPEDA/PHPIA/CASL compliance built in
- ORY Kratos not used for consent (Cloudflare Workers-native)

**Design doc:** `docs/platform/consent-trust/CONSENT_AND_TRUST_ARCHITECTURE.md`

### 3. Platform Capability Registry

**Type:** Platform Governance Document (Complete)

**Scope:** Canonical registry documenting every AI Platform capability:
- 11 capabilities documented: Execution, Workforce, Providers, Security, Trust & Identity, Policy Engine, Consent & Trust, Observability, Notifications, Storage, Platform Hardening
- Each entry: name, purpose, owner, interfaces, dependencies, consumers, status, maturity, risks, tests, metrics, roadmap
- Dependency map and product mapping
- Risk register per capability
- Maintenance schedule (quarterly full audit)

**Key decisions:**
- Registry is a living document — updated per capability lifecycle events
- Registry is authoritative — all capability discovery references this document

**Design doc:** `docs/platform/capability-registry/CAPABILITY_REGISTRY.md`

### 4. Platform Engineering Standards

**Type:** Platform Governance Document (Complete)

**Scope:** 110 mandatory standards across 19 categories:
1. Authentication (8 standards)
2. Authorization (8 standards)
3. Encryption (7 standards)
4. Secrets (7 standards)
5. Audit (9 standards)
6. Logging (7 standards)
7. Observability (7 standards)
8. Error Handling (6 standards)
9. API Contracts (8 standards)
10. Versioning (5 standards)
11. Dependency Management (5 standards)
12. Naming (6 standards)
13. Configuration (5 standards)
14. Feature Flags (4 standards)
15. Documentation (7 standards)
16. Testing (8 standards)
17. Deployment (7 standards)

**Key decisions:**
- Standards are mandatory — not aspirational
- Compliance verified at each maturity gate
- Waiver process requires Platform Owner approval
- Standards apply to all capabilities, not just Concierge

**Design doc:** `docs/platform/engineering-standards/ENGINEERING_STANDARDS.md`

### 5. Capability Maturity Model

**Type:** Platform Governance Document (Complete)

**Scope:** 8 maturity levels with defined entry/exit criteria, advancement rules, and demotion rules:
1. Concept (entry criteria: none)
2. Architecture (exit: arch doc, interfaces, risks, ADR)
3. Prototype (exit: working POC, unit tests, core error handling)
4. Development (exit: full test suite, audit, secrets, logging, health, rate limits, API docs)
5. Production Ready (exit: production deploy, rollback tested, monitoring, security review, runbook)
6. Operational (exit: 30 days of P0/P1-free operation, P95 within SLO, 99.9% uptime, 2+ consumers)
7. Deprecated (exit: consumers migrated, replacement documented)
8. Retired (exit: deployments removed, data retained per policy, code archived)

**Key decisions:**
- Advancement requires satisfying ALL exit criteria for current level
- Skip of prototype level requires waiver
- Production Ready requires full Engineering Standards compliance
- Demotion rules for security vulnerabilities, repeated P0/P1 incidents, or compliance failure

**Design doc:** `docs/platform/maturity-model/CAPABILITY_MATURITY_MODEL.md`

### 6. Workforce Identity Expansion

**Type:** AI Platform Capability — Expanded Architecture (v2.0.0)

**Scope:** Expanded workforce identity model covering:
- 4 identity types: Human, Machine, Agent, Delegated, Service Account
- 14 agent types (up from 3)
- 5 delegation types (Staff→Staff, Human→Agent, Patient→Proxy, Admin→Staff)
- 9 trust factors with weighted scoring and level thresholds
- Credential rotation schedule per identity type
- Session management per identity type
- Full workforce administration API
- Migration path from Phase 1 identity model

**Design doc:** `docs/platform/workforce-identity/WORKFORCE_IDENTITY_EXPANDED.md`

---

## Consequences

### Positive

1. **Governance before implementation** — All governance capabilities designed before Wave 3 patient authentication implementation
2. **Provider-agnostic** — All capabilities follow the established provider abstraction pattern
3. **Backward-compatible** — Policy Engine wraps, doesn't replace, the existing RBAC engine
4. **Regulatory compliance built in** — Consent & Trust handles PIPEDA/PHIPA/CASL requirements
5. **Single source of truth** — Capability Registry, Engineering Standards, and Maturity Model provide authoritative references
6. **Clear progression path** — Maturity Model defines exactly what each capability needs to reach production
7. **Reusable across products** — Every governance capability is product-agnostic

### Negative

1. **No implementation** — These are architecture-only; Wave 3+ implementation will be significant scope
2. **Policy Engine integration** — Requires wrapping the existing RBAC engine, which may surface compatibility issues during implementation
3. **Consent & Trust scope** — 10 consent types with Canadian regulatory compliance creates a large implementation surface
4. **Engineering Standards enforcement** — Standards require automated verification tools that don't exist yet

### Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Implementation scope underestimated | Medium | High | Detailed scope in each architecture document; phased implementation waves |
| Engineering Standards hard to enforce without tools | High | Medium | Start with manual verification + CI gates; automate gradually |
| Policy Engine evaluation latency | Medium | Medium | Caching; stateless evaluation |
| Consent compliance requirements change | Medium | High | Versioned consent types enable rapid re-consent |

---

## Related Documents

| Document | Path |
|---|---|
| Policy Engine Architecture | `docs/platform/policy-engine/POLICY_ENGINE_ARCHITECTURE.md` |
| Consent & Trust Architecture | `docs/platform/consent-trust/CONSENT_AND_TRUST_ARCHITECTURE.md` |
| Capability Registry | `docs/platform/capability-registry/CAPABILITY_REGISTRY.md` |
| Engineering Standards | `docs/platform/engineering-standards/ENGINEERING_STANDARDS.md` |
| Workforce Identity Expanded | `docs/platform/workforce-identity/WORKFORCE_IDENTITY_EXPANDED.md` |
| Capability Maturity Model | `docs/platform/maturity-model/CAPABILITY_MATURITY_MODEL.md` |
| ADR-010 | `docs/decisions/ADR-010-trust-identity-platform-capability.md` |

---

*ADR approved 2026-07-26. This decision record is append-only — corrections via new ADR referencing ADR-011.*