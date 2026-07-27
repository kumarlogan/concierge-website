// ┌─────────────────────────────────────────────────────────────┐
// │ AI Platform — Document Audit Trail                           │
// │ Product-agnostic, reusable across all AGS products.        │
// │ Wave 6 — AI Platform Secure Document Upload v1              │
// └─────────────────────────────────────────────────────────────┘
//
// PHI Boundary: Audit events record access metadata (identity IDs,
// document IDs, actions, timestamps) — never PHI payloads.
// Document content is never included in audit events.
// Events are immutable — once written, never modified or deleted.

import type { DocumentAccessLog } from "./types.js";
import { DocumentServiceError } from "./types.js";

// ════════════════════════════════════════════════════════════════
// Audit Event Types
// ════════════════════════════════════════════════════════════════

/**
 * Document access event for audit logging.
 */
export interface DocumentAccessAuditEvent {
  /** Identity performing the action */
  identityId: string;
  /** Document identifier */
  documentId: string;
  /** Action performed (read, write, delete, share, archive, verify) */
  action: string;
  /** Outcome of the action (ALLOW, DENY, ERROR) */
  outcome: string;
  /** Type of access (direct, delegated, emergency) */
  accessType?: string;
  /** Client IP address */
  ipAddress?: string;
  /** User agent string */
  userAgent?: string;
  /** Delegation chain if accessed via delegation */
  delegationChain?: string[];
  /** Purpose of use */
  purposeOfUse?: string;
  /** Policy evaluation identifier */
  policyEvaluationId?: string;
  /** Trust score at time of access (0.0 – 1.0) */
  trustScore?: number;
  /** Risk score at time of access (0.0 – 1.0) */
  riskScore?: number;
  /** Additional metadata for the event */
  metadata?: Record<string, unknown>;
}

/**
 * Document share event for audit logging.
 */
export interface DocumentShareAuditEvent {
  /** Document owner identity */
  ownerIdentityId: string;
  /** Identity receiving the share */
  delegateIdentityId: string;
  /** Document identifier */
  documentId: string;
  /** Action (share, revoke, expire) */
  action: string;
  /** Outcome */
  outcome: string;
  /** Share consent ID */
  consentId?: string;
  /** Delegation ID if via delegation */
  delegationId?: string;
  /** Access level granted */
  accessLevel?: string;
  /** Share expiry */
  expiresAt?: string;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Document upload event for audit logging.
 */
export interface DocumentUploadAuditEvent {
  /** Identity uploading the document */
  identityId: string;
  /** Document identifier */
  documentId: string;
  /** Document category */
  category: string;
  /** PHI classification */
  phiClassification: string;
  /** Encryption method applied */
  encryption: string;
  /** Storage bucket */
  storageBucket: string;
  /** File size in bytes */
  fileSize: number;
  /** Outcome */
  outcome: string;
  /** Checksum for integrity verification */
  checksumSha256?: string;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Document delete event for audit logging.
 */
export interface DocumentDeleteAuditEvent {
  /** Identity performing the delete */
  identityId: string;
  /** Document identifier */
  documentId: string;
  /** Type of delete (soft, hard) */
  deleteType: string;
  /** Outcome */
  outcome: string;
  /** Reason for deletion */
  reason?: string;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Document audit log query filters.
 */
export interface DocumentAuditFilters {
  /** Filter by action */
  action?: string;
  /** Filter by outcome */
  outcome?: string;
  /** Filter by date range (after) */
  after?: string;
  /** Filter by date range (before) */
  before?: string;
  /** Filter by access type */
  accessType?: string;
  /** Pagination offset */
  offset?: number;
  /** Pagination limit */
  limit?: number;
  /** Sort direction */
  sortOrder?: "asc" | "desc";
}

/**
 * Paginated audit log response.
 */
export interface DocumentAuditLogResponse {
  /** Audit log entries */
  entries: DocumentAccessLog[];
  /** Total count matching filters */
  total: number;
  /** Pagination offset */
  offset: number;
  /** Pagination limit */
  limit: number;
}

// ════════════════════════════════════════════════════════════════
// Storage Interface
// ════════════════════════════════════════════════════════════════

/**
 * Audit storage interface — allows pluggable backends.
 * Can be backed by D1, R2, or external audit service.
 * Events are append-only — no update or delete operations.
 */
export interface AuditStorage {
  /** Append an audit event to the log */
  append(event: DocumentAccessLog): Promise<void>;
  /** Query audit log for a document */
  queryByDocument(
    documentId: string,
    filters?: DocumentAuditFilters,
  ): Promise<{ entries: DocumentAccessLog[]; total: number }>;
  /** Query audit log for an identity */
  queryByIdentity(
    identityId: string,
    filters?: DocumentAuditFilters,
  ): Promise<{ entries: DocumentAccessLog[]; total: number }>;
}

// ════════════════════════════════════════════════════════════════
// In-Memory Audit Storage (Default)
// ════════════════════════════════════════════════════════════════

/**
 * In-memory audit storage for development/testing.
 * Production deployments should use D1 or external audit service.
 * Events are immutable — stored in an append-only array.
 */
export class InMemoryAuditStorage implements AuditStorage {
  private events: DocumentAccessLog[] = [];

  async append(event: DocumentAccessLog): Promise<void> {
    this.events.push(event);
  }

  async queryByDocument(
    documentId: string,
    filters?: DocumentAuditFilters,
  ): Promise<{ entries: DocumentAccessLog[]; total: number }> {
    let filtered = this.events.filter((e) => e.documentId === documentId);

    if (filters?.action) {
      filtered = filtered.filter((e) => e.action === filters.action);
    }
    if (filters?.outcome) {
      filtered = filtered.filter((e) => e.outcome === filters.outcome);
    }
    if (filters?.accessType) {
      filtered = filtered.filter((e) => e.accessType === filters.accessType);
    }
    if (filters?.after) {
      filtered = filtered.filter((e) => e.timestamp >= filters.after!);
    }
    if (filters?.before) {
      filtered = filtered.filter((e) => e.timestamp <= filters.before!);
    }

    // Sort by timestamp
    const sortOrder = filters?.sortOrder ?? "desc";
    filtered.sort((a, b) => {
      const cmp = a.timestamp.localeCompare(b.timestamp);
      return sortOrder === "desc" ? -cmp : cmp;
    });

    const total = filtered.length;
    const offset = filters?.offset ?? 0;
    const limit = filters?.limit ?? 50;
    const entries = filtered.slice(offset, offset + limit);

    return { entries, total };
  }

  async queryByIdentity(
    identityId: string,
    filters?: DocumentAuditFilters,
  ): Promise<{ entries: DocumentAccessLog[]; total: number }> {
    let filtered = this.events.filter((e) => e.identityId === identityId);

    if (filters?.action) {
      filtered = filtered.filter((e) => e.action === filters.action);
    }
    if (filters?.outcome) {
      filtered = filtered.filter((e) => e.outcome === filters.outcome);
    }
    if (filters?.after) {
      filtered = filtered.filter((e) => e.timestamp >= filters.after!);
    }
    if (filters?.before) {
      filtered = filtered.filter((e) => e.timestamp <= filters.before!);
    }

    const sortOrder = filters?.sortOrder ?? "desc";
    filtered.sort((a, b) => {
      const cmp = a.timestamp.localeCompare(b.timestamp);
      return sortOrder === "desc" ? -cmp : cmp;
    });

    const total = filtered.length;
    const offset = filters?.offset ?? 0;
    const limit = filters?.limit ?? 50;
    const entries = filtered.slice(offset, offset + limit);

    return { entries, total };
  }
}

// ════════════════════════════════════════════════════════════════
// Document Audit Service
// ════════════════════════════════════════════════════════════════

/**
 * Document Audit — immutable audit trail for document operations.
 *
 * All document access, upload, share, and delete events are
 * recorded in an append-only audit log. Events are never modified
 * or deleted after creation. Fail-closed: audit failures are logged
 * but do not block the underlying operation (document access is
 * allowed even if audit logging fails temporarily).
 */
export class DocumentAudit {
  private readonly storage: AuditStorage;

  constructor(storage?: AuditStorage) {
    this.storage = storage ?? new InMemoryAuditStorage();
  }

  /**
   * Get the underlying audit storage instance.
   */
  getStorage(): AuditStorage {
    return this.storage;
  }

  // ── logDocumentAccess ─────────────────────────────────────

  /**
   * Record a document access event.
   * Called every time a document is read, downloaded, or viewed.
   *
   * @param event - Document access audit event
   */
  async logDocumentAccess(event: DocumentAccessAuditEvent): Promise<void> {
    const logEntry = this.createLogEntry({
      id: crypto.randomUUID(),
      documentId: event.documentId,
      identityId: event.identityId,
      action: event.action,
      accessType: event.accessType ?? "direct",
      outcome: event.outcome,
      timestamp: new Date().toISOString(),
      ipAddress: event.ipAddress ?? null,
      userAgent: event.userAgent ?? null,
      delegationChain: event.delegationChain ?? null,
      purposeOfUse: event.purposeOfUse ?? null,
      policyEvaluationId: event.policyEvaluationId ?? null,
      trustScore: event.trustScore ?? null,
      riskScore: event.riskScore ?? null,
    });

    try {
      await this.storage.append(logEntry);
    } catch (error) {
      // Audit failure is non-fatal — log but don't block
      console.error(
        `Failed to log document access event: ${error instanceof Error ? error.message : "Unknown error"}`,
        { documentId: event.documentId, identityId: event.identityId },
      );
    }
  }

  // ── logDocumentShare ──────────────────────────────────────

  /**
   * Record a document share event.
   * Called when a document is shared or share is revoked.
   *
   * @param event - Document share audit event
   */
  async logDocumentShare(event: DocumentShareAuditEvent): Promise<void> {
    const logEntry = this.createLogEntry({
      id: crypto.randomUUID(),
      documentId: event.documentId,
      identityId: event.ownerIdentityId,
      action: `share:${event.action}`,
      accessType: "delegated",
      outcome: event.outcome,
      timestamp: new Date().toISOString(),
      ipAddress: null,
      userAgent: null,
      delegationChain: event.delegationId ? [event.delegationId] : null,
      purposeOfUse: "document_sharing",
      policyEvaluationId: event.consentId ?? null,
      trustScore: null,
      riskScore: null,
    });

    try {
      await this.storage.append(logEntry);
    } catch (error) {
      console.error(
        `Failed to log document share event: ${error instanceof Error ? error.message : "Unknown error"}`,
        { documentId: event.documentId, ownerIdentityId: event.ownerIdentityId },
      );
    }
  }

  // ── logDocumentUpload ─────────────────────────────────────

  /**
   * Record a document upload event.
   * Called when a document upload completes successfully.
   *
   * @param event - Document upload audit event
   */
  async logDocumentUpload(event: DocumentUploadAuditEvent): Promise<void> {
    const logEntry = this.createLogEntry({
      id: crypto.randomUUID(),
      documentId: event.documentId,
      identityId: event.identityId,
      action: "upload",
      accessType: "direct",
      outcome: event.outcome,
      timestamp: new Date().toISOString(),
      ipAddress: null,
      userAgent: null,
      delegationChain: null,
      purposeOfUse: null,
      policyEvaluationId: null,
      trustScore: null,
      riskScore: null,
    });

    try {
      await this.storage.append(logEntry);
    } catch (error) {
      console.error(
        `Failed to log document upload event: ${error instanceof Error ? error.message : "Unknown error"}`,
        { documentId: event.documentId, identityId: event.identityId },
      );
    }
  }

  // ── logDocumentDelete ─────────────────────────────────────

  /**
   * Record a document soft delete event.
   * Called when a document is soft-deleted (status set to DELETED).
   *
   * @param event - Document delete audit event
   */
  async logDocumentDelete(event: DocumentDeleteAuditEvent): Promise<void> {
    const logEntry = this.createLogEntry({
      id: crypto.randomUUID(),
      documentId: event.documentId,
      identityId: event.identityId,
      action: `delete:${event.deleteType}`,
      accessType: "direct",
      outcome: event.outcome,
      timestamp: new Date().toISOString(),
      ipAddress: null,
      userAgent: null,
      delegationChain: null,
      purposeOfUse: null,
      policyEvaluationId: null,
      trustScore: null,
      riskScore: null,
    });

    try {
      await this.storage.append(logEntry);
    } catch (error) {
      console.error(
        `Failed to log document delete event: ${error instanceof Error ? error.message : "Unknown error"}`,
        { documentId: event.documentId, identityId: event.identityId },
      );
    }
  }

  // ── getDocumentAuditLog ───────────────────────────────────

  /**
   * Get the audit log for a specific document.
   *
   * @param documentId - Document identifier
   * @param filters - Optional query filters
   * @returns Paginated audit log entries
   */
  async getDocumentAuditLog(
    documentId: string,
    filters?: DocumentAuditFilters,
  ): Promise<DocumentAuditLogResponse> {
    try {
      const result = await this.storage.queryByDocument(documentId, filters);
      return {
        entries: result.entries,
        total: result.total,
        offset: filters?.offset ?? 0,
        limit: filters?.limit ?? 50,
      };
    } catch (error) {
      throw new DocumentServiceError(
        `Failed to query document audit log: ${error instanceof Error ? error.message : "Unknown error"}`,
        "AUDIT_QUERY_FAILED",
        500,
      );
    }
  }

  // ── getIdentityAuditLog ───────────────────────────────────

  /**
   * Get the audit trail for a specific identity's document operations.
   *
   * @param identityId - Identity identifier
   * @param filters - Optional query filters
   * @returns Paginated audit log entries
   */
  async getIdentityAuditLog(
    identityId: string,
    filters?: DocumentAuditFilters,
  ): Promise<DocumentAuditLogResponse> {
    try {
      const result = await this.storage.queryByIdentity(identityId, filters);
      return {
        entries: result.entries,
        total: result.total,
        offset: filters?.offset ?? 0,
        limit: filters?.limit ?? 50,
      };
    } catch (error) {
      throw new DocumentServiceError(
        `Failed to query identity audit log: ${error instanceof Error ? error.message : "Unknown error"}`,
        "AUDIT_QUERY_FAILED",
        500,
      );
    }
  }

  // ── Helpers ─────────────────────────────────────────────────

  /**
   * Create a DocumentAccessLog entry from a partial record.
   */
  private createLogEntry(entry: DocumentAccessLog): DocumentAccessLog {
    return {
      id: entry.id,
      documentId: entry.documentId,
      identityId: entry.identityId,
      action: entry.action,
      accessType: entry.accessType,
      outcome: entry.outcome,
      timestamp: entry.timestamp,
      ipAddress: entry.ipAddress,
      userAgent: entry.userAgent,
      delegationChain: entry.delegationChain,
      purposeOfUse: entry.purposeOfUse,
      policyEvaluationId: entry.policyEvaluationId,
      trustScore: entry.trustScore,
      riskScore: entry.riskScore,
    };
  }
}