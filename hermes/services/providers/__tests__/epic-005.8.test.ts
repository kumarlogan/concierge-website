// ┌─────────────────────────────────────────────────────────────┐
// │ Hermes Platform — EPIC-005.8 Trust Enforcement Regression       │
// │ PHASE 7 · proves the canonical trust gates are REAL + fail-     │
// │ closed (no stubs, no simulation, correct state field names).   │
// │                                                               │
// │ Uses Node `crypto` ed25519 for real signing/verification. No  │
// │ network, no secrets, no fake CLI.                              │
// └─────────────────────────────────────────────────────────────┘

import { describe, it, expect, beforeEach } from "vitest";
import { generateKeyPairSync, sign as cryptoSign, createHash } from "crypto";
import { TrustLifecycle } from "../trust/lifecycle.js";
import {
  DefaultSignerRegistry,
  DefaultSignatureVerifier,
  type TrustedSignerRegistry,
} from "../trust/signature/verifier.js";
import { DefaultChecksumVerifier } from "../trust/checksum/checksum-verifier.js";
import { canonicalManifestBody } from "../trust/checksum/checksum-verifier.js";
import type { ProviderManifestV2 } from "../manifest-v2.js";

// ── ed25519 helpers ────────────────────────────────────────────────────────

function makeEd25519Signer(signerId: string, keyId: string) {
  const { privateKey, publicKey } = generateKeyPairSync("ed25519");
  const publicPem = publicKey.export({ type: "spki", format: "pem" }) as string;
  return {
    signerId,
    keyId,
    publicPem,
    sign(msg: string): string {
      return cryptoSign(null, Buffer.from(msg, "utf8"), privateKey).toString("base64");
    },
  };
}

function sha256(s: string): string {
  return createHash("sha256").update(s, "utf8").digest("hex");
}

// ── a minimal valid manifest ────────────────────────────────────────────────

function baseManifest(over: Partial<ProviderManifestV2> = {}): ProviderManifestV2 {
  return {
    id: "test-provider",
    name: "Test Provider",
    vendor: "anthropic",
    version: "1.0.0",
    manifestSchema: "v2",
    transports: [{ kind: "cli", auth: "none" }],
    capabilities: [{ id: "dev.code.generate", implKey: "x" }],
    permissions: [{ capability: "dev.code.generate", scope: "repo:local", grantedBy: "manifest" }],
    trust: { level: "sandbox", authModel: "none" },
    health: { probe: "none", intervalMs: 1, timeoutMs: 1, healthyWithinMs: 1 },
    limits: { maxConcurrent: 1, maxDurationMs: 1 },
    approval: { requiredByDefault: false },
    lifecycle: { discoverable: true, autoLoad: true },
    ...over,
  };
}

function signedManifest(signer: ReturnType<typeof makeEd25519Signer>): ProviderManifestV2 {
  const m = baseManifest();
  const checksum = sha256(canonicalManifestBody(m));
  const value = signer.sign(canonicalManifestBody(m));
  return {
    ...m,
    trust: {
      ...m.trust,
      signature: { algorithm: "ed25519", checksum, signer: signer.signerId, keyId: signer.keyId, value },
    },
  };
}

function makeLifecycle(over: Partial<{
  trustedSigners: string[];
  enforceSignatures: boolean;
  enablePersistence: boolean;
}> = {}) {
  const lc = new TrustLifecycle({
    trustedSigners: over.trustedSigners ?? [""],
    enforceSignatures: over.enforceSignatures ?? true,
    enablePersistence: over.enablePersistence ?? false,
    authorize: () => true,
  });
  // Stub factory so the LOAD stage succeeds (we only test trust gates here).
  lc.setLoader(() => ({}) as never);
  return lc;
}

describe("EPIC-005.8 — Trust Enforcement (real crypto, fail-closed)", () => {
  let signer: ReturnType<typeof makeEd25519Signer>;

  beforeEach(() => {
    DefaultSignerRegistry.revokeKey("anthropic", "k1");
    signer = makeEd25519Signer("anthropic", "k1");
    DefaultSignerRegistry.activateKey("anthropic", "k1", signer.publicPem,
      new Date(Date.now() + 86_400_000).toISOString());
  });

  it("PHASE 2: real SHA256 checksum verifies good + rejects tampered manifest", () => {
    const m = baseManifest();
    const checksum = sha256(canonicalManifestBody(m));
    m.trust.signature = { algorithm: "sha256", checksum, signer: "anthropic", keyId: "k1" };

    const tampered = baseManifest({ vendor: "evil-corp" });
    tampered.trust.signature = { algorithm: "sha256", checksum, signer: "anthropic", keyId: "k1" };

    expect(DefaultChecksumVerifier.verify(m).ok).toBe(true);
    expect(DefaultChecksumVerifier.verify(tampered).ok).toBe(false);
  });

  it("PHASE 3: real ed25519 signature — valid passes, tampered fails", () => {
    const m = signedManifest(signer);
    expect(DefaultSignatureVerifier.verify(m).ok).toBe(true);

    const tampered = signedManifest(signer);
    tampered.vendor = "evil-corp";
    expect(DefaultSignatureVerifier.verify(tampered).ok).toBe(false);
  });

  it("PHASE 3: wrong registered key → signature rejected (fail-closed)", () => {
    const other = makeEd25519Signer("anthropic", "k1");
    DefaultSignerRegistry.revokeKey("anthropic", "k1");
    DefaultSignerRegistry.activateKey("anthropic", "k1", other.publicPem,
      new Date(Date.now() + 86_400_000).toISOString());

    const m = signedManifest(signer); // signed by `signer`, but `other` key registered
    expect(DefaultSignatureVerifier.verify(m).ok).toBe(false);
  });

  it("PHASE 1+3: admission REJECTS manifest with no detached signature (fail-closed)", async () => {
    const m = baseManifest();
    m.trust.signature = { algorithm: "ed25519", checksum: "x", signer: "anthropic", keyId: "k1" };
    const lc = makeLifecycle({ trustedSigners: ["anthropic"] });
    const r = await lc.admit(m);
    expect(r.record.state).toBe("REJECTED");
    expect(r.record.rejectedAt?.stage).toBe("VALIDATE");
  });

  it("PHASE 1+3: admission ACCEPTS correctly signed + checksummed manifest", async () => {
    const m = signedManifest(signer);
    const lc = makeLifecycle({ trustedSigners: ["anthropic"] });
    const r = await lc.admit(m);
    expect(r.record.state).not.toBe("REJECTED");
    expect(r.provider).toBeDefined();
  });

  it("PHASE 1+3: untrusted signer rejected at VALIDATE gate", async () => {
    const m = signedManifest(signer);
    const lc = makeLifecycle({ trustedSigners: ["someone-else"] });
    const r = await lc.admit(m);
    expect(r.record.state).toBe("REJECTED");
    expect(r.record.rejectedAt?.reason).toMatch(/untrusted signer/);
  });

  it("PHASE 4+5: quarantine/revoke persist FULL record with correct `state` field", async () => {
    const lc = makeLifecycle({ trustedSigners: ["anthropic"] });
    const m = signedManifest(signer);
    const r = await lc.admit(m);
    const id = r.record.providerId;

    lc.quarantine(id, "runtime violation");
    const q = lc.getRecord(id)!;
    expect(q.state).toBe("QUARANTINED");
    expect(q.violations.some((v) => v.type === "QUARANTINE")).toBe(true);

    lc.revoke(id, "confirmed malicious");
    const rev = lc.getRecord(id)!;
    expect(rev.state).toBe("REVOKED");
    expect(rev.violations.some((v) => v.type === "REVOKE")).toBe(true);
  });

  it("PHASE 6: revoked provider cannot be re-admitted", async () => {
    const lc = makeLifecycle({ trustedSigners: ["anthropic"] });
    const m = signedManifest(signer);
    const r = await lc.admit(m);
    const id = r.record.providerId;
    lc.revoke(id, "bad");
    const re = await lc.admit(m);
    expect(re.record.state).toBe("REVOKED");
  });
});
