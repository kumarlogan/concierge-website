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
} from "./types.js";
import { DocumentStorage } from "./document-storage.js";
import { DocumentEncryption } from "./document-encryption.js";
import { DocumentAudit, type DocumentAccessAuditEvent, type DocumentShareAuditEvent, type DocumentUploadAuditEvent, type DocumentDeleteAuditEvent } from "./document-audit.js";
import { DocumentConsentIntegration } from "./document-consent-integration.js";
import { DocumentPolicyIntegration, DocumentAction } from "./document-policy-integration.js";
import { Decision } from "../trust/types.js";

// ════════════════════════════════════════════════════════════════
// Document Service Configuration
// ════════════════════════════════════════════════════════════════

/**
 * Configuration for the Document Service.
 */
export interface DocumentServiceConfig {
  /** Document storage (R2) service */
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

  /** In-memory document metadata store (replace with D1 in production) */
  private documents: Map<string, DocumentMetadata> = new Map();
  /** Document shares registry */
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

  constructor(config: DocumentServiceConfig) {
    this.storage = config.storage;
    this.encryption = config.encryption;
    this.audit = config.audit;
    this.consentIntegration = config.consentIntegration;
    this.policyIntegration = config.policyIntegration;
    this.storageProvider = config.storageProvider;
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

    // Store metadata
    this.documents.set(documentId, metadata);

    // Index in KV
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
    const metadata = this.documents.get(documentId);
    if (!metadata) {
      throw new DocumentNotFoundError(documentId);
    }

    if (metadata.status !== DocumentStatus.PENDING_UPLOAD) {
      throw new DocumentServiceError(
        `Document ${documentId} is not in PENDING_UPLOAD status (current: ${metadata.status})`,
        "INVALID_STATUS",
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

      // Upload to R2
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
        "UPLOAD_FAILED",
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
    const metadata = this.documents.get(documentId);
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
    let docs = Array.from(this.documents.values())
      .filter((d) => d.identityId === identityId && d.status !== DocumentStatus.DELETED);

    // Apply filters
    if (filters?.category) {
      docs = docs.filter((d) => d.category === filters.category);
    }
    if (filters?.status) {
      docs = docs.filter((d) => d.status === filters.status);
    }
    if (filters?.phiClassification) {
      docs = docs.filter((d) => d.phiClassification === filters.phiClassification);
    }
    if (filters?.patientId) {
      docs = docs.filter((d) => d.patientId === filters.patientId);
    }
    if (filters?.fileName) {
      docs = docs.filter((d) =>
        d.fileName.toLowerCase().includes(filters.fileName!.toLowerCase()),
      );
    }
    if (filters?.tags && filters.tags.length > 0) {
      docs = docs.filter((d) =>
        filters.tags!.every((tag) => d.tags.includes(tag)),
      );
    }
    if (filters?.uploadedAfter) {
      docs = docs.filter((d) => d.uploadedAt >= filters.uploadedAfter!);
    }
    if (filters?.uploadedBefore) {
      docs = docs.filter((d) => d.uploadedAt <= filters.uploadedBefore!);
    }

    // Sort
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
    const metadata = this.documents.get(documentId);
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
    const share = this.shares.find(
      (s) => s.id === shareId && s.documentId === documentId && !s.revokedAt,
    );

    if (!share) {
      throw new DocumentServiceError(
        `Share not found: ${shareId} for document ${documentId}`,
        "SHARE_NOT_FOUND",
        404,
      );
    }

    share.revokedAt = new Date().toISOString();

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
    const activeShares = this.shares.filter((s) => {
      if (s.delegateIdentityId !== identityId) return false;
      if (s.revokedAt) return false;
      if (s.expiresAt && new Date(s.expiresAt) < new Date()) return false;
      return true;
    });

    const documentIds = new Set(activeShares.map((s) => s.documentId));
    const documents: DocumentMetadata[] = [];

    for (const docId of documentIds) {
      const doc = this.documents.get(docId);
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
    const metadata = this.documents.get(documentId);
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
    const metadata = this.documents.get(documentId);
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
    const metadata = this.documents.get(documentId);
    if (!metadata) {
      throw new DocumentNotFoundError(documentId);
    }

    if (!metadata.checksumSha256) {
      throw new DocumentServiceError(
        `Document ${documentId} has no checksum to verify`,
        "NO_CHECKSUM",
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
        "INTEGRITY_VERIFICATION_FAILED",
        500,
      );
    }
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
    const metadata = this.documents.get(documentId);
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