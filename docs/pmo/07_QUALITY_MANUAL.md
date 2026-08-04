# Volume 07: Quality Manual

> **Version:** 1.0 | **Date:** 2026-08-03
> **Authority:** PMO — Engineering Standards v2.2 derived from `docs/platform/engineering-standards/`
> **Status:** ⚡ RATIFIED

---

## 1. Coding Standards

### 1.1 TypeScript Standards

| Standard | Requirement | Source |
|----------|-------------|--------|
| Language | TypeScript only (no plain JS) | ARCHITECTURE.md |
| Strict mode | `strict: true` in tsconfig | `tsconfig.json` |
| Formatting | Prettier (3.9.5) | `package.json` |
| No `any` | Explicit types required; use `unknown` for unsafe values | Engineering Standards |
| Modules | ES modules (import/export) | tsconfig |
| Naming | camelCase (vars/fns), PascalCase (classes/types/interfaces), kebab-case (files) | Convention |
| Null safety | Use `??` over `||` for defaults; prefer `undefined` over `null` | Convention |

### 1.2 React Component Standards

| Standard | Requirement |
|----------|-------------|
| Components | Function components only, no class components |
| Props | Explicit TypeScript interfaces |
| Hooks | Custom hooks for reusable logic |
| State | Minimal local state; prefer URL/API state |
| Styling | Tailwind CSS 4 utility classes |
| Accessibility | WCAG AA compliance minimum |

### 1.3 Worker Standards

| Standard | Requirement |
|----------|-------------|
| Router | URLPattern-based, zero dependencies |
| Handlers | Thin handlers delegate to services |
| Error format | `{ error: string, code: string, details?: any }` |
| Status codes | Standard HTTP semantics (200, 201, 400, 401, 403, 404, 500) |
| Environment | Env type from `wrangler.toml` bindings |

---

## 2. Architecture Standards

| Standard | Requirement |
|----------|-------------|
| Cloudflare-first | Workers, D1, R2, Pages — no multi-cloud |
| Frontend-backend separation | Frontend never touches D1/R2 directly |
| Hermes isolation | Patient data never flows through AI |
| Interface-first | Every dependency is behind a TypeScript interface |
| Fail-closed | All gates deny by default |
| PHI boundaries | Every module touching patient data is documented as PHI zone |

---

## 3. Testing Standards

### 3.1 Mandatory Requirements

| Requirement | Rule |
|-------------|------|
| Coverage for new code | 100% of new code must have tests |
| Pre-existing test pass | No code merged that breaks any test |
| Integration tests | Every API endpoint and bot webhook must have integration test |
| Unit tests | Every service function with logic must have unit test |
| Test structure | Vitest-based, in `workers/tests/` or alongside source |

### 3.2 Testing Levels

```
┌─────────────────────────────────────────────────┐
│                   E2E Tests                       │
│  (Manual smoke tests post-deployment)             │
├─────────────────────────────────────────────────┤
│               Integration Tests                   │
│  (API endpoints, bot webhooks, database access)   │
├─────────────────────────────────────────────────┤
│                 Unit Tests                        │
│  (Services, utilities, type validators)           │
└─────────────────────────────────────────────────┘
```

### 3.3 Test Naming

| Test Type | Pattern | Example |
|-----------|---------|---------|
| Unit | `<module>.test.ts` | `permissions.test.ts` |
| Integration | `<name>.integration.test.ts` | `bot.integration.test.ts` |
| Hermes | `hermes.<module>.test.ts` | `hermes.workforce.orchestration.test.ts` |

---

## 4. Documentation Standards

| Standard | Requirement |
|----------|-------------|
| Updates in PR | Documentation updated in same PR as code changes |
| ADR for architecture | Any architecture change requires an ADR |
| Governance freeze | No new platform capabilities without ADR (GOV-004) |
| Root docs | `ROADMAP.md`, `ARCHITECTURE.md`, `PROJECT.md` updated with phase changes |
| README | Every module has a README explaining purpose and usage |

---

## 5. Security Standards

| Standard | Requirement | Verification |
|----------|-------------|-------------|
| TLS everywhere | No unencrypted HTTP | Cloudflare edge |
| AuthN | JWT-based authentication | `withJwtAuth` middleware |
| AuthZ | RBAC via `requirePermission()` | `permissions.ts` |
| Rate limiting | Per-endpoint limits | `rateLimit.ts` |
| Input validation | All inputs validated | Route + schema validation |
| Secret management | Cloudflare Worker secrets | wrangler secrets |
| Audit logging | All security events logged | `audit_logs` table |
| PHI protection | Marked PHI boundaries | Module headers |
| Secret scanning | Gitleaks in CI | `.gitleaks.toml` |

---

## 6. Performance Standards

| Standard | Target |
|----------|--------|
| API response time | < 200ms p95 |
| D1 query time | < 50ms |
| Frontend load time | < 2s (First Contentful Paint) |
| Lighthouse score | ≥ 90 |
| Worker cold start | < 100ms |

---

## 7. Accessibility Standards

| Standard | Target |
|----------|--------|
| WCAG level | AA minimum, AAA preferred |
| Color contrast | 4.5:1 normal text, 3:1 large text |
| Keyboard navigation | All interactive elements reachable by keyboard |
| Screen reader support | ARIA labels on all interactive elements |
| Focus indicators | Visible focus state on all interactive elements |

---

## 8. Logging Standards

| Standard | Requirement |
|----------|-------------|
| Structure | JSON format with timestamp, level, module, message, correlation_id |
| Levels | ERROR, WARN, INFO, DEBUG |
| PII | No PII in logs (use correlation IDs) |
| Retention | Logs in Cloudflare dashboard + D1 audit store |

---

## 9. Monitoring Standards

| Standard | Requirement |
|----------|-------------|
| Health endpoint | `GET /api/v1/health` returns `{ status: "ok" }` |
| Error tracking | All API errors logged |
| Audit trail | All auth, RBAC, and admin actions in `audit_logs` |
| Alerting | Error rates > 1% trigger alert |

---

## 10. Release Standards

| Standard | Requirement |
|----------|-------------|
| CI/CD pipeline | Typecheck → Test → Build → Deploy (preview) → Human Approval → Deploy (prod) |
| Versioning | Feature tags + release tags |
| Rollback | Quick rollback via wrangler versions |
| Release notes | Every release has notes documenting changes |
| Smoke tests | Post-deployment smoke tests |

---

*End of Volume 07*