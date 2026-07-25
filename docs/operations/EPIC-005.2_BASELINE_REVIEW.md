# EPIC-005.2 — BASELINE REVIEW

**Date:** 2026-07-20 (night cycle)
**Scope:** Review EPIC-005.1 implementation, identify what is already dynamic vs still statically wired, before building the Dynamic Provider Loading Platform.
**No code changes in this phase.**

---

## 1. What EPIC-005.1 Delivered (the foundation we build on)

| Subsystem | File | Dynamic today? | Notes |
|-----------|------|----------------|-------|
| Provider SDK | `sdk.ts` | ✅ | Fully vendor-free. `Provider`, `ProviderRequest`, `ProviderError`, `ProviderMetadata`. No Claude/Claude-specific types. |
| Manifest V2 + validation | `manifest-v2.ts` | ✅ schema | `validateManifestV2()` is pure data, fail-closed, rejects vendor-namespaced capability ids. |
| Trust lifecycle | `trust/lifecycle.ts` | ✅ | `admit()` = DISCOVERED→VALIDATE→AUTHORIZE→AUTHENTICATED→LOADED. Fail-closed. REJECTED retained for visibility. Signature + policy hooks already data-driven. |
| Marketplace | `marketplace.ts` | ✅ | Derived read-only view. REJECTED visible. Queryable by trust/health/lifecycle/capability. |
| Transport | `transport.ts`, `transport/cli.ts` | ✅ | `TransportRegistry` keyed by kind. `CliTransport` is zero-dep, spawner-injected, reusable for ANY CLI backend. |
| Capability registry | `capability.ts` | ✅ registered | `MemoryCapabilityRegistry` — single source of truth for "what can run." |
| Orchestrator | `platform.ts` | ⚠️ partial | `bootstrap()` runs the full pipeline, but **only for providers already placed in `this.wirings`** at construction time. |
| Reference provider | `claude-code/` | ✅ proof | Pure data (manifest) + one factory. No core edits. |

**Conclusion:** EPIC-005.1 proved the *internal* architecture is provider-neutral. The trust, marketplace, transport, and capability seams are all data-driven. **But providers still enter Hermes through a hardcoded in-memory wiring map — they are registered, not discovered.**

---

## 2. What Is Still Statically Wired (THE GAP)

### 2.1 No Manifest Discovery
- `UniversalCapabilityPlatform.registerProvider(wiring)` requires the caller to already hold a `ProviderWiring { manifest, factory }` in memory.
- There is **no component that scans a provider location, reads `manifest.json`, validates it, and produces a wiring**.
- "Discovery" today = "someone already called `registerProvider()`." This is the core EPIC-005.2 gap.

### 2.2 Factory resolution is centralized, not package-local
- `createProviderLoader(providerFactories)` keys factories by `manifest.id` in a **central map supplied at build time**.
- The reference `claude-code/index.ts` factory is imported by whoever wires the platform. To add a provider you still add an import + a map entry.
- EPIC-005.2 requires the factory to live **inside the discovered package** and be resolved generically (a package contract: "export a `factory` / `createProvider`"), so no central registry of factories is needed.

### 2.3 No Provider Package Model
- There is no notion of a *package* (manifest.json + provider.ts + transport.json + metadata.json).
- Everything is in-code (`ProviderManifestV2` objects, inline factories). The architecture cannot yet load providers from disk/remote at runtime.

### 2.4 No duplicate / collision handling
- `registerProvider` overwrites `this.wirings.set(id, wiring)` silently — a second provider with the same `id` clobbers the first.
- `capabilityRegistry.register` is idempotent by id but does **not** detect two providers advertising the *same capability id* (collision). EPIC-005.2 scenario 4 & 5 require explicit handling.

### 2.5 No unload / reload
- `liveProviders` is append-only. No `unload(providerId)` or `reload(providerId)` exists. EPIC-005.2 scenarios 7 & 8 require both.

### 2.6 Marketplace lacks a few required states
- Required by EPIC-005.2 PHASE 6: **Installed / Available / Offline** in addition to Healthy / Rejected. Today the marketplace only has trust/health/lifecycle (ACTIVE, SUSPENDED, REJECTED, LOADED). "Available" (discovered-but-not-loaded) and "Offline" (load failed / transport down) are not modeled.

### 2.7 No discovery failure reporting surface
- A bad manifest currently throws inside `validateManifestV2`; there is no structured "discovery result" object that reports `REJECT` with a reason while letting other providers proceed. EPIC-005.2 PHASE 2 requires safe, per-provider failure isolation.

---

## 3. Remaining Assumptions to Remove

| Assumption | Where | EPIC-005.2 fix |
|------------|-------|----------------|
| Provider manifests live in code, not files | `platform.registerProvider` | `ProviderDiscovery` scans locations, reads `manifest.json` |
| Factories are centrally registered | `createProviderLoader` | Package-local factory export, resolved by generic `ProviderLoader` |
| Provider id is unique by overwriting | `this.wirings.set` | Duplicate detection at discovery time |
| Capability id is globally unique | `capabilityRegistry.register` | Collision detection + `preferredFor`/selection |
| Providers never leave | `liveProviders` append-only | `unload` / `reload` semantics |
| Marketplace knows only loaded/rejected | `marketplace.ts` | Add `AVAILABLE` / `OFFLINE` lifecycle states |

---

## 4. Reusable Assets (do NOT re-implement)

- `validateManifestV2` — reuse as-is for discovery validation.
- `TrustLifecycle.admit` — reuse as the admission gate. No bypass paths (PHASE 4).
- `TransportRegistry` + `CliTransport` — reuse; generic loader attaches the right transport kind from the manifest.
- `ProviderMarketplace` — extend (add states), do not rewrite.
- `MemoryCapabilityRegistry` — reuse; add collision detection wrapper.
- `claude-code/` — keep as the proof provider; it must continue to load via the NEW discovery path (not just `registerProvider`).

---

## 5. Risk Flags

- **Circular dependency risk:** `capability.ts` imports `ProviderName` from `index.ts`; the new package model must not entangle with the legacy `ProviderName` union (`"cloudflare" | "oci" | ...`). Keep EPIC-005.2 providers on the `ProviderManifestV2.id` namespace (e.g. `"claude-code"`), independent of the legacy adapter vocabulary.
- **Test isolation:** EPIC-005.1 test uses injected fake spawner. EPIC-005.2 tests must also avoid real binaries / network / secrets (mission constraint).
- **No core edits tolerated:** The generic `ProviderLoader` must not `switch`/`if` on vendor. The package contract (a standardized export) is the only coupling.

---

## 6. PHASE 0 Verdict

EPIC-005.1 delivered a **provider-neutral core** with all trust/transport/marketplace seams in place. The missing layer is **runtime discovery + generic package loading**: Hermes currently *knows* providers (they are registered in code); EPIC-005.2 must make Hermes *discover* them (scan → validate → load → manage). All building blocks exist; we add the discovery/loader boundary and the missing lifecycle operations (duplicate, collision, unload, reload, available/offline states).

**No code changed in PHASE 0.**
