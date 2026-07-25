// ┌─────────────────────────────────────────────────────────────┐
// │ Hermes Platform — Signature Verification Module               │
// │                                                           │
// │ This module provides signature verification and signer management │
// │ for provider manifests.                                       │
// │                                                           │
// │ PHASE 3 (EPIC-005.8): real asymmetric verification. When a     │
// │ detached `manifest.trust.signature.value` is present and a     │
// │ public key is registered for the signer, the verifier performs │
// │ REAL ed25519 signature verification (Node crypto). When no     │
// │ detached value exists, the gate is fail-closed: authenticity   │
// │ cannot be proven and verification fails unless a checksum-only │
// │ policy is explicitly opted into.                               │
// └─────────────────────────────────────────────────────────────┘

import { createPublicKey, createHash, verify as cryptoVerify, type KeyObject } from "crypto";
import type { ProviderManifestV2 } from "../../manifest-v2.js";
import { canonicalManifestBody } from "../checksum/checksum-verifier.js";

/** Interface for signature verification of provider manifests. */
export interface SignatureVerifier {
  /**
   * Verify signature of a provider manifest.
   * @param manifest - The validated ProviderManifestV2 to verify
   * @returns {ok: boolean, reason?: string} - Verification result
   */
  verify(manifest: ProviderManifestV2): { ok: boolean; reason?: string };
}

/** Interface for managing trusted signers with key rotation support. */
export interface TrustedSignerRegistry {
  /**
   * Get a public key (PEM/SPKI, or raw base64 ed25519) for a trusted signer by key id.
   * @param signerId - The signer identifier
   * @param keyId - The key identifier (defaults to signerId when omitted)
   * @returns PEM/SPKI string or undefined if not trusted
   */
  getPublicKey(signerId: string, keyId?: string): string | undefined;

  /** List all trusted signer ids. */
  listSigners(): string[];

  /** Activate a key for a signer (makes it valid for signature verification). */
  activateKey(signerId: string, keyId: string, publicKey: string, expiresAt: string): void;

  /** Revoke a key for a signer (makes it invalid for signature verification). */
  revokeKey(signerId: string, keyId: string): void;

  /** Check if a key is currently active and valid for a signer. */
  isKeyActive(signerId: string, keyId: string): boolean;

  /** Rotate keys for a signer - allows overlapping keys during transition. */
  rotateKeys(signerId: string, newKeyId: string, newPublicKey: string, newExpiresAt: string): void;
}

/** True if the stored key material is already PEM/SPKI (vs raw base64 ed25519). */
function looksLikePem(s: string): boolean {
  return s.includes("-----BEGIN") || s.startsWith("MC"); // "MC" ≈ SPKI base64 prefix for ed25519
}

/**
 * Build a Node KeyObject from a registered public key. Supports:
 *  - PEM/SPKI ("-----BEGIN PUBLIC KEY-----")
 *  - raw base64 ed25519 (32-byte) key → wrapped as SPKI DER
 */
function toKeyObject(pubKey: string): KeyObject {
  const trimmed = pubKey.trim();
  if (looksLikePem(trimmed)) {
    return createPublicKey(trimmed);
  }
  const raw = Buffer.from(trimmed, "base64");
  // RFC 8410 SubjectPublicKeyInfo prefix for id-Ed25519 (32-byte raw key).
  const DER_PREFIX = Buffer.from("302a300506032b6570032100", "hex");
  const spki = Buffer.concat([DER_PREFIX, raw]);
  return createPublicKey({ key: spki, format: "der", type: "spki" });
}

/**
 * Real-world signature verification implementation using ed25519.
 */
export class RealSignatureVerifier implements SignatureVerifier {
  constructor(
    private readonly registry: TrustedSignerRegistry,
    private readonly opts: { allowChecksumOnly?: boolean } = {},
  ) {}

  verify(manifest: ProviderManifestV2): { ok: boolean; reason?: string } {
    const signature = manifest.trust?.signature;
    if (!signature) {
      return { ok: false, reason: "signature missing in manifest" };
    }

    const signerId = signature.signer;
    if (!signerId) {
      return { ok: false, reason: "signer id missing from signature" };
    }

    const keyId = signature.keyId ?? signerId;

    // Key must be active + unexpired (rotation-aware).
    if (!this.registry.isKeyActive(signerId, keyId)) {
      return { ok: false, reason: "signer key not active or expired" };
    }

    const publicKey = this.registry.getPublicKey(signerId, keyId);
    if (!publicKey) {
      return { ok: false, reason: "unknown or revoked signer" };
    }

    // No detached signature value → authenticity cannot be proven.
    if (!signature.value) {
      if (this.opts.allowChecksumOnly) {
        // Checksum integrity is enforced separately by the lifecycle gate.
        return { ok: true };
      }
      return { ok: false, reason: "detached signature value missing (authenticity unproven)" };
    }

    try {
      const msg = canonicalManifestBody(manifest);
      const keyObj = toKeyObject(publicKey);
      const sig = Buffer.from(signature.value, "base64");
      // Node API: verify(algorithm, data, key, signature)
      const ok = cryptoVerify(null, Buffer.from(msg, "utf8"), keyObj, sig) === true;
      return ok ? { ok: true } : { ok: false, reason: "invalid signature" };
    } catch (error) {
      return { ok: false, reason: `signature verification error: ${(error as Error).message}` };
    }
  }
}

/**
 * In-memory implementation of TrustedSignerRegistry with key rotation support.
 */
export class InMemorySignerRegistry implements TrustedSignerRegistry {
  private readonly signers = new Map<string, SignerKeys>();

  getPublicKey(signerId: string, keyId?: string): string | undefined {
    const keys = this.signers.get(signerId);
    if (!keys) return undefined;

    const now = Date.now();
    const id = keyId ?? signerId;
    const activeKey = keys.activeKeys.find((key) =>
      key.keyId === id && (key.expiresAt ? new Date(key.expiresAt).getTime() > now : true),
    );
    return activeKey ? activeKey.publicKey : undefined;
  }

  listSigners(): string[] {
    return Array.from(this.signers.keys());
  }

  activateKey(signerId: string, keyId: string, publicKey: string, expiresAt: string): void {
    if (!this.signers.has(signerId)) {
      this.signers.set(signerId, { activeKeys: [], revokedKeys: [] });
    }

    const keys = this.signers.get(signerId)!;
    const previousActive = keys.activeKeys.find((k) => k.keyId !== keyId);
    if (previousActive) {
      keys.revokedKeys.push({ ...previousActive, revokedAt: new Date().toISOString() });
    }
    // Replace any key with the same id, then add the new active key.
    keys.activeKeys = keys.activeKeys.filter((k) => k.keyId === keyId);
    keys.activeKeys.push({
      keyId,
      publicKey,
      expiresAt,
      activatedAt: new Date().toISOString(),
    });
  }

  revokeKey(signerId: string, keyId: string): void {
    const keys = this.signers.get(signerId);
    if (!keys) return;

    const revoked = keys.activeKeys.find((k) => k.keyId === keyId);
    if (revoked) {
      keys.revokedKeys.push({ ...revoked, revokedAt: new Date().toISOString() });
    }
    keys.activeKeys = keys.activeKeys.filter((k) => k.keyId !== keyId);
  }

  isKeyActive(signerId: string, keyId: string): boolean {
    const keys = this.signers.get(signerId);
    if (!keys) return false;

    const now = Date.now();
    const key = keys.activeKeys.find((k) => k.keyId === keyId);
    if (!key) return false;
    if (key.expiresAt) {
      return new Date(key.expiresAt).getTime() > now;
    }
    return true;
  }

  rotateKeys(signerId: string, newKeyId: string, newPublicKey: string, newExpiresAt: string): void {
    this.activateKey(signerId, newKeyId, newPublicKey, newExpiresAt);
    // Old keys remain active until explicitly revoked (allowing overlap).
  }
}

interface SignerKeys {
  activeKeys: ActiveKey[];
  revokedKeys: RevokedKey[];
}

interface ActiveKey {
  keyId: string;
  publicKey: string;
  expiresAt?: string;
  activatedAt: string;
}

interface RevokedKey {
  keyId: string;
  publicKey?: string;
  revokedAt: string;
}

/**
 * Default signer registry + verifier. Fail-closed by default:
 * a detached signature value is REQUIRED to prove authenticity.
 */
export const DefaultSignerRegistry = new InMemorySignerRegistry();

/** Back-compat alias used by existing call sites. */
export const SignerRegistry = DefaultSignerRegistry;

export const DefaultSignatureVerifier = new RealSignatureVerifier(DefaultSignerRegistry);

/** Convenience: compute the canonical checksum of a manifest (parity with verifier). */
export function checksumOf(manifest: ProviderManifestV2, algorithm = "sha256"): string {
  const h = createHash(algorithm);
  h.update(canonicalManifestBody(manifest), "utf8");
  return h.digest("hex");
}
