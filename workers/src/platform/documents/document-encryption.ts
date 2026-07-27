// ┌─────────────────────────────────────────────────────────────┐
// │ AI Platform — Document Encryption (PHI Protection)           │
// │ Product-agnostic, reusable across all AGS products.        │
// │ Wave 6 — AI Platform Secure Document Upload v1              │
// └─────────────────────────────────────────────────────────────┘
//
// PHI Boundary: This module handles encryption of PHI document
// payloads. Encrypted payloads are stored in PHI-segregated R2
// buckets. Key material is managed via KMS or local key store.
// Non-PHI documents use server-side encryption (R2 default).
// PHI documents are always encrypted with AES-256-GCM.

import { DocumentEncryptionError, DocumentEncryption as DocEncryptionEnum } from "./types.js";

/**
 * Supported encryption algorithms.
 */
const ALGORITHM_AES_256_GCM = "AES-GCM";
const ALGORITHM_KEY_LENGTH = 256; // bits
const IV_LENGTH = 12; // bytes (96 bits for GCM recommended)
const TAG_LENGTH = 128; // bits (16 bytes)
const SALT_LENGTH = 32; // bytes

/**
 * Metadata encryption key identifier for sensitive fields.
 */
const METADATA_ENCRYPTION_KEY_PREFIX = "meta-key-";

/**
 * Key management interface for document encryption keys.
 * Implementations can back this with KMS, local key store, or
 * Cloudflare Workers Secrets.
 */
export interface KeyManager {
  /** Get an encryption key by key ID */
  getKey(keyId: string): Promise<CryptoKey | null>;
  /** Store a new encryption key and return its key ID */
  storeKey(key: CryptoKey, version: number): Promise<string>;
  /** Get the current active key version */
  getCurrentVersion(): Promise<number>;
  /** Rotate to a new key version */
  rotateKey(): Promise<{ keyId: string; version: number }>;
  /** List all key versions */
  listKeyVersions(): Promise<Array<{ keyId: string; version: number; createdAt: string }>>;
}

/**
 * Key metadata for tracking key material.
 */
export interface KeyMetadata {
  /** Key identifier */
  keyId: string;
  /** Key version number */
  version: number;
  /** ISO 8601 creation timestamp */
  createdAt: string;
  /** Algorithm used */
  algorithm: string;
}

/**
 * Default in-memory key manager for development/testing.
 * Production deployments should use a KMS-backed implementation.
 */
export class DefaultKeyManager implements KeyManager {
  private keys: Map<string, CryptoKey> = new Map();
  private keyVersions: Map<number, string> = new Map(); // version → keyId
  private currentVersion: number = 1;
  private readonly namespace: string;

  constructor(namespace: string = "default") {
    this.namespace = namespace;
  }

  async getKey(keyId: string): Promise<CryptoKey | null> {
    return this.keys.get(keyId) ?? null;
  }

  async storeKey(key: CryptoKey, version: number): Promise<string> {
    const keyId = `${this.namespace}-key-v${version}-${crypto.randomUUID().slice(0, 8)}`;
    this.keys.set(keyId, key);
    this.keyVersions.set(version, keyId);
    return keyId;
  }

  async getCurrentVersion(): Promise<number> {
    return this.currentVersion;
  }

  async rotateKey(): Promise<{ keyId: string; version: number }> {
    const newVersion = this.currentVersion + 1;
    const key = await generateAesGcmKey();
    const keyId = await this.storeKey(key, newVersion);
    this.currentVersion = newVersion;
    return { keyId, version: newVersion };
  }

  async listKeyVersions(): Promise<Array<{ keyId: string; version: number; createdAt: string }>> {
    const versions: Array<{ keyId: string; version: number; createdAt: string }> = [];
    for (const [version, keyId] of this.keyVersions) {
      versions.push({
        keyId,
        version,
        createdAt: new Date().toISOString(),
      });
    }
    return versions.sort((a, b) => b.version - a.version);
  }
}

/**
 * Generate an AES-256-GCM key.
 */
async function generateAesGcmKey(): Promise<CryptoKey> {
  // AES-GCM with these parameters always returns CryptoKey (not CryptoKeyPair)
  const key = await (crypto.subtle.generateKey(
    {
      name: ALGORITHM_AES_256_GCM,
      length: ALGORITHM_KEY_LENGTH,
    },
    true,
    ["encrypt", "decrypt"],
  ) as Promise<CryptoKey>);

  return key;
}

/**
 * Document Encryption — PHI document protection with AES-256-GCM.
 *
 * PHI documents are always encrypted at rest using AES-256-GCM.
 * Non-PHI documents rely on server-side encryption (R2 default).
 * Key management supports rotation and versioning.
 */
export class DocumentEncryption {
  private readonly keyManager: KeyManager;

  constructor(keyManager: KeyManager = new DefaultKeyManager()) {
    this.keyManager = keyManager;
  }

  /**
   * Get the key manager instance.
   */
  getKeyManager(): KeyManager {
    return this.keyManager;
  }

  /**
   * Encrypt a document buffer with AES-256-GCM.
   *
   * @param buffer - Document content to encrypt
   * @param keyId - Key identifier for encryption (uses current version if not specified)
   * @returns Encrypted buffer, IV, and key ID
   */
  async encryptDocument(
    buffer: ArrayBuffer,
    keyId?: string,
  ): Promise<{ encryptedBuffer: ArrayBuffer; iv: Uint8Array; keyId: string; keyVersion: number }> {
    try {
      // Resolve key
      const resolvedKeyId = keyId ?? await this.resolveCurrentKeyId();
      const key = await this.keyManager.getKey(resolvedKeyId);

      if (!key) {
        throw new DocumentEncryptionError(
          `Encryption key not found: ${resolvedKeyId}`,
          "KEY_NOT_FOUND",
        );
      }

      // Generate random IV
      const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));

      // Encrypt
      const encryptedBuffer = await crypto.subtle.encrypt(
        {
          name: ALGORITHM_AES_256_GCM,
          iv,
          tagLength: TAG_LENGTH,
        },
        key,
        buffer,
      );

      const version = await this.keyManager.getCurrentVersion();

      return {
        encryptedBuffer,
        iv,
        keyId: resolvedKeyId,
        keyVersion: version,
      };
    } catch (error) {
      if (error instanceof DocumentEncryptionError) {
        throw error;
      }
      throw new DocumentEncryptionError(
        `Failed to encrypt document: ${error instanceof Error ? error.message : "Unknown error"}`,
        "ENCRYPT_FAILED",
      );
    }
  }

  /**
   * Decrypt a document buffer with AES-256-GCM.
   *
   * @param encryptedBuffer - Encrypted document content
   * @param keyId - Key identifier used for encryption
   * @param iv - Initialization vector used during encryption
   * @returns Decrypted buffer
   */
  async decryptDocument(
    encryptedBuffer: ArrayBuffer,
    keyId: string,
    iv: Uint8Array,
  ): Promise<ArrayBuffer> {
    try {
      const key = await this.keyManager.getKey(keyId);

      if (!key) {
        throw new DocumentEncryptionError(
          `Decryption key not found: ${keyId}`,
          "KEY_NOT_FOUND",
        );
      }

      const decryptedBuffer = await crypto.subtle.decrypt(
        {
          name: ALGORITHM_AES_256_GCM,
          iv,
          tagLength: TAG_LENGTH,
        },
        key,
        encryptedBuffer,
      );

      return decryptedBuffer;
    } catch (error) {
      if (error instanceof DocumentEncryptionError) {
        throw error;
      }
      throw new DocumentEncryptionError(
        `Failed to decrypt document: ${error instanceof Error ? error.message : "Unknown error"}`,
        "DECRYPT_FAILED",
      );
    }
  }

  /**
   * Generate a new encryption key and register it with the key manager.
   *
   * @returns Key ID and version of the newly generated key
   */
  async generateEncryptionKey(): Promise<{ keyId: string; version: number }> {
    try {
      const key = await generateAesGcmKey();
      const version = await this.keyManager.getCurrentVersion();
      const keyId = await this.keyManager.storeKey(key, version);
      return { keyId, version };
    } catch (error) {
      throw new DocumentEncryptionError(
        `Failed to generate encryption key: ${error instanceof Error ? error.message : "Unknown error"}`,
        "KEY_GENERATION_FAILED",
      );
    }
  }

  /**
   * Generate a SHA-256 checksum for a document buffer.
   *
   * @param buffer - Document content
   * @returns Hex-encoded SHA-256 checksum
   */
  async generateDocumentChecksum(buffer: ArrayBuffer): Promise<string> {
    try {
      const hashBuffer = await crypto.subtle.digest("SHA-256", buffer);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
    } catch (error) {
      throw new DocumentEncryptionError(
        `Failed to generate checksum: ${error instanceof Error ? error.message : "Unknown error"}`,
        "CHECKSUM_FAILED",
      );
    }
  }

  /**
   * Encrypt sensitive metadata fields.
   * Used for fields that may contain PHI-like data in metadata.
   *
   * @param metadata - Metadata key-value pairs to encrypt
   * @param keyId - Key identifier for encryption
   * @returns Encrypted metadata with encrypted values base64-encoded
   */
  async encryptMetadata(
    metadata: Record<string, string>,
    keyId?: string,
  ): Promise<Record<string, string>> {
    try {
      const resolvedKeyId = keyId ?? await this.resolveCurrentKeyId();
      const key = await this.keyManager.getKey(resolvedKeyId);

      if (!key) {
        throw new DocumentEncryptionError(
          `Metadata encryption key not found: ${resolvedKeyId}`,
          "KEY_NOT_FOUND",
        );
      }

      const encryptedMetadata: Record<string, string> = {};

      for (const [field, value] of Object.entries(metadata)) {
        const encoder = new TextEncoder();
        const data = encoder.encode(value);

        const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));

        const encrypted = await crypto.subtle.encrypt(
          {
            name: ALGORITHM_AES_256_GCM,
            iv,
            tagLength: TAG_LENGTH,
          },
          key,
          data,
        );

        // Combine IV + encrypted data, base64-encode
        const combined = new Uint8Array(iv.length + encrypted.byteLength);
        combined.set(iv);
        combined.set(new Uint8Array(encrypted), iv.length);

        const base64 = arrayBufferToBase64(combined.buffer);
        encryptedMetadata[`enc_${field}`] = base64;
      }

      return encryptedMetadata;
    } catch (error) {
      if (error instanceof DocumentEncryptionError) {
        throw error;
      }
      throw new DocumentEncryptionError(
        `Failed to encrypt metadata: ${error instanceof Error ? error.message : "Unknown error"}`,
        "METADATA_ENCRYPT_FAILED",
      );
    }
  }

  /**
   * Decrypt encrypted metadata fields.
   *
   * @param encryptedMetadata - Metadata with encrypted values (enc_ prefix)
   * @param keyId - Key identifier used for encryption
   * @returns Decrypted metadata
   */
  async decryptMetadata(
    encryptedMetadata: Record<string, string>,
    keyId: string,
  ): Promise<Record<string, string>> {
    try {
      const key = await this.keyManager.getKey(keyId);

      if (!key) {
        throw new DocumentEncryptionError(
          `Metadata decryption key not found: ${keyId}`,
          "KEY_NOT_FOUND",
        );
      }

      const decryptedMetadata: Record<string, string> = {};

      for (const [field, value] of Object.entries(encryptedMetadata)) {
        if (!field.startsWith("enc_")) {
          decryptedMetadata[field] = value;
          continue;
        }

        const originalField = field.slice(4); // Remove "enc_" prefix
        const combined = base64ToArrayBuffer(value);
        const combinedArray = new Uint8Array(combined);

        // Extract IV (first 12 bytes) and ciphertext
        const iv = combinedArray.slice(0, IV_LENGTH);
        const ciphertext = combinedArray.slice(IV_LENGTH);

        const decrypted = await crypto.subtle.decrypt(
          {
            name: ALGORITHM_AES_256_GCM,
            iv,
            tagLength: TAG_LENGTH,
          },
          key,
          ciphertext,
        );

        const decoder = new TextDecoder();
        decryptedMetadata[originalField] = decoder.decode(decrypted);
      }

      return decryptedMetadata;
    } catch (error) {
      if (error instanceof DocumentEncryptionError) {
        throw error;
      }
      throw new DocumentEncryptionError(
        `Failed to decrypt metadata: ${error instanceof Error ? error.message : "Unknown error"}`,
        "METADATA_DECRYPT_FAILED",
      );
    }
  }

  /**
   * Resolve the current active key ID.
   */
  private async resolveCurrentKeyId(): Promise<string> {
    const version = await this.keyManager.getCurrentVersion();
    const keys = await this.keyManager.listKeyVersions();
    const currentKey = keys.find((k) => k.version === version);

    if (currentKey) {
      return currentKey.keyId;
    }

    // Generate a new key if none exists
    const { keyId } = await this.generateEncryptionKey();
    return keyId;
  }

  /**
   * Determine the appropriate encryption method for a document
   * based on its PHI classification.
   *
   * @param isPhi - Whether the document contains PHI
   * @returns The encryption method to use
   */
  getEncryptionMethod(isPhi: boolean): DocEncryptionEnum {
    return isPhi
      ? DocEncryptionEnum.AES_256_GCM
      : DocEncryptionEnum.SERVER_SIDE_ENCRYPTED;
  }
}

// ── Utility Functions ─────────────────────────────────────────

/**
 * Convert ArrayBuffer to base64 string.
 */
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Convert base64 string to ArrayBuffer.
 */
function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}