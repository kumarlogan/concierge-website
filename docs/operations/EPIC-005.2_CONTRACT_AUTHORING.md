# EPIC-005.2 — Provider Package Authoring Guide

**Phase:** 8 — Authoring documentation
**Status:** Implemented & validated. Docs only — no source changes in this phase.
**Date:** 2026-07-20

This guide shows how to ship a Hermes provider **as a package** — no core edits, no
provider-specific imports in Hermes. Hermes learns about your provider only through its
`manifest.json` and the `provider.ts` entry module you ship.

---

## 1. Package layout

```
my-provider/
  manifest.json     # required — describes the provider (data Hermes validates)
  provider.ts       # required — entry module exporting a ProviderPackageContract
```

Both files are **opaque to Hermes**. Hermes never reads your provider's internals beyond
these two contractually-defined surfaces.

---

## 2. `manifest.json` (ProviderManifestV2)

```json
{
  "schemaVersion": 2,
  "id": "my-provider",
  "name": "My Provider",
  "vendor": "acme",
  "version": "1.0.0",
  "kind": "cli",
  "trust": {
    "level": "sandbox",
    "signature": { "signer": "acme", "value": "<hex>" },
    "requiresapproval": false
  },
  "transports": [
    { "kind": "local-process", "endpoint": "sh" }
  ],
  "capabilities": [
    { "id": "my.capability", "name": "My Capability", "intent": "my.capability", "implKey": "run" }
  ]
}
```

| Field | Requirement | Notes |
|-------|-------------|-------|
| `id` | required, unique | Provider identity. Must be unique across all loaded packages. |
| `name` / `vendor` / `version` | required | Surfaced in the marketplace. |
| `kind` | required | One of the declared package kinds (e.g. `cli`, `remote`, `inline`). Data only — Hermes branches on it nowhere in core. |
| `trust.level` | required | `untrusted` \| `sandbox` \| `verified`. Drives signature enforcement. |
| `trust.signature` | conditional | Required when `enforceSignatures` is on and level ≥ sandbox. |
| `transports[].kind` | required | Must be registered in the platform `TransportRegistry` or the provider loads as **OFFLINE**. |
| `capabilities[].id` | required | Intention-keyed capability id. Collisions across providers are recorded, not fatal. |
| `capabilities[].implKey` | required | Key your `provider.ts` uses to map a capability to an implementation. |

A manifest that fails JSON parse or schema validation → the package is **discovery-rejected**
(isolated; sibling packages still load).

---

## 3. `provider.ts` (ProviderPackageContract)

Hermes loads this module via an injected `loadModule(path)` and expects a contract object:

```ts
import type { ProviderPackageContract, Provider, CapabilityRequest, CapabilityResponse } from "...";

const provider: Provider = {
  metadata() {
    return { id: "my-provider", name: "My Provider", version: "1.0.0", capabilities: ["my.capability"] };
  },
  async execute(req: CapabilityRequest): Promise<CapabilityResponse> {
    // req.capabilityId tells you which capability was invoked.
    // Use req.capabilityId / req.implKey to dispatch to your implementation.
    if (req.capabilityId === "my.capability") {
      return { ok: true, data: { /* ... */ }, durationMs: 0 };
    }
    return { ok: false, code: "UNKNOWN_CAPABILITY", message: "unsupported", durationMs: 0 };
  },
  async health() { return "healthy" as const; },
  async cancel(_id: string) {},
  async shutdown() {},
};

export const contract: ProviderPackageContract = {
  contractVersion: "1.0",
  createProvider: () => provider,
};
```

**Contract rules (enforced by the loader):**
- Must export a value with `contractVersion: "1.0"`.
- Must expose `createProvider` as a function returning a `Provider`.
- Anything else → the package is **REJECTED** and remains visible in the marketplace.

Your `provider.ts` may import whatever it wants internally (your own deps). Hermes only calls
`createProvider()` and then the returned `Provider`'s methods. Hermes **never** imports your
module statically — there is no provider-specific `import` statement anywhere in core.

---

## 4. Capability dispatch

When Hermes executes a capability, it calls `provider.execute(req)` with:

- `req.capabilityId` — the intention key (e.g. `"my.capability"`).
- `req.implKey` — the `implKey` from your manifest (use if you prefer manifest-driven routing).
- `req.input` — the invocation payload.

Dispatch inside `execute` on `capabilityId` (or `implKey`). This keeps your provider's routing
**data-driven from the manifest**, not hardcoded in Hermes.

---

## 5. Transports

Declare the transports your provider needs in `manifest.transports`. Each `kind` must exist in
the platform `TransportRegistry`. If it doesn't, the provider still loads but surfaces as
**OFFLINE** in the marketplace until the transport is registered. This lets Hermes flag
environment gaps without rejecting the provider.

---

## 6. Trust & signatures

- `trust.level: "untrusted"` → admitted without a signature (policy may still deny via `authorize`).
- `trust.level: "sandbox"` / `"verified"` → if `enforceSignatures` is on, the signer must be in
  the Hermes `trustedSigners` allowlist or the provider is **REJECTED**.
- `authorize(m)` is a Hermes-owned policy hook. Even a perfectly valid package can be denied
  here; denial is recorded and **visible**.

---

## 7. Checklist before shipping

- [ ] `manifest.json` parses and passes `ProviderManifestV2` schema validation.
- [ ] `id` is globally unique among your loaded packages.
- [ ] `provider.ts` exports `contract` with `contractVersion: "1.0"` + `createProvider`.
- [ ] `createProvider()` returns a `Provider` whose `metadata().capabilities` matches the manifest.
- [ ] Declared `transports[].kind` values are registered (or you accept OFFLINE until they are).
- [ ] `execute()` returns a well-formed `CapabilityResponse` for every advertised capability.
- [ ] No core Hermes file was edited to add this provider. ✅ (the whole point)
