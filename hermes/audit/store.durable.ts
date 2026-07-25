// ┌─────────────────────────────────────────────────────────────┐
// │ Hermes Platform — Durable Audit Store Seam                     │
// │ EPIC-004 PHASE 1 · provider-neutral persistence for audit.    │
// │                                                            \
// │  AuditStore        : canonical boundary (shared/interfaces)   │
// │  AuditPersistenceBackend : provider-neutral LOW-LEVEL store   │
// │                        (D1 / Postgres / KV implement this)     │
// │  DurableAuditStore : AuditStore backed by a backend           │
// │                                                            \
// │ D1 is NEVER referenced here. To add D1, implement             │
// │ AuditPersistenceBackend (a D1Backend) — no redesign needed.   │
// └─────────────────────────────────────────────────────────────┘

import type {
  AuditEvent,
  AuditQuery,
  AuditStore,
} from "../../shared/interfaces/audit.js";
import { enforceTenant, type TenantBound } from "../persistence/tenant.js";
import type { Principal } from "../contracts/platform-api.js";

/**
 * Provider-neutral low-level audit backend. A durable store (D1, Postgres, KV)
 * implements THIS interface; the `DurableAuditStore` above it stays generic.
 * Backends MUST be append-only and MUST NOT throw on write (best-effort; the
 * store layer decides whether to fail-closed).
 */
export interface AuditPersistenceBackend {
  /** Append a normalized event. Backend assigns id/at if absent. */
  append(event: AuditEvent): void;
  /** Query with the full filter (tenant + workflow + time + dims). */
  query(filter: AuditQuery): AuditEvent[];
  /** Clear all events (test/reset). */
  clear(): void;
}

/**
 * Durable audit store: an `AuditStore` whose durability is provided by an
 * `AuditPersistenceBackend`. Extends the canonical contract so it is a
 * drop-in for `defaultAuditStore`.
 */
export interface DurableAuditStore extends AuditStore {
  /** Query with tenant enforcement. `principal` must be authorized for the
   *  tenant(s) named in `filter.tenant`. Cross-tenant reads are denied. */
  queryScoped(filter: AuditQuery, principal: Principal): AuditEvent[];
}

/**
 * Create a durable audit store over any backend. The store adds tenant
 * enforcement on scoped reads and stamps nothing itself (callers stamp
 * `tenant`/`workflow` via emitAudit opts).
 */
export function createDurableAuditStore(
  backend: AuditPersistenceBackend,
): DurableAuditStore {
  return {
    append(event: AuditEvent): void {
      // Fail-closed validation: reject events missing required fields so a
      // bad write never silently enters the durable record.
      if (!event.type || !event.actor || !event.action) {
        throw new Error(
          `Invalid audit event: type/actor/action are required (got type=${event.type}, actor=${event.actor})`,
        );
      }
      backend.append(event);
    },
    query(filter: AuditQuery = {}): AuditEvent[] {
      return backend.query(filter);
    },
    clear(): void {
      backend.clear();
    },
    queryScoped(filter: AuditQuery, principal: Principal): AuditEvent[] {
      // If a tenant filter is present, enforce the principal may read it.
      if (filter.tenant) {
        enforceTenant(principal, filter.tenant);
      }
      const results = backend.query(filter);
      // Defense-in-depth: never return events outside the principal's tenant
      // even if the backend ignored the filter. (Unbound principal => empty.)
      if (!principal.organizationId) return [];
      return results.filter(
        (e) => !e.tenant || e.tenant === principal.organizationId,
      );
    },
  };
}

/**
 * In-memory backend. Used by tests and as the dev/edge default durable seam.
 * Demonstrates exactly what a D1/Postgres/KV backend must satisfy — swap the
 * backend, keep the store.
 */
export class MemoryAuditBackend implements AuditPersistenceBackend {
  private readonly events: AuditEvent[] = [];
  private seq = 0;

  append(event: AuditEvent): void {
    const id = event.id ?? `audit_${Date.now().toString(36)}_${(this.seq++).toString(36)}`;
    const at = event.at ?? new Date().toISOString();
    this.events.push({ ...event, id, at });
  }

  query(filter: AuditQuery = {}): AuditEvent[] {
    let out = this.events;
    if (filter.type) out = out.filter((e) => e.type === filter.type);
    if (filter.category) out = out.filter((e) => e.category === filter.category);
    if (filter.actor) out = out.filter((e) => e.actor === filter.actor);
    if (filter.resource) out = out.filter((e) => e.resource === filter.resource);
    if (filter.decision) out = out.filter((e) => e.decision === filter.decision);
    if (filter.tenant) out = out.filter((e) => e.tenant === filter.tenant);
    if (filter.workflow) out = out.filter((e) => e.workflow === filter.workflow);
    if (filter.since) out = out.filter((e) => e.at >= filter.since!);
    if (filter.until) out = out.filter((e) => e.at <= filter.until!);
    if (typeof filter.limit === "number" && filter.limit >= 0) {
      out = out.slice(-filter.limit);
    }
    return out.map((e) => ({ ...e }));
  }

  clear(): void {
    this.events.length = 0;
    this.seq = 0;
  }
}

/** Convenience: a ready durable store over an in-memory backend (no D1). */
export function createMemoryDurableAuditStore(): DurableAuditStore {
  return createDurableAuditStore(new MemoryAuditBackend());
}

/**
 * File-backed append-only audit backend (JSON-lines).
 *
 * EPIC-005.9 (P2): makes the audit trail survive restarts. Each event is
 * appended as one JSON object per line to a single file; queries stream the
 * file and filter in memory. Writes are synchronous within a single isolate
 * (workers edge: one isolate) and never throw on a single bad line — a
 * corrupt line is skipped so one bad record cannot wedge the whole trail.
 *
 * Provider-neutral: takes an absolute path + a `writeFileSync`/`readFileSync`/
 * `appendFileSync`/`existsSync` implementation so it works on Node (prod/build
 * verification) and can be shimmed on edge runtimes. No D1/Cloudflare
 * assumptions live here.
 */
export interface FileBackendDeps {
  readFileSync: (path: string, encoding: BufferEncoding) => string;
  writeFileSync: (path: string, data: string, encoding: BufferEncoding) => void;
  appendFileSync: (path: string, data: string, encoding: BufferEncoding) => void;
  existsSync: (path: string) => boolean;
}

export class FileAuditBackend implements AuditPersistenceBackend {
  private static readonly MAX_LINES = 1_000_000;

  constructor(
    private readonly filePath: string,
    private readonly fs: FileBackendDeps,
  ) {}

  private readAll(): AuditEvent[] {
    if (!this.fs.existsSync(this.filePath)) return [];
    const raw = this.fs.readFileSync(this.filePath, "utf8");
    if (!raw.trim()) return [];
    const out: AuditEvent[] = [];
    for (const line of raw.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      try {
        out.push(JSON.parse(trimmed) as AuditEvent);
      } catch {
        // Skip a corrupt line rather than failing the whole query.
        continue;
      }
    }
    return out;
  }

  append(event: AuditEvent): void {
    const id = event.id ?? `audit_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
    const at = event.at ?? new Date().toISOString();
    const line = JSON.stringify({ ...event, id, at }) + "\n";
    this.fs.appendFileSync(this.filePath, line, "utf8");
  }

  query(filter: AuditQuery = {}): AuditEvent[] {
    let out = this.readAll();
    if (filter.type) out = out.filter((e) => e.type === filter.type);
    if (filter.category) out = out.filter((e) => e.category === filter.category);
    if (filter.actor) out = out.filter((e) => e.actor === filter.actor);
    if (filter.resource) out = out.filter((e) => e.resource === filter.resource);
    if (filter.decision) out = out.filter((e) => e.decision === filter.decision);
    if (filter.tenant) out = out.filter((e) => e.tenant === filter.tenant);
    if (filter.workflow) out = out.filter((e) => e.workflow === filter.workflow);
    if (filter.since) out = out.filter((e) => e.at >= filter.since!);
    if (filter.until) out = out.filter((e) => e.at <= filter.until!);
    if (typeof filter.limit === "number" && filter.limit >= 0) {
      out = out.slice(-filter.limit);
    }
    return out.map((e) => ({ ...e }));
  }

  clear(): void {
    this.fs.writeFileSync(this.filePath, "", "utf8");
  }
}

/**
 * Build the production audit store. When `filePath` is provided, returns a
 * DurableAuditStore over a FileAuditBackend (restart-safe). Otherwise returns
 * the in-memory store (dev/test default) so existing test expectations hold.
 */
export function createProductionAuditStore(
  opts: { filePath?: string; fs?: FileBackendDeps } = {},
): AuditStore {
  if (opts.filePath && opts.fs) {
    return createDurableAuditStore(new FileAuditBackend(opts.filePath, opts.fs));
  }
  // In-memory fallback (dev/test). Mirrors MemoryAuditStore without creating a
  // circular dependency back into store.ts.
  const mem: AuditEvent[] = [];
  let seq = 0;
  return {
    append(event: AuditEvent): void {
      const id = event.id ?? `audit_${Date.now().toString(36)}_${(seq++).toString(36)}`;
      const at = event.at ?? new Date().toISOString();
      mem.push({ ...event, id, at });
    },
    query(filter: AuditQuery = {}): AuditEvent[] {
      let out = mem;
      if (filter.type) out = out.filter((e) => e.type === filter.type);
      if (filter.actor) out = out.filter((e) => e.actor === filter.actor);
      if (filter.tenant) out = out.filter((e) => e.tenant === filter.tenant);
      if (filter.limit != null && filter.limit >= 0) out = out.slice(-filter.limit);
      return out.map((e) => ({ ...e }));
    },
    clear(): void {
      mem.length = 0;
      seq = 0;
    },
  };
}
