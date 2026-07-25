# Provider Violation Model
## EPIC-005.4 · PHASE 4

> **Architecture-only.** Defines the fail-closed responses to provider runtime
> violations. Maps each violation class to an action (deny / quarantine /
> unload / revoke-trust / operator-notification) and to the trust-lifecycle
> state it produces. Reuses `TrustLifecycle` states (REJECTED / SUSPENDED /
> UNLOADED) — no new state machine invented. **No runtime code written.**

---

## 1. Response Vocabulary

| Action | Effect | Trust state after |
|---|---|---|
| **DENY** | Block the *current* execution (and this class going forward until cleared). No provider teardown. | unchanged (but streaked with a violation record) |
| **QUARANTINE** | Stop *new* executions; allow in-flight to finish; mark `SUSPENDED`; flag for operator review. | `SUSPENDED` |
| **UNLOAD** | Tear down the live provider (`provider.shutdown()` + remove from `liveProviders`). | `UNLOADED` |
| **REVOKE TRUST** | Force `REJECTED`; purge from marketplace effective-trust; require re-admission (fresh signature/approval). | `REJECTED` |
| **OPERATOR NOTIFICATION** | Emit a high-severity audit event + out-of-band alert (pager/webhook — operator-owned channel). Paired with any of the above. | depends on paired action |

**Fail-closed default:** when a violation is detected and the correct response
is ambiguous, the platform **DENIES + QUARANTINES** (stops new work, preserves
evidence) rather than continuing.

---

## 2. The Seven Violation Classes

### 2.1 Permission Denied
- **Trigger:** guard returns `denied:permission-missing` / `denied:capability-not-allowed` / `denied:tenant-mismatch` (PHASE 3 §3).
- **Response:** `DENY` the execution. Single instance = deny only. **Repeated**
  (≥ N within window, operator-tuned) = `QUARANTINE` + `OPERATOR NOTIFICATION`
  (possible misconfiguration or probing).
- **Audit:** `guard.deny` (decision: deny) + `PROVIDER_VIOLATION` (class: permission).

### 2.2 Timeout
- **Trigger:** execution exceeds `maxDurationMs` (guard deadline timer fires).
- **Response:** guard cancels the invocation (`provider.cancel`), records
  `TIMEOUT`. **First** timeout = `DENY` + record. **Repeated** timeouts =
  `QUARANTINE` (provider is unreliable/slow → protect the host).
- **Audit:** `transport.execute.failed` (code: TIMEOUT) + `PROVIDER_VIOLATION` (class: timeout).

### 2.3 Resource Exhaustion
- **Trigger:** sandbox backend reports memory/CPU over `limits.memoryMb` / CPU
  cap, or spawn count > budget (PHASE 2).
- **Response:** `DENY` current + `QUARANTINE` (a provider that exhausts
  resources is a stability + possible runaway risk). If exhaustion recurs after
  re-admission → `REVOKE TRUST`.
- **Audit:** `PROVIDER_VIOLATION` (class: resource) + operator alert.

### 2.4 Invalid Response
- **Trigger:** `provider.execute()` returns a result that violates the `Provider`
  SDK contract (missing `ok`, `ok:true` without `data`, `ok:false` without
  `code`, schema drift vs declared capability output).
- **Response:** `DENY` (return a normalized Hermes error to the caller, never
  the malformed payload). **Repeated** invalid responses = `QUARANTINE` +
  `OPERATOR NOTIFICATION` (provider is broken or adversarial).
- **Audit:** `PROVIDER_VIOLATION` (class: invalid-response) + `EXECUTION_FAILURE`.

### 2.5 Audit Failure
- **Trigger:** the guard's `emitAudit` call throws **or** the sink/store reports
  it could not persist (PHASE 3 §5). A provider action with **no audit trail**
  is itself a security violation — Hermes cannot operate blind.
- **Response:** `DENY` the execution + `QUARANTINE` the provider + `OPERATOR
  NOTIFICATION` (high severity — observability gap). The platform **never**
  proceeds with an unaudited provider action.
- **Audit:** `AUDIT_FAILURE` (decision: deny) + operator alert. (If the alert
  channel itself is down, the platform logs locally and keeps the provider
  quarantined.)

### 2.6 Trust Downgrade
- **Trigger:** `TrustLifecycle.reportHealth` marks `unhealthy` ≥ 3× → `SUSPENDED`,
  OR an operator/external signal lowers `trust.level`, OR a signature/approval
  expires.
- **Response:** `QUARANTINE` immediately (stop new executions). If downgrade is
  to `untrusted` or below the permission ceiling → `REVOKE TRUST` (→ `REJECTED`).
- **Audit:** `PROVIDER_TRUST_DOWNGRADED` + `PROVIDER_VIOLATION` (class: trust).

### 2.7 Provider Compromise Signal
- **Trigger:** observed-vs-declared drift that indicates the provider is doing
  something it was **not** granted (e.g. network egress when `network:"none"`,
  file writes outside scratch root, unexpected subprocess spawn, response
  containing data it should not have access to). This is the strongest signal —
  it means the sandbox boundary may have been crossed.
- **Response:** `REVOKE TRUST` (→ `REJECTED`) **immediately** + `UNLOAD` (tear
  down live instance to stop further activity) + `OPERATOR NOTIFICATION`
  (critical/page). No graceful finish — a compromise signal means assume breach.
- **Audit:** `PROVIDER_COMPROMISE_SIGNAL` (decision: deny, severity: critical)
  + full evidence capture (observed actions, declared policy).

---

## 3. Violation → Action Matrix

| Class | 1st occurrence | Repeated | Severity |
|---|---|---|---|
| Permission Denied | DENY | QUARANTINE + NOTIFY | medium |
| Timeout | DENY (+cancel) | QUARANTINE | medium |
| Resource Exhaustion | DENY + QUARANTINE | REVOKE TRUST | high |
| Invalid Response | DENY (normalize) | QUARANTINE + NOTIFY | medium |
| Audit Failure | DENY + QUARANTINE + NOTIFY | keep quarantined | **critical** |
| Trust Downgrade | QUARANTINE | REVOKE TRUST (if below ceiling) | high |
| Compromise Signal | REVOKE TRUST + UNLOAD + NOTIFY | — (already ejected) | **critical** |

---

## 4. State Transitions (reusing `ProviderLifecycleState`)

```
ACTIVE ──(violation: quarantine)──▶ SUSPENDED
ACTIVE ──(violation: unload)──────▶ UNLOADED
SUSPENDED ──(operator clears / re-admit)──▶ ACTIVE
SUSPENDED ──(revoke trust)────────▶ REJECTED
UNLOADED ──(re-load)──────────────▶ ACTIVE
ANY ──(compromise signal)─────────▶ REJECTED (+ UNLOADED)
```

No new states are added — `REJECTED` / `SUSPENDED` / `UNLOADED` already exist
in `sdk.ts`. The violation model only *triggers* these transitions.

---

## 5. Operator Notification Contract

- Notifications are **out-of-band** from the provider execution path (Hermes-
  owned channel: pager/webhook/console — never the provider's own transport).
- Every notification carries: `providerId`, `violationClass`, `observedAction`,
  `declaredPolicy`, `decision`, `at`, and `evidence` (the guard's captured
  metrics/violations).
- The notification sink is **injected** (like `emitAudit`'s `setAuditSink`) so
  tests can capture it and production can route to the operator alerting system.
- If the notification sink is unavailable, the platform **still** applies the
  DENY/QUARANTINE/REVOKE and records a local `NOTIFY_FAILURE` audit event — it
  never proceeds blindly because the pager is down.

---

## 6. Evidence Preservation

On any violation (especially compromise signal), the guard captures:
- the `GuardDecision` (category, reason),
- the `ProviderOutcome` (verbatim, normalized),
- the observed resource/violation metrics,
- the declared policy it violated (`SandboxPolicy`, `permissions`, `limits`).

This evidence is attached to the `REJECTED`/`SUSPENDED` record (extension of
`TrustRecord.rejectedAt`) so operators can answer *"why was this provider
ejected?"* — the same observability principle as `MarketplaceEntry.rejectionReason`.

---

*PHASE 4 complete. The violation model is fully defined, fail-closed, and reuses
existing trust states. Next: PHASE 5 (Marketplace Security View).*
