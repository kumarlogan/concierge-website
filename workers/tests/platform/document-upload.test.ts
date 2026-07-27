// ┌─────────────────────────────────────────────────────────────┐
// │ AI Platform — Secure Document Upload Unit Tests              │
// │ Product-agnostic tests for all Secure Document Upload       │
// │ components. Wave 6 — Secure Document Upload & Consent        │
// │ Runtime Completion.                                         │
// └─────────────────────────────────────────────────────────────┘

import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  DocumentCategory,
  DocumentStatus,
  DocumentEncryption as DocumentEncryptionType,
  PHIClassification,
  DocumentServiceError,
  ErrorCode,
} from "../../src/platform/documents/types.js";
import { DocumentStorage } from "../../src/platform/documents/document-storage.js";
import { DocumentEncryption } from "../../src/platform/documents/document-encryption.js";
import { DocumentConsentIntegration } from "../../src/platform/documents/document-consent-integration.js";
import { DocumentAudit } from "../../src/platform/documents/document-audit.js";
import { DocumentPolicyIntegration } from "../../src/platform/documents/document-policy-integration.js";
import { DocumentService } from "../../src/platform/documents/document-service.js";

// ════════════════════════════════════════════════
// Type & Error Tests
// ════════════════════════════════════════════════

describe("Document Types", () => {
  it("defines all document categories", () => {
    expect(DocumentCategory.LAB_RESULT).toBe("lab_result");
    expect(DocumentCategory.IMAGING).toBe("imaging");
    expect(DocumentCategory.PRESCRIPTION).toBe("prescription");
    expect(DocumentCategory.CONSENT_FORM).toBe("consent_form");
    expect(DocumentCategory.CLINICAL_NOTE).toBe("clinical_note");
    expect(DocumentCategory.IDENTIFICATION).toBe("identification");
    expect(DocumentCategory.INSURANCE_CARD).toBe("insurance_card");
    expect(DocumentCategory.OTHER).toBe("other");
  });

  it("defines all document statuses", () => {
    expect(DocumentStatus.PENDING_UPLOAD).toBe("pending_upload");
    expect(DocumentStatus.UPLOADING).toBe("uploading");
    expect(DocumentStatus.AVAILABLE).toBe("available");
    expect(DocumentStatus.ARCHIVED).toBe("archived");
    expect(DocumentStatus.DELETED).toBe("deleted");
    expect(DocumentStatus.QUARANTINED).toBe("quarantined");
  });

  it("defines all encryption types", () => {
    expect(DocumentEncryptionType.AES_256_GCM).toBe("aes_256_gcm");
    expect(DocumentEncryptionType.CLIENT_SIDE_ENCRYPTED).toBe("client_side_encrypted");
    expect(DocumentEncryptionType.SERVER_SIDE_ENCRYPTED).toBe("server_side_encrypted");
    expect(DocumentEncryptionType.UNENCRYPTED).toBe("unencrypted");
  });

  it("defines all PHI classifications", () => {
    expect(PHIClassification.PHI_DIRECT).toBe("phi_direct");
    expect(PHIClassification.PHI_INDIRECT).toBe("phi_indirect");
    expect(PHIClassification.NON_PHI).toBe("non_phi");
    expect(PHIClassification.UNKNOWN).toBe("unknown");
  });

  it("DocumentServiceError has correct shape", () => {
    const err = new DocumentServiceError("Not found", ErrorCode.NOT_FOUND, 404);
    expect(err.message).toBe("Not found");
    expect(err.code).toBe(ErrorCode.NOT_FOUND);
    expect(err.status).toBe(404);
    expect(err).toBeInstanceOf(Error);
  });
});

// ════════════════════════════════════════════════
// Document Storage Service Tests
// ════════════════════════════════════════════════

describe("DocumentStorage", () => {
  let storage: any;

  beforeEach(() => {
    // Mock R2 bucket
    const mockBucket = {
      put: vi.fn().mockResolvedValue({}),
      get: vi.fn().mockResolvedValue({
        body: new ArrayBuffer(10),
        httpMetadata: { contentType: "application/pdf" },
        customMetadata: { fileName: "test.pdf" },
        writeHttpMetadata: vi.fn(),
      }),
      delete: vi.fn().mockResolvedValue({}),
      head: vi.fn().mockResolvedValue({ httpEtag: "abc123" }),
      list: vi.fn().mockResolvedValue({ objects: [] }),
      createSignedUrl: vi.fn().mockResolvedValue("https://r2.example.com/signed"),
    };

    storage = new DocumentStorage({
      phiBucket: "phi-test",
      nonPhiBucket: "non-phi-test",
      r2Bucket: mockBucket,
    });
  });

  it("uploads a document to R2", async () => {
    const buffer = new ArrayBuffer(100);
    const result = await storage.uploadDocument(
      "phi-test",
      "test-key.pdf",
      buffer,
      "application/pdf",
      { fileName: "test.pdf" },
    );

    expect(result).toBeDefined();
    // R2Object returned by put - it has the key in the response
    expect(typeof result).toBe("object");
  });

  it("downloads a document from R2", async () => {
    const result = await storage.downloadDocument("phi-test", "test-key.pdf");

    expect(result).toBeDefined();
    expect(result.httpMetadata).toBeDefined();
  });

  it("deletes a document from R2", async () => {
    await storage.deleteDocument("phi-test", "test-key.pdf");
  });

  it("checks if a document exists", async () => {
    const result = await storage.documentExists("phi-test", "test-key.pdf");

    expect(result).toBe(true);
  });

  it("throws error when R2 put fails", async () => {
    const mockBucket = {
      put: vi.fn().mockRejectedValue(new Error("R2 put failed")),
      get: vi.fn(),
      delete: vi.fn(),
      head: vi.fn(),
      list: vi.fn(),
    };
    const failingStorage = new DocumentStorage(mockBucket);

    await expect(
      failingStorage.uploadDocument("phi-test", "key.pdf", new ArrayBuffer(10), "application/pdf"),
    ).rejects.toThrow(DocumentServiceError);
  });

  it("segregates PHI documents into phi- bucket", () => {
    expect(storage.isPhiBucket("phi-test")).toBe(true);
    expect(storage.isPhiBucket("non-phi-test")).toBe(false);
  });
});

// ════════════════════════════════════════════════
// Document Encryption Tests
// ════════════════════════════════════════════════

describe("DocumentEncryption", () => {
  let encryption: any;

  beforeEach(() => {
    encryption = new DocumentEncryption();
  });

  it("generates a checksum for a buffer", async () => {
    const buffer = new TextEncoder().encode("test document content");
    const checksum = await encryption.generateDocumentChecksum(buffer);

    expect(checksum).toBeDefined();
    expect(checksum.length).toBe(64); // SHA-256 hex
  });

  it("generates encryption keys", async () => {
    const key = await encryption.generateEncryptionKey();

    expect(key).toBeDefined();
    expect(key.keyId).toBeDefined();
    expect(key.version).toBeDefined();
  });

  it("encrypts and decrypts a document", async () => {
    const buffer = new TextEncoder().encode("sensitive PHI document content");
    const key = await encryption.generateEncryptionKey();

    const encrypted = await encryption.encryptDocument(buffer, key.keyId);
    expect(encrypted).toBeDefined();
    expect(encrypted.encryptedBuffer).toBeDefined();
    expect(encrypted.iv).toBeDefined();

    // Decrypt
    const decrypted = await encryption.decryptDocument(
      encrypted.encryptedBuffer,
      key.keyId,
      encrypted.iv,
    );

    const decryptedText = new TextDecoder().decode(decrypted);
    expect(decryptedText).toBe("sensitive PHI document content");
  });

  it("throws on decrypt with wrong key", async () => {
    const buffer = new TextEncoder().encode("test content");
    const key1 = await encryption.generateEncryptionKey();
    const key2 = await encryption.generateEncryptionKey();

    const encrypted = await encryption.encryptDocument(buffer, key1.keyId);

    await expect(
      encryption.decryptDocument(encrypted.encryptedBuffer, key2.keyId, encrypted.iv),
    ).rejects.toThrow();
  });
});

// ════════════════════════════════════════════════
// Document Consent Integration Tests
// ════════════════════════════════════════════════

describe("DocumentConsentIntegration", () => {
  let integration: any;
  let mockConsentEngine: any;
  let mockDelegationEngine: any;
  let mockPolicyEngine: any;
  let mockEventBus: any;

  beforeEach(() => {
    mockConsentEngine = {
      evaluate: vi.fn().mockResolvedValue({ allowed: true, score: 1.0 }),
      getHistory: vi.fn().mockResolvedValue({
        entries: [
          {
            granted: true,
            scope: ["doc-1", "*"],
            expiresAt: "2027-07-27T00:00:00Z",
            revokedAt: null,
            purpose: "clinical_care",
          },
        ],
      }),
      grant: vi.fn().mockResolvedValue({ id: "consent-1", granted: true, createdAt: "2026-07-27T00:00:00Z" }),
      withdraw: vi.fn().mockResolvedValue({ consentId: "consent-1", revoked: true, revokedAt: "2026-07-27T00:00:00Z" }),
    };

    mockDelegationEngine = {
      create: vi.fn().mockResolvedValue({ id: "deleg-1", createdAt: "2026-07-27T00:00:00Z" }),
      revoke: vi.fn().mockResolvedValue({ revoked: true, revokedAt: "2026-07-27T00:00:00Z" }),
      resolveChain: vi.fn().mockResolvedValue({ chain: ["deleg-1"], valid: true }),
    };

    mockPolicyEngine = {
      evaluate: vi.fn().mockResolvedValue({ allowed: true, decision: "ALLOW", reason: "Policy matched" }),
    };

    mockEventBus = {
      publish: vi.fn().mockResolvedValue({}),
    };

    integration = new DocumentConsentIntegration({
      consentEngine: mockConsentEngine,
      delegationEngine: mockDelegationEngine,
    });
  });

  it("checks document access consent", async () => {
    const result = await integration.checkDocumentAccessConsent(
      "identity-1",
      "doc-1",
      "clinical_care",
    );

    expect(result).toBe(true);
  });

  it("grants document sharing consent", async () => {
    const result = await integration.grantDocumentSharingConsent(
      "owner-1",
      "delegatee-1",
      "doc-1",
      ["read"],
      "2027-07-27T00:00:00Z",
    );

    expect(result.consentId).toBe("consent-1");
    expect(result.granted).toBe(true);
  });

  it("revokes document sharing consent", async () => {
    const result = await integration.revokeDocumentSharingConsent("consent-1");

    expect(result.consentId).toBe("consent-1");
    expect(result.revoked).toBe(true);
  });

  it("creates delegated consent for caregiver", async () => {
    const result = await integration.createDelegatedConsent(
      "patient-1",
      "caregiver-1",
      ["doc-1", "doc-2"],
      "read",
      "2027-07-27T00:00:00Z",
    );

    expect(result.delegationId).toBe("deleg-1");
    expect(result.createdAt).toBeDefined();
  });

  it("revokes caregiver delegation", async () => {
    const result = await integration.revokeDelegatedConsent(
      "deleg-1",
      "patient-1",
      "No longer needed",
    );

    expect(result.delegationId).toBe("deleg-1");
    expect(result.revoked).toBe(true);
  });
});

// ════════════════════════════════════════════════
// Document Audit Tests
// ════════════════════════════════════════════════

describe("DocumentAudit", () => {
  let audit: any;
  let mockDb: any;

  beforeEach(() => {
    mockDb = {
      prepare: vi.fn().mockReturnThis(),
      bind: vi.fn().mockReturnThis(),
      run: vi.fn().mockResolvedValue({ success: true }),
      all: vi.fn().mockResolvedValue({ results: [] }),
      first: vi.fn().mockResolvedValue(null),
      append: vi.fn().mockResolvedValue(undefined),
      queryByDocument: vi.fn().mockResolvedValue({ entries: [], total: 0 }),
      queryByIdentity: vi.fn().mockResolvedValue({ entries: [], total: 0 }),
    };

    audit = new DocumentAudit(mockDb);
  });

  it("logs document access events", async () => {
    const event = {
      documentId: "doc-1",
      identityId: "user-1",
      action: "document:read",
      accessType: "owner",
      outcome: "ALLOW",
      timestamp: "2026-07-27T00:00:00Z",
    };

    await audit.logDocumentAccess(event);
  });

  it("logs document share events", async () => {
    const event = {
      documentId: "doc-1",
      ownerId: "user-1",
      delegateeId: "user-2",
      action: "document:share",
      accessLevel: "read",
      expiresAt: "2027-07-27T00:00:00Z",
    };

    await audit.logDocumentShare(event);
  });

  it("logs document upload events", async () => {
    const event = {
      documentId: "doc-1",
      identityId: "user-1",
      fileName: "test.pdf",
      fileSize: 1024,
      category: "lab_result",
    };

    await audit.logDocumentUpload(event);
  });

  it("logs document delete events", async () => {
    const event = {
      documentId: "doc-1",
      identityId: "user-1",
      reason: "Patient request",
    };

    await audit.logDocumentDelete(event);
  });

  it("queries document audit log", async () => {
    mockDb.queryByDocument.mockResolvedValue({
      entries: [
        {
          id: "audit-1",
          documentId: "doc-1",
          identityId: "user-1",
          action: "document:read",
          outcome: "ALLOW",
          timestamp: "2026-07-27T00:00:00Z",
        },
      ],
      total: 1,
    });

    const result = await audit.getDocumentAuditLog("doc-1", { limit: 10, offset: 0 });
    expect(result.entries).toHaveLength(1);
    expect(result.entries[0].action).toBe("document:read");
  });
});

// ════════════════════════════════════════════════
// Document Policy Integration Tests
// ════════════════════════════════════════════════

describe("DocumentPolicyIntegration", () => {
  let policyIntegration: any;
  let mockPolicyEngine: any;

  beforeEach(() => {
    mockPolicyEngine = {
      evaluate: vi.fn().mockImplementation(({ action, resource }) => {
        // Owner always allowed
        if (resource === "document:doc-1") {
          return Promise.resolve({ allowed: true, decision: "ALLOW", reason: "Owner access", matchedRules: ["doc-owner-read"] });
        }
        // Shared document
        if (resource === "document:doc-2") {
          return Promise.resolve({ allowed: true, decision: "ALLOW", reason: "Shared access", matchedRules: ["doc-share-read"] });
        }
        // Deny by default
        return Promise.resolve({ allowed: false, decision: "DENY", reason: "No matching rules", matchedRules: [] });
      }),
      register: vi.fn().mockResolvedValue({}),
    };

    policyIntegration = new DocumentPolicyIntegration(mockPolicyEngine);
  });

  it("allows document owner access", async () => {
    const result = await policyIntegration.evaluateDocumentAccess(
      "user-1",
      "doc-1",
      "document:read",
      { accessType: "owner" },
    );

    expect(result.allowed).toBe(true);
    expect(result.decision).toBe("ALLOW");
  });

  it("allows shared document access", async () => {
    const result = await policyIntegration.evaluateDocumentAccess(
      "user-2",
      "doc-2",
      "document:read",
      { accessType: "shared" },
    );

    expect(result.allowed).toBe(true);
    expect(result.decision).toBe("ALLOW");
  });

  it("denies access by default (fail-closed)", async () => {
    const result = await policyIntegration.evaluateDocumentAccess(
      "user-3",
      "doc-3",
      "document:read",
      { accessType: "unknown" },
    );

    expect(result.allowed).toBe(false);
    expect(result.decision).toBe("DENY");
  });

  it("registers default document policies", async () => {
    const result = await policyIntegration.registerDocumentPolicies();
    expect(result).toBeDefined();
    expect(Array.isArray(result)).toBe(true);
  });
});

// ════════════════════════════════════════════════
// Document Service Integration Tests
// ════════════════════════════════════════════════

describe("DocumentService", () => {
  let service: any;
  let mockDb: any;
  let mockStorage: any;
  let mockEncryption: any;
  let mockAudit: any;
  let mockConsentIntegration: any;
  let mockPolicyIntegration: any;

  beforeEach(() => {
    mockDb = {
      prepare: vi.fn().mockReturnThis(),
      bind: vi.fn().mockReturnThis(),
      run: vi.fn().mockResolvedValue({ success: true }),
      all: vi.fn().mockResolvedValue({ results: [] }),
      first: vi.fn().mockResolvedValue(null),
    };

    mockStorage = {
      resolveBucket: vi.fn().mockReturnValue("phi-test"),
      uploadDocument: vi.fn().mockResolvedValue({ success: true, key: "doc-1.pdf" }),
      downloadDocument: vi.fn().mockResolvedValue({ body: new ArrayBuffer(10), contentType: "application/pdf" }),
      deleteDocument: vi.fn().mockResolvedValue({ success: true }),
      getBucketName: vi.fn().mockReturnValue("phi-test"),
      generateUploadUrl: vi.fn().mockResolvedValue({ url: "https://r2.example.com/upload" }),
      generateDownloadUrl: vi.fn().mockResolvedValue({ url: "https://r2.example.com/download" }),
      storeMetadataIndex: vi.fn().mockResolvedValue({}),
    };

    mockEncryption = {
      generateDocumentChecksum: vi.fn().mockResolvedValue("abc123def456"),
      getEncryptionMethod: vi.fn().mockReturnValue("aes_256_gcm"),
      encryptDocument: vi.fn().mockResolvedValue({ ciphertext: new ArrayBuffer(10), iv: new Uint8Array(12), encryptedBuffer: new ArrayBuffer(10) }),
      decryptDocument: vi.fn().mockResolvedValue(new ArrayBuffer(10)),
    };

    mockAudit = {
      logDocumentAccess: vi.fn().mockResolvedValue({ success: true }),
      logDocumentUpload: vi.fn().mockResolvedValue({ success: true }),
      logDocumentShare: vi.fn().mockResolvedValue({ success: true }),
      logDocumentDelete: vi.fn().mockResolvedValue({ success: true }),
      getDocumentAuditLog: vi.fn().mockResolvedValue({ entries: [], total: 0 }),
      storage: {
        queryByDocument: vi.fn().mockResolvedValue({ entries: [], total: 0 }),
        queryByIdentity: vi.fn().mockResolvedValue({ entries: [], total: 0 }),
        append: vi.fn().mockResolvedValue(undefined),
      },
    };

    mockConsentIntegration = {
      checkDocumentAccessConsent: vi.fn().mockResolvedValue({ allowed: true }),
      createDelegatedConsent: vi.fn().mockResolvedValue({ delegationId: "deleg-1", consentId: "consent-1" }),
      revokeDelegatedConsent: vi.fn().mockResolvedValue({ delegationId: "deleg-1", revoked: true }),
      getCaregiverDocuments: vi.fn().mockResolvedValue({ documents: [] }),
      getCaregiverAuthorizations: vi.fn().mockResolvedValue({ authorizations: [] }),
      grantDocumentSharingConsent: vi.fn().mockResolvedValue({ consentId: "consent-1", grantedAt: "2026-07-27T00:00:00Z" }),
    };

    mockPolicyIntegration = {
      evaluateDocumentAccess: vi.fn().mockResolvedValue({ allowed: true, decision: "ALLOW" }),
    };

    service = new DocumentService({
      storage: mockStorage,
      encryption: mockEncryption,
      audit: mockAudit,
      consentIntegration: mockConsentIntegration,
      policyIntegration: mockPolicyIntegration,
      storageProvider: "r2",
    });
  });

  it("creates a document metadata record", async () => {
    mockDb.first.mockResolvedValueOnce(null); // No existing doc
    mockDb.run.mockResolvedValueOnce({ success: true });

    const result = await service.createDocument({
      identityId: "user-1",
      patientId: "patient-1",
      category: "lab_result",
      fileName: "blood-test.pdf",
      mimeType: "application/pdf",
      fileSize: 0,
      phiClassification: "phi_direct",
    });

    expect(result.id).toBeDefined();
    expect(result.status).toBe("pending_upload");
  });

  it("uploads a document", async () => {
    mockDb.first.mockResolvedValueOnce(null); // No existing doc
    mockDb.run.mockResolvedValueOnce({ success: true });

    // First, create the document metadata (generates the document ID)
    const created = await service.createDocument({
      identityId: "user-1",
      patientId: "patient-1",
      category: "lab_result",
      fileName: "doc-1.pdf",
      mimeType: "application/pdf",
      fileSize: 100,
      phiClassification: "phi_direct",
    });

    // Then upload the file using the generated ID
    mockDb.run.mockResolvedValueOnce({ success: true });

    const result = await service.uploadDocument(
      created.id,
      new ArrayBuffer(100),
      "application/pdf",
    );

    expect(result.status).toBe("available");
    expect(result.documentId).toBe(created.id);
  });

  it("gets a document for the owner", async () => {
    mockDb.first.mockResolvedValueOnce(null);
    mockDb.run.mockResolvedValueOnce({ success: true });

    const created = await service.createDocument({
      identityId: "user-1",
      patientId: "patient-1",
      category: "lab_result",
      fileName: "test.pdf",
      mimeType: "application/pdf",
      fileSize: 1024,
      phiClassification: "phi_direct",
    });

    const result = await service.getDocument(created.id, "user-1");
    expect(result.id).toBe(created.id);
    expect(result.status).toBe("pending_upload");
  });

  it("shares a document with another user", async () => {
    mockDb.first.mockResolvedValueOnce(null);
    mockDb.run.mockResolvedValueOnce({ success: true });

    const created = await service.createDocument({
      identityId: "user-1",
      patientId: "patient-1",
      category: "lab_result",
      fileName: "test.pdf",
      mimeType: "application/pdf",
      fileSize: 1024,
      phiClassification: "phi_direct",
    });

    const result = await service.shareDocument(
      created.id,
      "user-1",
      "user-2",
      "read",
      "2027-07-27T00:00:00Z",
    );

    expect(result.id).toBeDefined();
    expect(result.documentId).toBe(created.id);
    expect(result.grantedAt).toBeDefined();
  });

  it("verifies document integrity", async () => {
    mockDb.first.mockResolvedValueOnce(null);
    mockDb.run.mockResolvedValueOnce({ success: true });

    const created = await service.createDocument({
      identityId: "user-1",
      patientId: "patient-1",
      category: "lab_result",
      fileName: "test.pdf",
      mimeType: "application/pdf",
      fileSize: 1024,
      phiClassification: "phi_direct",
    });

    // Upload a document to set a checksum in the map
    mockStorage.uploadDocument.mockResolvedValueOnce({ success: true, key: created.id });
    mockDb.run.mockResolvedValueOnce({ success: true });
    await service.uploadDocument(created.id, new ArrayBuffer(100), "application/pdf");

    // Mock downloadDocument to return a proper R2ObjectBody with arrayBuffer()
    mockStorage.downloadDocument.mockResolvedValueOnce({
      arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(100)),
      contentType: "application/pdf",
    });

    const result = await service.verifyDocumentIntegrity(created.id);
    expect(result).toBe(true);
  });

  it("denies document access to unauthorized users", async () => {
    mockDb.first.mockResolvedValueOnce(null);
    mockDb.run.mockResolvedValueOnce({ success: true });

    const created = await service.createDocument({
      identityId: "user-1",
      patientId: "patient-1",
      category: "lab_result",
      fileName: "test.pdf",
      mimeType: "application/pdf",
      fileSize: 1024,
      phiClassification: "phi_direct",
    });

    mockPolicyIntegration.evaluateDocumentAccess.mockResolvedValueOnce({
      allowed: false,
      decision: "DENY",
    });

    await expect(
      service.getDocument(created.id, "user-3"),
    ).rejects.toThrow(DocumentServiceError);
  });
});