// ┌─────────────────────────────────────────────────────────────┐
// │ Hermes Platform — Internal API Dispatcher                      │
// │ EPIC-002-006C · PHASE 7                                        │
// │ Wraps services with authentication + authorization + audit.    │
// │ In-process only — never bound to a public route.               │
// └─────────────────────────────────────────────────────────────┘

import { emitAudit } from "../audit/event.js";
import {
  registerResource,
  listResources,
  updateResource,
  removeResource,
} from "../services/registry/registry.js";
import {
  discover,
  discoverApplications,
  discoverResourcesByOwner,
  discoverAgents,
  discoverProviderOfResource,
} from "../services/discovery/discovery.js";
import {
  transitionResource,
  transitionAgent,
  LifecycleError,
} from "../services/lifecycle/lifecycle.js";
import {
  type Principal,
  type ApiResult,
  type RegisterResourceInput,
  type DiscoveryQuery,
  type TransitionInput,
  type AgentTransitionInput,
  type Authorizer,
  PLATFORM_PERMISSIONS,
} from "./platform-api.js";

export interface PlatformApiDeps {
  /** Authorization function (delegates to Hermes Permission engine). */
  authorize: Authorizer;
}

export function createPlatformApi(deps: PlatformApiDeps) {
  const { authorize } = deps;

  function deny<T>(reason: string): ApiResult<T> {
    return { ok: false, error: reason };
  }

  return {
    // ── Registry ──────────────────────────────────────────────
    registerResource(
      principal: Principal,
      input: RegisterResourceInput,
    ): ApiResult<{ id: string }> {
      if (!authorize(principal, PLATFORM_PERMISSIONS.REGISTRY_WRITE)) {
        emitAudit("api.denied", principal.id, { op: "registerResource" });
        return deny("unauthorized: hermes:registry:write");
      }
      try {
        const rec = registerResource({ ...input, meta: input.meta ?? {} }, principal.id);
        return { ok: true, data: { id: rec.id } };
      } catch (err) {
        return deny(err instanceof Error ? err.message : "register failed");
      }
    },

    listResources(principal: Principal, filter?: DiscoveryQuery): ApiResult<unknown> {
      if (!authorize(principal, PLATFORM_PERMISSIONS.REGISTRY_READ)) {
        return deny("unauthorized: hermes:registry:read");
      }
      return { ok: true, data: listResources(filter) };
    },

    // ── Discovery ─────────────────────────────────────────────
    discover(principal: Principal, query?: DiscoveryQuery): ApiResult<unknown> {
      if (!authorize(principal, PLATFORM_PERMISSIONS.DISCOVERY_READ)) {
        return deny("unauthorized: hermes:discovery:read");
      }
      return { ok: true, data: discover(query) };
    },

    discoverApplications(principal: Principal): ApiResult<unknown> {
      if (!authorize(principal, PLATFORM_PERMISSIONS.DISCOVERY_READ)) {
        return deny("unauthorized: hermes:discovery:read");
      }
      return { ok: true, data: discoverApplications() };
    },

    discoverAgents(principal: Principal): ApiResult<unknown> {
      if (!authorize(principal, PLATFORM_PERMISSIONS.DISCOVERY_READ)) {
        return deny("unauthorized: hermes:discovery:read");
      }
      return { ok: true, data: discoverAgents() };
    },

    // ── Lifecycle ────────────────────────────────────────────
    transitionResource(
      principal: Principal,
      input: TransitionInput,
    ): ApiResult<unknown> {
      if (!authorize(principal, PLATFORM_PERMISSIONS.LIFECYCLE_WRITE)) {
        return deny("unauthorized: hermes:lifecycle:write");
      }
      try {
        const t = transitionResource(
          input.id,
          input.from as any,
          input.to as any,
          principal.id,
        );
        return { ok: true, data: t };
      } catch (err) {
        if (err instanceof LifecycleError) return deny(err.message);
        return deny(err instanceof Error ? err.message : "transition failed");
      }
    },

    // ── Agent management ─────────────────────────────────────
    transitionAgent(
      principal: Principal,
      input: AgentTransitionInput,
    ): ApiResult<unknown> {
      // Activation requires the stronger permission.
      const perm =
        input.to === "active"
          ? PLATFORM_PERMISSIONS.AGENT_ACTIVATE
          : PLATFORM_PERMISSIONS.AGENT_WRITE;
      if (!authorize(principal, perm)) {
        return deny(`unauthorized: ${perm}`);
      }
      try {
        const t = transitionAgent(
          input.id,
          input.from as any,
          input.to as any,
          principal.id,
          input.authorized,
        );
        return { ok: true, data: t };
      } catch (err) {
        if (err instanceof LifecycleError) return deny(err.message);
        return deny(err instanceof Error ? err.message : "agent transition failed");
      }
    },
  };
}

export type PlatformApi = ReturnType<typeof createPlatformApi>;
