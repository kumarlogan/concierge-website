# Hermes Project Knowledge Index v1

> **Status:** Experimental · **Namespace:** `project-index/` · **Constitution:** v1.0.0
> **Version:** 1.0.0 · **Last Updated:** 2026-07-25

---

## Table of Contents

1. [Purpose](#1-purpose)
2. [Scope](#2-scope)
3. [Architecture](#3-architecture)
4. [Repository Index Format](#4-repository-index-format)
5. [Index Metadata](#5-index-metadata)
6. [Minimal PKI Schema](#6-minimal-pki-schema)
7. [PKI Refresh Strategy](#7-pki-refresh-strategy)
8. [Repository Discovery & Selection](#8-repository-discovery--selection)
9. [Cache Management](#9-cache-management)
10. [Service Interface](#10-service-interface)
11. [Configuration Schema](#11-configuration-schema)
12. [Observability Contract](#12-observability-contract)
13. [Deferred Backlog](#13-deferred-backlog)

---

## 1. Purpose

The Project Knowledge Index (PKI) provides **lightweight, cached repository metadata**
that enables fast context resolution without repeatedly scanning repositories.

It is the **primary deterministic data source** for the Intent Engine's resolution
pipeline (Tier 2 — Cached Metadata). Before any repository inspection (Tier 3) or AI
reasoning (Tier 4), the Intent Engine checks the PKI for the facts it needs.

### 1.1 — Constitutional Compliance

| Principle | How PKI Satisfies It |
|-----------|---------------------|
| **Deterministic Before AI** (§1.2) | Cached metadata (Tier 2) checked before repo inspection or AI |
| **Performance First** (§1.7) | Eliminates redundant repository scans |
| **Incremental Context** (§1.8) | Only indexes what's needed; loads on demand |
| **Repository Agnostic** (§1.5) | Standardised schema across all repos; no hardcoded structure |
| **Modular Design** (§1.6) | Independent module with defined interface |
| **Observability by Default** (§1.9) | Emits timing, hits, misses on every access |

---

## 2. Scope

The PKI is a **supporting platform service** whose scope is limited to supporting the
Intent Engine. It is not a general-purpose metadata store.

The PKI:

- **Does** provide repository metadata for fast context resolution
- **Does** cache build commands, test commands, component maps, and documentation paths
- **Does** handle incremental refresh when repositories change
- **Does not** store session state (see `memory/` namespace)
- **Does not** store execution history (see `telemetry/` namespace)
- **Does not** replace git operations for content discovery
- **Does not** perform AI reasoning

---

## 3. Architecture

```
┌──────────────┐     ┌──────────────────────────────────────────┐
│   Repository │     │           Project Knowledge Index         │
│  .hermes/    │────▶│                                          │
│  project-    │     │  ┌──────────┐  ┌──────────┐  ┌────────┐ │
│  index.yaml  │     │  │  Cache   │  │  Lookup  │  │ Builder│ │
│              │     │  │ Manager  │  │  Service │  │        │ │
│  (on disk)   │     │  │          │  │          │  │        │ │
│              │     │  └────┬─────┘  └────┬─────┘  └───┬────┘ │
└──────────────┘     │       │              │            │      │
                     │       │              │            │      │
                     │       ▼              ▼            ▼      │
                     │  ┌──────────────────────────────────────┐│
                     │  │          Extractor / Refresh          ││
                     │  │  (reads repo dirs, git state, docs)  ││
                     │  └──────────────────────────────────────┘│
                     └──────────────────────────────────────────┘
                                    │
                                    ▼
                     ┌──────────────────────────┐
                     │   Intent Engine (caller)  │
                     └──────────────────────────┘
```

### 3.1 — Module Responsibilities

| Module | File | Responsibility |
|--------|------|----------------|
| **Builder** | `builder.py` | Constructs the in-memory index from disk sources |
| **Extractor** | `extractor.py` | Reads project metadata, git state, docs, and component maps |
| **Lookup** | `lookup.py` | Resolves repository by name, path, or matching criteria |
| **Cache Manager** | `cache.py` | Maintains the in-memory cache, expiration, and staleness tracking |
| **Refresh** | `refresh.py` | Detects changes and triggers incremental index refresh |

### 3.2 — Dependency Rules

Per [Constitution §3.2](PLATFORM_CONSTITUTION.md#32---dependency-direction):

- `project-index/` is a **leaf service** — it has no platform-service dependencies.
- It may use `shared/` types and `policy/` rules for cache expiry policies.
- The `shared/` types dependency is optional; the PKI defines its own types if `shared/`
  is not yet implemented.

---

## 4. Repository Index Format

### 4.1 — File Location

Each Hermes-managed repository maintains a machine-readable index at:

```
.hermes/project-index.yaml
```

This path is the **recommended default**. Alternative paths or formats are permitted
as long as they are versioned and documented in the repository's profile.

### 4.2 — Format

The index is a YAML file with the following structure:

```yaml
# .hermes/project-index.yaml
project:
  name: concierge-website
  description: AG Synergy public website — Cloudflare Workers, D1, TypeScript
  status: active

technology:
  framework: hono
  language: typescript
  runtime: cloudflare-workers
  package_manager: pnpm

documentation:
  roadmap: ROADMAP.md
  architecture: ARCHITECTURE.md
  operations: docs/operations/DEPLOYMENT.md
  security: SECURITY.md
  database: DATABASE.md
  api: API.md

components:
  - name: Hero
    path: src/workers/components/hero.ts
    type: ui
  - name: Navigation
    path: src/workers/components/navigation.ts
    type: ui
  - name: Footer
    path: src/workers/components/footer.ts
    type: ui
  - name: Authentication
    path: src/workers/auth.ts
    type: backend
  - name: Dashboard
    path: src/workers/dashboard.ts
    type: ui
  - name: API Router
    path: src/workers/api.ts
    type: backend

operations:
  build: pnpm run build
  test: pnpm run test
  deployment_targets:
    - production
    - staging
  environments:
    - production
    - staging
    - preview

metadata:
  version: 1.0.0
  last_indexed: 2026-07-25T22:30:00Z
  active_branch: main
```

---

## 5. Index Metadata

### 5.1 — Project Section

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | `string` | Yes | Unique repository/project name |
| `description` | `string` | Yes | One-line description |
| `status` | `string` | Yes | `active`, `archived`, `frozen` |

### 5.2 — Technology Section

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `framework` | `string` | Yes | Primary framework (hono, next, express, etc.) |
| `language` | `string` | Yes | Primary language (typescript, python, go, etc.) |
| `runtime` | `string` | Yes | Runtime environment (cloudflare-workers, node, deno, etc.) |
| `package_manager` | `string` | Yes | Package manager (pnpm, npm, yarn, pip, uv) |

### 5.3 — Documentation Section

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `roadmap` | `string` | Yes | Path to roadmap document |
| `architecture` | `string` | No | Path to architecture document |
| `operations` | `string` | No | Path to operations/deployment document |
| `security` | `string` | No | Path to security document |
| `database` | `string` | No | Path to database document |
| `api` | `string` | No | Path to API document |

### 5.4 — Components Section

Each component entry:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | `string` | Yes | Logical component name |
| `path` | `string` | Yes | Source path (relative to repo root) |
| `type` | `string` | Yes | Component type: `ui`, `backend`, `infra`, `data`, `shared` |

### 5.5 — Operations Section

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `build` | `string` | Yes | Build command |
| `test` | `string` | Yes | Test command |
| `deployment_targets` | `list[string]` | Yes | Available deploy targets |
| `environments` | `list[string]` | Yes | Available environments |

### 5.6 — Metadata Section

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `version` | `string` | Yes | Index schema version |
| `last_indexed` | `datetime` | Yes | Last refresh timestamp (ISO 8601) |
| `active_branch` | `string` | Yes | Current active git branch |

---

## 6. Minimal PKI Schema

### 6.1 — Required Minimum

A repository must provide at minimum these four fields for PKI integration:

```yaml
project:
  name: <required>
  description: <required>
  status: <required>

technology:
  framework: <required>
  language: <required>
  runtime: <required>
  package_manager: <required>

operations:
  build: <required>
  test: <required>

metadata:
  version: <required>
  last_indexed: <required>
  active_branch: <required>
```

All other fields are optional. The PKI gracefully degrades when optional fields
are absent (e.g., component map unavailable → Intent Engine loads component list
from inspection instead).

### 6.2 — Graceful Degradation

| Missing Field | Behaviour |
|---------------|-----------|
| `documentation.*` | Skip doc path resolution; caller discovers docs by convention |
| `components` | Intent Engine inspects repo for component structure (Tier 3) |
| `operations.environments` | Default to `[production, staging]` |
| `operations.deployment_targets` | Default to `[production]` |

---

## 7. PKI Refresh Strategy

### 7.1 — Incremental Refresh

The PKI is refreshed **incrementally** — not via full rescans — triggered by:

| Trigger | Detection Method | Scope |
|---------|-----------------|-------|
| Git commit | `git log --oneline -1` hash change | Full index refresh |
| Documentation change | File modification time on doc files | Documentation paths only |
| Component change | File creation/deletion in source dirs | Components section only |
| Configuration change | `.hermes/project-index.yaml` mtime change | Project metadata only |

### 7.2 — Refresh Cooldown

To avoid thrashing, the PKI enforces a minimum cooldown between refreshes:

- Same trigger: 60 second minimum interval
- Different trigger: 10 second minimum interval
- Full rescan: 300 second minimum interval

### 7.3 — Manual Refresh

Repository owners may trigger a manual full refresh by touching the index file:

```bash
touch .hermes/project-index.yaml
```

### 7.4 — Full Rescan Conditions

Full rescans occur only when:

1. Explicitly requested via `pki.refresh()` with `force=True`.
2. No cached index exists for the repository (first-time setup).
3. The `.hermes/project-index.yaml` file does not exist and must be auto-generated.

---

## 8. Repository Discovery & Selection

### 8.1 — Discovery

The PKI maintains a registry of known repositories. Discovery methods (checked in order):

1. **Configuration** — explicit repository list in `project-index` config
2. **Directory scan** — scan configured workspace directories for `.hermes/project-index.yaml`
3. **Manual registration** — repositories added via the `register` interface

### 8.2 — Selection Rules

When the Intent Engine invokes the PKI for repository resolution:

| Scenario | Behaviour |
|----------|-----------|
| **Exactly one repo matches** | Auto-select; return index |
| **Multiple repos match** | Return list; do NOT select (per §1.3 — No Assumptions) |
| **Zero repos match** | Return empty; Intent Engine asks user to specify or register |
| **Request explicitly names a repo** | Match by name; return index or error |

### 8.3 — Multi-Repo Ambiguity

Per the Intent Engine pipeline, when multiple repositories satisfy a request:

1. PKI returns the candidate list with names and descriptions.
2. Intent Engine presents the list to the user.
3. The user must explicitly select.
4. PKI never infers repository selection.

---

## 9. Cache Management

### 9.1 — Cache Layers

| Layer | Storage | Duration | Eviction |
|-------|---------|----------|----------|
| **L1 — In-memory** | Python dict | Session lifetime | LRU, max 50 entries |
| **L2 — Disk** | JSON file per repo | Configurable TTL (default 1h) | TTL expiry |
| **L3 — Source** | `.hermes/project-index.yaml` | File system | N/A (source of truth) |

### 9.2 — Cache Hierarchy

1. Check L1 (fastest) — return if valid and not stale.
2. Check L2 — load into L1; return if not stale.
3. Check L3 — read from disk; update L2 and L1; return.
4. If L3 missing — trigger build/extract; cache result.

### 9.3 — Staleness Detection

A cache entry is stale when:

- `last_indexed` timestamp is older than the configured TTL.
- Git HEAD hash differs from the cached value.
- File modification time of `.hermes/project-index.yaml` is newer than `last_indexed`.

---

## 10. Service Interface

### 10.1 — Primary Entry Point

```python
def resolve(repo_identifier: str | None = None) -> ProjectIndex | list[ProjectIndex]
```

### 10.2 — Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `repo_identifier` | `str` | No | Repository name or path; `None` returns all known repos |

### 10.3 — Return Type

```python
@dataclass
class ProjectIndex:
    project: ProjectInfo
    technology: TechnologyInfo
    documentation: DocumentationPaths
    components: list[Component]
    operations: OperationsInfo
    metadata: MetadataInfo
    cache_status: str  # "fresh" | "stale" | "missing"
```

### 10.4 — Supporting Methods

| Method | Description |
|--------|-------------|
| `register(path: str)` | Register a repository path with the PKI |
| `refresh(repo_name: str, force: bool = False)` | Trigger incremental or full refresh |
| `search(query: str) -> list[ProjectIndex]` | Search known repos by name/description |
| `invalidate(repo_name: str)` | Mark a repo's cache as stale |
| `known_repos() -> list[str]` | List all registered repositories |

---

## 11. Configuration Schema

```yaml
# project-index config — injected per deployment, never hardcoded
project_index:
  workspace_dirs:
    - /home/ubuntu

  auto_discover: true

  cache:
    ttl_seconds:
      l1_in_memory: 3600        # 1 hour
      l2_disk: 3600              # 1 hour
    max_l1_entries: 50

  refresh:
    cooldown_same_trigger: 60    # seconds
    cooldown_diff_trigger: 10    # seconds
    cooldown_full_rescan: 300    # seconds
    git_check_enabled: true

  index_filename: .hermes/project-index.yaml

  # Optional: explicit repository registration
  repositories: []
```

---

## 12. Observability Contract

### 12.1 — Standard Envelope

```json
{
  "service": "project-index.lookup",
  "operation": "resolve",
  "duration_ms": 12,
  "decision_path": ["l1_cache", "l2_cache", "l3_disk"],
  "cache_hits": 2,
  "cache_misses": 1,
  "errors": [],
  "outcome": "success",
  "clarification_needed": false
}
```

### 12.2 — Per-Module Envelope

| Module | Service Name | Operation Example |
|--------|-------------|-------------------|
| Builder | `project-index.builder` | `build`, `rebuild` |
| Extractor | `project-index.extractor` | `extract_git_state`, `extract_metadata` |
| Lookup | `project-index.lookup` | `resolve`, `search` |
| Cache | `project-index.cache` | `get`, `set`, `invalidate` |
| Refresh | `project-index.refresh` | `check_trigger`, `incremental_refresh` |

### 12.3 — Additional Fields

| Field | Module | Description |
|-------|--------|-------------|
| `repo_count` | Lookup | Number of matched repositories |
| `cache_layer` | Cache | Which layer served the data (`l1`, `l2`, `l3`) |
| `trigger_type` | Refresh | What triggered the refresh (`git`, `file`, `manual`) |
| `is_auto_discovered` | Builder | Whether the repo was found via auto-discovery |

---

## 13. Deferred Backlog

The following improvements were identified during implementation but are outside scope.
See [Deferred Backlog](deferred-backlog.md) for the full list.

| # | Description | Rationale | Proposed Namespace |
|---|-------------|-----------|-------------------|
| PKI-001 | Dependency graph — index inter-repository dependencies | Support cross-repo orchestration | `project-index/` |
| PKI-002 | Auto-generate `project-index.yaml` from repo inspection for repos that lack it | Reduce manual setup cost | `project-index/` |
| PKI-003 | Git-aware change detection — diff-based partial refresh instead of HEAD hash | Faster incremental refresh | `project-index/` |
| PKI-004 | Remote repository support — index repos not on local filesystem | Support CI/CD environments | `project-index/` |