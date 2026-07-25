// ┌─────────────────────────────────────────────────────────────┐
// │ Hermes Platform — Provider Trust Lifecycle                     │
// │ EPIC-005.1 · PHASE 6                                            │
// │                                                               │
// │ Hermes OWNS trust. A provider is untrusted until it proves     │
// │ integrity, declares permissions, and is authorized. Any        │
// │ failure → REJECTED (fail-closed). No provider-specific code.   │
// └─────────────────────────────────────────────────────────────┘

import { type ProviderManifestV2, validateManifestV2 } from "../manifest-v2.js";
import type { TrustStateStore } from "./persistence/trust-state-store.js";
import type { ProviderLifecycleState, HealthStatus, TrustLevel, Provider } from "../sdk.js";
import { DefaultChecksumVerifier } from "./checksum/checksum-verifier.js";
import { DefaultSignatureVerifier } from "./signature/verifier.js";
// EPIC-005.7A (F-2): verified webhook ingress for external trust mutations.
// Type-only import keeps TrustLifecycle decoupled from the auth runtime.
import type { TrustWebhookAuthHandler, VerifiedTrustCommand } from "./webhooks/handler.js";

/** Error thrown when a provider fails a trust gate. */
export class TrustRejectionError extends Error {
  constructor(
    public readonly providerId: string,
    public readonly stage: string,
    public readonly reason: string,
  ) {
    super(`Provider "${providerId}" REJECTED at ${stage}: ${reason}`);
    this.name = "TrustRejectionError";
  }
}

/** Configuration Hermes owns (never in the manifest). */
export interface TrustConfig {
  /** Pinned trusted signer ids (for signature verification). */
  trustedSigners: string[];
  /** Verify signatures for trust.level >= sandbox? (toggle for dev/testing.) */
  enforceSignatures: boolean;
  /** Enable persistent trust state storage (for QUARANTINED/REVOKED survival). */
  enablePersistence: boolean;
  /** Policy hook: does the policy evaluator authorize this manifest? */
  authorize: (manifest: ProviderManifestV2) => boolean | Promise<boolean>;
}

export interface TrustRecord {
  providerId: string;
  vendor: string;
  version: string;
  state: ProviderLifecycleState;
  trustLevel: TrustLevel;
  health: HealthStatus;
  failureCount: number;
  violations: Array<{
    type: string;
    reason: string;
    timestamp: string; // ISO string
  }>;
  lastHealthCheck?: string;
  rejectedAt?: { stage: string; reason: string; at: string };
}

/**
 * The trust lifecycle driver. Stateful: maintained in both memory and
 * durable persistence. Transitions are explicit and fail-closed.
 */
export class TrustLifecycle {
  private readonly records = new Map<string, TrustRecord>();

  constructor(
    private readonly config: TrustConfig,
    private readonly stateStore?: TrustStateStore
  ) {}

  /** Replace the trust config at runtime. */
  setConfig(cfg: TrustConfig): void {
    (this as unknown as { config: TrustConfig }).config = cfg;
  }

  /** Read-only view for the Marketplace. */
  getRecord(providerId: string): TrustRecord | undefined {
    return this.records.get(providerId);
  }

  /**
   * EPIC-005.7A (F-2) — single verified ingress for external trust-state
   * mutations. The webhook is authenticated (identity + payload integrity +
   * replay) BEFORE any state changes. Returns the verified command; the
   * caller drives the actual transition (quarantine/revoke/…) from it.
   * Throws (fail-closed) on any authenticity/schema failure — never mutates.
   */
  async authenticateWebhook(
    headers: Parameters<TrustWebhookAuthHandler["authenticate"]>[0],
    rawBody: Uint8Array,
    handler: TrustWebhookAuthHandler,
  ): Promise<VerifiedTrustCommand> {
    return handler.authenticate(headers, rawBody);
  }

  list(): TrustRecord[] {
    return [...this.records.values()];
  }

  /**
   * DISCOVER → VALIDATE → AUTHORIZE → AUTHENTICATED → LOAD → ACTIVE
   * Returns a TrustRecord in LOADED (or REJECTED on any failure).
   * On REJECTED, the manifest/factory are NEVER turned into a live provider.
   */
  async admit(manifest: unknown): Promise<{ record: TrustRecord; provider?: Provider }> {
    // Capture the declared id early so a validation failure can be recorded
    // under the correct key (operators see WHAT was rejected, not "<unknown>").
    const declaredId =
      typeof manifest === "object" && manifest !== null
        ? String((manifest as Record<string, unknown>).id ?? "<unknown>")
        : "<unknown>";

    // DISCOVERED
    let m: ProviderManifestV2;
    try {
      m = validateManifestV2(manifest);
    } catch (e) {
      return { record: this.reject(declaredId, "VALIDATE", (e as Error).message) };
    }
    const id = m.id;

    // Prefer an in-memory record if one already exists (so a QUARANTINED or
    // REVOKED provider stays sticky across re-discovery even without a
    // persistence store). A persistence-backed record takes precedence only
    // when nothing is already loaded.
    const inMemory = this.records.get(id);
    if (inMemory) {
      // already loaded — keep its state
    } else {
      const existing = this.stateStore?.load(id);
      if (existing) {
        this.records.set(id, existing);
      } else {
        this.records.set(id, {
          providerId: id,
          vendor: m.vendor,
          version: m.version,
          state: "DISCOVERED",
          trustLevel: m.trust.level,
          health: "unknown",
          failureCount: 0,
          violations: [],
        });
      }
    }

    const record = this.records.get(id)!;

    // QUARANTINED providers cannot proceed to any further admission stages
    if (record.state === "QUARANTINED") {
      return { record };
    }

    // REVOKED providers must be in DISCOVERED state before they can be re-admitted
    if (record.state === "REVOKED") {
      return { record };
    }

    // VALIDATE — signature integrity for trust.level >= sandbox.
    // Hermes-owned cryptographic checks (real, fail-closed): checksum
    // integrity + trusted-signer signature verification.
    if (this.config.enforceSignatures && m.trust.level !== "untrusted") {
      const sig = m.trust.signature;
      if (!sig || !this.config.trustedSigners.includes(sig.signer)) {
        return { record: this.reject(id, "VALIDATE", "signature missing or untrusted signer") };
      }
      // Phase 2: real SHA256 checksum integrity of the canonical manifest body.
      if (!this.verifyChecksum(m)) {
        return { record: this.reject(id, "VALIDATE", "manifest checksum mismatch") };
      }
      // Phase 3: real signature verification (signer trust, key rotation, and
      // ed25519 authenticity when a detached signature value is present).
      const sv = DefaultSignatureVerifier.verify(m);
      if (!sv.ok) {
        return { record: this.reject(id, "VALIDATE", `signature verification failed: ${sv.reason ?? "unknown"}`) };
      }
    }
    this.set(id, "VALIDATED");

    // AUTHORIZE — policy evaluator decision (fail-closed)
    let authorized = false;
    try {
      authorized = await this.config.authorize(m);
    } catch {
      authorized = false;
    }
    if (!authorized) {
      return { record: this.reject(id, "AUTHORIZE", "policy denied provider") };
    }
    this.set(id, "AUTHORIZED");

    // AUTHENTICATED — no-op placeholder for token/oauth/mtls/ssh; trust owns it.
    this.set(id, "AUTHENTICATED");

    // LOAD — factory provided by caller turns manifest → Provider.
    // (The factory is registered data, not provider code in core.)
    const provider = this.loadFactory?.(m);
    if (!provider) {
      return { record: this.reject(id, "LOAD", "no provider factory registered") };
    }
    this.set(id, "LOADED");
    return { record: this.records.get(id)!, provider };
  }

  /** Register the factory that builds a Provider from a manifest (data map). */
  private loadFactory?: (m: ProviderManifestV2) => Provider | undefined;
  setLoader(fn: (m: ProviderManifestV2) => Provider | undefined): void {
    this.loadFactory = fn;
  }

  /** Move a loaded provider to ACTIVE (ready to serve). */
  activate(providerId: string): void {
    const r = this.records.get(providerId);
    if (r && r.state === "LOADED") this.set(providerId, "ACTIVE");
  }

  /** Quarantine a provider (runtime violation containment). */
  quarantine(providerId: string, reason: string): void {
    const record = this.getRecord(providerId);
    if (!record) return;

    const now = new Date().toISOString();
    record.state = "QUARANTINED";
    record.violations.push({ type: "QUARANTINE", reason, timestamp: now });

    // Persist the FULL record (state + violations) so containment survives restart.
    if (this.config.enablePersistence && this.stateStore) {
      this.stateStore.save(record);
    }
  }

  /** Revoke a provider (permanent removal). */
  revoke(providerId: string, reason: string): void {
    const record = this.getRecord(providerId);
    if (!record) return;

    const now = new Date().toISOString();
    record.state = "REVOKED";
    record.violations.push({ type: "REVOKE", reason, timestamp: now });

    // Persist the FULL record (state + violations) so revocation survives restart.
    if (this.config.enablePersistence && this.stateStore) {
      this.stateStore.save(record);
    }
  }

  /** Reinstate a previously revoked or quarantined provider. */
  reinstate(providerId: string): boolean {
    if (!this.stateStore) return false;

    const previousRecord = this.stateStore.load(providerId);
    if (!previousRecord || (previousRecord.state !== "REVOKED" && previousRecord.state !== "QUARANTINED")) {
      return false;
    }

    // Bring the record into memory (a fresh lifecycle may not have it loaded).
    const record = this.getRecord(providerId) ?? { ...previousRecord };
    // Move back to DISCOVERED so the normal admission pipeline re-validates it.
    record.state = "DISCOVERED";
    record.rejectedAt = undefined;
    record.health = previousRecord.health;
    record.violations = [...previousRecord.violations];
    this.records.set(providerId, record);
    this.stateStore.save(record);
    return true;
  }

  /** Mark a provider as unloaded (torn down at runtime). */
  setUnloaded(providerId: string): void {
    const r = this.records.get(providerId);
    if (r) this.set(providerId, "UNLOADED");
  }

  /** Health update from transport probe; drives SUSPENDED on repeated failure. */
  reportHealth(providerId: string, health: HealthStatus): void {
    const r = this.records.get(providerId);
    if (!r) return;
    r.health = health;
    r.lastHealthCheck = new Date().toISOString();
    if (health === "unhealthy") {
      r.failureCount++;
      if (r.failureCount >= 3 && r.state === "ACTIVE") this.set(providerId, "SUSPENDED");
    } else {
      r.failureCount = 0;
    }
  }

  private verifyChecksum(m: ProviderManifestV2): boolean {
    // Phase 2: real SHA256 checksum integrity of the canonical manifest body.
    return DefaultChecksumVerifier.verify(m).ok;
  }

  private set(providerId: string, state: ProviderLifecycleState): void {
    const r = this.records.get(providerId);
    if (r) r.state = state;
    this.stateStore?.save(r!);
  }

  private reject(providerId: string, stage: string, reason: string): TrustRecord {
    const existing = this.records.get(providerId);
    const record: TrustRecord = existing ?? {
      providerId,
      vendor: "unknown",
      version: "unknown",
      state: "REJECTED",
      trustLevel: "untrusted",
      health: "unknown",
      failureCount: 0,
      violations: [],
    };
    record.violations ??= [];
    record.state = "REJECTED";
    record.rejectedAt = { stage, reason, at: new Date().toISOString() };
    this.records.set(providerId, record);
    this.stateStore?.save(record);
    return record;
  }
}
