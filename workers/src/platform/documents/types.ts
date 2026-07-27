// ┌─────────────────────────────────────────────────────────────┐
// │ AI Platform — Secure Document Upload Types                   │
// │ Product-agnostic, reusable across all AGS products.        │
// │ Wave 6 — AI Platform Secure Document Upload v1              │
// └─────────────────────────────────────────────────────────────┘
//
// PHI Boundary: These types define document metadata and access
// control contracts. PHI payloads are stored separately in
// encrypted storage, referenced by opaque storage keys.
// Separation maintained: Identity | Trust | Document Metadata | PHI Payloads.

// ════════════════════════════════════════════════════════════════
// Error Codes
// ════════════════════════════════════════════════════════════════

/**
 * Standard error codes for document service operations.
 */
export enum ErrorCode {
  NOT_FOUND = "NOT_FOUND",
  STORAGE_ERROR = "STORAGE_ERROR",
  ENCRYPTION_ERROR = "ENCRYPTION_ERROR",
  INTEGRITY_ERROR = "INTEGRITY_ERROR",
  CONSENT_ERROR = "CONSENT_ERROR",
  ACCESS_DENIED = "ACCESS_DENIED",
  VALIDATION_ERROR = "VALIDATION_ERROR",
  POLICY_ERROR = "POLICY_ERROR",
}

// ════════════════════════════════════════════════════════════════
// Document Classification Enums
// ════════════════════════════════════════════════════════════════

/**
 * Categories of documents supported by the platform.
 * Used for routing, policy evaluation, and search/filter.
 */
// ════════════════════════════════════════════════════════════════
// Error Codes
// ════════════════════════════════════════════════════════════════

/**
 * Standard error codes for document service operations.
 */
export enum ErrorCode {
  NOT_FOUND = "NOT_FOUND",
  STORAGE_ERROR = "STORAGE_ERROR",
  ENCRYPTION_ERROR = "ENCRYPTION_ERROR",
  INTEGRITY_ERROR = "INTEGRITY_ERROR",
  CONSENT_ERROR = "CONSENT_ERROR",
  ACCESS_DENIED = "ACCESS_DENIED",
  VALIDATION_ERROR = "VALIDATION_ERROR",
  POLICY_ERROR = "POLICY_ERROR",
}

// ════════════════════════════════════════════════════════════════
// Document Classification Enums
// ════════════════════════════════════════════════════════════════

/**
 * Categories of documents supported by the platform.
 * Used for routing, policy evaluation, and search/filter.
 */
export enum DocumentCategory {
  LAB_RESULT = "lab_result",
  IMAGING = "imaging",
  PRESCRIPTION = "prescription",
  CONSENT_FORM = "consent_form",
  CLINICAL_NOTE = "clinical_note",
  IDENTIFICATION = "identification",
  INSURANCE_CARD = "insurance_card",
  OTHER = "other",
}

/**
 * Lifecycle status of a document.
 * Every document progresses through a strict status lifecycle.
 */
export enum DocumentStatus {
  PENDING_UPLOAD = "pending_upload",
  UPLOADING = "uploading",
  AVAILABLE = "available",
  ARCHIVED = "archived",
  DELETED = "deleted",
  QUARANTINED = "quarantined",
}

/**
 * Encryption methods for document storage.
 * Determines how documents are protected at rest.
 */
export enum DocumentEncryption {
  AES_256_GCM = "aes_256_gcm",
  CLIENT_SIDE_ENCRYPTED = "client_side_encrypted",
  SERVER_SIDE_ENCRYPTED = "server_side_encrypted",
  UNENCRYPTED = "unencrypted",
}

/**
 * PHI classification of a document.
 * Determines storage bucket, encryption requirements, and access policies.
 */
export enum PHIClassification {
  PHI_DIRECT = "phi_direct",
  PHI_INDIRECT = "phi_indirect",
  NON_PHI = "non_phi",
  UNKNOWN = "unknown",
}

// ════════════════════════════════════════════════════════════════
// Core Data Models
// ════════════════════════════════════════════════════════════════

/**
 * Document metadata — canonical record for an uploaded document.
 * PHI Boundary: Contains metadata and opaque storage references,
 * NOT the actual document payload. PHI payloads are encrypted
 * and stored in PHI-segregated buckets.
 */
export interface DocumentMetadata {
  /** Unique document identifier */
  id: string;
  /** Identity that owns/uploaded this document */
  identityId: string;
  /** Patient identifier the document belongs to */
  patientId: string;
  /** Document category for classification */
  category: DocumentCategory;
  /** Current lifecycle status */
  status: DocumentStatus;
  /** Original filename from upload */
  fileName: string;
  /** MIME type of the document */
  mimeType: string;
  /** File size in bytes */
  fileSize: number;
  /** Encryption method applied */
  encryption: DocumentEncryption;
  /** PHI classification for segregation */
  phiClassification: PHIClassification;
  /** R2 bucket where document is stored */
  storageBucket: string;
  /** R2 object key */
  storageKey: string;
  /** Storage provider identifier */
  storageProvider: string;
  /** SHA-256 checksum of document content */
  checksumSha256: string;
  /** Algorithm used for checksum */
  checksumAlgorithm: string;
  /** Arbitrary metadata key-value pairs */
  metadata: Record<string, string>;
  /** Tags for search and categorization */
  tags: string[];
  /** ISO 8601 timestamp of upload completion */
  uploadedAt: string;
  /** ISO 8601 timestamp of record creation */
  createdAt: string;
  /** ISO 8601 timestamp of last update */
  updatedAt: string;
  /** ISO 8601 timestamp of document expiry */
  expiresAt: string | null;
  /** ISO 8601 timestamp of archival */
  archivedAt: string | null;
  /** ISO 8601 timestamp of soft delete */
  deletedAt: string | null;
  /** Version number for optimistic concurrency */
  version: number;
}

// ════════════════════════════════════════════════════════════════
// Request/Response Types
// ════════════════════════════════════════════════════════════════

/**
 * Request to create a new document metadata record prior to upload.
 */
export interface DocumentCreateRequest {
  /** Identity that owns the document */
  identityId: string;
  /** Patient identifier the document belongs to */
  patientId: string;
  /** Document category */
  category: DocumentCategory;
  /** Original filename */
  fileName: string;
  /** MIME type */
  mimeType: string;
  /** Expected file size */
  fileSize: number;
  /** PHI classification (auto-detected if not provided) */
  phiClassification?: PHIClassification;
  /** Arbitrary metadata */
  metadata?: Record<string, string>;
  /** Tags */
  tags?: string[];
  /** Document expiry */
  expiresAt?: string;
}

/**
 * Request to access a document.
 */
export interface DocumentAccessRequest {
  /** Identity requesting access */
  identityId: string;
  /** Document identifier */
  documentId: string;
  /** Purpose of access */
  purposeOfUse?: string;
  /** Session context */
  ipAddress?: string;
  userAgent?: string;
  /** Delegation chain if accessing via delegation */
  delegationChain?: string[];
}

/**
 * Request to share a document with another identity.
 */
export interface DocumentShareRequest {
  /** Document owner identity */
  ownerIdentityId: string;
  /** Identity to share with */
  delegateIdentityId: string;
  /** Document identifier */
  documentId: string;
  /** Access level (read, write, share) */
  accessLevel: string;
  /** ISO 8601 expiry for the share */
  expiresAt: string;
  /** Sharing constraints */
  constraints?: Record<string, unknown>;
}

/**
 * Response from a document upload operation.
 */
export interface DocumentUploadResponse {
  /** Document identifier */
  documentId: string;
  /** Upload status */
  status: DocumentStatus;
  /** Storage bucket */
  storageBucket: string;
  /** Storage key */
  storageKey: string;
  /** Computed checksum */
  checksumSha256: string;
  /** Encryption method applied */
  encryption: DocumentEncryption;
  /** ISO 8601 timestamp */
  uploadedAt: string;
}

/**
 * Response from a document download operation.
 */
export interface DocumentDownloadResponse {
  /** Document metadata */
  metadata: DocumentMetadata;
  /** Document body (decrypted if applicable) */
  body: ReadableStream | ArrayBuffer;
  /** Content type */
  contentType: string;
  /** Content length */
  contentLength: number;
  /** Checksum for verification */
  checksumSha256: string;
}

// ════════════════════════════════════════════════════════════════
// Audit & Access Log Types
// ════════════════════════════════════════════════════════════════

/**
 * Document access audit log entry.
 * Immutable — once written, never modified.
 */
export interface DocumentAccessLog {
  /** Unique log entry identifier */
  id: string;
  /** Document identifier */
  documentId: string;
  /** Identity that performed the action */
  identityId: string;
  /** Action performed */
  action: string;
  /** Type of access (direct, delegated, emergency) */
  accessType: string;
  /** Outcome of the action */
  outcome: string;
  /** ISO 8601 timestamp */
  timestamp: string;
  /** Client IP address */
  ipAddress: string | null;
  /** User agent string */
  userAgent: string | null;
  /** Delegation chain if accessed via delegation */
  delegationChain: string[] | null;
  /** Purpose of use */
  purposeOfUse: string | null;
  /** Policy evaluation identifier */
  policyEvaluationId: string | null;
  /** Trust score at time of access (0.0 – 1.0) */
  trustScore: number | null;
  /** Risk score at time of access (0.0 – 1.0) */
  riskScore: number | null;
}

// ════════════════════════════════════════════════════════════════
// Share & Consent Types
// ════════════════════════════════════════════════════════════════

/**
 * Document share record — tracks document sharing between identities.
 */
export interface DocumentShareRecord {
  /** Unique share identifier */
  id: string;
  /** Document identifier */
  documentId: string;
  /** Identity that owns the document */
  ownerIdentityId: string;
  /** Identity that has delegated access */
  delegateIdentityId: string;
  /** Type of consent backing this share */
  consentType: string;
  /** Consent identifier */
  consentId: string;
  /** Delegation identifier if via delegation */
  delegationId: string | null;
  /** Access level granted */
  accessLevel: string;
  /** ISO 8601 expiry */
  expiresAt: string;
  /** ISO 8601 grant timestamp */
  grantedAt: string;
  /** ISO 8601 revocation timestamp */
  revokedAt: string | null;
  /** Share constraints */
  constraints: Record<string, unknown>;
}

// ════════════════════════════════════════════════════════════════
// Encryption Types
// ════════════════════════════════════════════════════════════════

/**
 * Document encryption key record.
 * Tracks key material for encrypted documents.
 */
export interface DocumentEncryptionKey {
  /** Unique key record identifier */
  id: string;
  /** Document identifier */
  documentId: string;
  /** Encryption algorithm used */
  algorithm: string;
  /** Key identifier (KMS key ID or local key ID) */
  keyId: string;
  /** Encrypted key material (base64-encoded) */
  encryptedKey: string;
  /** Key version for rotation tracking */
  keyVersion: number;
  /** ISO 8601 timestamp */
  createdAt: string;
}

// ════════════════════════════════════════════════════════════════
// Filter & Pagination Types
// ════════════════════════════════════════════════════════════════

/**
 * Document list filters for querying documents.
 */
export interface DocumentListFilters {
  /** Filter by category */
  category?: DocumentCategory;
  /** Filter by status */
  status?: DocumentStatus;
  /** Filter by PHI classification */
  phiClassification?: PHIClassification;
  /** Filter by patient ID */
  patientId?: string;
  /** Search in filename */
  fileName?: string;
  /** Filter by tags (AND logic) */
  tags?: string[];
  /** Filter by date range (uploaded after) */
  uploadedAfter?: string;
  /** Filter by date range (uploaded before) */
  uploadedBefore?: string;
  /** Pagination offset */
  offset?: number;
  /** Pagination limit */
  limit?: number;
  /** Sort field */
  sortBy?: string;
  /** Sort direction */
  sortOrder?: "asc" | "desc";
}

/**
 * Paginated document list response.
 */
export interface DocumentListResponse {
  /** Document metadata records */
  documents: DocumentMetadata[];
  /** Total count matching filters */
  total: number;
  /** Pagination offset */
  offset: number;
  /** Pagination limit */
  limit: number;
}

// ════════════════════════════════════════════════════════════════
// Error Types
// ════════════════════════════════════════════════════════════════

/**
 * Document service error — base error for document operations.
 */
export class DocumentServiceError extends Error {
  constructor(
    message: string,
    public readonly code: ErrorCode,
    public readonly status: number = 400,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "DocumentServiceError";
  }
}

/**
 * Document storage error — R2 storage operation failures.
 */
export class DocumentStorageError extends DocumentServiceError {
  constructor(message: string, code: ErrorCode = ErrorCode.STORAGE_ERROR, details?: Record<string, unknown>) {
    super(message, code, 500, details);
    this.name = "DocumentStorageError";
  }
}

/**
 * Document not found error.
 */
export class DocumentNotFoundError extends DocumentServiceError {
  constructor(documentId: string) {
    super(`Document not found: ${documentId}`, ErrorCode.NOT_FOUND, 404);
    this.name = "DocumentNotFoundError";
  }
}

/**
 * Document access denied error.
 */
export class DocumentAccessDeniedError extends DocumentServiceError {
  constructor(message: string = "Access denied to document") {
    super(message, ErrorCode.ACCESS_DENIED, 403);
    this.name = "DocumentAccessDeniedError";
  }
}

/**
 * Document encryption error.
 */
export class DocumentEncryptionError extends DocumentServiceError {
  constructor(message: string, code: ErrorCode = ErrorCode.ENCRYPTION_ERROR, details?: Record<string, unknown>) {
    super(message, code, 500, details);
    this.name = "DocumentEncryptionError";
  }
}

/**
 * Document integrity error — checksum mismatch.
 */
export class DocumentIntegrityError extends DocumentServiceError {
  constructor(message: string = "Document integrity check failed") {
    super(message, ErrorCode.INTEGRITY_ERROR, 409);
    this.name = "DocumentIntegrityError";
  }
}

/**
 * Document consent error — consent not granted.
 */
export class DocumentConsentError extends DocumentServiceError {
  constructor(message: string = "Consent not granted for document access") {
    super(message, ErrorCode.CONSENT_ERROR, 403);
    this.name = "DocumentConsentError";
  }
}