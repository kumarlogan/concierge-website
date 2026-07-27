# AI Platform Engineering Standards

> **Mandatory engineering standards for all future AI Platform capabilities and products.**
> These standards are the minimum bar for production readiness — every capability and product must satisfy every applicable standard before reaching Production Ready maturity.
>
> **Status:** Phase 2 — Wave 2 (Architecture)
> **Version:** 1.0.0
> **Last Updated:** 2026-07-26

---

## Governance Header

```
Company:        AGS
Platform:       AI Platform
Product:        Concierge (consumer) — first adopter
Public Brand:   AG Synergy
Repository:     concierge-website
Document:       AI Platform Engineering Standards
Phase:          Phase 2 — Wave 2 (Architecture)
Status:         Complete — Mandatory For All Future Capabilities
```

---

## 1. Purpose

## 2. Engineering Standards Compliance — Definition of Done

All engineering execution must satisfy **WEF v1.0** compliance (GOV-004) as the primary gate before any other standard is checked. WEF v1.0 compliance supersedes the individual standards below. *(WDC v1.0, the predecessor framework adopted under GOV-003, has been renamed to WEF v1.0. See ADR-015.)*

| # | Standard | Verification | Applies To |
|---|---|---|---|
| 1 | **WEF Compliance** | All applicable phases of WEF v1.0 have been executed; workforce report produced (Phase 7 of WEF); operator sign-off obtained at each gate | All engineering execution |
| 2 | **WEF Phase 0** | Agent health, workforce persistence, registry, metrics, observability, audit logging, execution gateway, approval workflow, governance dashboards, version synchronization, git state verified |
| 3 | **WEF Phase 1** | Current execution location identified and reported; roadmap item confirmed approved, in scope, no blockers, no drift, dependencies satisfied; operator approval obtained |
| 4 | **WEF Phase 2** | Implementation plan, architecture impact, reusable abstractions, expected files, complexity, and risks documented (Developer); acceptance criteria, regression strategy, testing strategy documented (QA); security, PHI, Zero Trust, permission, dependency, and runtime reviews documented (Security); documentation, governance, ADR, roadmap, and dashboard impact documented (Documentation); observability plan, metrics, health verification, and runtime validation documented (Monitoring); operator approval obtained |
| 5 | **WEF Phase 3** | Implementation follows Platform Constitution, Platform First, Roadmap Lock, Deterministic Before AI, Zero Trust, Fail Closed, No Speculative Features, Small Reviewable Commits, Provider Abstraction, Capability-First Design |
| 6 | **WEF Phase 4** | Unit tests executed; integration tests executed where applicable; regression tests executed; acceptance validation performed; security review completed; vulnerabilities, secrets, permissions, PHI boundary, identity boundary, trust boundary reviewed |
| 7 | **WEF Phase 5** | Architecture review completed by all five agents; no Platform First violations; no Roadmap Lock violations; no new technical debt introduced; no product coupling introduced; no future workforce capability reduction; human approval obtained if any violations found |
| 8 | **WEF Phase 6** | Organizational learning captured (reusable capabilities, new abstractions, engineering patterns, architecture decisions, lessons learned, future backlog, technical debt, platform maturity, capability maturity, workforce maturity); governance dashboards and documentation synchronized |
| 9 | **WEF Phase 7** | Consolidated workforce report produced with all agent sections completed; overall risk assessed; recommendation provided (READY FOR MERGE / READY FOR NEXT WAVE / CHANGES REQUIRED) |
| 10 | **Build & Test** | CI pipeline passes: lint, typecheck, test, build |
| 11 | **Documentation** | All affected documentation files updated in the same pull request |
| AUTH-01 | Every authenticated endpoint must identify the principal before processing | Code audit | All protected endpoints |
| AUTH-02 | Authentication must use Trust & Identity interfaces — never product-specific auth logic | Interface audit | All capabilities |
| AUTH-03 | Anonymous access must be explicitly declared and logged | Endpoint scan | All endpoints |
| AUTH-04 | Failed authentication must return 401 with generic error message | Integration test | Auth gateway |
| AUTH-05 | Authentication providers must be provider-agnostic via `IdentityProvider` interface | Code audit | Identity provider implementations |
| AUTH-06 | Session tokens must be cryptographically signed | Security review | Session management |
| AUTH-07 | No hardcoded credentials anywhere in source code | Secret scan | All capabilities |
| AUTH-08 | Authentication timeout must be configurable per product | Config review | Auth configuration |

## 3. Authorization

| # | Standard | Verification | Applies To |
|---|---|---|---|
| AUTHZ-01 | Every protected action must pass through the Policy Engine or RBAC engine | Code audit | All actions |
| AUTHZ-02 | Default deny — no action is permitted unless explicitly authorized | Integration test | Policy Engine |
| AUTHZ-03 | Permission resolution must be data-driven (no hardcoded role→permission maps) | Code audit | Authorization |
| AUTHZ-04 | Deny-wins — explicit deny overrides any number of allows | Integration test | Policy Engine |
| AUTHZ-05 | Every allow and deny must be recorded in the audit log | Integration test | Authorization |
| AUTHZ-06 | Delegated permissions must enforce max chain depth | Integration test | Delegation |
| AUTHZ-07 | Authorization decisions must be deterministic for same inputs | Unit test | Policy Engine |
| AUTHZ-08 | Authorization must be evaluated at the API boundary (not in frontend) | Architecture review | All products |

## 4. Encryption

| # | Standard | Verification | Applies To |
|---|---|---|---|
| ENC-01 | All data in transit must use TLS 1.2+ | Infra scan | All components |
| ENC-02 | All PHI must be encrypted at rest with customer-managed or platform-managed keys | Security review | Storage |
| ENC-03 | Encryption keys must be stored in the platform secret store, never in code | Secret scan | All capabilities |
| ENC-04 | Key rotation must be supported and documented | DR test | Key management |
| ENC-05 | PHI encryption keys must be separate from identity encryption keys | Security review | Trust & Identity |
| ENC-06 | Backups must be encrypted | DR review | Storage |
| ENC-07 | Encryption algorithm must be industry-standard (AES-256-GCM minimum) | Security review | All capabilities |

## 5. Secrets

| # | Standard | Verification | Applies To |
|---|---|---|---|
| SEC-01 | No secrets in source code, configuration files, or environment files committed to git | Automated scan | All repositories |
| SEC-02 | Secrets must use platform secret store (Cloudflare Workers Secrets, env vars as last resort) | Code audit | All capabilities |
| SEC-03 | Secret rotation must be documented and automated where possible | Runbook review | All capabilities |
| SEC-04 | Access to secrets must be audited | Infra review | Secret store |
| SEC-05 | Secrets must be least-privileged (only the services that need them can access them) | Architecture review | All capabilities |
| SEC-06 | No default or test credentials in production | Secret scan | Production config |
| SEC-07 | Secret detection must run in CI/CD pipeline | CI config | CI/CD pipeline |

## 6. Audit

| # | Standard | Verification | Applies To |
|---|---|---|---|
| AUD-01 | Every authorization decision must produce an audit event | Integration test | Authorization |
| AUD-02 | Every identity lifecycle event must produce an audit event | Integration test | Trust & Identity |
| AUD-03 | Every consent action must produce an audit event | Integration test | Consent & Trust |
| AUD-04 | Audit records must be append-only (no UPDATE or DELETE) | Code audit | Audit store |
| AUD-05 | Audit records must include timestamp, principal ID, action, outcome, and resource ID | Schema review | Audit store |
| AUD-06 | Audit records must be retained per regulatory requirements (7 years minimum for PHI) | Policy review | Audit store |
| AUD-07 | Audit must support query and export | Integration test | Audit service |
| AUD-08 | Audit records must be tamper-evident (append-only, cryptographic hash chain recommended) | Security review | Audit store |
| AUD-09 | Audit must be available during incidents (not gated by normal operation) | Architecture review | Audit service |

## 7. Logging

| # | Standard | Verification | Applies To |
|---|---|---|---|
| LOG-01 | All service logs must be structured (JSON format) | Code audit | All capabilities |
| LOG-02 | Logs must include correlation ID for distributed tracing | Code audit | All capabilities |
| LOG-03 | No PHI, PII, or secrets in log output | Automated scan | All capabilities |
| LOG-04 | Error logs must include stack traces (internal only, never exposed to clients) | Code audit | All capabilities |
| LOG-05 | Log levels must follow convention: ERROR (failures), WARN (anomalies), INFO (milestones), DEBUG (detail) | Code audit | All capabilities |
| LOG-06 | Logs must be queryable (Cloudflare Workers Observability or equivalent) | Infra check | All capabilities |
| LOG-07 | Log retention must be configured per data sensitivity classification | Policy review | All capabilities |

## 8. Observability

| # | Standard | Verification | Applies To |
|---|---|---|---|
| OBS-01 | Every service must expose a health endpoint returning 200 + version + status | Integration test | All services |
| OBS-02 | Health endpoint version must be auto-sourced (not hardcoded) | Code audit | All services |
| OBS-03 | Error rate must be monitored and alertable | Monitoring config | All capabilities |
| OBS-04 | Request latency must be tracked (P50, P95, P99) | Monitoring config | All capabilities |
| OBS-05 | Rate limiting must be implemented at the API boundary | Integration test | API gateway |
| OBS-06 | Deployment must produce a health check verification | CI config | CI/CD pipeline |
| OBS-07 | Incident response runbook must exist for each capability | Runbook review | All capabilities |

## 9. Error Handling

| # | Standard | Verification | Applies To |
|---|---|---|---|
| ERR-01 | All errors must return a consistent JSON structure: `{ error: { code, message } }` | Integration test | API endpoints |
| ERR-02 | No stack traces or internal details in error responses | Security scan | API endpoints |
| ERR-03 | Errors must be logged at the appropriate level | Code audit | All capabilities |
| ERR-04 | External service failures must result in graceful degradation, not cascade failure | Integration test | All capabilities |
| ERR-05 | Error codes must be documented in API specification | Doc review | API documentation |
| ERR-06 | Failures that could compromise security or data integrity must result in fail-closed behaviour | Security review | All capabilities |

## 10. API Contracts

| # | Standard | Verification | Applies To |
|---|---|---|---|
| API-01 | All APIs must be versioned (`/api/v{N}/`) | Code audit | All APIs |
| API-02 | API responses must be JSON | Integration test | All APIs |
| API-03 | API must use standard HTTP methods (GET, POST, PUT, PATCH, DELETE) | Code audit | All APIs |
| API-04 | API must use standard HTTP status codes | Integration test | All APIs |
| API-05 | Breaking changes require a new API version | API review | All APIs |
| API-06 | API contracts must be documented (OpenAPI or equivalent) | Doc review | All APIs |
| API-07 | Rate limiting headers must be returned (`X-RateLimit-*`) | Integration test | API gateway |
| API-08 | CORS must be configured and restricted to known origins | Integration test | All APIs |

## 11. Versioning

| # | Standard | Verification | Applies To |
|---|---|---|---|
| VER-01 | All capabilities must use semantic versioning (semver) | Version audit | All capabilities |
| VER-02 | Version must be auto-sourced from a single source of truth | Code audit | All capabilities |
| VER-03 | Breaking changes require major version bump | API review | All capabilities |
| VER-04 | Version must be exposed in health endpoint | Integration test | All capabilities |
| VER-05 | API versioning must follow URL-prefix pattern | Code audit | All APIs |

## 12. Dependency Management

| # | Standard | Verification | Applies To |
|---|---|---|---|
| DEP-01 | All dependencies must be pinned to specific versions | Package audit | All capabilities |
| DEP-02 | Dependency vulnerabilities must be scanned in CI/CD | CI config | All capabilities |
| DEP-03 | No deprecated or unmaintained dependencies | Dependency audit | All capabilities |
| DEP-04 | Dependency update must follow documented process | Process audit | All capabilities |
| DEP-05 | External provider dependencies must use provider abstraction interfaces | Code audit | All capabilities |

## 13. Naming

| # | Standard | Verification | Applies To |
|---|---|---|---|
| NAME-01 | All capability names must follow organizational hierarchy (Company > Platform > Capability > Product) | Name audit | All capabilities |
| NAME-02 | Identifiers must use kebab-case for files and directories | Code audit | All repositories |
| NAME-03 | Identifiers must use camelCase for TypeScript/JavaScript code | Code audit | All code |
| NAME-04 | Database table names must use snake_case | DB audit | All databases |
| NAME-05 | API endpoint paths must use kebab-case | Code audit | All APIs |
| NAME-06 | Permission keys must follow `domain:action` pattern (`leads.read`, `identity:create`) | Code audit | Authorization |

## 14. Configuration

| # | Standard | Verification | Applies To |
|---|---|---|---|
| CONF-01 | Configuration must be environment-specific (dev/staging/prod) | Config audit | All capabilities |
| CONF-02 | No hardcoded environment-specific values in source code | Code audit | All capabilities |
| CONF-03 | Configuration must be validated on startup | Integration test | All capabilities |
| CONF-04 | Sensitive configuration must use secrets (not config files) | Secret scan | All capabilities |
| CONF-05 | Configuration defaults must be safe for development | Code audit | All capabilities |

## 15. Feature Flags

| # | Standard | Verification | Applies To |
|---|---|---|---|
| FLAG-01 | New features in development must be gated behind feature flags | Code audit | All capabilities |
| FLAG-02 | Feature flags must be configurable without deployment | Config audit | All capabilities |
| FLAG-03 | Feature flags must be removed after stable release | Code review | All capabilities |
| FLAG-04 | Feature flag evaluation must not degrade performance | Load test | All capabilities |

## 16. Documentation

| # | Standard | Verification | Applies To |
|---|---|---|---|
| DOC-01 | Every capability must have a self-contained architecture document | Doc inventory | All capabilities |
| DOC-02 | API documentation must exist for all public endpoints | Doc inventory | All APIs |
| DOC-03 | Every ADR must be added to `docs/decisions/` and indexed in DECISION_LOG.md | Doc audit | All decisions |
| DOC-04 | Runbooks must exist for common operational tasks | Doc inventory | All capabilities |
| DOC-05 | Onboarding documentation must exist for new developers | Doc inventory | Platform |
| DOC-06 | Documentation must be versioned and updated with every change | Git history | All capabilities |
| DOC-07 | Documentation must follow the governance header pattern | Doc audit | All docs |

## 17. Testing

| # | Standard | Verification | Applies To |
|---|---|---|---|
| TEST-01 | Unit tests must cover all core business logic | Coverage report | All capabilities |
| TEST-02 | Integration tests must cover all API endpoints | Test report | All capabilities |
| TEST-03 | Test suite must pass before merge to main | CI config | All repositories |
| TEST-04 | Test count must not decrease without documented exception | CI check | All repositories |
| TEST-05 | Security tests must include: authorization bypass, injection, XSS | Security test | All capabilities |
| TEST-06 | PHI-protected endpoints must have consent verification tests | Integration test | Consent-related code |
| TEST-07 | Performance tests must establish baseline before production release | Performance report | All capabilities |
| TEST-08 | Test names must describe the scenario being tested | Code audit | All test files |

## 18. Deployment

| # | Standard | Verification | Applies To |
|---|---|---|---|
| DEPL-01 | Deployment must be automated (CI/CD pipeline) | CI config | All capabilities |
| DEPL-02 | Preview/staging environment must exist for pre-production validation | Infra audit | All capabilities |
| DEPL-03 | Rollback must be possible within 5 minutes | DR test | All capabilities |
| DEPL-04 | Zero-downtime deployment for production services | Architecture review | Production |
| DEPL-05 | Deployment must include health check verification | CI config | All capabilities |
| DEPL-06 | Secrets must be configured separately per environment | Infra audit | All capabilities |
| DEPL-07 | Deployment must be logged and auditable | CI/CD audit | All capabilities |

---

## 19. Standard Compliance Gates

| Maturity Level | Standards That Must Be Satisfied |
|---|---|
| Concept | None |
| Architecture | DOC-01, DOC-03, NAME-01, NAME-02 |
| Prototype | TEST-01, TEST-02, CONF-01, CONF-04, ERR-01 |
| Development | All applicable standards must be **designed** (may not be fully automated yet) |
| Production Ready | All applicable standards must be **verified passing** |
| Operational | All standards + OBS-07 (runbook exists) |
| Deprecated | DEP-03 (dependencies sunset), VER-01 (final version archived) |
| Retired | All data retention standards archived |

---

## 20. Standard Waiver Process

Any standard may be waived only by explicit AI Platform Owner approval:

```markdown
## Waiver Template

**Standard:** STANDARD-XX (Description)
**Capability/Product:** 
**Rationale:** Why this standard cannot be satisfied
**Compensating Control:** What alternative control is in place
**Duration:** Until when the waiver is valid
**Approved by:** [Name]
**Date:** YYYY-MM-DD
```

Waivers are recorded in the capability risk register and reviewed quarterly.

---

*These standards are mandatory for all future AI Platform capabilities and products. Compliance is verified at each maturity gate.*
*Last updated: 2026-07-26*
*Governance document — GOV-002 / Phase 2 Wave 2*