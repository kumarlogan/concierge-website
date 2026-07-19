# Testing Guide

> AG Synergy Platform — Backend Testing Foundation
> EPIC-001-008
> Last updated: 2026-07-18

## Testing Philosophy

**Test behaviour, not implementation.** Every test answers "what should this do?" — never "how is this built?"

Three layers of defence:

| Layer | Scope | Runtime | Speed |
|---|---|---|---|
| **Unit** | Pure functions, validation, business logic | Workerd | <100ms |
| **Integration** | HTTP endpoints, D1 persistence, CORS | Workerd + Miniflare | <500ms |
| **E2E** | Browser → Worker → D1 → Browser | Browser + Worker | Manual / CI |

This testing foundation covers layers 1 and 2. E2E verification is manual (via browser against production — see EPIC-001-005.5).

## Quick Start

```bash
# Run all tests
cd workers && pnpm test

# Run tests in watch mode (re-runs on file changes)
pnpm test:watch

# Run with coverage report
pnpm test:coverage
```

## Framework

- **Vitest 4.1** — test runner and assertion library
- **@cloudflare/vitest-pool-workers 0.18** — Workers runtime via workerd + Miniflare
- **Miniflare** — local D1, KV, R2 simulation
- **No mocking library** — stubs are handwritten (minimal, explicit, no magic)

## Test Structure

```
workers/
  tests/
    health/
      health.test.ts          # Health endpoint unit tests (10 tests)
    consultation/
      consultation.test.ts    # Consultation service unit tests (45 tests)
    integration/
      api.test.ts             # Full Worker → Service → D1 (19 tests)
    globalSetup.ts            # Applies D1 migrations before test run
  vitest.config.ts            # Vitest + Cloudflare Workers config
```

Tests mirror the feature structure. Every `src/routes/*.ts` gets a corresponding `tests/*/*.test.ts`. Every `src/services/*.ts` gets a corresponding `tests/*/*.test.ts`.

## Test Categories

### Unit Tests (55 tests)

Test pure functions directly — no Workers runtime needed.

**Health endpoint:**
- 200 status code
- JSON content type
- All 5 response fields present and correct
- Environment variable handling (default, production, preview)
- ISO 8601 timestamp format

**Consultation service:**
- Validation: required fields, type checks, empty rejection, email format, max lengths
- Normalization: email lowercase, whitespace trimming, name space collapsing, null message handling
- Duplicate detection: D1 query stubbing, SQL/bind verification
- Insert: UUID format, status default, ISO 8601 timestamps
- End-to-end service pipeline: valid → success, duplicate → 409, validation → 400

### Integration Tests (19 tests)

Full Worker pipeline via `exports.default.fetch()` + Miniflare D1.

**Health endpoint:**
- Live 200 response with expected fields
- Content-Type header

**Consultation workflow:**
- Happy path: 201 with UUID lead_id and status "new"
- Optional message field accepted
- Duplicate detection: 409 with "already exists" message
- Validation: 400 for missing fields, invalid email, empty strings
- Malformed requests: invalid JSON, array body, empty body → 400
- Normalization: email lowercase (verified by duplicate test), whitespace trimming
- D1 persistence: query leads table directly to confirm write

**CORS:**
- Allowed origin → Access-Control-Allow-Origin header set
- Disallowed origin → no CORS header
- OPTIONS preflight → 204 No Content

**Routing:**
- Unknown path → 404
- Wrong method → 404

## Writing New Tests

### Adding a unit test

1. Create `tests/<feature>/<feature>.test.ts`
2. Import the function/service directly from `../../src/...`
3. For D1-dependent services, use the `stubDb()` pattern:

```typescript
function stubDb(rows: Record<string, unknown>[] = []): D1Database {
  const first = vi.fn().mockResolvedValue(rows.length > 0 ? rows[0] : null);
  const run = vi.fn().mockResolvedValue(undefined);
  const prepare = vi.fn().mockReturnValue({
    bind: vi.fn().mockReturnValue({ first, run }),
  });
  return { prepare } as unknown as D1Database;
}
```

### Adding an integration test

1. Add tests to `tests/integration/api.test.ts` (or create a new file if it's a different domain)
2. Use `exports.default.fetch(request, env)` to call the Worker
3. If a new table is needed, add its DDL to the `beforeAll` block

### D1 schema in tests

The `beforeAll` in `tests/integration/api.test.ts` seeds the leads table. If new integration tests need other tables (contacts, consultations, clinics, etc.), add their DDL to that block.

## Coverage Expectations

| Area | Target | Current |
|---|---|---|
| Service functions (validation, normalization) | 100% | ✅ 100% |
| Route handlers (HTTP translation) | 90%+ | ✅ 100% |
| Error paths (400, 409, 500) | 100% | ✅ 100% |
| Integration (Worker → D1) | All critical paths | ✅ Happy path + duplicate + validation |
| CORS middleware | 100% | ✅ Allowed, disallowed, preflight |

## Running Tests in CI

```bash
# Install deps (only workers package needed for tests)
cd workers && pnpm install --frozen-lockfile

# Run tests
pnpm test

# Exit code 0 = all pass, 1 = failures
```

No external services needed — all tests run locally against Miniflare's in-memory D1.

## Troubleshooting

### "no such table: leads: SQLITE_ERROR"

Miniflare's D1 starts empty. The `beforeAll` block in the integration test file creates the schema. If this error appears for a new test, check that the required table's DDL is in the `beforeAll`.

### "Property 'default' does not exist on type 'Exports'"

TypeScript type error from `cloudflare:workers` type declarations. The runtime has the `.default` property — this is a type-only issue. It does not affect test execution.

### Tests pass locally but fail in CI

Check that `vitest` and `@cloudflare/vitest-pool-workers` versions are pinned in `package.json` (not `^` ranges). The Workers pool is sensitive to version mismatches.

## Future Testing Roadmap

| Milestone | Scope |
|---|---|
| EPIC-001-009 | Move globalSetup → proper D1 migration seeding in vitest config |
| Phase 2 | Add contact, consultation, clinic service tests |
| Phase 2 | Add authentication test helpers (mock JWT, session management) |
| Phase 3 | Add R2 storage tests (document upload, retrieval) |
| Phase 4 | Performance/load tests for critical paths |
| Continuous | Edge case fuzzing for validation (property-based testing) |