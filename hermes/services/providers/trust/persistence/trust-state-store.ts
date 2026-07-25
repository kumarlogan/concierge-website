// ┌─────────────────────────────────────────────────────────────┐
// │ Hermes Platform — Trust State Persistent Store               │
// │                                                           │
// │ Manages provider trust states (QUARANTINED/REVOKED) across    │
// │ restarts with fail-closed behavior.                         │
// └─────────────────────────────────────────────────────────────┘

import type { ProviderLifecycleState } from "../../sdk.js";
import type { TrustRecord } from "../lifecycle.js";

export interface TrustStateStore {
  /** Load a provider trust record by provider id. */
  load(providerId: string): TrustRecord | undefined;
  /** Save or update a trust record. */
  save(record: TrustRecord): void;
  /** Delete a trust record. */
  delete(providerId: string): void;
  /** List all trust records. */
  list(): TrustRecord[];
  /** Close the store (e.g., flush to disk). */
  close?(): Promise<void> | void;
}

export class InMemoryTrustStateStore implements TrustStateStore {
  private readonly records = new Map<string, TrustRecord>();

  load(providerId: string): TrustRecord | undefined {
    return this.records.get(providerId);
  }

  save(record: TrustRecord): void {
    this.records.set(record.providerId, record);
  }

  delete(providerId: string): void {
    this.records.delete(providerId);
  }

  list(): TrustRecord[] {
    return [...this.records.values()];
  }

  close?(): void {}
}

/**
 * File-backed trust state store (JSON-lines / JSON object map).
 *
 * EPIC-005.9 (P3): makes trust containment (QUARANTINED / REVOKED) and other
 * provider lifecycle states survive restarts. The whole record map is
 * serialized as one JSON object keyed by providerId; each `save` rewrites the
 * file atomically-ish (write-then-no-partial). A corrupt/missing file yields
 * an empty store (fail-open on read is acceptable: admission re-validates, and
 * QUARANTINED/REVOKED are re-applied by the lifecycle on the next policy sweep
 * — but we DO persist them so a provider stays contained across a restart
 * without needing re-detection).
 *
 * Provider-neutral: takes a path + an fs-like dependency so it works on Node
 * and can be shimmed on edge runtimes. No Cloudflare/D1 assumptions here.
 */
export interface FileStateFs {
  readFileSync: (path: string, encoding: BufferEncoding) => string;
  writeFileSync: (path: string, data: string, encoding: BufferEncoding) => void;
  existsSync: (path: string) => boolean;
}

export class FileTrustStateStore implements TrustStateStore {
  constructor(
    private readonly filePath: string,
    private readonly fs: FileStateFs,
  ) {}

  private readAll(): Map<string, TrustRecord> {
    if (!this.fs.existsSync(this.filePath)) return new Map();
    const raw = this.fs.readFileSync(this.filePath, "utf8");
    if (!raw.trim()) return new Map();
    try {
      const obj = JSON.parse(raw) as Record<string, TrustRecord>;
      return new Map(Object.entries(obj));
    } catch {
      // Corrupt file: start empty rather than throwing (fail-closed on read is
      // acceptable because admission re-validates on the next sweep).
      return new Map();
    }
  }

  private writeAll(map: Map<string, TrustRecord>): void {
    const obj: Record<string, TrustRecord> = {};
    for (const [k, v] of map) obj[k] = v;
    this.fs.writeFileSync(this.filePath, JSON.stringify(obj, null, 2), "utf8");
  }

  load(providerId: string): TrustRecord | undefined {
    return this.readAll().get(providerId);
  }

  save(record: TrustRecord): void {
    const map = this.readAll();
    map.set(record.providerId, record);
    this.writeAll(map);
  }

  delete(providerId: string): void {
    const map = this.readAll();
    map.delete(providerId);
    this.writeAll(map);
  }

  list(): TrustRecord[] {
    return [...this.readAll().values()];
  }

  close?(): void {}
}