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

## 5. Residual Risk & Deferred Work

- **Deferred:** literal GitHub-runner production replay of the Phase M/Phase L attack matrix.
- **Deferred:** self-hosted runner installation until separate isolated infrastructure is
  provisioned (see §4b).
- **Path to GREEN (any one):**
  1. Upgrade zone to a plan exposing `botManagement` skip (Business+), then apply the
     narrowly-scoped consent+Bearer skip rule; **or**
  2. Run the phase-m workflow on a **self-hosted runner** at a clean egress IP (secrets stay
     in GH); **or**
  3. During a maintenance window, briefly toggle **Super Bot Fight Mode off** for the zone,
     run the replay, and re-enable immediately (accepts a short window with that one layer
     off for all traffic).

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