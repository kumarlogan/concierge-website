# EPIC-005.2 — Dynamic Provider Loading: Runtime & Operator Guide

**Phase:** 8 — Operations documentation
**Status:** Implemented & validated (24/24 tests). Docs only — no source changes in this phase.
**Date:** 2026-07-20

---

## 1. What this changes at runtime

Previously, a provider's code had to be wired into Hermes core at build time. Now Hermes
**discovers and admits** provider packages at runtime through one generic path. Nothing about
a specific provider is hardcoded.

At boot (or on a re-scan signal), Hermes:

1. Reads configured `locations` (filesystem dirs, inline packages, or remote manifest URLs).
2. Discovers every `manifest.json` under each location and schema-validates it.
3. Loads each valid package's `provider.ts` via an injected module loader.
4. Admits each through the **single trust gate** (`UniversalCapabilityPlatform.bootstrap`).
5. Registers its capabilities and surfaces it in the **marketplace** with full state.

---

## 2. The single entry point

```ts
const manager = new DynamicProviderManager(capabilityRegistry, {
  read, listDir, loadModule,          // Hermes-owned I/O seams
  ctx: { runtime: { authorize } },    // Hermes-owned trust policy
});

const result = await manager.scan([
  { kind: "filesystem", rootDir: "/etc/hermes/providers" },
]);
```

`result` tells you everything that happened, partitioned by outcome:

| Field | Meaning |
|-------|---------|
| `loaded` | Provider ids that passed discovery + load + trust admission |
| `discoveryRejected` | Packages with unreadable/invalid manifests (isolated per package) |
| `trustRejected` | Loaded package but the trust gate denied it (visible in marketplace) |
| `duplicates` | Provider id already admitted — second copy ignored, first kept |
| `collisions` | A capability id claimed by two providers (both load; collision recorded) |

The scan **never throws**. One bad package cannot take down the others.

---

## 3. Trust is non-negotiable

Every provider — without exception — enters only through `bootstrap()` →
`TrustLifecycle.admit()`. There is no backdoor, no "trusted by default" shortcut.

- `authorize(m)` is a Hermes-owned function. Return `false` → provider is **REJECTED**
  and stays **visible** in the marketplace (operators see *what* was denied and *why*).
- A malformed entry module, a throwing factory, or a missing transport still routes through
  the gate and lands as **REJECTED / OFFLINE** — never silently dropped, never silently live.

To change the trust policy at runtime (without restarting the whole process):

```ts
manager.platform.setTrustConfig({ trustedSigners, enforceSignatures, authorize });
```

---

## 4. Marketplace = full state (nothing hidden)

`buildDynamicMarketplaceView(platform.marketplace, scanResult)` returns a single snapshot:

| Partition | Contents |
|-----------|----------|
| `ready` | ACTIVE providers, all capabilities green |
| `offline` | Loaded but a declared transport kind is unregistered (cannot serve yet) |
| `rejected` | REJECTED by discovery or trust — **still listed** for debugging |
| `unloaded` | Was loaded, then unloaded (lifecycle UNLOADED) — **still listed** |
| `collisions` | Capability ids shared across providers |

Operators can always answer: *"What providers exist, and exactly why is each in its state?"*

---

## 5. Runtime lifecycle operations

```ts
await manager.unload("some-provider");   // tear down live provider; record stays UNLOADED
await manager.reload("some-provider");   // unload (if loaded) then re-discover + re-admit
```

- `unload` keeps the trust record and the last-known location, so the provider remains visible
  and `reload` can recover it even after unload.
- `reload` re-runs the full discover → load → trust-admit pipeline. It does **not** reuse the
  old in-memory provider instance; it re-derives it from the package.

---

## 6. Operator triage quick reference

| Symptom | Where to look | Likely cause |
|---------|---------------|--------------|
| Provider absent from `loaded` | `discoveryRejected` | Bad `manifest.json` (JSON or schema) |
| Provider in `trustRejected` | `marketplace.rejected` + audit log | `authorize` returned false, or entry module threw |
| Provider in `offline` | `marketplace.offline` | Declared `transport.kind` not registered in `TransportRegistry` |
| Provider absent, id in `duplicates` | `scanResult.duplicates` | Same id already admitted from another location |
| Capability conflict | `scanResult.collisions` | Two packages advertise the same `capability.id` |
| After unload, still listed | `marketplace.unloaded` | Expected — record retained by design |

---

## 7. How to add a new provider (zero core edits)

1. Drop a folder under a configured `location`:
   ```
   my-provider/manifest.json
   my-provider/provider.ts
   ```
2. Point Hermes at the parent dir (`{ kind: "filesystem", rootDir: "..." }`).
3. Trigger a scan (boot or signal).
4. Check `scanResult.loaded` / `marketplace.ready`.

No import, no registration function, no edit to any Hermes core file. See
`EPIC-005.2_CONTRACT_AUTHORING.md` for the package shape.
