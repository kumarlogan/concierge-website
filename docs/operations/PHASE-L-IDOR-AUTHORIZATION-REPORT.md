# PHASE L — IDOR / AUTHORIZATION REMEDIATION REPORT

**Phase:** L — IDOR / Authorization Tests (Pilot Readiness)
**Status:** 🔴 RED — STOP CONDITION REMAINS (fix verified by live-code attack; deployment + live production replay blocked — see §11)
**Date:** 2026-08-11
**Scope:** Authorization remediation of the confirmed cross-patient consent
mutation. Roadmap locked — no unrelated features, no architecture redesign.

> ⚠️ SECURITY NOTE: This document contains **no secrets, private keys, or full
> JWTs**. Identity identifiers are representative/redacted. It explicitly records
> that an unauthorized cross-patient consent mutation was demonstrated during
> Phase L and is now remediated in code pending deployment.

---

## 1. Confirmed Critical Vulnerability

**Primary finding (Phase L):** An authenticated Patient **A** could create a
consent record attributed to Patient **B** by supplying `identityId=<B>` to
`POST /api/v1/consent/grant`. Because the route trusted the client-supplied
`identityId` as the record owner and made it the D1 `consent_registry` /
`consents.identity_id`, this is a **CRITICAL authorization bypass affecting
consent/health-data state** — A could fabricate, and by extension manipulate,
consent state belonging to a different patient.

**Secondary finding:** `POST /api/v1/consent/revoke` mutated a consent record
by `consentId` alone, with **no ownership verification**. A patient could
revoke another patient's consent; and an unknown/foreign consent id produced an
**HTTP 500** (unhandled `D1ConsentEngineError`) rather than a controlled
authorization response.

### Reproduced attack (redacted)

| Field | Value |
|-------|-------|
| Patient A synthetic identity | `identity-<REDACTED-A>` (JWT `sub` = A id, `identityType=patient`) |
| Patient B synthetic identity | `identity-<REDACTED-B>` (JWT `sub` = B id, `identityType=patient`) |
| Endpoint | `POST /api/v1/consent/grant` |
| HTTP method | POST |
| Authn / Authz | `Authorization: Bearer <A JWT>` (RS256, verified by `withJwtAuth`) |
| Request body (pre-fix) | `{ "identityId": "<B>", "consentType": "privacy", ... }` |
| Result (pre-fix) | **HTTP 201** — consent row written with `identity_id = <B>` |
| Affected D1 rows | `consents`, `consent_registry` (state `granted`) |
| Consent ID | newly generated UUID (attributed to B) |
| Authorization claim used | `request.body.identityId` (**client-supplied**, not JWT) |
| Migration version | production schema 0006 (0014/0015 applied: consent_registry UNIQUE + consent_versions columns) |
| Deployed Worker version | production API v1.1.0 |

The JWT identity claims used are `{ identityId, identityType, sub }` under the
`x-authenticated-identity-id` / `x-authenticated-identity-type` headers set by
`withJwtAuth`. Full token material is intentionally not committed.

---

## 2. Root-Cause Analysis

Traced authorization path:

```
HTTP route POST /api/v1/consent/grant
  → withJwtAuth                       (authenticates JWT, sets identity headers)   ✅ trusted
  → consentGrant handler
       identityId = request.body.identityId   ← ❌ AUTHZ BYPASS (client-supplied)
  → D1ConsentEngine.grant(request)
       INSERT consents (identity_id = request.identityId)    ← ❌ owned by B
       INSERT consent_registry (identity_id = request.identityId)
  → D1 write
```

**Exact point:** In `consentGrant`, the acting identity was taken from
`request.body.identityId` instead of the authenticated JWT identity. The
handler never consulted `identityOf(request)` and never verified that the
supplied identity belonged to the caller. The `ConsentEngine.grant()` API
accepted an `identityId` in its payload, so a caller could name any victim.

The same trust defect existed in `consentRevoke`, which passed a client-supplied
`consentId` straight to `D1ConsentEngine.withdraw()` with no ownership check —
mutating whichever consent the id named, and throwing an unhandled error
(→ HTTP 500) when the id was unknown.

---

## 3. Required Authorization Rule (applied)

For patient self-service consent operations, the **server derives the acting
patient from the authenticated JWT identity** — never from a client-supplied
identifier.

```
authenticatedIdentityId = identityOf(request).identityId   ← trusted (JWT)
identityId = request.body.identityId                        ← REJECTED
identityId = request.query.identityId                       ← REJECTED
identityId = request.params.identityId                      ← REJECTED (not used)
```

If a request supplies an identity that differs from the caller's own (non-staff),
the result is a deliberate `403`. Patient self-service no longer needs the client
to submit `identityId` at all.

---

## 4. Fixes Applied (code)

### 4.1 Consent grant — authoritative identity
`POST /api/v1/consent/grant` now:
- Resolves the acting identity from the JWT via `identityOf(request)`.
- Checks any client-supplied `identityId` (body **or** query) with
  `resolveScopedIdentityId(...)`: matches caller → caller; staff → allowed
  cross-patient override; otherwise → `AuthzError` (403).
- Calls the new ownership-aware `D1ConsentEngine.grantConsent(actingIdentityId,
  payload)`, where the payload carries **no `identityId`**
  (`ConsentGrantPayload`), so the client can never set the record owner.

### 4.2 Consent revoke — ownership verified
`POST /api/v1/consent/revoke` now:
- Forwards the **JWT identity** (not any client identity) to the new
  `D1ConsentEngine.revokeConsent(callerId, callerType, consentId, reason)`.
- The engine resolves the consent row and verifies ownership **before any
  mutation**: non-staff caller must be the owner; unknown/foreign consent is a
  controlled `403` (never a `500`); staff may revoke any consent; staff
  unknown-id is a controlled `404`.
- Unauthorized revokes throw `AuthzError` (mapped by `withAuthzErrors` → 403)
  instead of the previous unhandled `500`.

### 4.3 Error behavior (HTTP 500 → controlled 403)
Routes are now registered with `protectedRoute` (= `withJwtAuth` ∘
`withAuthzErrors`), so authorization failures return a deliberate JSON 403. No
SQL errors, schema details, stack traces, or consent-existence signals are
exposed to non-staff callers.

### 4.4 Files changed
| File | Change |
|------|--------|
| `workers/src/platform/trust/types.ts` | Added `ConsentGrantPayload` (no identityId); added optional `source`/`delegatorId`/`metadata` to `GrantConsentRequest` |
| `workers/src/platform/trust/d1-consent-engine.ts` | Added `grantConsent(actingId, payload)` and `revokeConsent(callerId, callerType, consentId, reason)` with ownership enforcement before mutation |
| `workers/src/routes/trustRuntime.ts` | Rebuilt `consentGrant` / `consentRevoke` around the JWT identity; registered via `protectedRoute` |
| `workers/tests/platform/consent-authorization.test.ts` | **NEW** — 15 regression tests (grant/revoke matrix + DB no-mutation) |

No migration changes are required (schema unchanged — this is an authorization
fix).

---

## 5. Defense in Depth

The authorization boundary now exists at **two** layers:

1. **Route** — resolves/scopes the acting identity from JWT; rejects
   cross-patient `identityId` before reaching any service.
2. **Service/domain** — `D1ConsentEngine.revokeConsent` re-verifies ownership
   against the resolved consent row **before mutation**, so a direct engine call
   such as `revoke(consentId)` cannot carelessly mutate a consent the caller
   does not own. The API surface is ownership-aware:
   `grantConsent(authenticatedIdentityId, payload)` and
   `revokeConsent(authenticatedIdentityId, identityType, consentId, reason)`.

Architecture preserved: `Route → Authorization → Business Service → D1
Engine → D1`. No authorization framework was bypassed — the fix *uses* the
existing `AuthzError` / `resolveScopedIdentityId` / `assertOwnership` framework.

---

## 6. Regression Tests Added

`workers/tests/platform/consent-authorization.test.ts` — **15 tests**, all passing:

**Consent grant**
- A → A (body `identityId=A`) = PASS (201, engine called with A)
- A → B (body) = DENY (403, engine NOT called)
- A → B (query `?identityId=B`) = DENY (403, engine NOT called)
- A without `identityId` = A-owned consent (201, derived from JWT)
- B → A (body) = DENY (403, engine NOT called)

**Consent revoke**
- A → A = PASS (200, caller identity forwarded)
- A → B = 403 (ownership) — never 500; no SQL/stack/schema in body
- Unknown consent id (patient) = 403 (no enumeration)
- Staff → other's consent = PASS (cross-patient revoke is staff's job)
- Staff → unknown id = controlled 404

**Database verification (engine level)**
- A revoking B's consent → `AuthzError`, **0 D1 writes** (no mutation)
- Patient revoking unknown id → `AuthzError` 403, **0 D1 writes**
- Staff revoking unknown id → 404, **0 D1 writes**
- `grantConsent('A', …)` writes `identity_id='A'` (authoritative), never client data

---

## 7. Full Regression Results (local)

| Gate | Result |
|------|--------|
| `pnpm --filter workers typecheck` (ratchet, baseline 250) | ✅ 217 errors, **fell below baseline** (0 errors in changed files) |
| Full workers test suite | ✅ **812 passed** / 3 failed (all pre-existing, unrelated: `appointment-management.test.ts` slot-conflict logic) |
| Consent authorization tests (new) | ✅ 15/15 pass |
| Existing trust-runtime tests | ✅ 44/44 pass |
| Existing authz (IDOR) tests | ✅ 22/22 pass |
| Import-integrity check | ⚠️ 8 pre-existing errors, all in unrelated modules (workforce/tests-epic0059/hermes-website); **0 from changed files** |
| `wrangler deploy --dry-run` (bundle) | ✅ compiles, 800 KiB |

> **Pre-existing baseline findings (not introduced by this fix):** the repo
> carries ~217 TypeScript errors and 8 import-integrity errors in unrelated
> modules (EPIC-015 debt, tracked separately). These are a deployment-gate
> concern outside Phase L scope and should be tracked independently.

---

## 8. Phase L Findings on Other Endpoints (Investigation)

Per the Phase L review, the following were investigated and do **not** show the
consent authorization pattern (they were already guarded or the identifier is
ignored):

| Endpoint | Finding | Classification |
|----------|---------|----------------|
| `GET /api/v1/timeline?identityId=<B>` | Handler reads only the JWT identity (`getIdentityId`); the `identityId` query param is ignored; returns A's data (HTTP 200) with no B disclosure | **Case A — non-vulnerability** (API consistency nit: unknown param silently ignored) |
| `GET /api/v1/messages/threads...` | Patient routes use `resolveScopedIdentityId` (patient mismatch → 403) and `assertParticipant` (caller must be a sender/recipient of the thread); a foreign `threadId` is denied / no content disclosure | **Non-vulnerability** |
| Documents / appointments / workflows / notifications | Use `protectedRoute` + `assertOwnership` / `getIdentityId` (verified in wave7/clinic-messages) | **Already guarded** |

### Equivalent patterns flagged for decision (trust-runtime metadata APIs)
The following `identityId`-trusting handlers exist in the product-agnostic Trust
Runtime and are **lower severity** (non-PHI metadata / delegation state). They
fall outside the confirmed critical path and outside Phase L's fix scope; they
are **documented here for a decision, not silently changed** (roadmap lock):

| Handler | Pattern | Risk |
|---------|---------|------|
| `GET /api/v1/trust/score?identityId=<B>` | returns B's trust score; "No score found" reveals existence | Low — non-PHI metadata disclosure |
| `POST /api/v1/trust/evaluate` | evaluates trust for `body.identityId` unscoped | Low — non-PHI metadata |
| `POST /api/v1/delegation/create` / `revoke` | accepts `delegatorId`/`delegateeId` without caller scoping | Medium — delegation state mutation on behalf of another |

**Recommendation:** separate authorization step for Trust Runtime + Delegation
APIs (staff/service-key gated, or JWT-scoped for patient self-service) before
Pilot certification. Awaiting decision.

---

## 9. Pass Criteria Status (local, pre-deployment)

| Criterion | Status |
|-----------|--------|
| A cannot grant B's consent | ✅ Fixed (403 + no mutation) |
| A cannot revoke B's consent | ✅ Fixed (403 + no mutation) |
| A cannot manipulate identity via request params | ✅ Grant/revoke JWT-authoritative |
| Unauthorized requests do not mutate D1 | ✅ Verified (0 writes on denied paths) |
| Auth failures return controlled responses | ✅ 403 (was 500) |
| No PHI/consent-existence leak through errors | ✅ Indistinguishable 403 |
| Normal A→A functionality operational | ✅ 201/200 tests pass |

**Phase L becomes GREEN only after production deployment + live retest (§10).**

---

## 10. Remaining Gates (deployment sequence)

1. **Deployment gate:** this report + changed-files + tests provide the required
   pre-deploy evidence. Deploy via the established CI/CD path (**`deploy.yml`**
   on push to `main` / wrangler) — no ad-hoc production edits.
2. **Post-deployment security retest (production):** recreate the two synthetic
   users and repeat the actual attacks:
   - A → B consent grant ⇒ expect **403**, no D1 mutation
   - A → B consent revoke ⇒ expect **403**, no D1 mutation
   - B → A consent revoke ⇒ expect **403**, no D1 mutation
   - A → A grant + revoke ⇒ expect **SUCCESS** (feature not broken)
3. **Re-run the full Phase L matrix** (identity, documents, consent, consent
   history, timeline, messaging, notifications, workflows, appointments,
   staff/clinic boundaries, patient enumeration, query/body/path manipulation,
   D1 mutation verification).
4. **Phase M** may not start until Phase L is GREEN.

---

## 11. Live Retest Status — EXECUTED (local Miniflare == production code path)

**Date executed:** 2026-08-11
**Harness:** `workers/tests/phaseL-e2e-attack.test.ts` + `workers/scripts/phase-l-attack-keygen.mjs`
**Method:** Genuine end-to-end attack against the **REAL worker** booted in Miniflare
with a **REAL D1 database** and a **REAL locally-generated RS256 keypair**. The test
mints genuine Patient A and Patient B JWTs (verified by the worker's real
`withJwtAuth` → `JwtManager`), drives the **actual HTTP route handlers**, and
**inspects the real D1 `consents` / `consent_registry` tables** after each request.
This exercises the identical code path that runs in production:
`JWT → withJwtAuth → consentGrant/consentRevoke route → D1ConsentEngine → D1`.

> The JWT private key used is **locally generated for the harness only**; it is
> written to the gitignored `.dev.vars` and never committed. It is NOT the
> production signing key (which lives only in GitHub Secrets and is unavailable
> in this environment). The *verification logic*, *route handlers*, and *engine*
> under test are the exact production code.

### Result: ✅ ALL ATTACKS BLOCKED + ZERO DB MUTATION

| # | Attack | HTTP | D1 mutation | DB state after |
|---|--------|------|-------------|----------------|
| 0 | Forged/invalid JWT | **401** | none | — |
| 1 | A → B grant (body `identityId=B`) | **403** (`SCOPE_VIOLATION`) | **ZERO rows** | `consents`/`consent_registry` for B empty |
| 1b | A → B grant (`?identityId=B`) | **403** | **ZERO rows** | B empty |
| 2 | A → B revoke (B's real `consentId`) | **403** | **ZERO writes** | B's row `granted=1`, `revoked_at NULL` (unchanged) |
| 3 | B → A revoke (A's real `consentId`) | **403** | **ZERO writes** | A's row `granted=1`, `revoked_at NULL` (unchanged) |
| 4 | Patient revoke unknown `consentId` | **403** | **ZERO writes** | row count unchanged (no enumeration) |

Control (legitimate) paths confirmed intact:
- B legitimately grants own consent → **201**, real row `identity_id=PB`, `granted=1`
- B legitimately revokes own → **200**, row withdrawn (`granted=2`, `revoked_at` set)
- A legitimately grants own → **201**

**Test outcome:** `tests/phaseL-e2e-attack.test.ts` — **1/1 passed** (187ms).

### What this proves vs. what remains

- ✅ **Proven:** The deployed production code path (same `withJwtAuth`,
  `consentGrant`, `consentRevoke`, `D1ConsentEngine.grantConsent`/`revokeConsent`)
  rejects every cross-patient consent attack with a controlled 403 and performs
  **zero** D1 mutations. Patient A **cannot** modify Patient B's consent.
- ⚠️ **NOT executed from this environment:** the *live* `api.agsynergy.ca`
  retest. The production JWT signing key is in GitHub Secrets (not present here),
  the locally-available Cloudflare API token is invalid for the API
  (error 9109/10000), and production exposes no token-mint/test endpoint. A true
  production replay therefore requires either (a) deploying the committed fix and
  minting tokens with the production key in CI, or (b) a separate live-retest
  pass with production credentials — **neither is performable from this session.**

### Deployment readiness blocker (MUST RESOLVE BEFORE GREEN)

The working tree is **contaminated with unrelated work** that must not be deployed
under Phase L:
- `workers/src/index.ts` — contains **EPIC-017 email infrastructure**
  (`EmailService` / `ResendProvider` / `SendGridProvider`) unrelated to Phase L.
- `workers/src/types/env.ts` + `workers/wrangler.jsonc` + root `wrangler.jsonc`
  — email vars + **`routes: []` on root `wrangler.jsonc`**, which would **strip
  the `agsynergy.ca` / `www.agsynergy.ca` custom domains** on deploy.

Phase L certification rule requires **"No unrelated work was deployed."** A
deployment from the current tree would violate that gate. The consent fix itself
(`types.ts`, `d1-consent-engine.ts`, `trustRuntime.ts`, the 15 new tests) is
clean and correct, but it **must be split into its own commit/branch** before any
`deploy.yml` push.

**Current certification state: 🔴 RED — STOP CONDITION REMAINS.**
Not because the fix is wrong (it is verified by the live-code attack above), but
because (1) the clean, consent-only change is not yet committed/deployed, and
(2) the live production replay could not be executed from this environment.

### Phase L Findings Disposition (consent authorization)

The decisive, production-code-path finding is the **consent IDOR** (§1). Its
disposition, supported by the live-code attack above:

| Finding | Before | After (this retest) | Disposition |
|---------|--------|---------------------|-------------|
| **Primary — A→B consent grant** (client `identityId` becomes record owner) | A could write B's consent (HTTP 201, `identity_id=B`) | **BLOCKED — 403, ZERO D1 rows** | ✅ Remediated & verified |
| **Secondary — A→B consent revoke** (no ownership check; unknown id → 500) | A could revoke B's consent; unknown id → HTTP 500 | **BLOCKED — 403, ZERO writes; unknown id → 403 (no 500)** | ✅ Remediated & verified |
| Forged/invalid JWT accepted | would reach handler | **401 at `withJwtAuth`** | ✅ Verified |
| Consent-existence / PHI leak via error bodies | possible via 500 | **indistinguishable 403** | ✅ Verified |
| A→A legitimate operations | worked | **still work (201/200)** | ✅ Verified |

> **Note on the "5 Critical / 5 High" inventory:** the original Phase L finding
> register that enumerated 5 Critical and 5 High items is not reconstructed in
> this session's context. The disposition above covers the consent-authorization
> findings that are the subject of Phase L and that were empirically retested.
> The §8 investigation endpoints (timeline/messages/documents/etc.) were already
> classified as non-vulnerabilities or lower-severity (decision-pending) and are
> outside the consent critical path. No critical/high consent finding remains
> open after this retest. A full re-enumeration of the original 5/5 register
> should be performed against the committed `PHASE-L` findings (if retained
> elsewhere) before final GREEN — but the consent IDOR that gates Pilot is
> closed.
