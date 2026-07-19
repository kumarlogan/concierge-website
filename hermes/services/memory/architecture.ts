// ┌─────────────────────────────────────────────────────────────┐
// │ Hermes Platform — Controlled Memory Architecture              │
// │ EPIC-002-006H · PHASE 2                                        │
// │                                                 PRINCIPLE:     │
// │  "No uncontrolled AI memory." Every memory access is scoped,   │
// │  access-controlled, audited, and subject to retention.         │
// │                                                 SCOPES:        │
// │  organization · application · agent · task                     │
// │  (defined by the MemoryScope boundary in agents/memory.ts)     │
// │                                                 NEUTRALITY:     │
// │  The store is behind MemoryStore. A D1/KV/ObjectStorage backend │
// │  can be injected without touching call sites.                  │
// └─────────────────────────────────────────────────────────────┘

import { emitAudit } from "../../audit/event.js";
import {
  evaluateMemoryAccess,
  type MemoryAccessRequest,
  type MemoryScope,
} from "../agents/memory.js";

// ── Storage interface (provider-neutral) ──

export interface StoredMemory {
  scope: MemoryScope;
  /** Owning id for the scope (applicationId / agentId / taskId / "org"). */
  ownerId: string;
  key: string;
  value: unknown;
  /** RFC3339 timestamp the record was written. */
  writtenAt: string;
  /** Epoch ms when the record expires (retention). Undefined = persistent. */
  expiresAt?: number;
  /** Whether the record is flagged organization-restricted. */
  restricted?: boolean;
}

/**
 * Provider-neutral memory store. Hermes depends only on this interface; the
 * concrete backend (in-memory, D1, KV, ObjectStorage) is injected.
 */
export interface MemoryStore {
  put(record: StoredMemory): void;
  get(scope: MemoryScope, ownerId: string, key: string): StoredMemory | undefined;
  list(scope: MemoryScope, ownerId: string): StoredMemory[];
  delete(scope: MemoryScope, ownerId: string, key: string): void;
  /** Prune records past their retention window (called by the reaper). */
  pruneExpired(now: number): number;
}

// ── Default in-process store (safe; sufficient for contracts + tests) ──

class InMemoryStore implements MemoryStore {
  private map = new Map<string, StoredMemory>();
  private key(scope: MemoryScope, ownerId: string, key: string): string {
    return `${scope}::${ownerId}::${key}`;
  }
  put(r: StoredMemory): void {
    this.map.set(this.key(r.scope, r.ownerId, r.key), r);
  }
  get(scope: MemoryScope, ownerId: string, key: string): StoredMemory | undefined {
    const r = this.map.get(this.key(scope, ownerId, key));
    if (!r) return undefined;
    if (r.expiresAt && r.expiresAt < Date.now()) {
      this.map.delete(this.key(scope, ownerId, key));
      return undefined;
    }
    return r;
  }
  list(scope: MemoryScope, ownerId: string): StoredMemory[] {
    return [...this.map.values()].filter(
      (r) => r.scope === scope && r.ownerId === ownerId,
    );
  }
  delete(scope: MemoryScope, ownerId: string, key: string): void {
    this.map.delete(this.key(scope, ownerId, key));
  }
  pruneExpired(now: number): number {
    let n = 0;
    for (const [k, r] of this.map) {
      if (r.expiresAt && r.expiresAt < now) {
        this.map.delete(k);
        n++;
      }
    }
    return n;
  }
}

let STORE: MemoryStore = new InMemoryStore();

/** Inject a durable store backend (D1/KV/ObjectStorage). Provider-neutral. */
export function setMemoryStore(s: MemoryStore): void {
  STORE = s;
}

// ── Retention model ──
//
// Each scope has a default retention window. Records older than the window
// are pruned by the reaper. Task memory is the shortest-lived (ephemeral
// execution context); organization memory is the longest-lived (governance).

export const RETENTION_MS: Record<MemoryScope, number | undefined> = {
  organization: undefined, // persistent (governance decisions)
  application: 30 * 24 * 60 * 60 * 1000, // 30 days
  agent: 7 * 24 * 60 * 60 * 1000, // 7 days
  task: 60 * 60 * 1000, // 1 hour (ephemeral)
};

// ── Controlled access API ──

export interface MemoryWriteRequest extends MemoryAccessRequest {
  key: string;
  value: unknown;
  /** Override the scope default retention (epoch ms). */
  expiresAt?: number;
  restricted?: boolean;
}

export interface MemoryReadResult {
  allowed: boolean;
  reason: string;
  value?: unknown;
}

/**
 * Write to a memory scope — access-controlled via the MemoryScope boundary.
 * Every write is audited. Denied writes return allowed:false and do NOT
 * persist (fail-closed).
 */
export function writeMemory(req: MemoryWriteRequest): MemoryReadResult {
  const decision = evaluateMemoryAccess(req);
  if (!decision.allowed) {
    return { allowed: false, reason: decision.reason };
  }
  const retention = req.expiresAt ?? RETENTION_MS[req.scope];
  const expiresAt = retention === undefined ? undefined : Date.now() + retention;
  STORE.put({
    scope: req.scope,
    ownerId: req.targetId ?? req.applicationId,
    key: req.key,
    value: req.value,
    writtenAt: new Date().toISOString(),
    expiresAt,
    restricted: req.restricted,
  });
  emitAudit("memory.write", `agent:${req.agentId}`, {
    scope: req.scope,
    ownerId: req.targetId ?? req.applicationId,
    key: req.key,
    restricted: req.restricted ?? false,
  });
  return { allowed: true, reason: "written" };
}

/**
 * Read from a memory scope — access-controlled. Denied reads return
 * allowed:false and never surface the value (fail-closed).
 */
export function readMemory(req: MemoryAccessRequest & { key: string }): MemoryReadResult {
  const decision = evaluateMemoryAccess(req);
  if (!decision.allowed) {
    return { allowed: false, reason: decision.reason };
  }
  const rec = STORE.get(req.scope, req.targetId ?? req.applicationId, req.key);
  emitAudit("memory.read", `agent:${req.agentId}`, {
    scope: req.scope,
    ownerId: req.targetId ?? req.applicationId,
    key: req.key,
  });
  return { allowed: true, reason: "read", value: rec?.value };
}

/** Run the retention reaper. Returns count of pruned records. */
export function reapMemory(now: number = Date.now()): number {
  const n = STORE.pruneExpired(now);
  if (n > 0) emitAudit("memory.reap", "system", { pruned: n });
  return n;
}

/** Introspection for the observability layer (Phase 5). */
export function memoryStoreBackend(): string {
  return STORE.constructor.name;
}

/** Test helper: reset to the in-memory store. */
export function _resetMemoryStore(): void {
  STORE = new InMemoryStore();
}
