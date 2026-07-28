// ┌─────────────────────────────────────────────────────────────┐
// │ AI Platform — Secure Document Upload Service                 │
// │ Central orchestration for all document operations.           │
// │ Product-agnostic, reusable across all AGS products.        │
// │ Wave 6 — AI Platform Secure Document Upload v1              │
// └─────────────────────────────────────────────────────────────┘
//
// PHI Boundary: This service orchestrates document upload, storage,
// encryption, access control, sharing, and audit. PHI payloads
// are always encrypted and stored in PHI-segregated buckets.
// Service logic operates on metadata and opaque references.

import type { DocumentMetadata, DocumentListFilters, DocumentListResponse } from "./types.js";
import {
  DocumentStatus,
  DocumentCategory,
  PHIClassification,
  DocumentServiceError,
  DocumentNotFoundError,
  DocumentAccessDeniedError,
  DocumentIntegrityError,
  ErrorCode,
} from "./types.js";
import { DocumentStorage } from "./document-storage.js";
import { DocumentEncryption } from "./document-encryption.js";
import { DocumentAudit, type DocumentAccessAuditEvent, type DocumentShareAuditEvent, type DocumentUploadAuditEvent, type DocumentDeleteAuditEvent } from "./document-audit.js";
import { DocumentConsentIntegration } from "./document-consent-integration.js";
import { DocumentPolicyIntegration, DocumentAction } from "./document-policy-integration.js";
import { Decision } from "../trust/types.js";

// ════════════════════════════════════════════════════════════════
// D1 Row Shapes (documents + document_shares)
// ════════════════════════════════════════════════════════════════

interface DocumentRow {
  id: string;
  identity_id: string;
  patient_id: string;
  category: string;
  status: string;
  file_name: string;
  mime_type: string;
  file_size: number;
  encryption: string;
  phi_classification: string;
  phi_classified_by: string | null;
  phi_classified_at: string | null;
  storage_bucket: string;
  storage_key: string;
  storage_provider: string;
  checksum_sha256: string | null;
  checksum_algorithm: string | null;
  metadata: string | null;
  tags: string | null;
  version: number;
  uploaded_at: string | null;
  created_at: string;
  updated_at: string;
  expires_at: string | null;
  archived_at: string | null;
  deleted_at: string | null;
}

interface ShareRow {
  id: string;
  document_id: string;
  owner_identity_id: string;
  delegate_identity_id: string;
  consent_type: string;
  consent_id: string | null;
  delegation_id: string | null;
  access_level: string;
  purpose_of_use: string | null;
  expires_at: string | null;
  granted_at: string;
  revoked_at: string | null;
  revoked_by: string | null;
  revoke_reason: string | null;
  constraints: string | null;
  version: number;
  created_at: string;
  updated_at: string;
}

// ════════════════════════════════════════════════════════════════
// Document Service Configuration
// ════════════════════════════════════════════════════════════════

/**
 * Configuration for the Document Service.
 */
export interface DocumentServiceConfig {
  /** Document storage (R1/D1 blob) service */
  storage: DocumentStorage;
  /** Document encryption service */
  encryption: DocumentEncryption;
  /** Document audit service */
  audit: DocumentAudit;
  /** Consent integration */
  consentIntegration: DocumentConsentIntegration;
  /** Policy integration */
  policyIntegration: DocumentPolicyIntegration;
  /** Default storage provider identifier */
  storageProvider: string;
  /** D1 database for durable document metadata + share persistence.
   *  When omitted (e.g. unit tests with mocked storage), the service falls
   *  back to an in-memory registry so callers still work. */
  db?: D1Database;
}

// ════════════════════════════════════════════════════════════════
// Document Service
// ════════════════════════════════════════════════════════════════

/**
 * Document Service — central orchestration for all document operations.
 *
 * All operations:
 * 1. Check identity ownership (where applicable)
 * 2. Evaluate policies for authorization
 * 3. Perform the operation
 * 4. Log to audit trail
 *
 * Fail-closed: if policy evaluation fails or access is denied,
 * the operation is rejected.
 */
export class DocumentService {
  private readonly storage: DocumentStorage;
  private readonly encryption: DocumentEncryption;
  private readonly audit: DocumentAudit;
  private readonly consentIntegration: DocumentConsentIntegration;
  private readonly policyIntegration: DocumentPolicyIntegration;
  private readonly storageProvider: string;
  private readonly db?: D1Database;

  /** In-memory cache/registry. Primary store when `db` is absent (unit tests). */
  private documents: Map<string, DocumentMetadata> = new Map();
  /** Document shares registry (in-memory cache/registry when `db` absent). */
  private shares: Array<{
    id: string;
    documentId: string;
    ownerIdentityId: string;
    delegateIdentityId: string;
    accessLevel: string;
    expiresAt: string;
    grantedAt: string;
    revokedAt: string | null;
  }> = [];

  /** When true, document metadata + shares are persisted durably in D1. */
  private readonly durable: boolean;

  constructor(config: DocumentServiceConfig) {
    this.storage = config.storage;
    this.encryption = config.encryption;
    this.audit = config.audit;
    this.consentIntegration = config.consentIntegration;
    this.policyIntegration = config.policyIntegration;
    this.storageProvider = config.storageProvider;
    this.db = config.db;
    this.durable = !!config.db;
  }

  // ── createDocument ─────────────────────────────────────────

  /**
   * Create a document metadata record prior to upload.
   *
   * @param request - Document creation parameters
   * @returns Created document metadata
   */
  async createDocument(request: {
    identityId: string;
    patientId: string;
    category: DocumentCategory;
    fileName: string;
    mimeType: string;
    fileSize: number;
    phiClassification?: PHIClassification;
    metadata?: Record<string, string>;
    tags?: string[];
    expiresAt?: string;
  }): Promise<DocumentMetadata> {
    const now = new Date().toISOString();
    const documentId = crypto.randomUUID();

    const phiClassification = request.phiClassification ?? PHIClassification.UNKNOWN;
    const isPhi = phiClassification === PHIClassification.PHI_DIRECT ||
                  phiClassification === PHIClassification.PHI_INDIRECT;

    const bucket = this.storage.resolveBucket(isPhi);
    const storageKey = `${request.patientId}/${documentId}/${request.fileName}`;

    const metadata: DocumentMetadata = {
      id: documentId,
      identityId: request.identityId,
      patientId: request.patientId,
      category: request.category,
      status: DocumentStatus.PENDING_UPLOAD,
      fileName: request.fileName,
      mimeType: request.mimeType,
      fileSize: request.fileSize,
      encryption: this.encryption.getEncryptionMethod(isPhi),
      phiClassification,
      storageBucket: bucket,
      storageKey,
      storageProvider: this.storageProvider,
      checksumSha256: "",
      checksumAlgorithm: "SHA-256",
      metadata: request.metadata ?? {},
      tags: request.tags ?? [],
      uploadedAt: "",
      createdAt: now,
      updatedAt: now,
      expiresAt: request.expiresAt ?? null,
      archivedAt: null,
      deletedAt: null,
      version: 1,
    };

    // Store metadata (in-memory cache)
    this.documents.set(documentId, metadata);

    // Persist durably to D1 when available
    if (this.durable && this.db) {
      await this.db
        .prepare(
          `INSERT INTO documents
           (id, identity_id, patient_id, category, status, file_name, mime_type, file_size,
            encryption, phi_classification, phi_classified_by, phi_classified_at,
            storage_bucket, storage_key, storage_provider, checksum_sha256, checksum_algorithm,
            metadata, tags, version, uploaded_at, created_at, updated_at, expires_at, archived_at, deleted_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind(
          documentId,
          request.identityId,
          request.patientId,
          request.category,
          DocumentStatus.PENDING_UPLOAD,
          request.fileName,
          request.mimeType,
          request.fileSize,
          this.encryption.getEncryptionMethod(isPhi),
          phiClassification,
          null,
          null,
          bucket,
          storageKey,
          this.storageProvider,
          "",
          "SHA-256",
          JSON.stringify(request.metadata ?? {}),
          JSON.stringify(request.tags ?? []),
          1,
          "",
          now,
          now,
          request.expiresAt ?? null,
          null,
          null,
        )
        .run();
    }

    // Index in KV (best-effort; no-op if unbound)
    await this.storage.storeMetadataIndex(documentId, {
      documentId,
      identityId: request.identityId,
      patientId: request.patientId,
      category: request.category,
      status: DocumentStatus.PENDING_UPLOAD,
      phiClassification,
      storageBucket: bucket,
      storageKey,
    });

    return metadata;
  }

  // ── uploadDocument ─────────────────────────────────────────

  /**
   * Internal: resolve a document by id from D1 (durable) or in-memory fallback,
   * returning null when not found. Does NOT perform access-control checks.
   */
  private async getDocumentUnchecked(documentId: string): Promise<DocumentMetadata | null> {
    if (this.durable && this.db) {
      const row = await this.db
        .prepare(`SELECT * FROM documents WHERE id = ? AND deleted_at IS NULL`)
        .bind(documentId)
        .first<RawDocumentRow>();
      if (!row) return null;
      const cached = rowToMetadata(row);
      this.documents.set(documentId, cached); // warm cache
      return cached;
    }
    return this.documents.get(documentId) ?? null;
  }

  /**
   * Upload a document with encryption and integrity verification.
   *
   * @param documentId - Document identifier from createDocument
   * @param fileBuffer - Document content
   * @param contentType - MIME type
   * @returns Upload response
   */
  async uploadDocument(
    documentId: string,
    fileBuffer: ArrayBuffer,
    contentType: string,
  ): Promise<{
    documentId: string;
    status: DocumentStatus;
    storageBucket: string;
    storageKey: string;
    checksumSha256: string;
    encryption: string;
    uploadedAt: string;
  }> {
    const metadata = await this.getDocumentUnchecked(documentId);
    if (!metadata) {
      throw new DocumentNotFoundError(documentId);
    }

    if (metadata.status !== DocumentStatus.PENDING_UPLOAD) {
      throw new DocumentServiceError(
        `Document ${documentId} is not in PENDING_UPLOAD status (current: ${metadata.status})`,
        ErrorCode.VALIDATION_ERROR,
        409,
      );
    }

    const now = new Date().toISOString();
    const isPhi = metadata.phiClassification === PHIClassification.PHI_DIRECT ||
                  metadata.phiClassification === PHIClassification.PHI_INDIRECT;

    try {
      // Update status to UPLOADING
      metadata.status = DocumentStatus.UPLOADING;
      metadata.updatedAt = now;

      // Generate checksum
      const checksumSha256 = await this.encryption.generateDocumentChecksum(fileBuffer);

      // Encrypt if PHI
      let uploadBuffer = fileBuffer;

      if (isPhi) {
        const encrypted = await this.encryption.encryptDocument(fileBuffer);
        uploadBuffer = encrypted.encryptedBuffer;
        metadata.encryption = "aes_256_gcm" as any;
      }

      // Upload to storage
      await this.storage.uploadDocument(
        metadata.storageBucket,
        metadata.storageKey,
        uploadBuffer,
        contentType,
        {
          document_id: documentId,
          phi_classification: metadata.phiClassification,
          encryption: metadata.encryption,
          checksum_sha256: checksumSha256,
          identity_id: metadata.identityId,
          category: metadata.category,
          uploadedAt: now,
        },
      );

      // Update metadata
      metadata.status = DocumentStatus.AVAILABLE;
      metadata.checksumSha256 = checksumSha256;
      metadata.uploadedAt = now;
      metadata.updatedAt = now;
      metadata.version++;

      // Persist status change durably
      if (this.durable && this.db) {
        await this.db
          .prepare(
            `UPDATE documents SET status = ?, checksum_sha256 = ?, uploaded_at = ?,
             updated_at = ?, version = ? WHERE id = ?`,
          )
          .bind(
            DocumentStatus.AVAILABLE,
            checksumSha256,
            now,
            now,
            metadata.version,
            documentId,
          )
          .run();
      }

      // Log upload to audit
      await this.audit.logDocumentUpload({
        identityId: metadata.identityId,
        documentId,
        category: metadata.category,
        phiClassification: metadata.phiClassification,
        encryption: metadata.encryption,
        storageBucket: metadata.storageBucket,
        fileSize: metadata.fileSize,
        outcome: "ALLOW",
        checksumSha256,
      });

      return {
        documentId,
        status: DocumentStatus.AVAILABLE,
        storageBucket: metadata.storageBucket,
        storageKey: metadata.storageKey,
        checksumSha256,
        encryption: metadata.encryption,
        uploadedAt: now,
      };
    } catch (error) {
      // Revert status on failure
      metadata.status = DocumentStatus.PENDING_UPLOAD;
      metadata.updatedAt = now;

      if (error instanceof DocumentServiceError) {
        throw error;
      }
      throw new DocumentServiceError(
        `Failed to upload document: ${error instanceof Error ? error.message : "Unknown error"}`,
        ErrorCode.STORAGE_ERROR,
        500,
      );
    }
  }

  // ── getDocument ────────────────────────────────────────────

  /**
   * Get a document with access control check.
   *
   * @param documentId - Document identifier
   * @param identityId - Identity requesting access
   * @param purposeOfUse - Purpose for access
   * @returns Document metadata
   */
  async getDocument(
    documentId: string,
    identityId: string,
    purposeOfUse?: string,
  ): Promise<DocumentMetadata> {
    const metadata = await this.getDocumentUnchecked(documentId);
    if (!metadata) {
      throw new DocumentNotFoundError(documentId);
    }

    // Verify access
    await this.verifyDocumentAccess(identityId, documentId, DocumentAction.READ, purposeOfUse);

    // Log access to audit
    await this.audit.logDocumentAccess({
      identityId,
      documentId,
      action: DocumentAction.READ,
      accessType: "direct",
      outcome: "ALLOW",
      purposeOfUse,
    });

    return metadata;
  }

  // ── listDocuments ──────────────────────────────────────────

  /**
   * List documents for an identity with filters and pagination.
   *
   * @param identityId - Identity whose documents to list
   * @param filters - Optional filters
   * @returns Paginated document list
   */
  async listDocuments(
    identityId: string,
    filters?: DocumentListFilters,
  ): Promise<DocumentListResponse> {
    let docs: DocumentMetadata[];

    if (this.durable && this.db) {
      const clauses: string[] = ["identity_id = ?", "deleted_at IS NULL"];
      const params: (string | number)[] = [identityId];

      if (filters?.category) { clauses.push("category = ?"); params.push(filters.category); }
      if (filters?.status) { clauses.push("status = ?"); params.push(filters.status); }
      if (filters?.phiClassification) { clauses.push("phi_classification = ?"); params.push(filters.phiClassification); }
      if (filters?.patientId) { clauses.push("patient_id = ?"); params.push(filters.patientId); }
      if (filters?.fileName) { clauses.push("file_name LIKE ?"); params.push(`%${filters.fileName}%`); }
      if (filters?.uploadedAfter) { clauses.push("uploaded_at >= ?"); params.push(filters.uploadedAfter); }
      if (filters?.uploadedBefore) { clauses.push("uploaded_at <= ?"); params.push(filters.uploadedBefore); }

      const sortBy = filters?.sortBy ?? "created_at";
      const sortOrder = filters?.sortOrder ?? "desc";
      const allowSort = ["created_at", "updated_at", "uploaded_at", "file_name", "category", "status"];
      const orderCol = allowSort.includes(sortBy) ? sortBy : "created_at";

      const rows = await this.db
        .prepare(`SELECT * FROM documents WHERE ${clauses.join(" AND ")} ORDER BY ${orderCol} ${sortOrder === "asc" ? "ASC" : "DESC"}`)
        .bind(...params)
        .all<RawDocumentRow>();
      docs = (rows.results ?? []).map(rowToMetadata);
      // warm cache
      for (const d of docs) this.documents.set(d.id, d);
    } else {
      docs = Array.from(this.documents.values())
        .filter((d) => d.identityId === identityId && d.status !== DocumentStatus.DELETED);
    }

    // Apply filters (in-memory subset: tags — not indexed in D1 query above)
    if (filters?.tags && filters.tags.length > 0) {
      docs = docs.filter((d) =>
        filters.tags!.every((tag) => d.tags.includes(tag)),
      );
    }
    const sortBy = filters?.sortBy ?? "createdAt";
    const sortOrder = filters?.sortOrder ?? "desc";
    docs.sort((a, b) => {
      const aVal = (a as any)[sortBy] ?? "";
      const bVal = (b as any)[sortBy] ?? "";
      const cmp = String(aVal).localeCompare(String(bVal));
      return sortOrder === "desc" ? -cmp : cmp;
    });

    const total = docs.length;
    const offset = filters?.offset ?? 0;
    const limit = filters?.limit ?? 50;
    const documents = docs.slice(offset, offset + limit);

    return { documents, total, offset, limit };
  }

  // ── shareDocument ──────────────────────────────────────────

  /**
   * Share a document with another identity via consent + delegation.
   *
   * @param documentId - Document to share
   * @param ownerId - Document owner identity
   * @param delegateeId - Identity to share with
   * @param accessLevel - Access level (read, write)
   * @param expiry - ISO 8601 expiry
   * @returns Share record
   */
  async shareDocument(
    documentId: string,
    ownerId: string,
    delegateeId: string,
    accessLevel: string,
    expiry: string,
  ): Promise<{
    id: string;
    documentId: string;
    grantedAt: string;
    expiresAt: string;
  }> {
    const metadata = await this.getDocumentUnchecked(documentId);
    if (!metadata) {
      throw new DocumentNotFoundError(documentId);
    }

    // Verify ownership
    if (metadata.identityId !== ownerId) {
      throw new DocumentAccessDeniedError("Only the document owner can share documents");
    }

    // Verify share policy
    await this.policyIntegration.evaluateDocumentAccess(
      ownerId,
      documentId,
      DocumentAction.SHARE,
      { metadata: { delegateeId, accessLevel } },
    );

    // Grant consent for sharing
    const consent = await this.consentIntegration.grantDocumentSharingConsent(
      ownerId,
      delegateeId,
      documentId,
      [accessLevel],
      expiry,
    );

    const now = new Date().toISOString();
    const shareId = crypto.randomUUID();

    const share = {
      id: shareId,
      documentId,
      ownerIdentityId: ownerId,
      delegateIdentityId: delegateeId,
      accessLevel,
      expiresAt: expiry,
      grantedAt: now,
      revokedAt: null,
    };

    this.shares.push(share);

    // Persist share durably
    if (this.durable && this.db) {
      const now = new Date().toISOString();
      await this.db
        .prepare(
          `INSERT INTO document_shares
           (id, document_id, owner_identity_id, delegate_identity_id, consent_type, consent_id,
            delegation_id, access_level, purpose_of_use, expires_at, granted_at, revoked_at,
            revoked_by, revoke_reason, constraints, version, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind(
          shareId,
          documentId,
          ownerId,
          delegateeId,
          "document_sharing",
          consent.consentId ?? null,
          null,
          accessLevel,
          "",
          expiry,
          now,
          null,
          null,
          "",
          "{}",
          1,
          now,
          now,
        )
        .run();
    }

    // Log to audit
    await this.audit.logDocumentShare({
      ownerIdentityId: ownerId,
      delegateIdentityId: delegateeId,
      documentId,
      action: "create",
      outcome: "ALLOW",
      consentId: consent.consentId,
      accessLevel,
      expiresAt: expiry,
    });

    return {
      id: shareId,
      documentId,
      grantedAt: now,
      expiresAt: expiry,
    };
  }

  // ── revokeShare ────────────────────────────────────────────

  /**
   * Revoke document sharing.
   *
   * @param documentId - Document identifier
   * @param shareId - Share record identifier
   */
  async revokeShare(documentId: string, shareId: string): Promise<void> {
    let share = this.shares.find(
      (s) => s.id === shareId && s.documentId === documentId && !s.revokedAt,
    );

    // In durable mode, fall back to D1 when not in memory
    if (!share && this.durable && this.db) {
      const row = await this.db
        .prepare(`SELECT * FROM document_shares WHERE id = ? AND document_id = ? AND revoked_at IS NULL`)
        .bind(shareId, documentId)
        .first<RawShareRow>();
      if (row) {
        share = {
          id: row.id,
          documentId: row.document_id,
          ownerIdentityId: row.owner_identity_id,
          delegateIdentityId: row.delegate_identity_id,
          accessLevel: row.access_level,
          expiresAt: row.expires_at ?? "",
          grantedAt: row.granted_at,
          revokedAt: row.revoked_at,
        };
      }
    }

    if (!share) {
      throw new DocumentServiceError(
        `Share ${shareId} not found for document ${documentId}`,
        ErrorCode.NOT_FOUND,
        404,
      );
    }

    const now = new Date().toISOString();
    share.revokedAt = now;

    if (this.durable && this.db) {
      await this.db
        .prepare(`UPDATE document_shares SET revoked_at = ?, updated_at = ? WHERE id = ?`)
        .bind(now, now, shareId)
        .run();
    }

    // Log to audit
    await this.audit.logDocumentShare({
      ownerIdentityId: share.ownerIdentityId,
      delegateIdentityId: share.delegateIdentityId,
      documentId,
      action: "revoke",
      outcome: "ALLOW",
      accessLevel: share.accessLevel,
    });
  }

  // ── getSharedDocuments ─────────────────────────────────────

  /**
   * List documents shared with an identity.
   *
   * @param identityId - Identity to check shared documents for
   * @returns List of shared document metadata
   */
  async getSharedDocuments(identityId: string): Promise<DocumentMetadata[]> {
    let documentIds: Set<string>;

    if (this.durable && this.db) {
      const rows = await this.db
        .prepare(
          `SELECT document_id FROM document_shares
           WHERE delegate_identity_id = ? AND revoked_at IS NULL
           AND (expires_at IS NULL OR expires_at > ?)`,
        )
        .bind(identityId, new Date().toISOString())
        .all<{ document_id: string }>();
      documentIds = new Set((rows.results ?? []).map((r) => r.document_id));
      // warm share cache
      const shareRows = await this.db
        .prepare(`SELECT * FROM document_shares WHERE delegate_identity_id = ?`)
        .bind(identityId)
        .all<RawShareRow>();
      for (const r of shareRows.results ?? []) {
        if (!this.shares.find((s) => s.id === r.id)) {
          this.shares.push({
            id: r.id,
            documentId: r.document_id,
            ownerIdentityId: r.owner_identity_id,
            delegateIdentityId: r.delegate_identity_id,
            accessLevel: r.access_level,
            expiresAt: r.expires_at ?? "",
            grantedAt: r.granted_at,
            revokedAt: r.revoked_at,
          });
        }
      }
    } else {
      const activeShares = this.shares.filter((s) => {
        if (s.delegateIdentityId !== identityId) return false;
        if (s.revokedAt) return false;
        if (s.expiresAt && new Date(s.expiresAt) < new Date()) return false;
        return true;
      });
      documentIds = new Set(activeShares.map((s) => s.documentId));
    }

    const documents: DocumentMetadata[] = [];

    for (const docId of documentIds) {
      const doc = await this.getDocumentUnchecked(docId);
      if (doc && doc.status !== DocumentStatus.DELETED) {
        documents.push(doc);
      }
    }

    return documents;
  }

  // ── deleteDocument ─────────────────────────────────────────

  /**
   * Soft-delete a document.
   *
   * @param documentId - Document identifier
   * @param identityId - Identity requesting deletion
   */
  async deleteDocument(documentId: string, identityId: string): Promise<void> {
    const metadata = await this.getDocumentUnchecked(documentId);
    if (!metadata) {
      throw new DocumentNotFoundError(documentId);
    }

    // Verify ownership
    if (metadata.identityId !== identityId) {
      throw new DocumentAccessDeniedError("Only the document owner can delete documents");
    }

    // Verify delete policy
    await this.policyIntegration.evaluateDocumentAccess(
      identityId,
      documentId,
      DocumentAction.DELETE,
    );

    const now = new Date().toISOString();

    // Soft delete
    metadata.status = DocumentStatus.DELETED;
    metadata.deletedAt = now;
    metadata.updatedAt = now;
    metadata.version++;

    if (this.durable && this.db) {
      await this.db
        .prepare(
          `UPDATE documents SET status = ?, deleted_at = ?, updated_at = ?, version = ? WHERE id = ?`,
        )
        .bind(DocumentStatus.DELETED, now, now, metadata.version, documentId)
        .run();
    }

    // Log to audit
    await this.audit.logDocumentDelete({
      identityId,
      documentId,
      deleteType: "soft",
      outcome: "ALLOW",
    });
  }

  // ── archiveDocument ────────────────────────────────────────

  /**
   * Archive a document.
   *
   * @param documentId - Document identifier
   * @param identityId - Identity requesting archival
   */
  async archiveDocument(documentId: string, identityId: string): Promise<void> {
    const metadata = await this.getDocumentUnchecked(documentId);
    if (!metadata) {
      throw new DocumentNotFoundError(documentId);
    }

    // Verify ownership
    if (metadata.identityId !== identityId) {
      throw new DocumentAccessDeniedError("Only the document owner can archive documents");
    }

    // Verify archive policy
    await this.policyIntegration.evaluateDocumentAccess(
      identityId,
      documentId,
      DocumentAction.ARCHIVE,
    );

    const now = new Date().toISOString();

    metadata.status = DocumentStatus.ARCHIVED;
    metadata.archivedAt = now;
    metadata.updatedAt = now;
    metadata.version++;

    if (this.durable && this.db) {
      await this.db
        .prepare(
          `UPDATE documents SET status = ?, archived_at = ?, updated_at = ?, version = ? WHERE id = ?`,
        )
        .bind(DocumentStatus.ARCHIVED, now, now, metadata.version, documentId)
        .run();
    }
  }

  // ── getDocumentAccessLog ───────────────────────────────────

  /**
   * Get the audit log for a document.
   *
   * @param documentId - Document identifier
   * @param filters - Optional audit log filters
   * @returns Audit log entries
   */
  async getDocumentAccessLog(
    documentId: string,
    filters?: {
      action?: string;
      outcome?: string;
      offset?: number;
      limit?: number;
    },
  ): Promise<{
    entries: import("./types.js").DocumentAccessLog[];
    total: number;
    offset: number;
    limit: number;
  }> {
    return this.audit.getDocumentAuditLog(documentId, filters);
  }

  // ── verifyDocumentIntegrity ─────────────────────────────────

  /**
   * Verify document integrity by comparing stored checksum
   * against a freshly computed one.
   *
   * @param documentId - Document identifier
   * @returns True if checksum matches
   * @throws DocumentIntegrityError if checksum does not match
   */
  async verifyDocumentIntegrity(documentId: string): Promise<boolean> {
    const metadata = await this.getDocumentUnchecked(documentId);
    if (!metadata) {
      throw new DocumentNotFoundError(documentId);
    }

    if (!metadata.checksumSha256) {
      throw new DocumentServiceError(
        `Document ${documentId} has no checksum for integrity verification`,
        ErrorCode.INTEGRITY_ERROR,
        400,
      );
    }

    try {
      // Download the document
      const object = await this.storage.downloadDocument(
        metadata.storageBucket,
        metadata.storageKey,
      );

      // Read the body
      const body = await object.arrayBuffer();

      // Decrypt if needed
      let verifiedBuffer = body;
      if (metadata.phiClassification === PHIClassification.PHI_DIRECT ||
          metadata.phiClassification === PHIClassification.PHI_INDIRECT) {
        // Note: In production, decrypt with the stored key
        // For now, we verify the encrypted checksum
      }

      // Compute checksum
      const computedChecksum = await this.encryption.generateDocumentChecksum(verifiedBuffer);

      // Compare
      if (computedChecksum !== metadata.checksumSha256) {
        throw new DocumentIntegrityError(
          `Document ${documentId} integrity check failed: checksum mismatch`,
        );
      }

      // Log verification to audit
      await this.audit.logDocumentAccess({
        identityId: metadata.identityId,
        documentId,
        action: "verify",
        accessType: "direct",
        outcome: "ALLOW",
        purposeOfUse: "integrity_check",
      });

      return true;
    } catch (error) {
      if (error instanceof DocumentIntegrityError) {
        throw error;
      }
      throw new DocumentServiceError(
        `Failed to verify document integrity: ${error instanceof Error ? error.message : "Unknown error"}`,
        ErrorCode.INTEGRITY_ERROR,
        500,
      );
    }
  }

  // ── downloadDocument ───────────────────────────────────────

  /**
   * Download a document's encrypted bytes after verifying access control.
   * Performs ownership / share / delegated / policy checks before returning
   * the storage object. The caller (route handler) is responsible for any
   * decryption and the HTTP response framing.
   *
   * @param documentId - Document identifier
   * @param identityId - Identity requesting the download
   * @param purposeOfUse - Optional purpose of use
   * @returns The storage object (R2/R1) for the document bytes
   * @throws DocumentAccessDeniedError if access is not permitted
   * @throws DocumentNotFoundError if the document does not exist
   */
  async downloadDocument(
    documentId: string,
    identityId: string,
    purposeOfUse?: string,
  ): Promise<R2ObjectBody> {
    const metadata = await this.getDocumentUnchecked(documentId);
    if (!metadata) {
      throw new DocumentNotFoundError(documentId);
    }

    // Enforce access control (owner / share / delegation / policy)
    await this.verifyDocumentAccess(identityId, documentId, DocumentAction.READ, purposeOfUse);

    // Log the access for audit
    await this.audit.logDocumentAccess({
      identityId,
      documentId,
      action: "download",
      accessType: "direct",
      outcome: "ALLOW",
      purposeOfUse: purposeOfUse ?? "treatment",
    });

    // Fetch bytes from storage (D1 blob / R2)
    return this.storage.downloadDocument(metadata.storageBucket, metadata.storageKey);
  }

  // ── Internal: Access Verification ──────────────────────────

  /**
   * Verify that an identity has access to a document.
   * Checks ownership, then shared access, then delegated access.
   */
  private async verifyDocumentAccess(
    identityId: string,
    documentId: string,
    action: string,
    purposeOfUse?: string,
  ): Promise<void> {
    const metadata = await this.getDocumentUnchecked(documentId);
    if (!metadata) {
      throw new DocumentNotFoundError(documentId);
    }

    // Check 1: Is this the owner?
    if (metadata.identityId === identityId) {
      return; // Owner always has access
    }

    // Check 2: Is this a shared document?
    const isShared = this.shares.some(
      (s) =>
        s.documentId === documentId &&
        s.delegateIdentityId === identityId &&
        !s.revokedAt &&
        (!s.expiresAt || new Date(s.expiresAt) > new Date()),
    );

    if (isShared) {
      // Verify consent exists
      await this.consentIntegration.checkDocumentAccessConsent(
        identityId,
        documentId,
        purposeOfUse,
      );
      return;
    }

    // Check 3: Is this via delegation?
    try {
      await this.consentIntegration.checkDelegatedAccess(
        identityId,
        documentId,
        action,
      );
      return; // Delegated access granted
    } catch {
      // Not delegated — continue to policy check
    }

    // Check 4: Evaluate via policy engine
    const policyResult = await this.policyIntegration.evaluateDocumentAccess(
      identityId,
      documentId,
      action,
      {
        purposeOfUse,
        metadata: {
          ownerId: metadata.identityId,
          patientId: metadata.patientId,
        },
      },
    );

    if (policyResult.decision !== Decision.ALLOW) {
      throw new DocumentAccessDeniedError(
        `Access denied for identity ${identityId} to document ${documentId}: ${policyResult.reason}`,
      );
    }
  }
}

// ════════════════════════════════════════════════════════════════
// D1 Row → Domain Mapping Helpers
// ════════════════════════════════════════════════════════════════

/** Raw D1 row shape for the `documents` table (matches nullable D1 results). */
interface RawDocumentRow {
  id: string;
  identity_id: string;
  patient_id: string | null;
  category: string;
  status: string;
  file_name: string | null;
  mime_type: string | null;
  file_size: number | null;
  encryption: string | null;
  phi_classification: string | null;
  phi_classified_by: string | null;
  phi_classified_at: string | null;
  storage_bucket: string | null;
  storage_key: string | null;
  storage_provider: string | null;
  checksum_sha256: string | null;
  checksum_algorithm: string | null;
  metadata: string | null;
  tags: string | null;
  version: number;
  uploaded_at: string | null;
  created_at: string | null;
  updated_at: string | null;
  expires_at: string | null;
  archived_at: string | null;
  deleted_at: string | null;
}

/** Raw D1 row shape for the `document_shares` table. */
interface RawShareRow {
  id: string;
  document_id: string;
  owner_identity_id: string;
  delegate_identity_id: string;
  consent_type: string | null;
  consent_id: string | null;
  delegation_id: string | null;
  access_level: string;
  purpose_of_use: string | null;
  expires_at: string | null;
  granted_at: string;
  revoked_at: string | null;
  revoked_by: string | null;
  revoke_reason: string | null;
  constraints: string | null;
  version: number;
  created_at: string | null;
  updated_at: string | null;
}

function rowToMetadata(row: RawDocumentRow): DocumentMetadata {
  return {
    id: row.id,
    identityId: row.identity_id,
    patientId: row.patient_id ?? "",
    category: row.category as any,
    status: row.status as DocumentStatus,
    fileName: row.file_name ?? "",
    mimeType: row.mime_type ?? "application/octet-stream",
    fileSize: row.file_size ?? 0,
    encryption: (row.encryption ?? "none") as any,
    phiClassification: (row.phi_classification ?? PHIClassification.NON_PHI) as any,
    storageBucket: row.storage_bucket ?? "documents",
    storageKey: row.storage_key ?? row.id,
    storageProvider: (row.storage_provider ?? "r1") as any,
    checksumSha256: row.checksum_sha256 ?? "",
    checksumAlgorithm: (row.checksum_algorithm ?? "SHA-256") as any,
    metadata: row.metadata ? JSON.parse(row.metadata) : {},
    tags: row.tags ? JSON.parse(row.tags) : [],
    version: row.version ?? 1,
    uploadedAt: row.uploaded_at ?? "",
    createdAt: row.created_at ?? "",
    updatedAt: row.updated_at ?? "",
    expiresAt: row.expires_at ?? null,
    archivedAt: row.archived_at ?? null,
    deletedAt: row.deleted_at ?? null,
  };
}