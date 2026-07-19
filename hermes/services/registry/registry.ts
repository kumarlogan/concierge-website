// ┌─────────────────────────────────────────────────────────────┐
// │ Hermes Platform — Registry Service                            │
// │ EPIC-002-006C · PHASE 2                                        │
// │ Provider-neutral resource inventory. In-memory store; the     │
// │ contract-based backing can be swapped for D1/OCI later.        │
// └─────────────────────────────────────────────────────────────┘

import type {
  ResourceRecord,
  ResourceKind,
  ResourceLifecycleState,
} from "../../../shared/contracts/resource.js";
import { emitAudit } from "../../audit/event.js";

const STORE = new Map<string, ResourceRecord>();

function nowIso(): string {
  return new Date().toISOString();
}

function genId(kind: string): string {
  return `res_${kind}_${Math.random().toString(36).slice(2, 8)}`;
}

export function registerResource(
  input: Omit<ResourceRecord, "id" | "createdAt" | "updatedAt" | "state"> & {
    id?: string;
    state?: ResourceLifecycleState;
  },
  actor: string,
): ResourceRecord {
  const id = input.id ?? genId(input.kind);
  if (STORE.has(id)) {
    throw new Error(`Resource already registered: ${id}`);
  }
  const ts = nowIso();
  const record: ResourceRecord = {
    ...input,
    id,
    state: input.state ?? "planned",
    createdAt: ts,
    updatedAt: ts,
  };
  STORE.set(record.id, record);
  emitAudit("registry.register", actor, {
    resourceId: record.id,
    kind: record.kind,
    provider: record.provider,
  });
  return record;
}

export function getResource(id: string): ResourceRecord | undefined {
  return STORE.get(id);
}

export function updateResource(
  id: string,
  patch: Partial<Omit<ResourceRecord, "id" | "createdAt">>,
  actor: string,
): ResourceRecord {
  const existing = STORE.get(id);
  if (!existing) throw new Error(`Unknown resource: ${id}`);
  const updated: ResourceRecord = { ...existing, ...patch, updatedAt: nowIso() };
  STORE.set(id, updated);
  emitAudit("registry.update", actor, { resourceId: id });
  return updated;
}

export function listResources(filter?: {
  kind?: ResourceKind;
  owner?: string;
  provider?: string;
  state?: ResourceLifecycleState;
}): ResourceRecord[] {
  let items = [...STORE.values()];
  if (filter?.kind) items = items.filter((r) => r.kind === filter.kind);
  if (filter?.owner) items = items.filter((r) => r.owner === filter.owner);
  if (filter?.provider) items = items.filter((r) => r.provider === filter.provider);
  if (filter?.state) items = items.filter((r) => r.state === filter.state);
  return items;
}

export function removeResource(id: string, actor: string): void {
  const existing = STORE.get(id);
  if (!existing) throw new Error(`Unknown resource: ${id}`);
  STORE.delete(id);
  emitAudit("registry.remove", actor, { resourceId: id });
}

/** Test/reset helper — not used in production flows. */
export function _clearRegistry(): void {
  STORE.clear();
}
