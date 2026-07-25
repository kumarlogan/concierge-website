# Hermes Foundation v1.0 — Verification Report (EPIC-005.8A)

**What was verified:** The EPIC-005 test corpus was **actually executed**, not
just read. The review's security claims were checked against source with
`search_files` / `read_file` and a full `vitest` run.

**Environment:** Node v22.23.0; `vitest@4.1.9` (from the Hermes agent toolchain,
since `hermes/` has no own `node_modules`). Config: `hermes/vitest.config.js`
(`include: "**/*.test.ts"`, node env). Note: `hermes/vitest.epic005.config.ts`
has a broken `root: "../hermes"` (points outside the package) and a narrow
`include`; the run used the working `vitest.config.js` instead.

---

## 1. Test execution results — 102/102 PASS

| Suite | File | Tests | Result | What it proves |
|---|---|---|---|---|
| EPIC-005.1 | `services/providers/__tests__/epic-005.1.test.ts` | 12 | ✅ | Platform end-to-end: discover→validate→authorize→load→execute→audit; 10 fail-closed scenarios + happy path |
| EPIC-005.3 | `services/providers/__tests__/epic-005.3.test.ts` | 12 | ✅ | Transport seam is provider-neutral & fail-closed (unknown transport ⇒ no fallback) |
| EPIC-005.5 | `services/providers/__tests__/epic-005.5.test.ts` | 18 | ✅ | Runtime guard: 12 deny scenarios (trust/tenant/capability/sandbox/audit) + violation engine + marketplace projection |
| EPIC-005.6 | `services/execution/gateway/__tests__/epic-005.6.test.ts` | 20 | ✅ | **Single boundary**: tenant/policy/approval/guard all DENY before executor; approval-service verify (ghost/expired/missing/tenant-mismatch) |
| EPIC-005.8 | `services/providers/__tests__/epic-005.8.test.ts` | 8 | ✅ | Real crypto: SHA-256 checksum + HMAC signature verify/reject, tamper detection |
| dynamic | `services/providers/dynamic.test.ts` | 12 | ✅ | Dynamic pipeline: admission, collision detection, unload/reload |
| EPIC-004.6 | `services/execution/epic-004.6.test.ts` | 20 | ✅ | Execution security (tenant-scoped reads, decision emission) |
| **Total** | | **102** | **✅** | |

No test failures. No flaky/timeout signals. Run time ~1s.

---

## 2. Coverage that IS present (and verified)

- **Fail-closed gates** — every deny path asserts the executor never runs
  (`calls.length === 0`). Strong.
- **Tenant isolation** — cross-tenant principal DENIED at gateway (EPIC-005.6)
  and at `enforceTenant` (EPIC-004.6 read scoping).
- **Approval verification (gateway-level)** — EPIC-005.6 exercises the real
  `ApprovalService`: unknown approver, missing record, expired, capability
  mismatch, tenant mismatch → all DENY. This is the *correct* reference behavior.
- **Signature/checksum crypto** — EPIC-005.8 uses real SHA-256 + HMAC, not mocks.
- **Provider neutrality** — tests build fake providers inline; no vendor imports.

---

## 3. Coverage GAPS (not exercised by any test)

| Gap | Why tests miss it | Risk |
|---|---|---|
| **Stack B `human-token` approval** | No test calls `security-agent.executeCapability` with a fake token and asserts it is *rejected* when the token is unverifiable. EPIC-005.6's approval tests use the real `ApprovalService`, but Stack B bypasses it (`approvalRequired:false`) | CRITICAL-1 slips through green tests |
| **Audit durability** | `MemoryAuditStore` is the only impl; no test asserts survival across a "restart" or a D1 flush | CRITICAL-2 undetected |
| **Trust-state durability** | `InMemoryTrustStateStore` only; no test asserts a REVOKED provider stays revoked after re-init | HIGH-2 undetected |
| **Signature enforcement default** | EPIC-005.1 SCENARIO 10 passes `enforceSignatures:true` explicitly; no test asserts the *default* (`false`) is rejected | HIGH-1 default-permissive untested |
| **Marketplace install flow** | Only the read-only `safeExecuteAnswer` projection exists; no install/transaction tests (none needed yet — flow unimplemented) | scope delta, not a test gap |
| **End-to-end Stack B path** | EPIC-005.6/005.1 test Stack A + the gateway in isolation; the `provider-framework.executeCapability` → `stackBGateway` wiring is untested | the integration seam carrying CRITICAL-1 is unverified |

---

## 4. Interpretation

The test suite is **high quality and genuinely fail-closed for what it covers** —
it is not a change-detector or happy-path-only suite. However, it has a
**blind spot exactly at the two critical gaps**: the tests validate the gateway's
approval gate (correct) but never validate that Stack B actually *uses* it, and
they validate the in-memory stores (correct for a unit) but never assert
durability. A reviewer relying on "102 passing tests" alone would miss
CRITICAL-1 and CRITICAL-2.

**Recommendation:** Add two regression tests that would have caught the gaps:
1. `security-agent` invokes a `requiresApproval` capability via Stack B with a
   *fake/unverifiable* token → assert DENY (forces real `ApprovalService` use).
2. `defaultAuditStore` is replaced by a durable stub in a test that reinitializes
   the platform and asserts prior events survive (forces a real `AuditStore`).

---

## 5. Reproduce

```bash
cd /home/ubuntu/concierge-website/hermes
~/.hermes/hermes-agent/node_modules/.bin/vitest run \
  services/providers/__tests__/epic-005.1.test.ts \
  services/providers/__tests__/epic-005.3.test.ts \
  services/providers/__tests__/epic-005.5.test.ts \
  services/providers/__tests__/epic-005.8.test.ts \
  services/providers/dynamic.test.ts \
  services/execution/gateway/__tests__/epic-005.6.test.ts \
  services/execution/epic-004.6.test.ts \
  --config vitest.config.js
# → 7 files, 102 tests, 102 passed
```
