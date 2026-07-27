# Platform Identity Interfaces

> **Reusable, provider-neutral interface contracts for the Trust & Identity domain.**
> These interfaces define the contracts between the Trust & Identity capability and all consumers (products, workforce, integrations).
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
Capability:     Trust & Identity — Platform Interfaces
```

---

## 1. Interface Overview

| # | Interface | Purpose | Consumers |
|---|---|---|---|
| 1 | `IdentityProvider` | Authenticate users/agents against an identity source | Auth Gateway |
| 2 | `IdentityResolver` | Resolve external identities to platform identities | Auth Gateway, Authorization Engine |
| 3 | `AuthenticationService` | Orchestrate authentication flow across providers | Auth Gateway, any authenticated service |
| 4 | `AuthorizationService` | Check permissions for an authenticated principal | Protected routes, services |
| 5 | `SessionManager` | Create, validate, and revoke sessions | Auth Gateway, services |
| 6 | `ConsentService` | Manage and verify consent records | PHI-protected services |
| 7 | `TrustEvaluator` | Evaluate trust/risk for a request | Zero Trust Gateway |
| 8 | `RiskEngine` | Calculate risk score for a principal + context | TrustEvaluator |
| 9 | `IdentityRegistry` | Manage identity lifecycle | Admin, workforce services |
| 10 | `AgentIdentity` | Manage AI workforce identity lifecycle | Workforce Orchestration |
| 11 | `AuditService` | Record identity/trust audit events | All interfaces |
| 12 | `FederationGateway` | Normalize external identity provider claims | Auth Gateway |

---

## 2. Interface Contracts

### 2.1 IdentityProvider

```typescript
interface IdentityProvider {
  readonly id: string;
  readonly displayName: string;
  readonly supportedMethods: AuthMethod[];
  readonly metadata: ProviderMetadata;

  /** Initiate authentication */
  authenticate(request: AuthRequest): Promise<AuthResult>;

  /** Exchange authorization code for tokens (OAuth2/OIDC) */
  exchangeCode(code: string, redirectUri: string): Promise<TokenResult>;

  /** Validate and introspect an existing token */
  validateToken(token: string): Promise<TokenIntrospection>;

  /** Refresh an expired token */
  refreshToken(refreshToken: string): Promise<TokenResult>;

  /** Revoke a token */
  revokeToken(token: string): Promise<void>;

  /** Health check */
  health(): Promise<ProviderHealth>;
}
```

### 2.2 IdentityResolver

```typescript
interface IdentityResolver {
  /** Resolve a provider subject to a platform identity */
  resolve(subject: string, providerId: string): Promise<PlatformIdentity>;

  /** Link an external identity to an existing platform identity */
  link(platformId: string, providerId: string, subject: string): Promise<void>;

  /** Unlink an external identity */
  unlink(platformId: string, providerId: string): Promise<void>;

  /** Find platform identity by external subject */
  findByExternalId(providerId: string, subject: string): Promise<PlatformIdentity | undefined>;
}
```

### 2.3 AuthenticationService

```typescript
interface AuthenticationService {
  /** Authenticate a user/agent with credentials */
  authenticate(request: AuthRequest): Promise<AuthenticationResult>;

  /** Initiate a password reset flow */
  initiatePasswordReset(identityId: string, channel: ResetChannel): Promise<void>;

  /** Complete a password reset */
  completePasswordReset(token: string, newPassword: string): Promise<void>;

  /** Initiate MFA enrollment */
  initiateMFAEnrollment(identityId: string, method: MFAMethod): Promise<MFAEnrollment>;

  /** Complete MFA enrollment */
  completeMFAEnrollment(identityId: string, enrollmentId: string, verification: string): Promise<void>;

  /** Verify MFA challenge */
  verifyMFA(identityId: string, sessionId: string, challengeResponse: string): Promise<boolean>;

  /** Get MFA status for an identity */
  getMFAStatus(identityId: string): Promise<MFAStatus>;

  /** List active sessions for an identity */
  listSessions(identityId: string): Promise<Session[]>;

  /** Revoke all sessions for an identity */
  revokeAllSessions(identityId: string, reason: string): Promise<void>;
}

interface AuthenticationResult {
  success: boolean;
  principal?: Principal;
  session?: Session;
  mfaRequired: boolean;
  mfaMethods?: MFAMethod[];
  error?: AuthError;
  auditId: string;
}
```

### 2.4 AuthorizationService

```typescript
interface AuthorizationService {
  /** Check if a principal has a specific permission */
  checkPermission(principal: Principal, permission: string, resource?: ResourceContext): Promise<PermissionResult>;

  /** Require a permission (throws if not authorized) */
  requirePermission(principal: Principal, permission: string, resource?: ResourceContext): Promise<void>;

  /** Get all permissions for a principal */
  getEffectivePermissions(principal: Principal): Promise<string[]>;

  /** Check if principal has any of the specified permissions */
  hasAnyPermission(principal: Principal, permissions: string[]): Promise<boolean>;

  /** Check if principal has all specified permissions */
  hasAllPermissions(principal: Principal, permissions: string[]): Promise<boolean>;

  /** Check if principal owns a specific resource */
  checkOwnership(principal: Principal, resourceType: string, resourceId: string): Promise<boolean>;
}

interface PermissionResult {
  allowed: boolean;
  reason?: string;
  auditId: string;
  evaluatedAt: DateTime;
}

interface ResourceContext {
  type: string;
  id: string;
  tenantId?: string;
  ownerId?: string;
  metadata?: Record<string, unknown>;
}
```

### 2.5 SessionManager

```typescript
interface SessionManager {
  /** Create a new session */
  createSession(principal: Principal, context: SessionContext): Promise<Session>;

  /** Validate an existing session */
  validateSession(sessionId: string): Promise<SessionValidation>;

  /** Get session by ID */
  getSession(sessionId: string): Promise<Session | undefined>;

  /** Refresh an expiring session */
  refreshSession(sessionId: string): Promise<Session>;

  /** Revoke a session */
  revokeSession(sessionId: string, reason: string): Promise<void>;

  /** Revoke all sessions for a principal */
  revokePrincipalSessions(principalId: string, reason: string): Promise<void>;

  /** Update session activity timestamp */
  touchSession(sessionId: string): Promise<void>;

  /** Clean up expired sessions */
  purgeExpiredSessions(): Promise<number>;
}

interface Session {
  id: string;
  principalId: string;
  identityType: IdentityType;
  authMethod: AuthMethod;
  mfaLevel: number;
  startedAt: DateTime;
  expiresAt: DateTime;
  lastActivityAt: DateTime;
  riskScore: number;
  deviceFingerprint?: string;
  ipAddress?: string;
  consentSnapshot?: ConsentSnapshot;
  delegationChain?: Delegation[];
  metadata: Record<string, unknown>;
}

interface SessionValidation {
  valid: boolean;
  session?: Session;
  reason?: string;
}
```

### 2.6 ConsentService

```typescript
interface ConsentService {
  /** Grant a new consent */
  grantConsent(patientId: string, request: ConsentGrantRequest): Promise<ConsentRecord>;

  /** Get active consents for a patient */
  getActiveConsents(patientId: string): Promise<ConsentRecord[]>;

  /** Get consent history for a patient */
  getConsentHistory(patientId: string): Promise<ConsentRecord[]>;

  /** Modify an existing consent (creates new version) */
  modifyConsent(consentId: string, changes: Partial<ConsentRecord>): Promise<ConsentRecord>;

  /** Revoke a consent */
  revokeConsent(consentId: string, reason: string): Promise<void>;

  /** Verify consent for a specific operation */
  verifyConsent(patientId: string, consentType: string, scope: ConsentScope): Promise<ConsentVerification>;

  /** Take a consent snapshot (for session binding) */
  snapshotConsents(patientId: string): Promise<ConsentSnapshot>;

  /** Re-verify a consent snapshot */
  verifySnapshot(snapshot: ConsentSnapshot): Promise<ConsentVerification>;

  /** Get consent types available */
  getConsentTypes(): Promise<ConsentTypeDefinition[]>;
}

interface ConsentGrantRequest {
  patientId: string;
  consentType: string;
  granted: boolean;
  scope: ConsentScope;
  expiresAt?: DateTime;
  metadata?: Record<string, unknown>;
}

interface ConsentVerification {
  valid: boolean;
  consent?: ConsentRecord;
  reason?: string;
  requiresReconsent: boolean;
}
```

### 2.7 TrustEvaluator

```typescript
interface TrustEvaluator {
  /** Evaluate trust for a request context */
  evaluate(request: TrustEvaluationRequest): Promise<TrustEvaluationResult>;

  /** Get default trust policy for a product/context */
  getPolicy(context: TrustContext): Promise<TrustPolicy>;

  /** Configure trust policy */
  configurePolicy(policy: TrustPolicy): Promise<void>;
}

interface TrustEvaluationRequest {
  principal: Principal;
  action: string;
  resource: ResourceContext;
  session?: Session;
  device?: DeviceContext;
  location?: LocationContext;
  metadata?: Record<string, unknown>;
}

interface TrustEvaluationResult {
  decision: "ALLOW" | "CHALLENGE" | "DENY" | "REVIEW";
  score: number;
  factors: TrustFactor[];
  challengeMethods?: MFAMethod[];
  expiresAt: DateTime;
  auditId: string;
}

interface TrustFactor {
  name: string;
  score: number;      // 0.0 – 1.0 contribution
  weight: number;
  passed: boolean;
  detail?: string;
}

interface TrustPolicy {
  name: string;
  rules: TrustRule[];
  defaultDecision: "DENY" | "REVIEW";
}
```

### 2.8 RiskEngine

```typescript
interface RiskEngine {
  /** Calculate risk score for a principal + context */
  evaluate(request: RiskEvaluationRequest): Promise<RiskScore>;

  /** Get risk history for a principal */
  getRiskHistory(principalId: string, since?: DateTime): Promise<RiskEvent[]>;

  /** Report a risk event (e.g., failed login) */
  reportEvent(event: RiskEvent): Promise<void>;

  /** Get risk threshold configuration */
  getThresholds(): Promise<RiskThresholds>;
}

interface RiskEvaluationRequest {
  principalId: string;
  identityType: IdentityType;
  action: string;
  session?: Session;
  device?: DeviceContext;
  location?: LocationContext;
  resourceSensitivity: "public" | "internal" | "confidential" | "restricted" | "phi";
}

interface RiskScore {
  score: number;       // 0.0 – 1.0
  level: "low" | "medium" | "high" | "critical";
  factors: RiskFactor[];
  expiresAt: DateTime;
}

interface RiskFactor {
  name: string;
  value: number;
  weight: number;
  evidence?: string;
}

interface RiskThresholds {
  low: number;          // < 0.3
  medium: number;       // 0.3 – 0.6
  high: number;         // 0.6 – 0.9
  critical: number;     // > 0.9
}
```

### 2.9 IdentityRegistry

```typescript
interface IdentityRegistry {
  /** Register a new identity */
  register(request: RegisterIdentityRequest): Promise<PlatformIdentity>;

  /** Get identity by platform ID */
  get(identityId: string): Promise<PlatformIdentity | undefined>;

  /** Find identity by attribute */
  find(query: IdentityQuery): Promise<PlatformIdentity[]>;

  /** Update identity profile */
  update(identityId: string, updates: Partial<IdentityProfile>): Promise<PlatformIdentity>;

  /** Update identity status */
  updateStatus(identityId: string, status: IdentityStatus, reason: string): Promise<void>;

  /** Delete identity (after retention period) */
  delete(identityId: string): Promise<void>;

  /** List identities by type */
  listByType(type: IdentityType, options?: ListOptions): Promise<PaginatedResult<PlatformIdentity>>;

  /** Verify an identity (mark as verified) */
  verify(identityId: string, method: VerificationMethod): Promise<void>;
}

interface RegisterIdentityRequest {
  identityType: IdentityType;
  profile: IdentityProfile;
  authMethods?: AuthMethod[];
  externalIds?: ExternalId[];
  metadata?: Record<string, unknown>;
}

interface IdentityQuery {
  type?: IdentityType;
  status?: IdentityStatus;
  email?: string;
  externalId?: string;
  createdAfter?: DateTime;
  createdBefore?: DateTime;
}
```

### 2.10 AgentIdentity

```typescript
interface AgentIdentity {
  /** Register a new AI agent identity */
  register(request: AgentRegistrationRequest): Promise<Agent>;

  /** Activate an agent (issues credentials) */
  activate(agentId: string): Promise<AgentCredentials>;

  /** Suspend an agent (revokes credentials) */
  suspend(agentId: string, reason: string): Promise<void>;

  /** Retire an agent permanently */
  retire(agentId: string, reason: string): Promise<void>;

  /** Get agent by ID */
  get(agentId: string): Promise<Agent | undefined>;

  /** Rotate agent credentials */
  rotateCredentials(agentId: string): Promise<AgentCredentials>;

  /** Get agent credential status */
  getCredentialStatus(agentId: string): Promise<CredentialStatus>;

  /** Validate agent authentication token */
  validateToken(token: string): Promise<AgentValidation>;

  /** List all registered agents */
  list(options?: ListOptions): Promise<PaginatedResult<Agent>>;

  /** Update agent permission scope */
  updateScope(agentId: string, scope: AgentPermissionScope): Promise<void>;

  /** Get agent audit trail */
  getAuditTrail(agentId: string): Promise<AuditEvent[]>;
}

interface Agent {
  id: string;
  name: string;
  description: string;
  type: AgentType;
  status: IdentityStatus;
  owner: string;
  permissionScope: AgentPermissionScope;
  capabilities: string[];
  assignedProducts: string[];
  createdAt: DateTime;
  activatedAt?: DateTime;
  lastActivityAt?: DateTime;
  trustScore: number;
  metadata: Record<string, unknown>;
}

interface AgentCredentials {
  token: string;           // Short-lived JWT
  tokenExpiresAt: DateTime;
  refreshToken?: string;
  refreshExpiresAt?: DateTime;
  certificate?: string;    // Future: mTLS cert
}

interface AgentPermissionScope {
  products: string[];
  permissions: string[];
  resources?: {
    type: string;
    ids?: string[];
  }[];
  maxDelegationDepth: number;    // Default: 0
  constraints: {
    maxSessionDuration?: number;
    allowedIPs?: string[];
    allowedTimeRange?: { start: string; end: string };
  };
}
```

### 2.11 AuditService

```typescript
interface AuditService {
  /** Record an audit event */
  record(event: AuditEvent): Promise<string>;

  /** Query audit events */
  query(filter: AuditFilter, options?: QueryOptions): Promise<PaginatedResult<AuditEvent>>;

  /** Get audit event by ID */
  get(eventId: string): Promise<AuditEvent | undefined>;

  /** Export audit events for compliance */
  export(filter: AuditFilter, format: ExportFormat): Promise<Blob>;

  /** Verify audit log integrity (hash chain) */
  verifyIntegrity(since?: DateTime): Promise<IntegrityReport>;
}

interface AuditEvent {
  id: string;
  eventType: string;
  eventVersion: string;     // Schema version
  timestamp: DateTime;
  principalId: string;
  principalType: IdentityType;
  action: string;
  resource: string;
  resourceType: string;
  outcome: "SUCCESS" | "FAILURE" | "ERROR";
  reason?: string;
  sessionId?: string;
  requestId?: string;
  metadata: Record<string, unknown>;
  previousHash?: string;     // Hash chain
}
```

### 2.12 FederationGateway

```typescript
interface FederationGateway {
  /** Process incoming federation response */
  handleResponse(provider: string, response: FederationResponse): Promise<FederationResult>;

  /** Generate authentication request URL for a provider */
  generateAuthUrl(provider: string, redirectUri: string, state: string): Promise<string>;

  /** Link a federated identity to an existing platform identity */
  linkIdentity(platformId: string, provider: string, subject: string): Promise<void>;

  /** Unlink a federated identity */
  unlinkIdentity(platformId: string, provider: string): Promise<void>;

  /** Get available federation providers */
  getProviders(): Promise<FederationProvider[]>;
}

interface FederationResult {
  success: boolean;
  providerSubject?: string;
  normalizedClaims?: NormalizedClaims;
  platformIdentity?: PlatformIdentity;
  isNewUser: boolean;
  error?: string;
}
```

---

## 3. Interface Implementation Patterns

### 3.1 Existing Implementation (Phase 1)

The existing `workers/src/auth/` engine already implements a subset:

| Interface | Current Status | Notes |
|---|---|---|
| `IdentityResolver` | ✅ Implemented | `IdentityResolver` registry with `TelegramIdentityResolver` |
| `AuthorizationService` | ✅ Implemented | `authorize()`, `requirePermission()`, RBAC engine |
| `AuditService` (partial) | ✅ Implemented | `audit_logs` D1 table, audit middleware |

These existing implementations **continue to work** and become consumers of the new Trust & Identity capability.

### 3.2 New Interfaces (Phase 2+)

| Interface | Implementation Priority | Notes |
|---|---|---|
| `IdentityProvider` | Phase 2 (Wave 2) | Start with LocalPassword, MagicLink, Passkeys |
| `AuthenticationService` | Phase 2 (Wave 2) | Orchestrates authentication across providers |
| `SessionManager` | Phase 2 (Wave 2) | D1-backed sessions, JWT tokens |
| `ConsentService` | Phase 2 (Wave 2) | D1-backed consent records |
| `TrustEvaluator` | Phase 2 (Wave 3) | Risk-based decision engine |
| `RiskEngine` | Phase 2 (Wave 3) | Risk scoring with configurable factors |
| `IdentityRegistry` | Phase 2 (Wave 2) | Identity lifecycle management |
| `AgentIdentity` | Phase 2 (Wave 2) | Workforce agent identity management |
| `FederationGateway` | Phase 2 (Wave 2+) | OIDC, OAuth2, SAML normalization |
| `AuditService` (full) | Phase 2 (Wave 2) | Append-only audit with hash chain |

---

*This document is architecture-only. No application code, database migrations, API changes, or UI work is authorized by this document.*