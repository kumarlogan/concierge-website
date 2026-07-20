// ┌─────────────────────────────────────────────────────────────┐
// │ Hermes Platform — Provider Adapter Service                     │
// │ EPIC-002-006C · PHASE 6                                        │
// │ The ONLY place vendor SDKs are bound. Business logic imports    │
// │ shared/interfaces, never provider SDKs directly.                │
// │ Current: Cloudflare. Future: OCI / AWS / Azure / Local.         │
// └─────────────────────────────────────────────────────────────┘

import type {
  IdentityProvider,
  PermissionProvider,
  AuditProvider,
  DataStore,
  ObjectStorage,
  Queue,
  NotificationProvider,
  Scheduler,
  SecretProvider,
  LoggingProvider,
} from "../../../shared/interfaces/index.js";

/** Logical provider name — a data field, never a hardcoded import. */
export type ProviderName = "cloudflare" | "oci" | "aws" | "azure" | "local";

export interface ProviderBundle {
  name: ProviderName;
  identity: IdentityProvider;
  permission: PermissionProvider;
  audit: AuditProvider;
  datastore: DataStore;
  objectStorage: ObjectStorage;
  queue: Queue;
  notification: NotificationProvider;
  scheduler: Scheduler;
  secret: SecretProvider;
  logging: LoggingProvider;
}

let ACTIVE: ProviderBundle | null = null;

/** Register the active provider bundle. Called once at platform init. */
export function setActiveProvider(bundle: ProviderBundle): void {
  ACTIVE = bundle;
}

export function getActiveProvider(): ProviderBundle {
  if (!ACTIVE) throw new Error("No active provider bundle registered");
  return ACTIVE;
}

export function activeProviderName(): ProviderName | null {
  return ACTIVE?.name ?? null;
}

/**
 * Cloudflare adapter factory — the only implemented adapter in this run.
 * It receives already-constructed provider instances (no SDK imported here;
 * the SDK lives in the worker bootstrap that builds this bundle).
 */
export function cloudflareBundle(
  impls: Omit<ProviderBundle, "name">,
): ProviderBundle {
  return { name: "cloudflare", ...impls };
}

// Future adapters are declared but NOT implemented (per mission: no OCI yet).
// Their signatures will mirror cloudflareBundle once built.
export type FutureAdapter = "oci" | "aws" | "azure" | "local";
export function isAdapterImplemented(name: ProviderName): boolean {
  return name === "cloudflare";
}

// ── Capability seam (EPIC-003-006 M5) ──────────────────────────
export * from "./capability.js";
