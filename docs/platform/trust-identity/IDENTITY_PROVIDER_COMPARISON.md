# Open-Source Identity Platform Comparison

> **Evaluation of open-source identity and access management platforms**
> for the AGS AI Platform Trust & Identity capability.
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
Capability:     Trust & Identity — Provider Evaluation
```

---

## 1. Evaluation Criteria

| # | Criterion | Weight | Description |
|---|---|---|---|
| 1 | Architecture Fit | High | Does the platform align with AGS's provider-neutral, interface-driven architecture? |
| 2 | Extensibility | High | Can we add custom authentication flows, identity types, and consent models? |
| 3 | Cloudflare Compatibility | Critical | Can it run on or integrate with Cloudflare's edge platform? |
| 4 | API Compatibility | High | Does it expose a clean REST/gRPC API for platform integration? |
| 5 | Self-hosting | Medium | Can we self-host on our infrastructure without vendor dependency? |
| 6 | Provider Federation | High | Does it support Google, Apple, Microsoft, OIDC, SAML, passkeys? |
| 7 | Audit Capabilities | High | Comprehensive, immutable audit logging? |
| 8 | MFA | High | TOTP, WebAuthn, SMS, email OTP? Adaptive MFA? |
| 9 | Passkeys (WebAuthn) | High | Native WebAuthn/passkey support? |
| 10 | OIDC Compliance | High | Certified OIDC provider? |
| 11 | OAuth2 Compliance | High | OAuth2 authorization server? |
| 12 | Operational Complexity | Medium | Deployment, scaling, DB requirements, maintenance burden? |
| 13 | Workforce Identity | Medium | Support for machine/agent identities, service accounts? |
| 14 | Community & Ecosystem | Low | Active development, community size, extension ecosystem? |
| 15 | License | Medium | Permissive vs copyleft? Commercial implications? |

---

## 2. Platforms Evaluated

### 2.1 Keycloak

| Attribute | Value |
|---|---|
| **Vendor** | Red Hat / WildFly |
| **License** | Apache 2.0 |
| **Language** | Java |
| **Latest Version** | 26.x |
| **OIDC Certified** | ✅ Yes |
| **OAuth2** | ✅ Full |
| **SAML** | ✅ Full |
| **WebAuthn** | ✅ Yes |
| **MFA** | ✅ TOTP, WebAuthn, SMS, email, backup codes |

**Strengths:**
- Most mature and widely-deployed open-source IdP
- Comprehensive OIDC/OAuth2/SAML support
- Built-in user federation and identity brokering
- Rich admin console
- Extensive customization via SPI (Service Provider Interfaces)
- Event listener system for audit
- Large community and enterprise support

**Weaknesses:**
- **Java-based** — Heavy JVM footprint (~1GB+ RAM baseline)
- Not Cloudflare-native — requires separate server infrastructure
- Complex deployment (requires relational database, JVM tuning)
- Admin console is UI-heavy, not API-first
- Eventual consistency model for some operations
- Custom themes and flows require Java development
- Upgrades are notoriously difficult (breaking changes between major versions)
- No native support for machine/service identities (workaround via service accounts)
- No consent management built-in (requires custom extension)
- No risk-based/adaptive authentication without custom SPI

**Architecture Fit: Medium** — Powerful but heavy. Would add significant operational overhead. The Java/JVM dependency contradicts our Cloudflare-first edge strategy.

### 2.2 Authentik

| Attribute | Value |
|---|---|
| **Vendor** | Goauthentik / Community |
| **License** | MIT (except Enterprise features) |
| **Language** | Python + Go (Go for proxy, Python for core) |
| **Latest Version** | 2024.x |
| **OIDC Certified** | ✅ Yes |
| **OAuth2** | ✅ Full |
| **SAML** | ✅ Full |
| **WebAuthn** | ✅ Yes |
| **MFA** | ✅ TOTP, WebAuthn, SMS, email, backup codes, DUO |

**Strengths:**
- Modern architecture (Python/Go, not Java)
- Built-in consent management
- Stage-based flow designer (visual but programmable)
- OIDC/OAuth2/SAML/LDAP/SCIM all supported
- WebAuthn and extensive MFA options
- Good REST API for integration
- Built for containerized deployment (Docker Compose, Kubernetes)
- Active development with regular releases
- Policy engine for access decisions
- Enterprise features available (SSO, SSO enforcement)

**Weaknesses:**
- **Not Cloudflare-native** — Requires persistent server (not edge-compatible)
- Python base — adds operational dependencies (Celery, Redis, PostgreSQL)
- Flow designer is mostly UI-driven; harder to version-control as code
- Smaller community than Keycloak
- Some enterprise features require paid license
- Documentation can be inconsistent
- No native workforce/agent identity model (workaround via service accounts)
- No machine identity lifecycle (certificate management, mTLS)
- Audit is good but not immutable (can be rotated)

**Architecture Fit: Medium-High** — Better fit than Keycloak for modern deployments, but still requires persistent infrastructure off Cloudflare.

### 2.3 ORY Stack (Hydra + Kratos + Oathkeeper + Keto)

| Attribute | Value |
|---|---|
| **Vendor** | Ory Corp |
| **License** | Apache 2.0 |
| **Language** | Go |
| **OIDC Certified** | ✅ Yes (Hydra) |
| **OAuth2** | ✅ Full (Hydra) |
| **SAML** | ❌ Not supported natively |
| **WebAuthn** | ✅ Yes (Kratos) |
| **MFA** | ✅ TOTP, WebAuthn, SMS, email (Kratos) |

**Strengths:**
- **Go-based** — Single binary, low resource footprint, fast startup
- **Microservice architecture** — Each component is independent:
  - **Hydra** — OAuth2/OIDC server (stateless, no user store)
  - **Kratos** — Identity management + authentication
  - **Oathkeeper** — Proxy/identity-aware reverse proxy
  - **Keto** — Permission/relation-based access control
  - **Kratos** handles registration, login, MFA, WebAuthn, passwordless
- **API-first** — Everything through REST/gRPC
- **Stateless design** — Hydra is purely stateless (state in DB)
- **Small footprint** — Each service runs in <100MB
- **Excellent documentation**
- **Could potentially run on Cloudflare** — Kratos uses SQL backend, but stateless services could theoretically run on Workers
- **Identity schema is fully customizable** via JSON Schema
- **Self-service flows** are configurable JSON configs
- **WebAuthn support** in Kratos
- **OAuth2 + OIDC** certified

**Weaknesses:**
- **No SAML support** — Would require custom implementation or proxy
- **Microservice complexity** — Four services to deploy, configure, and maintain
- **No built-in admin UI** — Requires building a custom admin interface
- **No consent management** — Kratos handles authentication, not consent records
- **Keto permission model** is relation-based (Google Zanzibar), not RBAC — would need adapter layer to our RBAC engine
- **No built-in workforce identity** — Machine/agent identities require custom implementation
- **No risk-based/adaptive access** — Would need custom implementation
- **Oathkeeper integration** adds a reverse proxy layer — additional complexity
- **Hydra is OAuth2/OIDC only** — authentication is delegated entirely to Kratos
- **No SAML means** enterprise SSO requires a separate SAML proxy

**Architecture Fit: High** — The best architectural match for our interface-driven design. Go-based, API-first, stateless design aligns with Cloudflare principles. However, it's not a turnkey solution — it's a composable framework that requires integration work.

### 2.4 Casdoor

| Attribute | Value |
|---|---|
| **Vendor** | Casbin / Community |
| **License** | Apache 2.0 |
| **Language** | Go |
| **OIDC** | ✅ Yes |
| **OAuth2** | ✅ Full |
| **SAML** | ✅ Yes |
| **WebAuthn** | ✅ Yes |
| **MFA** | ✅ TOTP, WebAuthn, SMS |

**Strengths:**
- Go-based (single binary)
- Rich management UI
- OIDC, OAuth2, SAML all supported
- WebAuthn + MFA
- Built-in social login (Google, GitHub, etc.)
- Multi-tenant support
- Casbin-based access control

**Weaknesses:**
- Smaller community than Keycloak/Authentik/ORY
- Less mature than ORY for OIDC certification
- Still requires persistent server infrastructure
- Not designed for Cloudflare edge deployment
- No workforce identity model
- Documentation and API quality is variable

**Architecture Fit: Medium** — Viable but less compelling than ORY or Authentik.

### 2.5 Zitadel

| Attribute | Value |
|---|---|
| **Vendor** | CAOS / Zitadel |
| **License** | Apache 2.0 |
| **Language** | Go |
| **OIDC Certified** | ✅ Yes |
| **OAuth2** | ✅ Full |
| **SAML** | ❌ Not natively |
| **WebAuthn** | ✅ Yes (passwordless) |
| **MFA** | ✅ TOTP, WebAuthn, SMS, email |

**Strengths:**
- Built-in B2B multi-tenancy
- Passwordless-first design
- Good audit capabilities
- Go-based, single binary
- Good API documentation

**Weaknesses:**
- Still relatively new
- Requires PostgreSQL
- No SAML
- Heavy focus on multi-tenancy (we have a simpler model)
- Customization requires understanding Zitadel's specific patterns
- Not designed for Cloudflare edge deployment

**Architecture Fit: Medium** — Good technology but the multi-tenant focus is over-engineered for our needs.

---

## 3. Comparison Matrix

| Criterion | Keycloak | Authentik | ORY Stack | Casdoor | Zitadel |
|---|---|---|---|---|---|
| **Architecture Fit** | 🟡 Medium | 🟡 Medium-High | 🟢 High | 🟡 Medium | 🟡 Medium |
| **Extensibility** | 🟢 High (SPI) | 🟡 Medium (flows) | 🟢 High (API) | 🟡 Medium | 🟡 Medium |
| **Cloudflare Compat** | 🔴 Poor (JVM) | 🔴 Poor (Python) | 🟡 Medium (Go) | 🔴 Poor | 🔴 Poor |
| **API Compatibility** | 🟡 Medium | 🟡 Medium | 🟢 High (REST) | 🟡 Medium | 🟢 High |
| **Self-hosting** | 🟢 Yes | 🟢 Yes | 🟢 Yes | 🟢 Yes | 🟢 Yes |
| **Provider Fed** | 🟢 Full | 🟢 Full | 🟡 No SAML | 🟢 Full | 🟡 No SAML |
| **Audit** | 🟢 Good (events) | 🟡 Good (not immutable) | 🟢 Good | 🟡 Medium | 🟢 Good |
| **MFA** | 🟢 Full | 🟢 Full | 🟢 Full | 🟢 Full | 🟢 Full |
| **Passkeys** | 🟢 Yes | 🟢 Yes | 🟢 Yes | 🟢 Yes | 🟢 Yes |
| **OIDC** | 🟢 Certified | 🟢 Certified | 🟢 Certified | 🟢 Yes | 🟢 Certified |
| **OAuth2** | 🟢 Full | 🟢 Full | 🟢 Full | 🟢 Full | 🟢 Full |
| **SAML** | 🟢 Full | 🟢 Full | 🔴 No | 🟢 Full | 🔴 No |
| **Ops Complexity** | 🔴 High (JVM) | 🟡 Med (Python) | 🟡 Med (4 svcs) | 🟡 Medium | 🟡 Medium |
| **Workforce ID** | 🔴 Poor | 🔴 Poor | 🟡 Medium | 🔴 Poor | 🔴 Poor |
| **Community** | 🟢 Large | 🟡 Growing | 🟡 Growing | 🟡 Small | 🟡 Growing |
| **License** | 🟢 Apache 2.0 | 🟢 MIT | 🟢 Apache 2.0 | 🟢 Apache 2.0 | 🟢 Apache 2.0 |

---

## 4. Recommendation: **Use none directly; build a platform abstraction**

### 4.1 Primary Recommendation

**Do not embed any open-source identity platform as a runtime dependency.**

Instead, the AGS AI Platform Trust & Identity capability shall be:

1. **A provider abstraction layer** (as designed in [IDENTITY_PROVIDER_ABSTRACTION.md](./IDENTITY_PROVIDER_ABSTRACTION.md)) that wraps identity providers behind neutral interfaces
2. **Direct integration with Cloudflare services** for the authentication substrate:
   - **Cloudflare Access** — Staff/admin authentication (OIDC/OAuth2/SAML gateway)
   - **Cloudflare Zero Trust** — Service-to-service authentication
   - **D1 Sessions** — Session storage for stateful sessions
   - **Workers + WebAuthn API** — Passkey authentication
3. **Self-built, lightweight identity service** on Workers for:
   - Patient identity lifecycle
   - Consent management
   - Session management
   - Magic link / email OTP authentication
   - MFA orchestration

### 4.2 Rationale

| Factor | Why Not Embed | Why Build Abstraction |
|---|---|---|
| **Cloudflare fit** | No open-source IdP runs on Cloudflare Workers — they all require persistent servers (JVM, Python, Go process, PostgreSQL) | By building on Workers, we stay in our Cloudflare ecosystem with zero server management, automatic scaling, and edge-native performance |
| **Architecture alignment** | Embedding Keycloak/Authentik/ORY would create a second infrastructure stack outside Cloudflare with separate deployment, scaling, and security models | A platform abstraction keeps all identity logic in our provider-neutral pattern, consistent with our interface-driven design |
| **Operational simplicity** | Running a 1GB+ Keycloak instance or a 4-service ORY stack for patient authentication is disproportionate to Phase 2 needs | A Workers-based identity service is <100KB cold start, scales to zero, and costs nothing when idle |
| **Workforce identity** | No open-source IdP has a first-class AI agent identity model | We can model workforce identity precisely how we need it — agent lifecycle, trust scores, credential rotation, delegation |
| **Consent management** | None of the evaluated platforms have built-in healthcare consent management | We build consent management that matches our PHI compliance requirements exactly |
| **Future flexibility** | Embedding now creates migration cost later | The abstraction layer means we can add Keycloak/ORY/Entra ID as a *backend* later without changing the interface |

### 4.3 When to Re-Evaluate

If any of these conditions are met, re-evaluate:

1. **Phase 3+ — Enterprise SSO at scale** (1000+ staff users, complex SAML federation)
   - Consider: Cloudflare Access (managed) or Authentik (self-hosted)
2. **Phase 4+ — External developer API ecosystem** (third-party apps using OAuth2)
   - Consider: ORY Hydra for a certified OAuth2/OIDC server
3. **Regulatory requirement** for a certified OIDC provider (HIPAA audit requires certified IdP)
   - Consider: ORY Hydra (OIDC certified) behind the abstraction layer

### 4.4 Fallback: ORY Kratos for Identity Management

If identity management becomes too complex to self-build, **ORY Kratos** is the recommended fallback:
- Go-based, single binary, low footprint
- API-first design — no UI dependency
- Extensible identity schema
- WebAuthn, MFA, passwordless support
- Could run as a standalone Worker-compatible service
- No SAML requirement in Phase 2 (SAML needed only for enterprise, which is Phase 3+)

---

## 5. Platform Abstraction Benefits Summary

| Concern | Without Abstraction | With Abstraction |
|---|---|---|
| Vendor lock-in | Embedded Keycloak/Authentik | Swappable backends behind interface |
| Cloudflare alignment | Second infrastructure stack | Unified Cloudflare deployment |
| PHI isolation | External IdP has PHI-adjacent data | Identity data stays in platform boundary |
| Workforce identity | No model for AI agent auth | First-class agent identity lifecycle |
| Consent management | Must build alongside embedded IdP | Built into the platform layer |
| Audit consistency | Cross-system audit joins | Single audit stream |
| Migration cost | High (rip and replace) | Low (new backend adapter) |
| Phase 2 timeline | Months to deploy and configure | Weeks to build what we need |

---

## 6. Evaluation Record

```
Date:             2026-07-26
Evaluated by:     AI Platform Architecture
Platforms reviewed: Keycloak 26.x, Authentik 2024.x, ORY (Hydra+Kratos+Oathkeeper+Keto),
                    Casdoor, Zitadel
Recommendation:   Build platform abstraction on Workers
                  Re-evaluate for Enterprise SSO in Phase 3+
                  ORY Kratos as fallback if self-build exceeds scope
Status:           ✅ Architecture Decision Recorded (see ADR-010)
```

---

*This document is architecture-only. No application code, database migrations, API changes, or UI work is authorized by this document.*