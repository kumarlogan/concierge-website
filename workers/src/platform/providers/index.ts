// ┌─────────────────────────────────────────────────────────────┐
// │ AI Platform — Provider Registry Index                      │
// │ EPIC-PLATFORM-002: Provider Registry                        │
// │ Reusable platform capability — NOT Concierge-specific       │
// └─────────────────────────────────────────────────────────────┘

export type {
  ProviderId,
  ProviderHealthStatus,
  ProviderCapability,
  RequiredScope,
  RotationPolicy,
  ProviderAuditEntry,
  RegisteredProvider,
  ProviderRegistry,
  RegisterProviderRequest,
} from "./types.js";

export { InMemoryProviderRegistry } from "./provider-registry.js";
export { providerRegistry } from "./provider-registry.js";