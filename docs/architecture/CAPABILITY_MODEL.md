# EPIC-005 — Universal Capability Model

**Phase:** 1 — Capability taxonomy as intention, not provider
**Status:** Architecture-only. No source code modified.
**Date:** 2026-07-20

---

## 1. Principle

> A **capability** is an *intention Hermes can form*. It is never a provider, a transport, or a vendor product.

The current code namespaces capabilities by vendor (`cloudflare:r2`, `cloudflare:kv`). Under EPIC-005 this is reversed:

```
BEFORE (provider-namespaced):
  capability.id = "cloudflare:r2"
  capability.provider = "cloudflare"   // vendor-typed

AFTER (intention-namespaced):
  capability.id = "storage.object.put"
  capability.intent = "storage.object.put"
  // provider is RESOLVED at selection time, not baked into the id
```

The capability name is stable forever. The provider behind it can change without any caller change.

---

## 2. Canonical Taxonomy (provider-independent)

Names use a `domain.verb[.object]` convention. The list is **non-exhaustive and open** — new capabilities are data, not code.

### Dev / Code
| Capability | Intention |
|------------|-----------|
| `dev.code.generate` | Produce source code |
| `dev.code.review` | Review a diff/PR |
| `dev.code.refactor` | Restructure existing code |
| `dev.test.run` | Execute a test suite |
| `dev.debug.attach` | Attach a debugger |

### Git / VCS
| Capability | Intention |
|------------|-----------|
| `git.commit` | Commit changes |
| `git.push` | Push a ref |
| `git.pr.open` | Open a pull request |
| `git.pr.review` | Review a pull request |
| `git.clone` | Clone a repository |

### Deploy
| Capability | Intention |
|------------|-----------|
| `deploy.website` | Publish a static/site artifact |
| `deploy.worker` | Deploy a worker/function |
| `deploy.infra` | Apply infrastructure (Terraform) |
| `deploy.container` | Run a container image |

### Security
| Capability | Intention |
|------------|-----------|
| `security.scan` | Static/dynamic vulnerability scan |
| `security.secret.detect` | Detect leaked secrets |
| `security.policy.evaluate` | Evaluate an execution against policy |

### Data
| Capability | Intention |
|------------|-----------|
| `database.query` | Run a query |
| `database.migrate` | Apply a schema migration |
| `storage.object.put` | Write an object |
| `storage.object.get` | Read an object |
| `kv.get` / `kv.put` | Key-value read/write |

### Workflow
| Capability | Intention |
|------------|-----------|
| `workflow.execute` | Run a multi-step workflow |
| `workflow.schedule` | Schedule a recurring workflow |
| `agent.orchestrate` | Drive an agent through a task |

### Notification / Comms
| Capability | Intention |
|------------|-----------|
| `notification.send` | Send a message (transport resolved later) |
| `notification.channel.list` | Enumerate available channels |

### Research / Knowledge
| Capability | Intention |
|------------|-----------|
| `research.search` | Web/KB search |
| `research.summarize` | Summarize a corpus |
| `memory.recall` | Recall from Hermes memory |

### Identity / Trust (Hermes-owned)
| Capability | Intention |
|------------|-----------|
| `identity.verify` | Verify a principal |
| `policy.decide` | Make a policy decision |
| `audit.append` | Append an audit event |
| `capability.discover` | List available capabilities |

---

## 3. Capability Record (intention-shaped)

```ts
interface UniversalCapability {
  /** Stable intention id — NEVER contains a vendor name. */
  id: string;                       // e.g. "storage.object.put"
  /** Human label. */
  name: string;
  /** Domain grouping for marketplace/discovery. */
  domain: "dev" | "git" | "deploy" | "security" | "data"
        | "workflow" | "notification" | "research" | "identity";
  /** Declared side-effects (for policy + approval routing). */
  effects: Array<"read" | "write" | "network" | "exec" | "delete" | "external">;
  /** Whether human approval is required by default. */
  approvalRequired: boolean;
  /** Risk tier driving the policy evaluator. */
  risk: "low" | "medium" | "high" | "critical";
  /**
   * Provider resolution is DEFERRED. The capability does not name a provider.
   * The Selection Engine resolves a provider at execution time from the
   * set of providers that declare this capability in their manifest.
   */
  // (no `provider` field — resolver-owned)
}
```

Key change vs today: **`provider` is removed from the capability record.** The capability expresses *what Hermes wants*; the provider is discovered and selected later.

---

## 4. Resolution Flow

```
Hermes intends:  capability "storage.object.put"   (intention)
                        │
                        ▼
        Provider Marketplace: which installed providers
        declare "storage.object.put" in their manifest?
                        │
                        ▼
        Selection Engine: score candidates by policy/trust/
        health/latency/cost → pick ONE provider
                        │
                        ▼
        Provider Loader: resolve provider's impl for this capability
                        │
                        ▼
        Transport: carry the invocation to the provider
                        │
                        ▼
        Execution + Verification + Audit
```

The capability id is immutable across this whole flow. Only the *resolved provider* changes.

---

## 5. Migration Note (non-breaking)

Today's `Capability.provider: ProviderName` becomes optional metadata. Existing `cloudflare:r2` entries are re-mapped to intention `storage.object.put` with `cloudflare` recorded as *one of* the providers supplying it. Callers that currently read `capability.provider` are updated to ask the Selection Engine instead. Because the registry interface (`get/list/has/register`) is unchanged, this is a **data migration + additive resolver**, not a rewrite.

---

## 6. Rules (carried into implementation)

- Capability ids are **permanent**. Renaming one is a breaking change requiring a migration.
- No capability id may contain a vendor token (`cloudflare`, `aws`, `openai`, …).
- A capability declares *effects* and *risk*, never *how* to execute.
- Provider resolution is the Selection Engine's job, never the capability's.
- Adding a capability is a manifest/registry data change — no core edit.
