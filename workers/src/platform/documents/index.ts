// ┌─────────────────────────────────────────────────────────────┐
// │ AI Platform — Secure Document Upload Barrel Export            │
// │ Single import point for all Document Upload components.      │
// │ Wave 6 — AI Platform Secure Document Upload v1              │
// └─────────────────────────────────────────────────────────────┘

// Types
export * from "./types.js";

// Storage
export { DocumentStorage } from "./document-storage.js";
export type { DocumentStorageConfig } from "./document-storage.js";

// Encryption
export { DocumentEncryption, DefaultKeyManager } from "./document-encryption.js";
export type { KeyManager, KeyMetadata } from "./document-encryption.js";

// Audit
export { DocumentAudit, InMemoryAuditStorage } from "./document-audit.js";
export type {
  DocumentAccessAuditEvent,
  DocumentShareAuditEvent,
  DocumentUploadAuditEvent,
  DocumentDeleteAuditEvent,
  DocumentAuditFilters,
  DocumentAuditLogResponse,
  AuditStorage,
} from "./document-audit.js";

// Service
export { DocumentService } from "./document-service.js";
export type { DocumentServiceConfig } from "./document-service.js";

// Consent Integration
export { DocumentConsentIntegration } from "./document-consent-integration.js";
export type { DocumentConsentIntegrationConfig } from "./document-consent-integration.js";

// Policy Integration
export { DocumentPolicyIntegration, createDefaultDocumentPolicies, DocumentAction, ALL_DOCUMENT_ACTIONS, DOCUMENT_ACCESS_RESOURCE_TYPE } from "./document-policy-integration.js";