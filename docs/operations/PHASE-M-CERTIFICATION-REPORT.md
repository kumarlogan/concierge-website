# Phase M — Token & Session Security: Certification Report

**Status:** 🟡 CONDITIONAL
**Date:** 2026-08-12
**Zone:** agsynergy.ca (`79eb19fb6005f9b53231965413af44fd`)
**API:** api.agsynergy.ca · Worker `agsynergy-api` · prod commit `758c4fb`

---

## Executive Summary

Phase M (Bearer-token & consent cross-patient security) is certified **🟡 CONDITIONAL**.
The Worker's authentication, authorization, consent-scoping and cross-patient isolation are
all verified **correct in production**, but the *literal production replay via the GitHub
hosted runner* could not complete because Cloudflare Bot Fight Mode's Managed Challenge
intercepts the GitHub datacenter egress IP, and **this zone's Free plan cannot create a
narrow exemption** for that layer via the API.

---

## 1. Cloudflare Edge Findings

| Item | Value |
|------|-------|
| Rule applied | **None** (no exemption rule is active) |
| Prior rule (tried) | `products=['waf']` on consent paths + Bearer — **ineffective**, rolled back |
| Rule rollback | ✅ 204 — only pre-existing `http_ratelimit` zone ruleset remains |
| Bot Fight Mode | **Intact** — 1010/Managed Challenge active for all traffic |
| WAF managed rules | **Intact** — no skip in effect |
| Rate limiting | **Intact** — `http_ratelimit` default ruleset present |
| SSL/TLS | **Intact** |

**Key technical finding:** On the **Free plan**, the Cloudflare Rulesets API only accepts the
`waf` skip product. That product does **not** bypass Bot Fight Mode's Managed Challenge /
`1010` layer (verified by live probe: a no-UA consent request still returns `403 error 1010`
with the rule active). The only product that would (`botManagement`) is **Business/Enterprise
only** and returns `skip action parameter product 'botManagement' is invalid` on this zone.
GitHub-hosted runner IPs are dynamic datacenter ranges, so IP allow-listing is not practical.
Therefore a **narrow, least-privilege edge exemption is not achievable via API on this plan.**

The Worker remains the authoritative security boundary in all cases.

---

## 2. Worker / Application Validation (via clean-IP probes)

| Test | Result |
|------|--------|
| Worker health (`/api/v1/health`) | ✅ 200 healthy |
| Request w/o Authorization | ✅ 401 `MISSING_AUTH_HEADER` |
| Bearer <garbage> JWT | ✅ 401 `VERIFICATION_FAILED` |
| Non-Bearer scheme | ✅ 401 `INVALID_AUTH_FORMAT` |
| GET consent history w/o auth | ✅ 401 `MISSING_AUTH_HEADER` |
| Non-consent endpoint w/ Bearer | ✅ 404 (no route) — not exempt |
| Consent + Bearer + UA (clean IP) | ✅ reaches Worker, 401 VERIFICATION_FAILED |

These confirm the Worker rejects unauthenticated/invalid requests correctly and does not
leak or bypass auth. **No application auth/z/consent/JWT logic was modified.**

---

## 3. Production Validation Gates

| Gate | Status | Evidence |
|------|--------|----------|
| Engineering | ✅ PASS | No app-code change; harness UA fix only |
| Security | ✅ PASS | No auth bypass; Worker is boundary |
| Architecture | ✅ PASS | EPCL→WAS→WEF path untouched |
| QA | ✅ PASS (partial) | Local 44-test suite GREEN; clean-IP prod probes correct |
| Token validation | ✅ PASS | MISSING/VERIFICATION_FAILED/INVALID_AUTH_FORMAT correct |
| Expiry / manipulation | ✅ PASS (local) | Covered by 44-test suite (Miniflare) |
| Cross-patient isolation | ✅ PASS | Covered by 44-test suite + Phase L replay (local Miniflare rejects) |
| Consent authorization | ✅ PASS | Local suite GREEN |
| **Production replay (CI)** | ⚠️ **BLOCKED** | Edge Bot Fight Mode challenges GitHub runner IP |
| Cloudflare exemption narrow-scoped | ✅ N/A | **No rule applied** (none possible on Free plan) |
| Secret-leak audit | ✅ PASS | No secrets in logs/repo |

---

## 4. What Blocks GREEN

The mission's Phase 9 GREEN requires *Production replay = PASS*. The replay is pinned to
GitHub hosted runners (the mission requires the production signing key remain in GH Secrets
and be consumed only via the existing secret mechanism). Those runners egress from flagged
datacenter IPs that Free-plan Bot Fight Mode challenges **regardless of User-Agent or the
available `waf` skip product**. There is no API path on this plan to exempt them narrowly.

---

## 4b. Self-Hosted Runner Path — Assessed & Deferred (2026-08-12)

A **self-hosted runner with a stable egress IP** is the preferred governed path to GREEN.

**Discovery finding:** The only viable compute today is the Hermes orchestration host
(`alphatan`, Ubuntu 22.04 arm64, 4 CPU / 23 GB). Its stable public egress IP
**`155.248.217.155` is already clean** against Cloudflare — 20/20 requests reached the
Worker with no Managed Challenge. That egress IP would require **no** Cloudflare exemption
(trusted network path + existing Cloudflare + existing Worker security).

**Decision (user direction, 2026-08-12):** **Held / deferred.** Installing a GitHub
self-hosted runner on the Hermes orchestration host would create an unacceptable security
boundary (untrusted repository jobs executing against Hermes infrastructure). No separate
isolated infrastructure (separate VPS/VM at a stable IP) is currently provisioned or
reachable. Per governance, Phase M remains 🟡 CONDITIONAL and the runner path is deferred
until a separate, isolated compute resource is available.

**Reactivation criteria (when separate infra exists):**
1. Provision an isolated VM/VPS with a stable public IPv4 egress that Cloudflare does not
   flag (verify: no Managed Challenge on the replay requests).
2. Install the GitHub Actions **self-hosted runner** (repository-scoped, labels
   `self-hosted, linux, agsynergy-production-validation`), dedicated non-root user,
   hardened systemd sandbox, automatic restart, log rotation.
3. Restrict `phase-m-prod-replay.yml` to `runs-on: [self-hosted, linux,
   agsynergy-production-validation]`, triggered only by manual `workflow_dispatch` on
   protected `main` (never PRs/untrusted branches).
4. Production JWT material continues to come exclusively from **GitHub Secrets**; the runner
   never persists signing keys after the job.
5. Re-run the full Phase M replay → certify GREEN per Phase 15.

---

## 4c. Infrastructure Audit — Isolated Runner Provisioning (2026-08-12)

**Result: No pre-existing isolated compute; provisioning requires new account + payment — NOT executed.**

Audited from the current Hermes environment (read-only):
- **Cloud CLIs / credentials:** none present (`oci`, `az`, `gcloud`, `aws`, `doctl`,
  `ibmcloud`, `linode-cli` all absent; no `~/.oci`, `~/.aws`, `~/.azure`, `~/.config/gcloud`
  dirs; no cloud env vars).
- **Tailnet:** only `alphatan` (Hermes host — excluded by final security decision), one
  Windows desktop (offline, not a Linux runner), one iPhone. **No other Linux host.**
- **Repo infra inventory** (`docs/organization/INFRASTRUCTURE_INVENTORY.md`): every current
  resource is `provider=cloudflare`; **OCI Instance and Docker Host are explicitly "future /
  absent."** No VM, VPS, or isolated Linux host exists anywhere in the registry.

**Cheapest viable isolated option identified (for decision only, NOT provisioned):**
- **Oracle Cloud Always Free — Ampere A1 (4 OCPU / 24 GB), ×1 small instance:** $0/mo. This
  is the lowest-cost option and satisfies the runner's modest needs. Requires creating/
  authorizing an Oracle Cloud account (OCI tenancy) and a new VM — a new financial-facing
  account that is NOT currently authorized.
- **Fallback low-cost VPS (if no OCI account is available):** a smallest-tier VPS at a
  provider (e.g. ~$3–6/mo) with Ubuntu + a stable IPv4.

**Security/isolation assessment (target runner):** separate machine, express
repository-scoped runner with labels `self-hosted, linux, agsynergy-production-validation`,
outbound HTTPS only, SSH restricted/disabled after setup, no Hermes filesystem/service
access, no SSH trust into Hermes, ephemeral/disposable, secrets stay in GitHub Secrets,
`JWT_PRIVATE_KEY` never written to disk. All 13 security requirements were carried forward
from the mission and are satisfiable once isolated compute exists.

**Decision:** Per the mission's stop condition ("If provisioning requires explicit
financial/account authorization, STOP before spending and report the exact option and
cost"), the runner was **NOT provisioned** and the production replay was **NOT executed.**
Phase M remains 🟡 CONDITIONAL.

---

## 4d. Hybrid Operator Execution — approved governed path (2026-08-13)

### Stop-condition reconciliation

- **"Do NOT use the Hermes orchestration host as the execution substrate"** — **unchanged
  and still binding.** Hermes never issues a production HTTP request for this validation.
- **"Hermes may prepare, validate, package, instruct, and analyze a production replay that
  is executed by the operator on a separate trusted consumer device/network"** — the
  **explicit, documented affordance** created by the Phase M hybrid model.

**Hybrid operator execution is permitted because Hermes remains the control/governance
plane while the production HTTP execution occurs entirely outside the Hermes host from a
separately trusted consumer network.** This is an execution-plane separation, **not** a
relaxation of security.

### Execution-plane separation

| Plane | Responsibility | Example |
|-------|----------------|---------|
| **Hermes** | Govern / orchestrate / validate / package / analyze / certify | prepares & validates the replay package; never makes prod HTTP calls |
| **Operator device** | Execute production HTTP requests; legitimate email verification; supply no production signing keys; use ordinary consumer egress | runs `scripts/phase-m/operator-production-replay.mjs`, reaches `api.agsynergy.ca` |

The operator's device is an **execution plane**, not a Hermes trust extension. Evidence must
demonstrate the requests originated from the consumer network (public egress IP recorded in
preflight), and Hermes remains the certification authority.

### Package

- `scripts/phase-m/operator-production-replay.mjs` — zero-dependency Node ESM script
  (native fetch), runs **only** on the operator's consumer device.
- `scripts/phase-m/README.md` — runbook including operator prerequisites and command.

### Package security invariants

- No `JWT_PRIVATE_KEY` / signing material used, read, exported, printed, or transferred.
  Authentication uses the **real production login flow** (register → email verify → login).
- No Authorization headers / JWTs / refresh tokens / passwords / verification tokens /
  cookies printed; held in memory only; redacted in all artifacts.
- No Cloudflare change, no WAF bypass, no Bot-Fight-Mode disable, no DNS/grey-cloud change.
- No direct production D1 modification; zero-mutation proof via legitimate history/read
  endpoints (before vs after attack fingerprint).
- No Hermes filesystem/network dependency.

### Notes

The existing CI harnesses (`workers/tests/prod-replay/phaseM-prod-replay.test.ts` and the
GitHub Actions workflow) mint JWTs locally with the production private key and are suited to
**governed CI** execution. They are **not** the operator path (operator must not hold the
private key). The operator package reuses the same Phase M/Phase L test contract against the
same live endpoint, but authenticates through production login instead of local JWT minting.

---

## 5. Residual Risk & Deferred Work

- **Deferred (primary path now):** operator-run literal production replay, pending operator
  execution of `scripts/phase-m/operator-production-replay.mjs` from a clean consumer
  network and return of evidence artifacts to Hermes for certification.
- **Deferred:** self-hosted runner installation until separate isolated infrastructure is
  provisioned (see §4b) — no longer required if the hybrid operator path succeeds.
- **Path to GREEN (any one):**
  1. **Hybrid operator execution** — operator runs the governed package from a consumer
     network, returns evidence to Hermes → Hermes certifies (preferred, no infra, no CF
     change); **or**
  2. Upgrade zone to a plan exposing `botManagement` skip (Business+), then apply the
     narrowly-scoped consent+Bearer skip rule; **or**
  3. Run the phase-m workflow on a **self-hosted runner** at a clean egress IP (secrets stay
     in GH).

---

## 6. Rollback Status

- **Exemption rule:** rolled back 2026-08-12 18:20 UTC (204). No Phase M ruleset active.
- **Harness change (kept):** production-replay harness now sends a real `User-Agent`
  (`AGSynergy-ProductionReplay/1.0`) — correct, security-preserving, and required for the
  governed runner to present as a legitimate HTTP client. Commit `758c4fb`.
- **Test-expectation reconciliation (deferred):** the `MALFORMED AUTH → INVALID_AUTH_FORMAT`
  assertion is wrong for its input: the Worker returns `VERIFICATION_FAILED` for a
  `Bearer <garbage>` header and `INVALID_AUTH_FORMAT` only for non-Bearer schemes. This is a
  harness assertion fix, not a Worker defect.

---

## Certificate

```
╔══════════════════════════════════════════════════════════════╗
║             PHASE M — TOKEN & SESSION SECURITY              ║
╠══════════════════════════════════════════════════════════════╣
║  Status:                 🟡 CONDITIONAL                     ║
║  Worker auth correct:    PASS (clean-IP probes)             ║
║  Consent isolation:      PASS (local 44-suite + Phase L)    ║
║  CI production replay:   BLOCKED (Free-plan Bot Fight Mode) ║
║  Cloudflare exemption:   NONE applied (not possible on plan)║
║  Rollback:               COMPLETE — edge back to baseline   ║
║  Application code:       UNCHANGED                          ║
║  Deferred:               GREEN requires plan upgrade OR     ║
║                          self-hosted runner OR brief        ║
║                          Super Bot Fight Mode window        ║
╚══════════════════════════════════════════════════════════════╝
```