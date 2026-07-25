# Provider Authoring Guide — EPIC-005.1

**Status:** Implemented & validated (12/12 tests passing, `tsc -p tsconfig.epic005.json --noEmit` clean)
**Audience:** Engineers adding a new external provider (Claude Code, Codex, OpenCode, or any future tool) to Hermes.
**Core principle:** Adding a provider requires **zero edits to core platform code**. You add *data* (a manifest) and *one factory function*. The platform is 100% provider-neutral.

---

## 1. What you ship

A provider is composed of exactly two artifacts:

| Artifact | File | Form |
|----------|------|------|
| **Manifest V2** | `services/providers/<you>/index.ts` | Pure data object (`ProviderManifestV2`) |
| **Factory** | `services/providers/<you>/index.ts` | `(manifest, transports, spawner?) => Provider` |

There is **no core edit**, no hardcoded `if (vendor === "x")` branch, no special-casing. The `UniversalCapabilityPlatform` learns about a provider only through `registerProvider({ manifest, factory })`.

Reference implementation: [`services/providers/claude-code/index.ts`](../../services/providers/claude-code/index.ts).

---

## 2. The four steps to add a provider

### Step 1 — Write the manifest (`ProviderManifestV2`)
Mirror the shape in [`services/providers/manifest-v2.ts`](../../services/providers/manifest-v2.ts). Key rules:

- `id` — a stable slug (`"claude-code"`). Used as the trust/marketplace key.
- `capabilities[]` — each `id` is a **vendor-free intention** (e.g. `"dev.code.generate"`). The validator **rejects** any `id` containing `":"` — vendor namespacing is forbidden by EPIC-005.
- `trust.level` — one of `untrusted | sandbox | trusted | privileged`. Tiers `>= trusted` **require** a `trust.signature` block (supply-chain integrity).
- `transports[]` — declares how the platform reaches the tool (`cli`, `http`, `stdio`, `mcp`, …).
- `approval.requiredByDefault` — whether the Selection Engine must get human sign-off before invoking.

### Step 2 — Write the factory
```ts
export function myToolFactory(
  manifest: ProviderManifestV2,
  transports: TransportRegistry,
  spawner?: ProcessSpawner,
): Provider {
  const cli = transports.get("cli");        // registered Hermes transport
  const transport = cli ?? new CliTransport({
    command: manifest.transports[0]?.endpoint ?? "my-tool",
    baseArgs: [],
    healthProbeArgs: ["--version"],
    spawner,                                  // injected only in tests / non-registered env
  });
  return new MyToolProvider(manifest, transport);
}
```
The factory resolves its transport from the **shared `TransportRegistry`** (Hermes-owned, reusable across providers). If the transport isn't pre-registered, it falls back to constructing one from an injected `spawner` — this is what makes the code unit-testable without a real binary.

### Step 3 — Implement the `Provider` interface
Implement [`Provider`](../../services/providers/sdk.ts): `metadata()`, `execute(req)`, `cancel(id)`, `health()`.
- `execute` receives a **normalized** request envelope (`capabilityId`, `implKey`, `args`, `timeoutMs`, `invocationId`).
- **Normalize every failure into a structured `ProviderError`** (`{ ok:false, code, message }`). Codes used by the platform: `CAPABILITY_UNKNOWN`, `PROVIDER_UNAVAILABLE`, `TRANSPORT_FAILED`, `TIMEOUT`. The transport already returns these shapes; pass them through.
- Reference implementation: [`services/providers/claude-code/provider.ts`](../../services/providers/claude-code/provider.ts).

### Step 4 — Register with the platform
```ts
const platform = new UniversalCapabilityPlatform(trustConfig, capabilityRegistry);
platform.registerProvider({ manifest: MY_TOOL_MANIFEST, factory: myToolFactory });
const provider = await platform.bootstrap("my-tool"); // discover→validate→authorize→load→activate
```
No other code path needs to know `my-tool` exists.

---

## 3. Trust gates (fail-closed by design)

`bootstrap()` runs the provider through `TrustLifecycle.admit()`:

```
DISCOVERED → VALIDATE → AUTHORIZE → AUTHENTICATED → LOADED → (activate) ACTIVE
                                  ↘ any failure → REJECTED
```

| Gate | Failure → |
|------|-----------|
| `VALIDATE` (manifest schema + vendor-free capability ids) | REJECTED, manifest id preserved for observability |
| `AUTHORIZE` (policy evaluator — `trustConfig.authorize`) | REJECTED, `trustLevel` shown as `untrusted` |
| `enforceSignatures` + untrusted/unpinned signer (`trust.level >= sandbox`) | REJECTED |
| `LOAD` (no factory registered) | REJECTED |

**A REJECTED provider is never instantiated and never enters the live provider map.** It *does* remain visible in the Marketplace (with `lifecycle: "REJECTED"` + `rejectionReason`) so operators can see what was declined and why.

---

## 4. Runtime failure modes (all proven by the validation suite)

| Scenario | Trigger | Result |
|----------|---------|--------|
| Unknown provider id | `bootstrap("nope")` | `undefined`, no crash |
| Bad manifest | empty `capabilities[]` | REJECTED + visible in marketplace |
| Auth denied | `authorize: () => false` | REJECTED (fail-closed) |
| Cancellation | `cancel(id, inv)` | `EXECUTION_CANCELLED` audit, no crash |
| Timeout | transport never closes | normalized `TIMEOUT` error |
| Health failure | 3× `unhealthy` probes | `SUSPENDED` |
| Unknown capability | `capabilityId` not in manifest | `CAPABILITY_UNKNOWN` |
| Provider not loaded | `execute` before `bootstrap` | `PROVIDER_UNAVAILABLE` |
| Transport error | spawn throws | `TRANSPORT_FAILED` |
| Bad signature | `trust.level=trusted`, unpinned signer | REJECTED |

Every failure mode **closes safely** — no partial provider, no leaked trust, no unhandled exception.

---

## 5. Validation

Run the suite:
```bash
cd hermes
./node_modules/.bin/vitest run services/providers/__tests__/epic-005.1.test.ts
# or via the global binary:
/path/to/workers/node_modules/.bin/vitest run --root . services/providers/__tests__/epic-005.1.test.ts
```
Typecheck (isolated project, DOM lib enabled for timers/streams):
```bash
tsc -p tsconfig.epic005.json --noEmit
```

The suite uses an **injected fake spawner** — no real CLI binary, no network, no secrets. It proves the full lifecycle `discover → validate → authorize → load → execute → audit` end-to-end, and that every failure mode closes safely.

---

## 6. Architecture map (where things live)

| Concern | Module |
|---------|--------|
| Orchestrator (composes everything, provider-neutral) | `services/providers/platform.ts` |
| Manifest schema + validator + loader | `services/providers/manifest-v2.ts` |
| Trust lifecycle (Hermes owns trust) | `services/providers/trust/lifecycle.ts` |
| Marketplace (read-only derived view) | `services/providers/marketplace.ts` |
| Transports (CLI transport + registry) | `services/providers/transport/cli.ts`, `transport.ts` |
| Provider SDK types (`Provider`, `ProviderError`) | `services/providers/sdk.ts` |
| Reference provider (Claude Code) | `services/providers/claude-code/` |

See also: [PROVIDER_MANIFEST_V2](./PROVIDER_MANIFEST_V2.md) · [PROVIDER_TRUST_MODEL](./PROVIDER_TRUST_MODEL.md) · [PROVIDER_MARKETPLACE](./PROVIDER_MARKETPLACE.md) · [PROVIDER_TRANSPORT](./PROVIDER_TRANSPORT.md) · [PROVIDER_SELECTION_ENGINE](./PROVIDER_SELECTION_ENGINE.md).
