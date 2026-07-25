# EPIC-005.2 — Dynamic Provider Loading: Design

**Phase:** 8 — Design documentation (PHASE 1–7 implemented & validated)
**Status:** Implemented. 12/12 dynamic scenarios + 12/12 EPIC-005.1 regression tests green.
**Date:** 2026-07-20
**Scope:** Converts the Hermes provider architecture from *static* (manifest describes a
provider whose code already lives in core) to *dynamic* (Hermes discovers, loads, and
trust-admits provider code at runtime through a single generic, provider-neutral path).

---

## 1. Goal

A new provider must become usable **without editing any core source file** and **without a
provider-specific import anywhere in Hermes services**. The only artifacts a new provider
ships are a `manifest.json` and a `provider.ts` entry module — both opaque data/code to
Hermes. Hermes learns about the provider purely through the trust gate.

---

## 2. Non-Negotiable Constraints (preserved from EPIC-005)

| # | Constraint | Enforcement point |
|---|-----------|-------------------|
| C1 | New providers require **zero core source changes** | Package = data (`manifest.json`) + opaque module (`provider.ts`); loaded via injected `loadModule` |
| C2 | **No provider-specific imports** in Hermes services | `provider.ts` is loaded as a string path → `loadModule()`; never `import`ed |
| C3 | **No custom registration functions** | `manager.scan()` is the only entry; discovery/loader are generic |
| C4 | **Strict trust lifecycle, no bypass paths** | Every provider enters ONLY through `UniversalCapabilityPlatform.bootstrap()` → `TrustLifecycle.admit()` |
| C5 | **Rejected providers stay visible** | Marketplace composes from `TrustLifecycle.records`; REJECTED/UNLOADED never dropped |
| C6 | **Provider-neutral** | No vendor name in manager/loader/discovery; only `kind`/`transport.kind` data fields |

---

## 3. Pipeline

```
            ┌──────────────────────────────────────────────────────────┐
            │  Hermes-owned injected seams (NEVER provider code)        │
            │   read(path)   listDir(root)   loadModule(path)            │
            └──────────────────────────────────────────────────────────┘
                                   │
   locations[]  ──▶  ProviderDiscovery  ──▶  DiscoveredProvider[]  ──▶  ProviderLoader
   (Hermes            (manifest read +         (id, kind, location,    (loadModule →
    config)           schema VALIDATE)         manifest, transports)    ProviderPackageContract)
                                   │                                       │
                                   │                          loadOutcome.ok === false
                                   │                                       │ (loader fail)
                                   │                                       ▼
                                   │                          platform.registerProvider(throwing
                                   │                          wiring) → bootstrap → REJECTED
                                   │                                       │ (visible)
                                   ▼                                       ▼
                          DynamicProviderManager ──── single trust path ──▶ UniversalCapabilityPlatform
                          (duplicate + collision                │              .bootstrap(providerId)
                           guards around the gate)             ▼              │
                                                       TrustLifecycle.admit()  │
                                                       (DISCOVERED→VALIDATED→  │
                                                        AUTHORIZE→AUTHENTICATED│
                                                        →LOADED→ACTIVE)        ▼
                                                                   CapabilityRegistry.register
                                                                   (dynamic ownerOf tracking)
                                                                              │
                                                                              ▼
                                                                   ProviderMarketplace (full state)
```

The manager is **orchestration only**. It composes three already-trust-bearing components
(`ProviderDiscovery`, `ProviderLoader`, `UniversalCapabilityPlatform`) and adds two
cross-cutting guards (duplicate id, capability collision) *around* the trust gate — never
inside it.

---

## 4. Component Contracts

### 4.1 `ProviderDiscovery` (`discovery.ts`)
- Input: `ProviderPackageLocation[]` (filesystem | inline | remote).
- Reads `manifest.json` via injected `read`, validates with `validateManifestV2`.
- A malformed manifest → `DiscoveryResult.rejected` (isolated; siblings still load).
- Emits `DiscoveredProvider { id, kind, location, packageDir, manifest, transports, metadata }`.

### 4.2 `ProviderLoader` (`loader.ts`)
- Input: a `DiscoveredProvider`.
- Resolves the entry module path: `${packageDir}/provider.ts`.
- Calls injected `loadModule(path)` → expects a `ProviderPackageContract`
  (`contractVersion: "1.0"` + `createProvider()`).
- Resolves declared transports against the platform `TransportRegistry`; unregistered
  transport kinds are recorded as `missingTransports` (provider still loads → OFFLINE surfaced).
- Returns `LoadOutcome { ok, pkg: ProviderPackage, provider: Provider }` or
  `{ ok: false, error }`.

### 4.3 `UniversalCapabilityPlatform` (`platform.ts`)
- The **single trust admission gate**. `bootstrap(providerId)` → `TrustLifecycle.admit`.
- Fail-closed: any admission error (incl. factory throw) is caught and returns `undefined`
  with a `PROVIDER_REJECTED` audit event. No provider reaches the live set via any other path.
- After admission, registers the provider's capabilities into the shared `CapabilityRegistry`.
- `unloadProvider(id)` tears down the live provider and moves the trust record to `UNLOADED`
  (record retained → marketplace stays visible).

### 4.4 `DynamicProviderManager` (`manager.ts`)
- `scan(locations)` → `ScanResult { loaded, discoveryRejected, trustRejected, duplicates, collisions }`.
- Duplicate id already admitted → `duplicates` (never clobbers the first).
- Capability collision (same cap id claimed by two providers) → `collisions`, both still load;
  current provider wins ownership but the collision is recorded for operators.
- `unload(id)` / `reload(id)` for runtime lifecycle management.

### 4.5 `DynamicMarketplaceView` (`marketplace-view.ts`)
- Composes the base `ProviderMarketplace` and adds `ready` / `rejected` / `offline` / `unloaded`
  partitions plus `collisions`, giving operators a single full-state snapshot. Rejected and
  unloaded providers are NEVER hidden.

---

## 5. What a New Provider Ships (no core change)

```
my-provider/
  manifest.json        # ProviderManifestV2 (id, vendor, version, trust, transports, capabilities)
  provider.ts          # export const contract = { contractVersion: "1.0", createProvider }
```

Hermes is told where to look (`locations: [{ kind: "filesystem", rootDir }]`). That is the
**only** integration step. No import, no registration function, no manifest edit in core.

---

## 6. Trust Lifecycle (strict, no bypass)

```
DISCOVERED → VALIDATED → AUTHORIZED → AUTHENTICATED → LOADED → ACTIVE
                                  │
                                  └─ fail → REJECTED (visible in marketplace)
UNLOADED ← (unload) ── ACTIVE
```

`authorize` is a Hermes-owned policy function injected into the platform trust config.
Denied providers are REJECTED and remain visible — never silently dropped.

---

## 7. Validation (PHASE 7)

12 dynamic scenarios + 12 EPIC-005.1 regression scenarios, run under `vitest` (node pool)
from `workers/` against `hermes/` sources. All I/O faked (no fs/network/secrets). All 24 pass.

| # | Scenario | Result |
|---|----------|--------|
| 1 | Valid CLI package discovered + loaded | ✅ |
| 2 | JSON-parse failure isolated; siblings load | ✅ |
| 3 | Manifest schema failure → discoveryRejected | ✅ |
| 4 | Duplicate id → duplicate, no clobber | ✅ |
| 5 | Capability collision → both load, collision recorded | ✅ |
| 6 | Unregistered transport kind → OFFLINE flagged | ✅ |
| 7 | Malformed entry contract → REJECTED (visible) | ✅ |
| 8 | Trust policy deny → REJECTED | ✅ |
| 9 | Marketplace view keeps REJECTED visible | ✅ |
| 10 | unload tears down + keeps record visible | ✅ |
| 11 | reload re-admits after unload | ✅ |
| 12 | Two unrelated provider shapes via one generic path | ✅ |

---

## 8. Files (implemented, not modified in PHASE 8)

| File | Role |
|------|------|
| `services/providers/discovery.ts` | Discovery + `packageDir` plumbing |
| `services/providers/loader.ts` | Generic loader (path fix → `packageDir`) |
| `services/providers/manager.ts` | Orchestration + duplicate/collision guards + reload |
| `services/providers/platform.ts` | `bootstrap` fail-closed + `setTrustConfig` |
| `services/providers/trust/lifecycle.ts` | `setConfig` for runtime trust updates |
| `services/providers/capability.ts` | `ownerOf()` dynamic capability tracking |
| `services/providers/marketplace-view.ts` | Full-state dynamic view |
| `services/providers/dynamic.test.ts` | 12 PHASE 7 scenarios |
| `vitest.epic005.config.ts` | Node-pool vitest config (excluded from workers tsconfig) |
