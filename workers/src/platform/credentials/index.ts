// ┌─────────────────────────────────────────────────────────────┐
// │ AI Platform — Credential & Secrets Management Index           │
// │ EPIC-PLATFORM-001: Credential & Secrets Management           │
// │ Reusable platform capability — NOT Concierge-specific         │
// └─────────────────────────────────────────────────────────────┘

export type {
  ProviderId,
  CredentialSource,
  CredentialStatus,
  CredentialHealth,
  CredentialValidation,
  RotationPolicy,
  CredentialRecord,
  AuditEntry,
  CredentialAction,
  CredentialResolver,
  CredentialValidator,
  CredentialHealthChecker,
  CredentialRotationService,
  CredentialRegistry,
  DeploymentReadiness,
  DeploymentReport,
} from "./types.js";

export { InMemoryCredentialRegistry } from "./credential-registry.js";
export { credentialRegistry } from "./credential-registry.js";

export { CredentialResolver } from "./credential-resolver.js";
export { credentialResolver } from "./credential-resolver.js";

export { CredentialValidatorImpl } from "./credential-validator.js";
export { credentialValidator } from "./credential-validator.js";

export { CredentialHealthCheckerImpl } from "./credential-health-checker.js";
export { credentialHealthChecker } from "./credential-health-checker.js";

export { CredentialRotationServiceImpl } from "./credential-rotation.js";
export { credentialRotationService } from "./credential-rotation.js";

export { CredentialAuditLog } from "./credential-audit.js";
export { credentialAuditLog } from "./credential-audit.js";