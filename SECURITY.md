# SECURITY

> AG Synergy Platform — Security Policies and Posture
> **Status:** Phase 1 Live + Operations API Live | **Last reviewed:** 2026-07-18

## Security Principles

| Principle | Implementation |
|---|---|
| **Least privilege** | Workers have access only to the D1 database they need and the R2 buckets they need. Hermes has no access to D1 or R2 data. GitHub tokens are scoped to the repository. |
| **Secure API design** | All API endpoints require HTTPS. Input validation at the Worker boundary. Error responses never leak stack traces, internal paths, or database details. |
| **Data minimization** | Only necessary data is collected. Every form field, database column, and log entry is justified. No medical records, clinical data, or PHI. |
| **Encryption** | TLS for all data in transit (Cloudflare enforces). Server-side encryption for data at rest (D1, R2 — Cloudflare default). Secrets managed through Cloudflare Worker secrets. |
| **Access controls** | **Live RBAC (EPIC-002-002):** provider-agnostic `src/auth/` engine enforces authorization at the Worker edge — `requirePermission()` guards, data-driven permission resolution (deny-wins, OWNER short-circuit), and `audit_logs` on every decision. Public informational endpoints remain open; protected routes are gated explicitly. No hardcoded role→permission maps (ADR-003). |
| **Auditability** | Structured logs in Workers. All deployments are documented in CHANGELOG.md. D1 migrations are tracked and forward-only. |

## Security Boundaries

```
Public Internet → Cloudflare Edge (DDoS, WAF, TLS termination)
                   │
       ┌───────────┴───────────┐
       ▼                       ▼
  Pages (static)          Workers (API)
                                │
                     ┌──────────┴──────────┐
                     ▼                      ▼
                D1 (encrypted)      R2 (encrypted)
```

## Current Posture — Phase 1

| Security Area | Status | Detail |
|---|---|---|
| **Transport security** | ✅ Enforced | HTTPS at Cloudflare edge for all traffic |
| **Input validation** | ✅ Active | Type checks, format validation, length limits, empty rejection in Worker route handlers |
| **SQL injection prevention** | ✅ Active | Prepared statements via D1 `stmt.bind()` — no string concatenation |
| **No stack trace exposure** | ✅ Active | All errors return structured JSON: `{ "error": "...", "message": "..." }` |
| **CORS restrictions** | ✅ Active | Whitelist: only agsynergy.ca origins + localhost dev. OPTIONS preflight handled. |
| **Database access control** | ✅ Restricted | D1 only accessible through Workers — no external D1 connections |
| **Duplicate protection** | ✅ Active | Email-based duplicate detection prevents double-submission of consultation requests |
| **Code quality** | ✅ Active | TypeScript strict mode, 141 tests (74 Epic 1 + 25 auth-engine + 21 Operations API + 21 Operations Bot), linting |
| **Secrets management** | ✅ Cloudflare | Worker secrets for deployment credentials via `wrangler secret` |
| **GitHub access** | ✅ Scoped | Fine-grained tokens scoped to repository; no org-wide tokens |

## Upcoming — Phase 2

| Security Area | Phase 1 | Phase 2 |
|---|---|---|
| **Authentication** | None (public API) | **Live RBAC** — `src/auth/` engine enforces authorization on protected routes via `requirePermission()` guards; public endpoints remain open. Identity providers register a resolver (ships `TelegramIdentityResolver`; Patient/Clinic resolvers to follow). The `/api/v1/ops/*` Operations API is the first live consumer (EPIC-002-003A); the **Operations Telegram Bot** (EPIC-002-004-IMPL, `/telegram/webhook`) is the second — it dispatches through the same `requirePermission()` engine, so RBAC is enforced identically across both surfaces. |
| **Rate limiting** | Prepared architecture | Per-endpoint rate limits in Workers |
| **PHI controls** | Not collected | Full PHI data handling policies, access audit, consent tracking |
| **Audit logging** | Structured Worker logs | Centralized log retention, access audit trails |
| **Incident response** | Documentation planned | Formal incident response procedure, notification process |

## Data Protection

### What We Collect

| Data | Purpose | Retention |
|---|---|---|
| Name, email, phone | Consultation request fulfillment | Active leads only |
| Treatment interest | Match to appropriate services | Duration of lead lifecycle |
| Consultation scheduling | Appointment management | Scheduled + 30 days post-completion |

### What We Never Collect

- Medical records, diagnoses, or treatment outcomes
- Government IDs (SIN, passport, driver's license)
- Payment information (credit cards, bank details)
- Genetic or biometric data
- Patient health information (PHI/HIPAA scope)

### Data Access Restrictions

| Role | D1 Access | What They Can See |
|---|---|---|
| Worker (production) | Full CRUD | Only through defined API routes — no direct SQL |
| Worker (preview) | Separate D1 instance | Isolated test data only |
| Hermes (admin) | None | Cannot access D1 or patient/lead data |
| GitHub Actions | Deploy only | Wrangler token — can deploy Workers, not query D1 |

## Platform Exclusions

The AG Synergy Platform is **not**:

- ❌ A medical device or diagnostic tool
- ❌ An electronic medical record (EMR) system
- ❌ A HIPAA-covered entity (no PHI collection)
- ❌ A payment processor

See [`PRODUCT_BOUNDARIES.md`](./PRODUCT_BOUNDARIES.md) for the full platform scope definition.

## Security Contacts & Process

| Concern | Action |
|---|---|
| Bug reports, vulnerabilities | Create GitHub issue in `agsynergy/concierge-website` |
| Production incidents | Hermes admin via Telegram |
| Access requests | Through AG Synergy concierge staff |

## Dependency Auditing

Automated via `pnpm audit` in CI. Manual review for Cloudflare Workers-specific dependencies (no npm audit for Workers runtime).

## Related Documents

- [`ARCHITECTURE.md`](./ARCHITECTURE.md) — §8 Security Architecture
- [`API.md`](./API.md) — Security measures in API design
- [`DATABASE.md`](./DATABASE.md) — Data boundaries and access control
- [`PRODUCT_BOUNDARIES.md`](./PRODUCT_BOUNDARIES.md) — Platform scope and data exclusions
- [`docs/security/README.md`](./docs/security/README.md) — Extended security documentation directory