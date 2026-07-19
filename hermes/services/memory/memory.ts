// ┌─────────────────────────────────────────────────────────────┐
// │ Hermes Platform — Memory Service (in-process)                  │
// │ EPIC-002-006C · PHASE 1                                        │
// │ Durable, agent-scoped memory. In-memory store; can be backed   │
// │ by ObjectStorage/DataStore later via shared/interfaces.        │
// └─────────────────────────────────────────────────────────────┘

import type { DataStore } from "../../../shared/interfaces/datastore.js";
import type { ObjectStorage } from "../../../shared/interfaces/object-storage.js";

export interface MemoryRecord {
  agentId: string;
  scope: string;
  key: string;
  value: unknown;
  /** Optional TTL (epoch ms). */
  expiresAt?: number;
}

const MEMORY = new Map<string, MemoryRecord>();

function memKey(agentId: string, scope: string, key: string): string {
  return `${agentId}::${scope}::${key}`;
}

export function putMemory(r: MemoryRecord): void {
  MEMORY.set(memKey(r.agentId, r.scope, r.key), r);
}

export function getMemory(agentId: string, scope: string, key: string): unknown | undefined {
  const r = MEMORY.get(memKey(agentId, scope, key));
  if (!r) return undefined;
  if (r.expiresAt && r.expiresAt < Date.now()) {
    MEMORY.delete(memKey(agentId, scope, key));
    return undefined;
  }
  return r.value;
}

export function listMemory(agentId: string, scope: string): MemoryRecord[] {
  return [...MEMORY.values()].filter((r) => r.agentId === agentId && r.scope === scope);
}

/**
 * Bind durable backends without importing SDKs. Satisfies provider isolation.
 */
export function bindMemoryBackends(
  _store: DataStore,
  _storage: ObjectStorage,
): void {
  // Hook for future durable wiring.
}
