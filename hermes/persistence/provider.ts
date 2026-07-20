// ┌─────────────────────────────────────────────────────────────┐
// │ Hermes Platform — Persistence Provider Architecture            │
// │ EPIC-004 PHASE 5 · provider-neutral persistence seam.         │
// │                                                            \
// │  PersistenceProvider  : bundle of durable store factories.     │
// │  Capabilities: audit.store | workflow.store | agent.store      │
// │                                                            \
// │  MemoryPersistenceProvider  : ships now (dev/edge/tests).      │
// │  D1 / Postgres / KV         : FUTURE-READY seams (declared,     │
// │                                NOT implemented — no vendor lock-in)│
// └─────────────────────────────────────────────────────────────┘

import type { AuditStore } from "../../shared/interfaces/audit.js";
import {
  createMemoryDurableAuditStore,
  type DurableAuditStore,
} from "../audit/store.durable.js";
import {
  createWorkflowStore,
  MemoryWorkflowBackend,
  type WorkflowStore,
} from "./workflow-store.js";
import {
  createAgentStateStore,
  MemoryAgentBackend,
  type AgentStateStore,
} from "./agent-state-store.js";

/** The three durable capabilities Hermes owns. */
export type PersistenceCapability = "audit.store" | "workflow.store" | "agent.store";

/**
 * Provider-neutral persistence surface. A provider exposes the factories for
 * each durable store. Business logic depends ONLY on the store abstractions,
 * never on a concrete backend (D1/Postgres/KV) — satisfying "Hermes controls
 * external capabilities, owns trust-critical state."
 */
export interface PersistenceProvider {
  readonly kind: "memory" | "d1" | "postgres" | "kv";
  auditStore(): AuditStore;
  /** Durable audit store (adds tenant-scoped reads). */
  durableAuditStore(): DurableAuditStore;
  workflowStore(): WorkflowStore;
  agentStore(): AgentStateStore;
}

/**
 * In-memory provider. Bundles the three Memory-backed stores. This is the
 * default for dev/edge/tests and proves the seam end-to-end with zero external
 * dependencies. Swap `kind` to "d1" by implementing a D1 provider that injects
 * D1-backed `AuditPersistenceBackend` / `WorkflowPersistenceBackend` /
 * `AgentPersistenceBackend` — no consumer changes required.
 */
export class MemoryPersistenceProvider implements PersistenceProvider {
  readonly kind = "memory" as const;
  private _audit?: AuditStore;
  private _durable?: DurableAuditStore;
  private _workflow?: WorkflowStore;
  private _agent?: AgentStateStore;

  auditStore(): AuditStore {
    if (!this._audit) this._audit = createMemoryDurableAuditStore();
    return this._audit;
  }
  durableAuditStore(): DurableAuditStore {
    if (!this._durable) this._durable = createMemoryDurableAuditStore();
    return this._durable;
  }
  workflowStore(): WorkflowStore {
    if (!this._workflow) this._workflow = createWorkflowStore(new MemoryWorkflowBackend());
    return this._workflow;
  }
  agentStore(): AgentStateStore {
    if (!this._agent) this._agent = createAgentStateStore(new MemoryAgentBackend());
    return this._agent;
  }
}

/**
 * FUTURE-READY SEAMS (NOT implemented). Declared so the architecture is
 * explicit and adding them later needs NO redesign:
 *
 *   - D1PersistenceProvider: implements PersistenceProvider with kind "d1";
 *     injects a D1AuditBackend / D1WorkflowBackend / D1AgentBackend
 *     (each implementing the corresponding *PersistenceBackend interface).
 *   - PostgresPersistenceProvider: kind "postgres"; SQL-backed backends.
 *   - KVPersistenceProvider: kind "kv"; KV-backed backends (eventual, audit-only).
 *
 * None of these are coded yet (per "Do not implement external databases yet").
 * To add one: implement the three *PersistenceBackend interfaces against the
 * target, then construct the provider — store consumers stay unchanged.
 */
export const FUTURE_PERSISTENCE_PROVIDERS: ReadonlyArray<PersistenceProvider["kind"]> = [
  "d1",
  "postgres",
  "kv",
] as const;

/** Resolve a provider by kind. Only "memory" is available today. */
export function createPersistenceProvider(kind: PersistenceProvider["kind"] = "memory"): PersistenceProvider {
  switch (kind) {
    case "memory":
      return new MemoryPersistenceProvider();
    case "d1":
    case "postgres":
    case "kv":
      throw new Error(
        `Persistence provider "${kind}" is future-ready (declared in EPIC-004 PHASE 5) but not yet implemented. ` +
        `Use "memory" until the backend is added behind the *PersistenceBackend interfaces.`,
      );
    default:
      throw new Error(`Unknown persistence provider kind: ${kind as string}`);
  }
}
