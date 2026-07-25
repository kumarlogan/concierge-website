// ┌─────────────────────────────────────────────────────────────┐
// │ Hermes Platform — Checksum Verification Implementation      │
// │                                                           │
// │ Cryptographic validation of provider manifests for integrity │
// └─────────────────────────────────────────────────────────────┘

import { createHash } from "crypto";

import type { ProviderManifestV2 } from "../../manifest-v2.js";

/** Interface for checksum verification of provider manifests. */
export interface ChecksumVerifier {
  /**
   * Verify checksum of a provider manifest.
   * @param manifest - The validated ProviderManifestV2 to verify
   * @returns {ok: boolean, reason?: string} - Verification result
   */
  verify(manifest: ProviderManifestV2): { ok: boolean; reason?: string };
}

/**
 * Canonical serializer for provider manifests - ensures stable byte representation
 * for consistent checksum calculations.
 */
export function canonicalizeManifest(manifest: ProviderManifestV2): string {
  // Treat as a record for stable canonicalization (key-order-independent hash).
  const src = manifest as unknown as Record<string, unknown>;
  // Sort object keys to ensure consistent ordering
  const sorted: Record<string, unknown> = {};

  // Sort top-level keys
  const topLevelKeys = Object.keys(src).sort();
  for (const key of topLevelKeys) {
    if (Array.isArray(src[key])) {
      // Sort arrays for consistent ordering
      sorted[key] = JSON.stringify(
        (src[key] as unknown[]).sort((a, b) => {
          // Simple string comparison for array items
          return JSON.stringify(a) < JSON.stringify(b) ? -1 : 1;
        })
      );
    } else if (typeof src[key] === "object" && src[key] !== null) {
      // Recursively sort nested objects
      sorted[key] = JSON.stringify(canonicalizeObject(src[key] as Record<string, unknown>));
    } else {
      sorted[key] = src[key];
    }
  }

  return JSON.stringify(sorted);
}

/**
 * Recursively sort object keys for consistent canonicalization.
 */
function canonicalizeObject(obj: Record<string, unknown>): Record<string, unknown> {
  const sorted: Record<string, unknown> = {};
  const keys = Object.keys(obj).sort();

  for (const key of keys) {
    if (typeof obj[key] === "object" && obj[key] !== null && !Array.isArray(obj[key])) {
      sorted[key] = canonicalizeObject(obj[key] as Record<string, unknown>);
    } else if (Array.isArray(obj[key])) {
      sorted[key] = (obj[key] as unknown[]).sort((a, b) => {
        return JSON.stringify(a) < JSON.stringify(b) ? -1 : 1;
      });
    } else {
      sorted[key] = obj[key];
    }
  }

  return sorted;
}

/**
 * Canonical serialization of a manifest EXCLUDING its own `trust.signature`
 * block. This is the stable byte string a checksum is computed over and a
 * detached signature is generated/verified against — excluding the signature
 * prevents a circular (sign-the-signature) dependency.
 */
export function canonicalManifestBody(manifest: ProviderManifestV2): string {
  const { trust, ...rest } = manifest as ProviderManifestV2 & { trust: Record<string, unknown> };
  const trustWithoutSig: Record<string, unknown> = { ...trust };
  delete (trustWithoutSig as Record<string, unknown>).signature;
  return canonicalizeManifest({ ...rest, trust: trustWithoutSig } as ProviderManifestV2);
}

/**
 * Real-world checksum verification implementation.
 */
export class RealChecksumVerifier implements ChecksumVerifier {
  private readonly algorithm = "sha256";

  verify(manifest: ProviderManifestV2): { ok: boolean; reason?: string } {
    try {
      const canonical = canonicalManifestBody(manifest);
      const hash = createHash(this.algorithm);
      hash.update(canonical, "utf8");
      const computedChecksum = hash.digest("hex");

      // Get expected checksum from manifest if present
      const expectedChecksum = this.extractChecksumFromManifest(manifest);

      if (!expectedChecksum) {
        return { ok: false, reason: "no checksum present in manifest" };
      }

      if (computedChecksum !== expectedChecksum) {
        return { ok: false, reason: "checksum mismatch" };
      }

      return { ok: true };
    } catch (error) {
      return { ok: false, reason: `checksum verification error: ${(error as Error).message}` };
    }
  }

  /**
   * Extract checksum from manifest - checks manifest.trust.checksum if present.
   */
  private extractChecksumFromManifest(manifest: ProviderManifestV2): string | undefined {
    return manifest.trust?.signature?.checksum;
  }
}

/**
 * Default checksum verifier instance.
 */
export const DefaultChecksumVerifier = new RealChecksumVerifier();