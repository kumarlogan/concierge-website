# ADR-010: Trust & Identity as an AI Platform Capability

| Field | Value |
|---|---|
| **ID** | ADR-010 |
| **Status** | ✅ Accepted |
| **Date** | 2026-07-26 |
| **Category** | Architecture · Platform · Security |
| **Author** | AI Platform Architecture |
| **Related Phase** | Phase 2 — Wave 1 (Architecture) |
| **Supersedes** | — |
| **Superseded By** | — |

---

## Context

Phase 1 established the operational foundation for the AGS AI Platform and the Concierge product. Phase 2 introduces patient-facing features, which require authentication, authorization, consent management, and PHI protection.

The organization architecture (ADR-004, ADR-005) established that:

1. **AI Platform capabilities are reusable** — They serve all products, not just Concierge
2. **Provider abstraction is mandatory** — No vendor lock-in at any layer
3. **Identity and PHI must be separated** — Different stores, different encryption, different governance

The existing `workers/src/auth/` engine (EPIC-002-002) provides authorization (principal building, RBAC, audit) but not authentication, identity lifecycle, consent, delegation, or trust evaluation.

## Decision

**Create Trust & Identity as a first-class AI Platform capability** with the following scope:

### What it IS

1. A **reusable platform capability** that all AGS products consume through stable interfaces
2. **Provider-agnostic identity abstraction** — All identity providers (Google, Apple, Microsoft, local, passkeys, enterprise SSO) are registered behind a neutral `IdentityProvider` interface
3. **12 platform interfaces** — `IdentityProvider`, `IdentityResolver`, `AuthenticationService`, `AuthorizationService`, `SessionManager`, `ConsentService`, `TrustEvaluator`, `RiskEngine`, `IdentityRegistry`, `AgentIdentity`, `AuditService`, `FederationGateway`
4. **Identity-PHI separation** — Identity data and PHI data are in separate stores with separate encryption keys
5. **Workforce identity model** — Every AI agent gets a first-class platform identity with lifecycle, permissions, trust scoring, and credential management
6. **Zero Trust architecture** — Every request evaluates identity, authentication, authorization, device, session, organization, role, product, consent, and risk
7. **Built on Workers, not external IdP** — The platform abstraction is implemented on Cloudflare Workers, not by embedding Keycloak/Authentik/ORY

### What it IS NOT

1. **Not Concierge-specific** — Concierge is a consumer of this capability, not the owner
2. **Not a replacement for the existing auth engine** — The existing `workers/src/auth/` RBAC engine continues to work and becomes a consumer of the Trust & Identity capability (receives authenticated principals)
3. **Not implemented yet** — This ADR covers architecture only. Implementation is Phase 2, Waves 2+

## Decision on Open-Source Identity Platform

**Do not embed any open-source identity platform as a runtime dependency at this stage.**

Evaluate the following platforms were reviewed: Keycloak, Authentik, ORY (Hydra + Kratos + Oathkeeper + Keto), Casdoor, Zitadel. All require persistent server infrastructure (JVM, Python, Go process + PostgreSQL) that is incompatible with the Cloudflare-first architecture.

Instead:
1. Build the **provider abstraction layer** on Workers
2. Use **Cloudflare Access** for staff/admin authentication
3. Self-build lightweight identity services for patient auth (local password, magic link, passkeys, consent)
4. **Re-evaluate for Phase 3+** when enterprise SSO at scale requires SAML federation
5. **ORY Kratos** is the recommended fallback if identity management exceeds self-build scope

## Rationale

1. **Cloudflare alignment** — No open-source IdP runs on Workers. Building on Workers keeps zero server management, automatic scaling, and edge-native performance.
2. **Operational simplicity** — Running a 1GB+ Keycloak instance or 4-service ORY stack for Phase 2 auth is disproportionate.
3. **Workforce identity** — No open-source IdP has a first-class AI agent identity model. Building it ourselves gives us exactly what we need.
4. **Consent management** — Healthcare consent management is not available in any evaluated platform.
5. **PHI boundary** — Embedding an external IdP would create PHI-adjacent data outside our security boundary.
6. **Provider abstraction** — The abstraction layer means we can add Keycloak/ORY as a backend later without changing interfaces.

## Consequences

### Positive

- Platform abstraction prevents vendor lock-in — any identity provider can be added/removed via configuration
- Identity-PHI separation ensures compliance-ready architecture from Phase 2
- Workforce identity model supports autonomous AI agent expansion
- Single audit stream across all identity events
- Consistent zero trust model across all products

### Negative

- Requires building identity services that open-source IdPs provide out-of-box (password management, MFA enrollment, WebAuthn, OTP delivery)
- No admin UI for identity management — must build platform admin interfaces
- Initial implementation effort is higher than embedding an existing IdP

### Mitigations

- ORY Kratos is identified as the fallback if self-build becomes too complex
- Cloudflare Access handles staff/admin authentication (reducing custom build scope)
- Existing Workers patterns and provider abstractions from Phase 1 accelerate development
- Phase 2 Waves 2+ can prioritize the most impactful identity services first

## Related Decisions

| Decision | Relationship |
|---|---|
| ADR-001 (Cloudflare-native architecture) | Consistent with Cloudflare-first strategy |
| ADR-004 (Organization architecture) | Trust & Identity is an AI Platform capability, per org model |
| ADR-005 (Hermes platform) | Extends Hermes platform with identity services |
| D-009 (Phase 2 scope) | Trust & Identity enables Epic 2.1 — Patient Identity & Authentication |
| D-006 (AI Platform separation) | Consistent with provider-neutral, interface-driven design |
| EPIC-002-002 (Auth engine) | Existing RBAC engine becomes a consumer of Trust & Identity |

---

*This ADR is architecture-only. No application code, database migrations, API changes, or UI work is authorized by this record.*