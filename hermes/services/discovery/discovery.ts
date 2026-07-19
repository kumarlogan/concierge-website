// ┌─────────────────────────────────────────────────────────────┐
// │ Hermes Platform — Discovery Service                           │
// │ EPIC-002-006C · PHASE 3                                        │
// │ Answers topology questions by QUERYING the Registry. Never    │
// │ hardcodes topology.                                            │
// └─────────────────────────────────────────────────────────────┘

import type {
  DiscoveryResult,
  ResourceKind,
  ResourceLifecycleState,
} from "../../../shared/contracts/resource.js";
import { listResources } from "../registry/registry.js";
import { listAgents } from "../../agents/registry.js";

function toResult(
  r: { id: string; name: string; owner: string; provider: string; state: string },
): DiscoveryResult {
  return { kind: "service", id: r.id, name: r.name, owner: r.owner, provider: r.provider, state: r.state };
}

/** "What applications exist?" */
export function discoverApplications(): DiscoveryResult[] {
  return listResources({ kind: "application" }).map((r) => ({
    kind: "application",
    id: r.id,
    name: r.name,
    owner: r.owner,
    provider: r.provider,
    state: r.state,
  }));
}

/** "What resources belong to <owner>?" */
export function discoverResourcesByOwner(owner: string): DiscoveryResult[] {
  return listResources({ owner }).map((r) => ({
    kind: r.kind,
    id: r.id,
    name: r.name,
    owner: r.owner,
    provider: r.provider,
    state: r.state,
  }));
}

/** "What AI agents are registered?" */
export function discoverAgents(): Array<{
  id: string;
  name: string;
  domain: string;
  state: string;
  activation: string;
}> {
  return listAgents().map((a) => ({
    id: a.id,
    name: a.name,
    domain: a.domain,
    state: a.state,
    activation: a.activation,
  }));
}

/** "What services are active?" */
export function discoverActiveServices(): DiscoveryResult[] {
  const all = listResources({ kind: "service" });
  return all
    .filter((r) => r.state === ("active" as ResourceLifecycleState))
    .map((r) => toResult(r));
}

/** "What provider owns resource <id>?" */
export function discoverProviderOfResource(id: string): string | undefined {
  const r = listResources({}).find((x) => x.id === id);
  return r?.provider;
}

/** Generic discovery: any filter the registry supports. */
export function discover(filter?: {
  kind?: ResourceKind;
  owner?: string;
  provider?: string;
  state?: ResourceLifecycleState;
}): DiscoveryResult[] {
  return listResources(filter).map((r) => ({
    kind: r.kind,
    id: r.id,
    name: r.name,
    owner: r.owner,
    provider: r.provider,
    state: r.state,
  }));
}
