// ┌─────────────────────────────────────────────────────────────┐
// │ AI Platform — Secure Document Storage (R2)                   │
// │ Product-agnostic, reusable across all AGS products.        │
// │ Wave 6 — AI Platform Secure Document Upload v1              │
// └─────────────────────────────────────────────────────────────┘
//
// PHI Boundary: This service manages document storage in R2.
// PHI-segregated buckets ensure PHI documents are always
// separated from non-PHI documents. Object metadata stores
// classification and encryption metadata — never raw PHI payloads.

import { DocumentStorageError, DocumentEncryption } from "./types.js";

/**
 * PHI bucket name prefix.
 * All PHI documents are stored in buckets prefixed with "phi-".
 */
const PHI_BUCKET_PREFIX = "phi-";

/**
 * Non-PHI bucket name prefix.
 * All non-PHI documents are stored in buckets prefixed with "non-phi-".
 */
const NON_PHI_BUCKET_PREFIX = "non-phi-";

/**
 * Default expiry for pre-signed URLs in seconds (1 hour).
 */
const DEFAULT_URL_EXPIRY_SECONDS = 3600;

/**
 * Maximum expiry for pre-signed URLs in seconds (24 hours).
 */
const MAX_URL_EXPIRY_SECONDS = 86400;

/**
 * Object metadata key for PHI classification.
 */
const META_PHI_CLASSIFICATION = "phi_classification";

/**
 * Object metadata key for encryption method.
 */
const META_ENCRYPTION = "encryption";

/**
 * Object metadata key for document ID.
 */
const META_DOCUMENT_ID = "document_id";

/**
 * Object metadata key for checksum.
 */
const META_CHECKSUM = "checksum_sha256";

/**
 * Object metadata key for identity ID.
 */
const META_IDENTITY_ID = "identity_id";

/**
 * Object metadata key for category.
 */
const META_CATEGORY = "category";

/**
 * Storage configuration for the document storage service.
 */
export interface DocumentStorageConfig {
  /** Default PHI bucket name */
  phiBucket: string;
  /** Default non-PHI bucket name */
  nonPhiBucket: string;
  /** R2 bucket binding */
  r2Bucket: R2Bucket;
  /** Optional KV namespace for document metadata index */
  kvNamespace?: KVNamespace;
}

/**
 * Document Storage — R2-based document storage with PHI segregation.
 *
 * Manages document upload, download, deletion, and pre-signed URLs
 * with automatic PHI vs non-PHI bucket routing based on document
 * classification. Object metadata stores classification and
 * encryption metadata for audit and retrieval.
 */
export class DocumentStorage {
  private readonly config: DocumentStorageConfig;

  constructor(config: DocumentStorageConfig) {
    this.config = config;
  }

  // ── Bucket Resolution ──────────────────────────────────────

  /**
   * Resolve the storage bucket name based on PHI classification.
   * PHI documents go to phi- buckets, non-PHI to non-phi- buckets.
   */
  resolveBucket(isPhi: boolean): string {
    return isPhi ? this.config.phiBucket : this.config.nonPhiBucket;
  }

  /**
   * Determine if a bucket name is a PHI bucket.
   */
  isPhiBucket(bucketName: string): boolean {
    return bucketName.startsWith(PHI_BUCKET_PREFIX);
  }

  // ── Upload ──────────────────────────────────────────────────

  /**
   * Upload a document to R2 storage.
   *
   * @param bucket - Target R2 bucket name
   * @param key - Object key within the bucket
   * @param body - Document content as a stream or buffer
   * @param contentType - MIME type of the document
   * @param metadata - Custom metadata to store with the object
   * @returns The uploaded object metadata
   */
  async uploadDocument(
    bucket: string,
    key: string,
    body: ReadableStream | ArrayBuffer | Blob,
    contentType: string,
    metadata?: Record<string, string>,
  ): Promise<R2Object> {
    try {
      const object = await this.config.r2Bucket.put(key, body, {
        httpMetadata: { contentType },
        customMetadata: {
          ...metadata,
          uploadedAt: new Date().toISOString(),
        },
      });

      return object;
    } catch (error) {
      throw new DocumentStorageError(
        `Failed to upload document to bucket "${bucket}": ${error instanceof Error ? error.message : "Unknown error"}`,
        "UPLOAD_FAILED",
        { bucket, key },
      );
    }
  }

  // ── Download ────────────────────────────────────────────────

  /**
   * Download a document from R2 storage.
   *
   * @param bucket - Source R2 bucket name
   * @param key - Object key within the bucket
   * @returns The document body as an R2ObjectBody
   */
  async downloadDocument(bucket: string, key: string): Promise<R2ObjectBody> {
    try {
      const object = await this.config.r2Bucket.get(key);

      if (!object) {
        throw new DocumentStorageError(
          `Document not found in bucket "${bucket}": ${key}`,
          "DOCUMENT_NOT_FOUND",
          { bucket, key },
        );
      }

      return object;
    } catch (error) {
      if (error instanceof DocumentStorageError) {
        throw error;
      }
      throw new DocumentStorageError(
        `Failed to download document from bucket "${bucket}": ${error instanceof Error ? error.message : "Unknown error"}`,
        "DOWNLOAD_FAILED",
        { bucket, key },
      );
    }
  }

  // ── Delete ──────────────────────────────────────────────────

  /**
   * Delete a document from R2 storage.
   *
   * @param bucket - Source R2 bucket name
   * @param key - Object key within the bucket
   */
  async deleteDocument(bucket: string, key: string): Promise<void> {
    try {
      await this.config.r2Bucket.delete(key);
    } catch (error) {
      throw new DocumentStorageError(
        `Failed to delete document from bucket "${bucket}": ${error instanceof Error ? error.message : "Unknown error"}`,
        "DELETE_FAILED",
        { bucket, key },
      );
    }
  }

  // ── Pre-signed URLs ─────────────────────────────────────────

  /**
   * Generate a pre-signed upload URL.
   *
   * Available at runtime via R2 bucket.createSignedUrl().
   *
   * @param bucket - Target R2 bucket name
   * @param key - Object key to upload to
   * @param expirySeconds - URL expiry in seconds (max 86400)
   * @returns Pre-signed upload URL
   */
  async generateUploadUrl(
    bucket: string,
    key: string,
    expirySeconds: number = DEFAULT_URL_EXPIRY_SECONDS,
  ): Promise<string> {
    const expiry = Math.min(expirySeconds, MAX_URL_EXPIRY_SECONDS);

    try {
      // createSignedUrl is available in the Workers R2 runtime
      const url = await (this.config.r2Bucket as any).createSignedUrl(key, {
        method: "PUT",
        expirySeconds: expiry,
      });

      return url;
    } catch (error) {
      throw new DocumentStorageError(
        `Failed to generate upload URL for bucket "${bucket}": ${error instanceof Error ? error.message : "Unknown error"}`,
        "SIGNED_URL_FAILED",
        { bucket, key },
      );
    }
  }

  /**
   * Generate a pre-signed download URL.
   *
   * Available at runtime via R2 bucket.createSignedUrl().
   *
   * @param bucket - Source R2 bucket name
   * @param key - Object key to download
   * @param expirySeconds - URL expiry in seconds (max 86400)
   * @returns Pre-signed download URL
   */
  async generateDownloadUrl(
    bucket: string,
    key: string,
    expirySeconds: number = DEFAULT_URL_EXPIRY_SECONDS,
  ): Promise<string> {
    const expiry = Math.min(expirySeconds, MAX_URL_EXPIRY_SECONDS);

    try {
      const url = await (this.config.r2Bucket as any).createSignedUrl(key, {
        method: "GET",
        expirySeconds: expiry,
      });

      return url;
    } catch (error) {
      throw new DocumentStorageError(
        `Failed to generate download URL for bucket "${bucket}": ${error instanceof Error ? error.message : "Unknown error"}`,
        "SIGNED_URL_FAILED",
        { bucket, key },
      );
    }
  }

  // ── Existence Check ─────────────────────────────────────────

  /**
   * Check if a document exists in R2 storage.
   *
   * @param bucket - Source R2 bucket name
   * @param key - Object key to check
   * @returns True if the object exists
   */
  async documentExists(bucket: string, key: string): Promise<boolean> {
    try {
      const head = await this.config.r2Bucket.head(key);
      return head !== null;
    } catch (error) {
      throw new DocumentStorageError(
        `Failed to check document existence in bucket "${bucket}": ${error instanceof Error ? error.message : "Unknown error"}`,
        "HEAD_FAILED",
        { bucket, key },
      );
    }
  }

  // ── List ────────────────────────────────────────────────────

  /**
   * List documents in a bucket with an optional prefix.
   *
   * @param bucket - Source R2 bucket name
   * @param prefix - Object key prefix to filter by
   * @returns List of R2 objects
   */
  async listDocuments(bucket: string, prefix?: string): Promise<R2Object[]> {
    try {
      const objects: R2Object[] = [];
      let cursor: string | undefined;

      do {
        const result = await this.config.r2Bucket.list({
          prefix,
          cursor,
          limit: 1000,
        });

        objects.push(...result.objects);
        cursor = result.truncated ? result.cursor : undefined;
      } while (cursor);

      return objects;
    } catch (error) {
      throw new DocumentStorageError(
        `Failed to list documents in bucket "${bucket}": ${error instanceof Error ? error.message : "Unknown error"}`,
        "LIST_FAILED",
        { bucket, prefix },
      );
    }
  }

  // ── Copy ────────────────────────────────────────────────────

  /**
   * Copy a document between buckets or within the same bucket.
   *
   * @param sourceBucket - Source R2 bucket name
   * @param sourceKey - Source object key
   * @param destBucket - Destination R2 bucket name
   * @param destKey - Destination object key
   * @returns The copied object metadata
   */
  async copyDocument(
    sourceBucket: string,
    sourceKey: string,
    destBucket: string,
    destKey: string,
  ): Promise<R2Object> {
    try {
      const source = await this.config.r2Bucket.get(sourceKey);

      if (!source) {
        throw new DocumentStorageError(
          `Source document not found: "${sourceBucket}/${sourceKey}"`,
          "DOCUMENT_NOT_FOUND",
          { sourceBucket, sourceKey },
        );
      }

      const body = await source.arrayBuffer();
      const object = await this.config.r2Bucket.put(destKey, body, {
        customMetadata: source.customMetadata,
        httpMetadata: source.httpMetadata,
      });

      return object;
    } catch (error) {
      if (error instanceof DocumentStorageError) {
        throw error;
      }
      throw new DocumentStorageError(
        `Failed to copy document from "${sourceBucket}/${sourceKey}" to "${destBucket}/${destKey}": ${error instanceof Error ? error.message : "Unknown error"}`,
        "COPY_FAILED",
        { sourceBucket, sourceKey, destBucket, destKey },
      );
    }
  }

  // ── Metadata Management ─────────────────────────────────────

  /**
   * Get custom metadata from an R2 object.
   *
   * @param bucket - Source R2 bucket name
   * @param key - Object key
   * @returns Object metadata record
   */
  async getObjectMetadata(bucket: string, key: string): Promise<Record<string, string>> {
    try {
      const head = await this.config.r2Bucket.head(key);

      if (!head) {
        throw new DocumentStorageError(
          `Document not found in bucket "${bucket}": ${key}`,
          "DOCUMENT_NOT_FOUND",
          { bucket, key },
        );
      }

      return head.customMetadata ?? {};
    } catch (error) {
      if (error instanceof DocumentStorageError) {
        throw error;
      }
      throw new DocumentStorageError(
        `Failed to get metadata for document in bucket "${bucket}": ${error instanceof Error ? error.message : "Unknown error"}`,
        "METADATA_FAILED",
        { bucket, key },
      );
    }
  }

  /**
   * Store document metadata in KV namespace for fast indexing.
   *
   * @param documentId - Document identifier
   * @param metadata - Document metadata to store
   */
  async storeMetadataIndex(
    documentId: string,
    metadata: Record<string, string>,
  ): Promise<void> {
    if (!this.config.kvNamespace) {
      return; // KV is optional
    }

    try {
      await this.config.kvNamespace.put(
        `doc:${documentId}`,
        JSON.stringify(metadata),
        {
          metadata: {
            documentId,
            storedAt: new Date().toISOString(),
          },
        },
      );
    } catch (error) {
      // KV indexing failure is non-fatal — document is still in R2
      console.warn(
        `Failed to store metadata index for document ${documentId}: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  /**
   * Retrieve document metadata from KV index.
   *
   * @param documentId - Document identifier
   * @returns Stored metadata or null
   */
  async getMetadataIndex(
    documentId: string,
  ): Promise<Record<string, string> | null> {
    if (!this.config.kvNamespace) {
      return null;
    }

    try {
      const value = await this.config.kvNamespace.get(`doc:${documentId}`);
      return value ? JSON.parse(value) : null;
    } catch (error) {
      console.warn(
        `Failed to retrieve metadata index for document ${documentId}: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
      return null;
    }
  }

  /**
   * Delete document metadata from KV index.
   *
   * @param documentId - Document identifier
   */
  async deleteMetadataIndex(documentId: string): Promise<void> {
    if (!this.config.kvNamespace) {
      return;
    }

    try {
      await this.config.kvNamespace.delete(`doc:${documentId}`);
    } catch (error) {
      console.warn(
        `Failed to delete metadata index for document ${documentId}: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  // ── Health ──────────────────────────────────────────────────

  /**
   * Check storage service health.
   *
   * @returns True if the storage service is operational
   */
  async health(): Promise<boolean> {
    try {
      await this.config.r2Bucket.list({ limit: 1 });
      return true;
    } catch {
      return false;
    }
  }
}