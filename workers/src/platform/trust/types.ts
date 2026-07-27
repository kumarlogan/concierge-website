// ┌─────────────────────────────────────────────────────────────┐
// │ AI Platform — Trust Runtime Types                              │
// │ Product-agnostic, reusable across all AGS products.        │
// │ Wave 4 — AI Platform Trust Runtime v1                       │
// └─────────────────────────────────────────────────────────────┘
//
// PHI Boundary: These types contain NO personal health information.
// PHI references are opaque IDs only — never payloads.
// Separation maintained: Identity | Trust | Consent | PHI (separate stores).

// ════════════════════════════════════════════════════════════
// Core Evaluation Types
// ════════════════════════════════════════════════════════════

export enum Decision {
  ALLOW = "ALLOW",
  DENY = "DENY",
  CONDITIONAL = "CONDITIONAL",
}

export enum PolicyCategory {
  RBAC = "rbac",
  ABAC = "abac",
  REBAC = "rebac",
  TIME = "time",
  LOCATION = "location",
  DEVICE = "device",
  RISK = "risk",
  PURPOSE_OF_USE = "purpose_of_use",
  EMERGENCY = "emergency",
  MAINTENANCE = "maintenance",
}

export enum ConsentType {
  MEDICAL_TREATMENT = "medical_treatment",
  PRIVACY = "privacy",
  MARKETING = "marketing",
  RESEARCH = "research",
  DOCUMENT_SHARING = "document_sharing",
  CLINIC_SHARING = "clinic_sharing",
  INTERNATIONAL_TRANSFER = "international_transfer",
  AI_ASSISTANCE = "ai_assistance",
  DELEGATED_CAREGIVER = "delegated_caregiver",
}

export enum ConsentState {
  GRANTED = "granted",
  DENIED = "denied",
  WITHDRAWN = "withdrawn",
  EXPIRED = "expired",
  PENDING = "pending",
}

export enum ConsentSource {
  EXPLICIT = "explicit",
  IMPLICIT = "implicit",
  EMERGENCY = "emergency",
  DELEGATION = "delegation",
}

export enum TrustLevel {
  CRITICAL = "critical",
  LOW = "low",
  MEDIUM = "medium",
  HIGH = "high",
  ELEVATED = "elevated",
}

export enum RiskLevel {
  LOW = "low",
  MEDIUM = "medium",
  HIGH = "high",
  CRITICAL = "critical",
}

export enum DelegationType {
  PATIENT_TO_CONCIERGE = "patient_to_concierge",
  PATIENT_TO_FAMILY = "patient_to_family",
  PATIENT_TO_CLINIC = "patient_to_clinic",
  ADMIN_TO_WORKFORCE = "admin_to_workforce",
  PLATFORM_TO_AI_WORKER = "platform_to_ai_worker",
}

export enum DelegationStatus {
  ACTIVE = "active",
  EXPIRED = "expired",
  REVOKED = "revoked",
  PENDING = "pending",
}

export enum AuthorizationResult {
  ALLOW = "ALLOW",
  DENY = "DENY",
  CONDITIONAL = "CONDITIONAL",
  ERROR = "ERROR",
}

export enum AuditOutcome {
  ALLOW = "ALLOW",
  DENY = "DENY",
  CONDITIONAL = "CONDITIONAL",
  ERROR = "ERROR",
  EMERGENCY_OVERRIDE = "EMERGENCY_OVERRIDE",
  MAINTENANCE_OVERRIDE = "MAINTENANCE_OVERRIDE",
}

// ════════════════════════════════════════════════════════════
// Policy Engine Types
// ════════════════════════════════════════════════════════════

export interface Policy {
  id: string;
  name: string;
  description: string;
  category: PolicyCategory;
  version: number;
  enabled: boolean;
  failClosed: boolean;
  precedence: number;
  content: PolicyContent;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface PolicyContent {
  // RBAC rules
  rules?: PolicyRule[];
  // ABAC conditions
  conditions?: PolicyCondition[];
  // Time windows
  timeWindows?: TimeWindow[];
  // Location constraints
  locationConstraints?: LocationConstraint[];
  // Device constraints
  deviceConstraints?: DeviceConstraint[];
  // Risk thresholds
  riskThresholds?: RiskThreshold[];
  // Purpose-of-use constraints
  purposeConstraints?: PurposeConstraint[];
  // Emergency access rules
  emergencyRules?: EmergencyRule[];
  // Maintenance policies
  maintenanceRules?: MaintenanceRule[];
}

export interface PolicyRule {
  id: string;
  name: string;
  action: string;
  resource: string;
  effect: "allow" | "deny";
  conditions?: PolicyCondition[];
  precedence: number;
}

export interface PolicyCondition {
  id: string;
  type: "attribute" | "context" | "time" | "location" | "device" | "risk" | "consent" | "trust";
  attribute: string;
  operator: "eq" | "neq" | "in" | "not_in" | "gt" | "lt" | "gte" | "lte" | "contains" | "matches";
  value: unknown;
  weight: number;
}

export interface TimeWindow {
  id: string;
  name: string;
  daysOfWeek: number[];        // 0-6 (Sunday-Saturday)
  startTime: string;             // HH:MM
  endTime: string;               // HH:MM
  timezone: string;
  action: "allow" | "deny";
}

export interface LocationConstraint {
  id: string;
  name: string;
  allowedCountries?: string[];
  allowedRegions?: string[];
  allowedIps?: string[];
  allowedNetworks?: string[];
  action: "allow" | "deny";
}

export interface DeviceConstraint {
  id: string;
  name: string;
  allowedDeviceTypes?: string[];
  allowedOsTypes?: string[];
  trustedDeviceIds?: string[];
  mfaRequired: boolean;
  action: "allow" | "deny";
}

export interface RiskThreshold {
  id: string;
  name: string;
  maxRiskScore: number;          // 0.0 – 1.0
  action: "allow" | "deny" | "step_up";
  stepUpAction?: string;
}

export interface PurposeConstraint {
  id: string;
  name: string;
  purposes: string[];
  requiresConsent: boolean;
  consentTypes: ConsentType[];
  action: "allow" | "deny";
}

export interface EmergencyRule {
  id: string;
  name: string;
  breakGlassCode: string;
  allowedActions: string[];
  maxDurationMinutes: number;
  requiresApproval: boolean;
  approvalChain: string[];
  auditRequired: boolean;
}

export interface MaintenanceRule {
  id: string;
  name: string;
  maintenanceWindowStart: string;   // ISO 8601 cron or time
  maintenanceWindowEnd: string;
  allowedActionsDuringMaintenance: string[];
  blockedActionsDuringMaintenance: string[];
  overrideRole: string;
}

export interface PolicyEvaluationResult {
  allowed: boolean;
  decision: Decision;
  matchedRules: MatchedRule[];
  unmatchedRules: string[];
  conditionsEvaluated: number;
  conditionsPassed: number;
  conditionsFailed: number;
  failClosedResult: boolean;
  reason: string;
  policySnapshot: PolicySnapshot;
  evaluationTimeMs: number;
}

export interface MatchedRule {
  ruleId: string;
  ruleName: string;
  category: PolicyCategory;
  effect: "allow" | "deny";
  precedence: number;
  matchedConditions: string[];
}

export interface PolicySnapshot {
  policyId: string;
  policyName: string;
  version: number;
  category: PolicyCategory;
  enabled: boolean;
  contentHash: string;
  capturedAt: string;
}

export interface PolicyEvaluationRequest {
  identityId: string;
  identityType: string;
  action: string;
  resource: string;
  context: EvaluationContext;
  policyCategories?: PolicyCategory[];
  delegationChain?: DelegationChain;
}

export interface EvaluationContext {
  time?: string;                  // ISO 8601
  location?: LocationContext;
  device?: DeviceContext;
  riskScore?: number;
  trustScore?: number;
  consentStatus?: Record<ConsentType, ConsentState>;
  purposeOfUse?: string;
  sessionId?: string;
  ipAddress?: string;
  userAgent?: string;
  metadata?: Record<string, unknown>;
}

export interface LocationContext {
  country?: string;
  region?: string;
  city?: string;
  ipAddress?: string;
  latitude?: number;
  longitude?: number;
}

export interface DeviceContext {
  deviceId?: string;
  deviceType?: string;
  osType?: string;
  osVersion?: string;
  fingerprint?: string;
  mfaAuthenticated?: boolean;
}

// ════════════════════════════════════════════════════════════
// Consent Engine Types
// ════════════════════════════════════════════════════════════

export interface Consent {
  id: string;
  identityId: string;
  consentType: ConsentType;
  granted: boolean;
  scope: string[];
  purpose: string;
  source: ConsentSource;
  delegatorId: string | null;
  expiresAt: string | null;
  version: number;
  metadata: Record<string, unknown>;
  createdAt: string;
  revokedAt: string | null;
  versionToken: string;
}

export interface ConsentGrantRequest {
  identityId: string;
  consentType: ConsentType;
  scope: string[];
  purpose: string;
  source: ConsentSource;
  expiresAt?: string;
  delegatorId?: string;
  metadata?: Record<string, unknown>;
}

export interface ConsentRevokeRequest {
  consentId: string;
  reason: string;
  revokedBy: string;            // identity_id of who revoked
}

export interface ConsentHistoryEntry {
  id: string;
  consentId: string;
  identityId: string;
  consentType: ConsentType;
  granted: boolean;
  scope: string[];
  purpose: string;
  source: ConsentSource;
  version: number;
  changedBy: string;
  changeReason: string;
  expiresAt: string | null;
  revokedAt: string | null;
  createdAt: string;
}

export interface ConsentSnapshot {
  id: string;
  identityId: string;
  sessionId: string;
  consentType: ConsentType;
  granted: boolean;
  scope: string[];
  purpose: string;
  source: ConsentSource;
  expiresAt: string | null;
  version: number;
  versionToken: string;
  capturedAt: string;
}

export interface ConsentEvaluationResult {
  granted: boolean;
  consentType: ConsentType;
  scope: string[];
  purposeMatch: boolean;
  expired: boolean;
  revoked: boolean;
  source: ConsentSource;
  snapshot: ConsentSnapshot;
  reason: string;
}

// ════════════════════════════════════════════════════════════
// Trust Engine Types
// ════════════════════════════════════════════════════════════

export interface TrustEvaluationRequest {
  identityId: string;
  sessionId?: string;
  factors?: TrustFactorInput[];
}

export interface TrustFactorInput {
  name: string;
  score: number;           // 0.0 – 1.0
  weight: number;          // 0.0 – 1.0 (all weights should sum to ~1.0)
  passed: boolean;
  detail?: string;
}

export interface TrustEvaluationResult {
  identityId: string;
  trustScore: number;        // 0.0 – 1.0
  trustLevel: TrustLevel;
  factors: TrustFactorResult[];
  weightedScore: number;
  levelChanged: boolean;
  previousLevel: TrustLevel | null;
  evaluatedAt: string;
  expiresAt: string | null;
}

export interface TrustFactorResult {
  name: string;
  score: number;
  weight: number;
  passed: boolean;
  detail?: string;
}

export interface TrustScore {
  id: string;
  identityId: string;
  sessionId: string | null;
  trustScore: number;
  trustLevel: TrustLevel;
  factors: TrustFactorResult[];
  identityConfidence: number;
  authStrength: number;
  mfaStatus: boolean;
  deviceTrust: number;
  networkTrust: number;
  behavioralTrust: number;
  sessionTrust: number;
  credentialAge: number;
  riskHistory: number;
  administrativeOverride: string;
  expiresAt: string | null;
  createdAt: string;
}

export interface TrustSnapshot {
  id: string;
  identityId: string;
  sessionId: string;
  trustScore: number;
  trustLevel: TrustLevel;
  factors: TrustFactorResult[];
  createdAt: string;
}

// ════════════════════════════════════════════════════════════
// Delegation Types
// ════════════════════════════════════════════════════════════

export interface Delegation {
  id: string;
  delegatorId: string;
  delegateeId: string;
  scope: string[];
  type: DelegationType;
  expiresAt: string;
  revokedAt: string | null;
  maxPrivilege: "same_as_owner" | "limited" | "scoped";
  constraints: DelegationConstraints;
  approvalChain: string[];
  auditTag: string;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface DelegationConstraints {
  timeWindows?: TimeWindow[];
  allowedLocations?: string[];
  allowedDevices?: string[];
  maxDurationMinutes?: number;
  purposeOfUse?: string;
  requiresMfa?: boolean;
  requiresApproval?: boolean;
  approvalIdentityIds?: string[];
}

export interface DelegationCreateRequest {
  delegatorId: string;
  delegateeId: string;
  scope: string[];
  type: DelegationType;
  expiresAt: string;
  maxPrivilege?: "same_as_owner" | "limited" | "scoped";
  constraints?: Partial<DelegationConstraints>;
  approvalChain?: string[];
  auditTag?: string;
  metadata?: Record<string, unknown>;
}

export interface DelegationRevokeRequest {
  delegationId: string;
  revokedBy: string;
  reason: string;
}

export interface DelegationChain {
  delegations: Delegation[];
  rootDelegatorId: string;
  depth: number;
  valid: boolean;
  expiresAt: string | null;
}

// ════════════════════════════════════════════════════════════
// Authorization Runtime Types
// ════════════════════════════════════════════════════════════

export interface AuthorizationRequest {
  identityId: string;
  identityType: string;
  action: string;
  resource: string;
  context: EvaluationContext;
  delegationChain?: DelegationChain;
  correlationId: string;
}

export interface AuthorizationResponse {
  decision: AuthorizationResult;
  reason: string;
  correlationId: string;
  trustScore: number;
  trustLevel: TrustLevel;
  consentEvaluations: ConsentEvaluationResult[];
  policyEvaluations: PolicyEvaluationResult[];
  riskScore: number;
  riskLevel: RiskLevel;
  delegationChain: DelegationChain | null;
  auditId: string;
  evaluatedAt: string;
  executionTimeMs: number;
}

export interface AuthorizationPipelineContext {
  identityId: string;
  identityType: string;
  sessionId?: string;
  action: string;
  resource: string;
  evaluationContext: EvaluationContext;
  trustScore?: number;
  trustLevel?: TrustLevel;
  consentSnapshots: ConsentSnapshot[];
  policyEvaluations: PolicyEvaluationResult[];
  riskScore: number;
  riskLevel: RiskLevel;
  delegationChain: DelegationChain | null;
}

// ════════════════════════════════════════════════════════════
// Risk Evaluation Types
// ════════════════════════════════════════════════════════════

export interface RiskEvaluationRequest {
  identityId: string;
  action: string;
  resource: string;
  context: EvaluationContext;
  trustScore?: number;
}

export interface RiskEvaluationResult {
  riskScore: number;
  riskLevel: RiskLevel;
  factors: RiskFactor[];
  elevated: boolean;
  requiresStepUp: boolean;
  stepUpAction?: string;
  blocked: boolean;
  reason: string;
}

export interface RiskFactor {
  name: string;
  score: number;
  weight: number;
  description: string;
  triggered: boolean;
}

export interface RiskEvent {
  id: string;
  identityId: string;
  sessionId: string | null;
  riskType: string;
  severity: RiskLevel;
  score: number;
  details: Record<string, unknown>;
  resolved: boolean;
  resolvedAt: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
}

// ════════════════════════════════════════════════════════════
// Decision Audit Types
// ════════════════════════════════════════════════════════════

export interface DecisionAuditEntry {
  id: string;
  decisionId: string;
  identityId: string;
  resource: string;
  action: string;
  decision: AuditOutcome;
  consentSnapshot: Record<string, unknown>;
  policySnapshot: Record<string, unknown>;
  trustSnapshot: Record<string, unknown>;
  riskFactors: Record<string, unknown>;
  context: Record<string, unknown>;
  delegationChain: DelegationChain | null;
  createdAt: string;
}

// ════════════════════════════════════════════════════════════
// Registry Types
// ════════════════════════════════════════════════════════════

export interface PolicyRegistryEntry {
  id: string;
  policyId: string;
  category: PolicyCategory;
  resourcePattern: string;
  actionPattern: string;
  activeVersion: number;
  updatedAt: string;
}

export interface ConsentRegistryEntry {
  id: string;
  identityId: string;
  consentType: ConsentType;
  currentState: ConsentState;
  expiresAt: string | null;
  versionToken: string;
  updatedAt: string;
}

export interface TrustRegistryEntry {
  id: string;
  identityId: string;
  trustLevel: TrustLevel;
  trustScore: number;
  expiresAt: string | null;
  updatedAt: string;
}

// ════════════════════════════════════════════════════════════
// Event Types (Foundation)
// ════════════════════════════════════════════════════════════

export enum TrustEventType {
  TRUST_SCORE_CHANGED = "trust.score_changed",
  TRUST_LEVEL_CHANGED = "trust.level_changed",
  TRUST_EVALUATED = "trust.evaluated",
  TRUST_DECAYED = "trust.decayed",
  ADMINISTRATIVE_OVERRIDE = "trust.admin_override",
}

export enum ConsentEventType {
  CONSENT_GRANTED = "consent.granted",
  CONSENT_REVOKED = "consent.revoked",
  CONSENT_EXPIRED = "consent.expired",
  CONSENT_SNAPSHOT_CAPTURED = "consent.snapshot_captured",
  CONSENT_VERSION_CHANGED = "consent.version_changed",
}

export enum PolicyEventType {
  POLICY_CREATED = "policy.created",
  POLICY_UPDATED = "policy.updated",
  POLICY_DELETED = "policy.deleted",
  POLICY_EVALUATED = "policy.evaluated",
  POLICY_PREDECEDENCE_CHANGED = "policy.precedence_changed",
}

export interface TrustEvent {
  eventType: TrustEventType;
  identityId: string;
  sessionId?: string;
  trustScore: number;
  trustLevel: TrustLevel;
  previousTrustLevel: TrustLevel | null;
  factors: TrustFactorResult[];
  timestamp: string;
  correlationId: string;
  source: string;
  metadata: Record<string, unknown>;
}

export interface ConsentEvent {
  eventType: ConsentEventType;
  identityId: string;
  consentType: ConsentType;
  granted: boolean;
  version: number;
  timestamp: string;
  correlationId: string;
  source: string;
  metadata: Record<string, unknown>;
}

export interface PolicyEvent {
  eventType: PolicyEventType;
  policyId: string;
  policyName: string;
  category: PolicyCategory;
  version: number;
  timestamp: string;
  correlationId: string;
  source: string;
  metadata: Record<string, unknown>;
}

// ════════════════════════════════════════════════════════════
// Worker Authorization Types
// ════════════════════════════════════════════════════════════

export enum WorkerCredentialType {
  DELEGATED = "delegated",
  TEMPORARY_ELEVATION = "temporary_elevation",
  TASK_SCOPED = "task_scoped",
  ROTATING = "rotating",
}

export interface WorkerCredential {
  id: string;
  workerId: string;
  type: WorkerCredentialType;
  scope: string[];
  issuedBy: string;               // identity_id of issuer
  expiresAt: string;
  rotatedAt: string | null;
  revokedAt: string | null;
  approvalChain: string[];
  taskId: string | null;
  createdAt: string;
}

export interface WorkerAuthorizationRequest {
  workerId: string;
  workerType: string;
  action: string;
  resource: string;
  taskId?: string;
  credentialId?: string;
  correlationId: string;
}

export interface WorkerAuthorizationResponse {
  decision: AuthorizationResult;
  reason: string;
  correlationId: string;
  trustScore: number;
  credentialValid: boolean;
  approvalChainSatisfied: boolean;
  auditId: string;
  evaluatedAt: string;
}

// ════════════════════════════════════════════════════════════
// API Types (Request/Response envelopes)
// ════════════════════════════════════════════════════════════

export interface EvaluateTrustRequest {
  identityId: string;
  sessionId?: string;
  factors?: TrustFactorInput[];
}

export interface EvaluateTrustResponse {
  trustScore: number;
  trustLevel: TrustLevel;
  factors: TrustFactorResult[];
  evaluatedAt: string;
}

export interface EvaluatePolicyRequest {
  identityId: string;
  identityType: string;
  action: string;
  resource: string;
  context?: EvaluationContext;
}

export interface EvaluatePolicyResponse {
  allowed: boolean;
  decision: Decision;
  reason: string;
  matchedRules: MatchedRule[];
  evaluatedAt: string;
}

export interface GrantConsentRequest {
  identityId: string;
  consentType: ConsentType;
  scope: string[];
  purpose: string;
  expiresAt?: string;
}

export interface GrantConsentResponse {
  consentId: string;
  granted: boolean;
  versionToken: string;
  createdAt: string;
}

export interface RevokeConsentRequest {
  consentId: string;
  reason: string;
}

export interface RevokeConsentResponse {
  consentId: string;
  revoked: boolean;
  revokedAt: string;
}

export interface ConsentHistoryRequest {
  identityId: string;
  consentType?: ConsentType;
  limit?: number;
  offset?: number;
}

export interface ConsentHistoryResponse {
  entries: ConsentHistoryEntry[];
  total: number;
  limit: number;
  offset: number;
}

export interface GetTrustScoreRequest {
  identityId: string;
}

export interface GetTrustScoreResponse {
  identityId: string;
  trustScore: number;
  trustLevel: TrustLevel;
  factors: TrustFactorResult[];
  expiresAt: string | null;
  evaluatedAt: string;
}

export interface CreateDelegationRequest {
  delegatorId: string;
  delegateeId: string;
  scope: string[];
  type: DelegationType;
  expiresAt: string;
  constraints?: Partial<DelegationConstraints>;
  approvalChain?: string[];
  auditTag?: string;
}

export interface CreateDelegationResponse {
  delegationId: string;
  delegatorId: string;
  delegateeId: string;
  scope: string[];
  type: DelegationType;
  expiresAt: string;
  createdAt: string;
}

export interface RevokeDelegationRequest {
  delegationId: string;
  reason: string;
}

export interface RevokeDelegationResponse {
  delegationId: string;
  revoked: boolean;
  revokedAt: string;
}

export interface CheckAuthorizationRequest {
  identityId: string;
  identityType: string;
  action: string;
  resource: string;
  context?: EvaluationContext;
}

export interface CheckAuthorizationResponse {
  decision: AuthorizationResult;
  reason: string;
  trustScore: number;
  trustLevel: TrustLevel;
  consentEvaluations: ConsentEvaluationResult[];
  policyEvaluations: PolicyEvaluationResult[];
  riskScore: number;
  riskLevel: RiskLevel;
  evaluatedAt: string;
}

export interface ListPoliciesRequest {
  category?: PolicyCategory;
  enabled?: boolean;
  limit?: number;
  offset?: number;
}

export interface ListPoliciesResponse {
  policies: Policy[];
  total: number;
  limit: number;
  offset: number;
}

export interface ListPermissionsRequest {
  identityId: string;
  identityType: string;
}

export interface ListPermissionsResponse {
  permissions: string[];
  identityId: string;
  evaluatedAt: string;
}