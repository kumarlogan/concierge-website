# Trust & Identity — Threat Model

> **Security threat assessment for the Trust & Identity capability.**
> This document identifies threats, their impact, and mitigations for the identity, authentication, authorization, and trust domains.
>
> **Status:** Phase 2 — Wave 1 (Architecture)
> **Version:** 1.0.0
> **Last Updated:** 2026-07-26

---

## Governance Header

```
Company:        AGS
Platform:       AI Platform
Product:        Concierge (consumer)
Public Brand:   AG Synergy
Repository:     concierge-website
Capability:     Trust & Identity — Threat Model
```

---

## 1. Threat Categories

| Category | Description | Risk Level |
|---|---|---|
| **T-ID** | Identity threats — identity lifecycle, registration, verification | High |
| **T-AUTHN** | Authentication threats — credential theft, session hijack, MFA bypass | Critical |
| **T-AUTHZ** | Authorization threats — privilege escalation, permission bypass | Critical |
| **T-SESSION** | Session threats — token theft, session fixation, replay | High |
| **T-CONSENT** | Consent threats — consent bypass, consent replay, stale consent | High |
| **T-TRUST** | Trust threats — trust manipulation, risk bypass | Medium |
| **T-PHI** | PHI threats — PHI exfiltration, boundary crossing, encryption failure | Critical |
| **T-AGENT** | Agent threats — agent impersonation, credential theft, scope bypass | High |
| **T-AUDIT** | Audit threats — log tampering, audit bypass, retention failure | High |
| **T-FED** | Federation threats — IdP compromise, token substitution, CSRF at IdP | Medium |

---

## 2. Threat Register

### 2.1 Identity Threats (T-ID)

| ID | Threat | Likelihood | Impact | Mitigation |
|---|---|---|---|---|
| T-ID-01 | Identity enumeration via registration API | Medium | Medium | Rate-limit registration attempts; use constant-time responses for "exists" vs. "doesn't exist" |
| T-ID-02 | Account takeover via support/verification bypass | Low | Critical | Multi-channel verification; support cannot bypass verification; audit all account recovery |
| T-ID-03 | Fake identity registration (bots, Sybil attack) | Medium | Medium | Rate limiting, CAPTCHA integration (TBD), email/SMS verification required |
| T-ID-04 | Identity store compromise | Low | Critical | Encryption at rest, key separation, access logging, no PHI in identity store |
| T-ID-05 | Orphaned identity (identity without proper lifecycle) | Medium | Low | Scheduled identity lifecycle audit; automated suspension of inactive identities |

### 2.2 Authentication Threats (T-AUTHN)

| ID | Threat | Likelihood | Impact | Mitigation |
|---|---|---|---|---|
| T-AUTHN-01 | Password brute force / credential stuffing | High | High | Rate limiting, account lockout after N failures, CAPTCHA, MFA |
| T-AUTHN-02 | MFA bypass (TOTP phishing, SMS intercept) | Medium | High | WebAuthn as preferred MFA; step-up auth on sensitive operations; risk-based challenges |
| T-AUTHN-03 | OAuth2 authorization code intercept | Low | High | PKCE required for all OAuth2 flows; state parameter validation |
| T-AUTHN-04 | JWT token forgery | Low | Critical | RS256/ES256 signatures with platform-managed keys; short TTL; no sensitive data in claims |
| T-AUTHN-05 | Session token replay | Medium | High | Token binding (device fingerprint, IP, nonce); short TTL |
| T-AUTHN-06 | Authentication provider compromise | Low | Critical | Provider abstraction limits blast radius; multiple providers; audit detects anomalous patterns |
| T-AUTHN-07 | Passkey phishing | Low | Medium | WebAuthn origin binding prevents cross-site usage; RP ID is platform-owned |

### 2.3 Authorization Threats (T-AUTHZ)

| ID | Threat | Likelihood | Impact | Mitigation |
|---|---|---|---|---|
| T-AUTHZ-01 | Privilege escalation via permission configuration | Low | Critical | Deny-wins permission resolution; no implicit grants; audit on permission changes |
| T-AUTHZ-02 | Authorization check bypass | Low | Critical | Authorization is middleware-enforced, not opt-in; fail-closed on missing middleware |
| T-AUTHZ-03 | Horizontal privilege escalation (User A accesses User B's data) | Medium | High | Tenant isolation at query level; OWNER check short-circuits to authorized only for same-ID resources |
| T-AUTHZ-04 | Permission cache poisoning | Low | Medium | No permission caching for deny decisions; allow decisions re-validated periodically |

### 2.4 Session Threats (T-SESSION)

| ID | Threat | Likelihood | Impact | Mitigation |
|---|---|---|---|---|
| T-SESSION-01 | Session hijacking via XSS | Medium | High | HttpOnly, Secure, SameSite=Strict cookies; CSP headers; no sensitive data in localStorage |
| T-SESSION-02 | Session fixation | Low | Medium | Sessions created only after successful auth; old sessions invalidated on new login |
| T-SESSION-03 | Session token in URL/logs | Low | High | Tokens sent only in Authorization header; logs automatically redact Authorization headers |
| T-SESSION-04 | Session replay after logout | Medium | Medium | Sessions revoked on server on logout; short token TTL limits window |

### 2.5 Consent Threats (T-CONSENT)

| ID | Threat | Likelihood | Impact | Mitigation |
|---|---|---|---|---|
| T-CONSENT-01 | Consent bypass via direct PHI access | Low | Critical | PHI access always checks consent before data retrieval; consent check is middleware, not opt-in |
| T-CONSENT-02 | Stale consent used after revocation | Low | High | Consent snapshot bound to session; re-verified on PHI-sensitive operations |
| T-CONSENT-03 | Consent record tampering | Low | High | Append-only consent log; integrity hashing; audit on every change |

### 2.6 Trust Threats (T-TRUST)

| ID | Threat | Likelihood | Impact | Mitigation |
|---|---|---|---|---|
| T-TRUST-01 | Trust score manipulation | Low | Medium | Trust factors are system-calculated, not user-supplied; factors are cryptographically verified where possible |
| T-TRUST-02 | Risk evaluation bypass | Low | Medium | Trust evaluation is middleware, not opt-in; fail-closed on evaluation failure |
| T-TRUST-03 | False positive trust (trusting a bad actor) | Medium | High | Multi-factor trust calculation; no single factor grants unlimited trust |

### 2.7 PHI Threats (T-PHI)

| ID | Threat | Likelihood | Impact | Mitigation |
|---|---|---|---|---|
| T-PHI-01 | PHI exfiltration via API | Low | Critical | Field-level encryption; access logging; rate limiting; audit of bulk access |
| T-PHI-02 | PHI stored in logs or error messages | Medium | High | Log redaction; no PHI in error responses; automated log scanning |
| T-PHI-03 | PHI boundary crossing (identity ↔ product data leak) | Low | Critical | Separate stores; separate encryption keys; no PHI fields in identity store schema |
| T-PHI-04 | Encryption key compromise | Low | Critical | Key rotation; key access audit; keys never leave KMS |
| T-PHI-05 | Insecure document sharing | Medium | High | Time-limited, pre-signed URLs; document access logging; no public buckets |
| T-PHI-06 | De-identification failure | Low | Medium | De-identification is separate pipeline; not applicable until Phase 3+ |

### 2.8 Agent Threats (T-AGENT)

| ID | Threat | Likelihood | Impact | Mitigation |
|---|---|---|---|---|
| T-AGENT-01 | Agent impersonation | Medium | High | Short-lived credentials; certificate binding; platform verifies agent identity before each action |
| T-AGENT-02 | Agent credential theft | Medium | High | Automated rotation; revocation on security event; audit detects unauthorized use |
| T-AGENT-03 | Agent permission scope bypass | Low | High | Permission scope enforced at execution gateway; canAgentAct() + RBAC double-check |
| T-AGENT-04 | Agent delegation abuse | Low | Medium | Max delegation depth = 0; delegation is task-scoped; audit at every delegation link |
| T-AGENT-05 | Rogue agent execution | Low | Critical | Execution gateway (fail-closed); agent approval gated by human; trust score monitoring |

### 2.9 Audit Threats (T-AUDIT)

| ID | Threat | Likelihood | Impact | Mitigation |
|---|---|---|---|---|
| T-AUDIT-01 | Audit log tampering | Low | High | Append-only log; hash chain integrity; write permissions limited to platform services |
| T-AUDIT-02 | Audit log deletion | Low | High | Immutable storage; retention policy enforced by automated jobs; backup copies |
| T-AUDIT-03 | Audit log flooding (DoS via log bloat) | Medium | Low | Rate limiting on audit writes; log rotation; separate log storage with size limits |
| T-AUDIT-04 | Incomplete audit (missed events) | Low | High | Audit is mandatory middleware; services cannot opt out; verified by integration tests |

### 2.10 Federation Threats (T-FED)

| ID | Threat | Likelihood | Impact | Mitigation |
|---|---|---|---|---|
| T-FED-01 | IdP spoofing (attacker-provided identity) | Low | Medium | Provider registry validates IdP issuer; only configured providers accepted |
| T-FED-02 | Token substitution attack | Low | High | Nonce validation; aud claim check; subject binding to platform identity |
| T-FED-03 | IdP account takeover → platform account takeover | Low | High | Platform MFA independent of IdP MFA; risk-based challenge on IdP-linked accounts |
| T-FED-04 | Cross-tenant token reuse | Low | Critical | Tenant ID bound to session; all authorization checks include tenant scope |

---

## 3. Attack Tree: PHI Exfiltration

```
Goal: Exfiltrate PHI from the platform
├── 1. Compromise an authenticated session
│   ├── 1.1 Steal session token (XSS, MitM, log exposure)
│   │   └── Mitigation: HttpOnly cookies, CSP, TLS, log redaction
│   ├── 1.2 Brute force credentials
│   │   └── Mitigation: Rate limiting, lockout, MFA
│   └── 1.3 Bypass MFA
│       └── Mitigation: WebAuthn preferred, risk-based step-up
├── 2. Escalate privileges to PHI access
│   ├── 2.1 Modify own permissions
│   │   └── Mitigation: Deny-wins, no self-service permission elevation
│   ├── 2.2 Assume another user's identity
│   │   └── Mitigation: Horizontal tenant isolation, OWNER check
│   └── 2.3 Exploit admin role
│       └── Mitigation: MFA for admin, action-level audit, emergency access protocol
├── 3. Bypass consent check
│   ├── 3.1 Consent service unavailable
│   │   └── Mitigation: Fail-closed on consent failure
│   ├── 3.2 Stale consent snapshot
│   │   └── Mitigation: Re-verify consent on sensitive operations
│   └── 3.3 Modify consent records
│       └── Mitigation: Append-only log, integrity hash
└── 4. Exfiltrate encrypted data
    ├── 4.1 Obtain encryption keys
    │   └── Mitigation: Keys in KMS/HSM, never in application memory
    ├── 4.2 Brute force encryption
    │   └── Mitigation: AES-256-GCM, key rotation
    └── 4.3 Side-channel through logs/errors
        └── Mitigation: No PHI in logs, consistent error responses
```

---

## 4. Data Flow Threats

### 4.1 Authentication Data Flow

```
User → [TLS 1.3] → Cloudflare Edge → Worker Auth Gateway → Identity Provider → Identity Store → Platform

Threat: T-AUTHN-01 (credential stuffing)
  Mitigation: Rate limiting, lockout, CAPTCHA

Threat: T-AUTHN-05 (session replay)
  Mitigation: Token binding, short TTL

Threat: T-FED-02 (token substitution)
  Mitigation: Nonce validation, aud check
```

### 4.2 PHI Access Data Flow

```
User → [Auth] → Authorization → Consent Check → PHI Store → [Decrypt] → Response

Threat: T-PHI-01 (exfiltration)
  Mitigation: Field-level encryption, access logging, rate limiting

Threat: T-CONSENT-01 (consent bypass)
  Mitigation: Consent middleware is mandatory, not opt-in

Threat: T-PHI-02 (PHI in logs)
  Mitigation: Log redaction, automated scanning
```

### 4.3 Agent Execution Data Flow

```
Agent → [Agent Auth] → Execution Gateway → RBAC Check → Trust Eval → Action

Threat: T-AGENT-01 (agent impersonation)
  Mitigation: Short-lived credentials, certificate binding

Threat: T-AGENT-03 (scope bypass)
  Mitigation: canAgentAct() + RBAC double-check

Threat: T-TRUST-02 (risk bypass)
  Mitigation: Trust evaluation is middleware, fail-closed
```

---

## 5. Security Control Mapping

| Threat | Control Type | Control |
|---|---|---|
| T-AUTHN-01 | Preventive | Rate limiting, account lockout |
| T-AUTHN-02 | Preventive/Deterrent | WebAuthn MFA, risk-based challenges |
| T-AUTHN-03 | Preventive | PKCE, state validation |
| T-AUTHN-04 | Preventive | RS256 signatures, short TTL |
| T-AUTHN-05 | Preventive | Token binding |
| T-AUTHN-06 | Detective | Audit anomalies, provider health checks |
| T-AUTHZ-01 | Preventive | Deny-wins, audit on permission changes |
| T-AUTHZ-02 | Preventive/Deterrent | Mandatory auth middleware |
| T-AUTHZ-03 | Preventive | Tenant-scoped queries, OWNER check |
| T-CONSENT-01 | Preventive | Mandatory consent middleware |
| T-PHI-01 | Preventive/Detective | Field encryption, access logging, bulk access alerts |
| T-PHI-03 | Preventive | Separate stores, separate keys |
| T-AGENT-01 | Preventive | Short-lived credentials, cert binding |
| T-AGENT-03 | Preventive | Double-check (gateway + RBAC) |
| T-AUDIT-01 | Detective | Hash chain integrity, write-only permissions |

---

*This document is architecture-only. No application code, database migrations, API changes, or UI work is authorized by this document.*