# EPIC-005 — Provider Manifest V2

**Phase:** 2 — Canonical provider manifest
**Status:** Architecture-only. No source code modified.
**Date:** 2026-07-20

---

## 1. Purpose

The Provider Manifest is the **single declarative contract** a provider ships to Hermes. It is *data, never code*. Hermes reads it to discover capabilities, enforce trust, route policy, and drive selection — without importing a line of vendor code.

This supersedes the current `ProviderManifest` in `capability.ts` (which carries only `name`, `version`, `capabilities[]`). V2 adds the trust, transport, lifecycle, and sandbox metadata the Baseline Review (H1–H5, P1–P4) showed was missing.

---

## 2. Canonical Schema

```ts
interface ProviderManifestV2 {
  /** ── Identity ── */
  id: string;                       // logical id, e.g. "claude-code", "cloudflare", "github-actions"
  name: string;                     // human label
  vendor: string;                   // "anthropic" | "cloudflare" | "github" | ...
  version: string;                  // semver of the manifest contract
  manifestSchema: "v2";             // distinguishes from legacy manifests

  /** ── Transport(s) the provider speaks ── */
  transports: ProviderTransport[];  // see PROVIDER_TRANSPORT.md

  /** ── Capabilities this provider can serve ── */
  // Intention ids ONLY (never vendor names) — see CAPABILITY_MODEL.md
  capabilities: ManifestCapability[];

  /** ── Permissions the provider DECLARES it needs ── */
  permissions: ProviderPermission[];

  /** ── Trust ── */
  trust: {
    level: "untrusted" | "sandbox" | "trusted" | "privileged";
    authModel: "none" | "token" | "oauth" | "mtls" | "ssh-key";
    signature?: {                  // supply-chain integrity
      algorithm: "sha256" | "sha512" | "ed25519";
      checksum: string;            // manifest checksum (detached-signed)
      signer: string;              // trusted signer id
      certificate?: string;        // optional x509/cosign ref
    };
    sandboxPolicy?: SandboxPolicy;
  };

  /** ── Health ── */
  health: {
    probe: "none" | "http" | "tcp" | "process" | "command";
    endpoint?: string;             // for http/tcp
    intervalMs: number;
    timeoutMs: number;
    healthyWithinMs: number;
  };

  /** ── Resource limits Hermes will enforce ── */
  limits: {
    maxConcurrent: number;
    maxDurationMs: number;
    memoryMb?: number;
    networkEgress?: "none" | "egress-only" | "full";
  };

  /** ── Approval requirements ── */
  approval: {
    requiredByDefault: boolean;
    perCapability?: Record<string, boolean>;  // override by intention id
    humanInLoop?: boolean;
  };

  /** ── Lifecycle ── */
  lifecycle: {
    discoverable: boolean;         // appears in marketplace?
    autoLoad: boolean;             // load at boot if trusted?
    deprecated?: boolean;
    deprecationNote?: string;
    preferredFor?: string[];       // intention ids this provider is preferred for
  };

  /** ── Optional features ── */
  features?: {
    streaming?: boolean;
    cancel?: boolean;
    idempotency?: boolean;
    retry?: boolean;
    webhook?: boolean;
  };

  /** ── Sandbox policy (if trust.level >= sandbox) ── */
  // (referenced above; full shape in PROVIDER_TRUST_MODEL.md)
}

interface ManifestCapability {
  id: string;                      // intention id, e.g. "dev.code.generate"
  implKey: string;                 // resolved by the Loader factory map (data, not code)
  config?: Record<string, unknown>; // non-secret config
  effects?: Array<"read" | "write" | "network" | "exec" | "delete" | "external">;
}

interface ProviderTransport {
  kind: "cli" | "local-process" | "stdio" | "http" | "https"
      | "websocket" | "mcp" | "ssh" | "future";
  endpoint?: string;
  auth?: string;                   // auth model name (resolved by transport layer)
}

interface ProviderPermission {
  capability: string;              // intention id this permission gates
  scope: string;                   // e.g. "repo:write", "account:read"
  grantedBy: "manifest" | "operator" | "runtime"; // who must affirm it
}

interface SandboxPolicy {
  isolation: "none" | "process" | "container" | "vm";
  filesystem: "ro" | "rw" | "ephemeral";
  network: "none" | "egress-only" | "full";
  seccomp?: "default" | "strict";
}
```

---

## 3. Manifest Examples (data only)

### Claude Code
```yaml
id: claude-code
vendor: anthropic
version: 1.0.0
manifestSchema: v2
transports: [{ kind: cli, endpoint: "claude" }]
capabilities:
  - id: dev.code.generate
    implKey: claude-code.generate
  - id: dev.code.review
    implKey: claude-code.review
trust:
  level: sandbox
  authModel: token
  signature: { algorithm: sha512, checksum: "...", signer: "nous-research" }
health: { probe: process, intervalMs: 30000, timeoutMs: 5000, healthyWithinMs: 10000 }
limits: { maxConcurrent: 4, maxDurationMs: 600000, networkEgress: egress-only }
approval: { requiredByDefault: false, humanInLoop: true }
lifecycle: { discoverable: true, autoLoad: true, preferredFor: [dev.code.generate, dev.code.review] }
features: { streaming: true, cancel: true, retry: true }
```

### Cloudflare
```yaml
id: cloudflare
vendor: cloudflare
version: 1.0.0
manifestSchema: v2
transports: [{ kind: https, endpoint: "https://api.cloudflare.com", auth: "token" }]
capabilities:
  - id: deploy.worker
    implKey: cloudflare.worker.deploy
  - id: deploy.website
    implKey: cloudflare.pages.deploy
  - id: storage.object.put
    implKey: cloudflare.r2.put
trust:
  level: trusted
  authModel: token
  signature: { algorithm: sha512, checksum: "...", signer: "nous-research" }
health: { probe: https, endpoint: "https://api.cloudflare.com/health", intervalMs: 60000, timeoutMs: 5000, healthyWithinMs: 15000 }
limits: { maxConcurrent: 8, maxDurationMs: 120000, networkEgress: full }
approval: { requiredByDefault: true }
lifecycle: { discoverable: true, autoLoad: true }
```

### GitHub Actions
```yaml
id: github-actions
vendor: github
version: 1.0.0
manifestSchema: v2
transports: [{ kind: https, endpoint: "https://api.github.com", auth: "oauth" }]
capabilities:
  - id: git.pr.open
    implKey: gh.pr.create
  - id: deploy.infra
    implKey: gh.actions.run
trust: { level: trusted, authModel: oauth, signature: { algorithm: sha512, checksum: "...", signer: "nous-research" } }
health: { probe: https, endpoint: "https://api.github.com/healthz", intervalMs: 60000, timeoutMs: 5000, healthyWithinMs: 15000 }
limits: { maxConcurrent: 6, maxDurationMs: 1800000, networkEgress: full }
approval: { requiredByDefault: true }
lifecycle: { discoverable: true, autoLoad: false }
```

---

## 4. Manifest Lifecycle in Hermes

```
provider artifact
      │
      ▼
DISCOVER   → locate manifest file / registry entry
      │
      ▼
VALIDATE   → schema check + signature/checksum verify (Phase 4)
      │
      ▼
AUTHORIZE  → trust level + permission grants vs policy
      │
      ▼
LOAD       → Loader maps implKeys → live impls (capability.ts seam)
      │
      ▼
ACTIVATE   → register capabilities into the Registry; expose in Marketplace
```

---

## 5. Rules

- A manifest is **the only thing a provider ships**. No code reaches Hermes core except through the Loader's `implKey` factory map.
- `id` is permanent. Renaming a provider id is a breaking change.
- `capabilities[].id` MUST be intention ids from the Capability Model — never vendor names.
- `trust.signature` is mandatory for any provider with `trust.level >= trusted`.
- `limits` are **enforced by Hermes**, not honored voluntarily by the provider.
- Adding a provider = add a manifest + register `implKey` factories. No core edit.
