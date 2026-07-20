# EPIC-004 TESTING — Instructions & Coverage

## Run everything
```bash
cd workers
npx vitest run                 # full suite (415 tests)
npm run typecheck              # tsc --noEmit (EPIC-004 sources clean)
```

## Run only EPIC-004
```bash
cd workers
npx vitest run tests/epic-004-audit-store.test.ts \
             tests/epic-004-workflow-store.test.ts \
             tests/epic-004-agent-state-store.test.ts \
             tests/epic-004-persistence-provider.test.ts \
             tests/epic-004-tenant-boundary.test.ts
```
Or use the name pattern: `npx vitest run --testNamePattern "EPIC-004"`.

## What each test file proves
| File | Coverage |
|---|---|
| `epic-004-audit-store.test.ts` | Events persist through abstraction; tenant isolation; query filtering; invalid event rejected (fail-closed). |
| `epic-004-workflow-store.test.ts` | State survives a new store instance over the same backend (restart sim); transition persistence; tenant separation; illegal transition rejected; failed-write fails closed. |
| `epic-004-agent-state-store.test.ts` | Disabled/suspended agent cannot execute; active+enabled can; illegal transition rejected; restored agent retains state; cross-tenant mutation denied. |
| `epic-004-persistence-provider.test.ts` | Memory provider bundles 3 stores (cached); future kinds (d1/postgres/kv) throw "future-ready" — no vendor lock-in. |
| `epic-004-tenant-boundary.test.ts` | Tenant enforcement ACTIVE in audit (queryScoped), workflow, agent paths; cross-tenant denied; unbound principal reads nothing; default store no regression. |

## Test design notes
- All EPIC-004 tests use **in-memory** backends — no D1/network. Fast, hermetic.
- "Restart simulation" = a new store instance over the **same backend** shows
  state survived (the backend outlives the store). This proves the seam is
  durable; a real D1 backend would survive process restart identically.
- Tenant enforcement is exercised with cross-tenant principals (DENY) and
  unbound principals (DENY) — fail-closed by construction.
- `canAgentAct()` is asserted as the single gate; no test bypasses it.
