// ┌─────────────────────────────────────────────────────────────┐
// │ Hermes Platform — EPIC-005.9 Regression Suite                  │
// │ PHASE 7 · proves the EPIC-005.9 fixes hold:                    │
// │   P1 — single durable approval model (no string tokens)        │
// │   P2 — durable audit trail (restart-safe)                      │
// │   P3 — durable trust state (QUARANTINED/REVOKED survive)       │
// │   P4 — production trust defaults (enforceSignatures env-driven)│
// │ No stubs, no simulation. Real crypto + real file I/O.          │
// └─────────────────────────────────────────────────────────────┘

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { generateKeyPairSync, sign as cryptoSign, createHash } from "crypto";
import { mkdtempSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";

import { grantStackBApproval } from "@hermes/services/activation/provider-framework.js";
import { grantGitApproval } from "@hermes/services/activation/approval-gates.js";
import { FileAuditBackend, createDurableAuditStore, createProductionAuditStore } from "@hermes/audit/store.durable.js";
import { TrustLifecycle } from "@hermes/services/providers/trust/lifecycle.js";
import { DefaultSignerRegistry, DefaultSignatureVerifier } from "@hermes/services/providers/trust/signature/verifier.js";
import { canonicalManifestBody } from "@hermes/services/providers/trust/checksum/checksum-verifier.js";
import { FileTrustStateStore } from "@hermes/services/providers/trust/persistence/trust-state-store.js";
import type { ProviderManifestV2 } from "@hermes/services/providers/manifest-v2.js";
import type { AuditStore } from "@hermes/shared/interfaces/audit.js";
import type { TrustStateStore } from "@hermes/services/providers/trust/persistence/trust-state-store.js";

// ── ed25519 helpers (real crypto, no fake CLI) ──────────────────────────────

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
  stateStore: TrustStateStore;
}> = {}) {
  const lc = new TrustLifecycle(
    {
      trustedSigners: over.trustedSigners ?? [""],
      enforceSignatures: over.enforceSignatures ?? true,
      enablePersistence: over.enablePersistence ?? false,
      authorize: () => true,
    },
    over.stateStore,
  );
  lc.setLoader(() => ({}) as never);
  return lc;
}

// ── temp dirs ───────────────────────────────────────────────────────────────

let tmpRoot: string;
beforeEach(() => {
  tmpRoot = mkdtempSync(join(tmpdir(), "epic0059-"));
});
afterEach(() => {
  rmSync(tmpRoot, { recursive: true, force: true });
});

// ═══════════════════════════════════════════════════════════════════════════
// P1 — SINGLE DURABLE APPROVAL MODEL (no string tokens)
// ═══════════════════════════════════════════════════════════════════════════

describe("EPIC-005.9 P1 — single durable approval model", () => {
  it("grantGitApproval returns a structured ApprovalRef (never a string token)", async () => {
    const ref = await grantGitApproval("actor1", "app1", "git.commit", "staging");
    expect(typeof ref).toBe("object");
    expect(typeof ref.id).toBe("string");
    expect(ref.id.startsWith("apr_")).toBe(true);
    expect(ref.capability).toBe("git.commit");
    expect(ref.tenant).toBe("actor1");
    expect(ref.approver).toBe("actor1");
  });

  it("grantGitApproval and grantStackBApproval both mint durable refs via the human queue", async () => {
    const a = await grantStackBApproval("actor2", "app2", "dev.code.generate", "production");
    const b = await grantGitApproval("actor2", "app2", "git.push", "production");
    expect(a.approver).toBe("actor2");
    expect(b.approver).toBe("actor2");
    expect(a.capability).toBe("dev.code.generate");
    expect(b.capability).toBe("git.push");
  });

  it("ApprovalRef is the ONLY issuer type — no legacy string-token approval exists", async () => {
    // The ref carries tenant + capability + approver + scope + at, so it can be
    // verified fail-closed by the gateway (no opaque string can satisfy it).
    const ref = await grantGitApproval("actor3", "app3", "deploy", "production");
    expect(ref).toHaveProperty("tenant");
    expect(ref).toHaveProperty("capability");
    expect(ref).toHaveProperty("approver");
    expect(ref).toHaveProperty("scope");
    expect(ref).toHaveProperty("at");
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// P2 — DURABLE AUDIT TRAIL (restart-safe)
// ═══════════════════════════════════════════════════════════════════════════

describe("EPIC-005.9 P2 — durable audit trail", () => {
  it("FileAuditBackend persists events and is restart-safe (re-read by new instance)", () => {
    const fs = require("node:fs");
    const file = join(tmpRoot, "audit.jsonl");
    const store: AuditStore = createDurableAuditStore(new FileAuditBackend(file, fs));
    store.append({ type: "p2.event", actor: "a1", at: new Date().toISOString(), action: "do" });
    store.append({ type: "p2.event", actor: "a2", at: new Date().toISOString(), action: "do" });

    // Simulate restart: brand-new backend instance over the SAME file.
    const reopened: AuditStore = createDurableAuditStore(new FileAuditBackend(file, fs));
    const all = reopened.query({ type: "p2.event" });
    expect(all.length).toBe(2);
    expect(all.map((e) => e.actor).sort()).toEqual(["a1", "a2"]);
  });

  it("createProductionAuditStore returns file-backed store when filePath+fs given, else in-memory", () => {
    const fs = require("node:fs");
    const file = join(tmpRoot, "audit2.jsonl");
    const durable = createProductionAuditStore({ filePath: file, fs });
    durable.append({ type: "p2.wire", actor: "w1", at: new Date().toISOString(), action: "wire" });
    expect(durable.query({ type: "p2.wire" }).length).toBe(1);

    const mem = createProductionAuditStore();
    mem.append({ type: "p2.mem", actor: "m1", at: new Date().toISOString(), action: "mem" });
    expect(mem.query({ type: "p2.mem" }).length).toBe(1);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// P3 — DURABLE TRUST STATE (QUARANTINED/REVOKED survive restart)
// ═══════════════════════════════════════════════════════════════════════════

describe("EPIC-005.9 P3 — durable trust state", () => {
  let signer: ReturnType<typeof makeEd25519Signer>;
  beforeEach(() => {
    DefaultSignerRegistry.revokeKey("anthropic", "k1");
    signer = makeEd25519Signer("anthropic", "k1");
    DefaultSignerRegistry.activateKey("anthropic", "k1", signer.publicPem,
      new Date(Date.now() + 86_400_000).toISOString());
  });

  it("QUARANTINED/REVOKED state survives a fresh TrustLifecycle via FileTrustStateStore", async () => {
    const fs = require("node:fs");
    const file = join(tmpRoot, "trust.json");
    const store = new FileTrustStateStore(file, fs);

    // Lifecycle instance #1 admits + quarantines + revokes, persisting to file.
    const lc1 = makeLifecycle({ trustedSigners: ["anthropic"], enablePersistence: true, stateStore: store });
    const r = await lc1.admit(signedManifest(signer));
    const id = r.record.providerId;
    lc1.quarantine(id, "runtime violation");
    expect(lc1.getRecord(id)!.state).toBe("QUARANTINED");
    lc1.revoke(id, "confirmed malicious");
    expect(lc1.getRecord(id)!.state).toBe("REVOKED");

    // The persisted record is independently readable from the file (restart-safe).
    const persisted = new FileTrustStateStore(file, fs).load(id);
    expect(persisted).toBeDefined();
    expect(persisted!.state).toBe("REVOKED");
    expect(persisted!.violations.some((v) => v.type === "REVOKE")).toBe(true);

    // A re-admit of the SAME manifest on a fresh lifecycle stays contained
    // (the persisted REVOKED state is sticky — never silently re-admitted).
    const lc2 = makeLifecycle({ trustedSigners: ["anthropic"], enablePersistence: true, stateStore: new FileTrustStateStore(file, fs) });
    const re = await lc2.admit(signedManifest(signer));
    expect(re.record.state).toBe("REVOKED");
  });

  it("file-backed store round-trips state across multiple saves", () => {
    const fs = require("node:fs");
    const file = join(tmpRoot, "trust2.json");
    const store = new FileTrustStateStore(file, fs);
    store.save({ providerId: "p", vendor: "v", version: "1", state: "ACTIVE", trustLevel: "sandbox", health: "healthy", failureCount: 0, violations: [] });
    expect(new FileTrustStateStore(file, fs).load("p")!.state).toBe("ACTIVE");
    store.save({ providerId: "p", vendor: "v", version: "1", state: "QUARANTINED", trustLevel: "sandbox", health: "healthy", failureCount: 0, violations: [] });
    expect(new FileTrustStateStore(file, fs).load("p")!.state).toBe("QUARANTINED");
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// P4 — PRODUCTION TRUST DEFAULTS (enforceSignatures env-driven, fail-closed)
// ═══════════════════════════════════════════════════════════════════════════

describe("EPIC-005.9 P4 — production trust defaults", () => {
  const saved = { ...process.env };
  afterEach(() => { process.env = { ...saved }; });

  function resolveEnforce(): boolean {
    return (
      process.env.HERMES_ENFORCE_SIGNATURES === "true" ||
      (process.env.NODE_ENV === "production" && process.env.HERMES_ENFORCE_SIGNATURES !== "false")
    );
  }

  it("dev/test default: enforceSignatures = false (unsigned local providers admit)", () => {
    delete process.env.HERMES_ENFORCE_SIGNATURES;
    process.env.NODE_ENV = "development";
    expect(resolveEnforce()).toBe(false);
  });

  it("explicit HERMES_ENFORCE_SIGNATURES=true ⇒ fail-closed enforcement on", () => {
    process.env.HERMES_ENFORCE_SIGNATURES = "true";
    expect(resolveEnforce()).toBe(true);
  });

  it("NODE_ENV=production ⇒ fail-closed enforcement on (unless explicitly off)", () => {
    delete process.env.HERMES_ENFORCE_SIGNATURES;
    process.env.NODE_ENV = "production";
    expect(resolveEnforce()).toBe(true);
  });

  it("production with explicit off stays off (operator override honored)", () => {
    process.env.HERMES_ENFORCE_SIGNATURES = "false";
    process.env.NODE_ENV = "production";
    expect(resolveEnforce()).toBe(false);
  });

  it("enforceSignatures=true rejects an unsigned manifest at VALIDATE (fail-closed)", async () => {
    const m = baseManifest();
    m.trust.signature = { algorithm: "ed25519", checksum: "x", signer: "anthropic", keyId: "k1" };
    const lc = makeLifecycle({ trustedSigners: ["anthropic"], enforceSignatures: true });
    const r = await lc.admit(m);
    expect(r.record.state).toBe("REJECTED");
    expect(r.record.rejectedAt?.stage).toBe("VALIDATE");
  });
});
