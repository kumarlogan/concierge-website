# MEOW — Tool Registry

> **Document:** MEOW_TOOL_REGISTRY.md
> **Version:** 1.0.0
> **Date:** 2026-08-04
> **Status:** Draft — Awaiting Product Owner Approval
> **Owner:** Hermes Platform
> **Repository:** concierge-website (GitHub) + Hermes OCI
> **Audit Type:** READ-ONLY — no code changes, no commits, no deployments

---

## Governance Header

```
Company:        AGS
Platform:       Hermes AI Platform
Product:        Concierge (AG Synergy)
Public Brand:   AG Synergy
Repository:     concierge-website
Roadmap:        Hermes Strategic Roadmap
Phase:          Executive Architecture — MEOW
```

---

## 1. Purpose

The Tool Registry inventories every executable tool currently used in the Hermes platform. Tools are grouped, normalized, and deduplicated. This registry prepares Hermes for a Tool Broker.

---

## 2. Tool Categories

### 2.1 Build Tools

| Tool | Name | Normalized Name | Category | Duplicate? |
|---|---|---|---|---|
| pnpm | pnpm | pnpm | Build | No |
| npm | npm | npm | Build | No (pnpm preferred) |
| npx | npx | npx | Build | No |
| wrangler | wrangler | wrangler | Build/Deploy | No |
| vite | vite | vite | Build | No |
| tsc | TypeScript Compiler | tsc | Build | No |
| tsx | tsx | tsx | Build | No |

### 2.2 Test Tools

| Tool | Name | Normalized Name | Category | Duplicate? |
|---|---|---|---|---|
| vitest | vitest | vitest | Test | No |
| pytest | pytest | pytest | Test | No |
| node | node | node | Runtime | No |

### 2.3 Git Tools

| Tool | Name | Normalized Name | Category | Duplicate? |
|---|---|---|---|---|
| git | git | git | VCS | No |
| gh | GitHub CLI | gh | VCS | No |

### 2.4 Cloud Tools

| Tool | Name | Normalized Name | Category | Duplicate? |
|---|---|---|---|---|
| wrangler | wrangler | wrangler | Cloudflare | No |
| curl | curl | curl | HTTP | No |
| jq | jq | jq | JSON | No |

### 2.5 Documentation Tools

| Tool | Name | Normalized Name | Category | Duplicate? |
|---|---|---|---|---|
| markdown | Markdown | markdown | Docs | No |
| nano-pdf | nano-pdf | nano-pdf | Docs | No |

### 2.6 Agent Tools

| Tool | Name | Normalized Name | Category | Duplicate? |
|---|---|---|---|---|
| delegate_task | Subagent | delegate_task | Agent | No |
| execute_code | Python Runner | execute_code | Agent | No |
| terminal | Shell | terminal | Agent | No |
| read_file | File Reader | read_file | Agent | No |
| write_file | File Writer | write_file | Agent | No |
| patch | File Patcher | patch | Agent | No |
| search_files | File Search | search_files | Agent | No |
| terminal | Shell Runner | terminal | Agent | No |

### 2.7 Communication Tools

| Tool | Name | Normalized Name | Category | Duplicate? |
|---|---|---|---|---|
| send_message | Telegram | send_message | Communication | No |
| text_to_speech | TTS | text_to_speech | Communication | No |

### 2.8 Memory Tools

| Tool | Name | Normalized Name | Category | Duplicate? |
|---|---|---|---|---|
| memory | Memory Store | memory | Memory | No |
| session_search | Session Search | session_search | Memory | No |

---

## 3. Duplicate Removal

| Original | Normalized | Action |
|---|---|---|
| terminal (Shell) | terminal | Keep single entry |
| terminal (Shell Runner) | terminal | Merge into single entry |
| read_file (File Reader) | read_file | Keep single entry |
| write_file (File Writer) | write_file | Keep single entry |

---

## 4. Normalized Tool Inventory

| # | Normalized Name | Category | Count (before dedup) | Count (after dedup) |
|---|---|---|---|---|
| 1 | pnpm | Build | 1 | 1 |
| 2 | npm | Build | 1 | 1 |
| 3 | npx | Build | 1 | 1 |
| 4 | wrangler | Build/Deploy | 1 | 1 |
| 5 | vite | Build | 1 | 1 |
| 6 | tsc | Build | 1 | 1 |
| 7 | tsx | Build | 1 | 1 |
| 8 | vitest | Test | 1 | 1 |
| 9 | pytest | Test | 1 | 1 |
| 10 | node | Runtime | 1 | 1 |
| 11 | git | VCS | 1 | 1 |
| 12 | gh | VCS | 1 | 1 |
| 13 | curl | HTTP | 1 | 1 |
| 14 | jq | JSON | 1 | 1 |
| 15 | markdown | Docs | 1 | 1 |
| 16 | nano-pdf | Docs | 1 | 1 |
| 17 | delegate_task | Agent | 1 | 1 |
| 18 | execute_code | Agent | 1 | 1 |
| 19 | terminal | Agent | 2 | 1 |
| 20 | read_file | Agent | 1 | 1 |
| 21 | write_file | Agent | 1 | 1 |
| 22 | patch | Agent | 1 | 1 |
| 23 | search_files | Agent | 1 | 1 |
| 24 | send_message | Communication | 1 | 1 |
| 25 | text_to_speech | Communication | 1 | 1 |
| 26 | memory | Memory | 1 | 1 |
| 27 | session_search | Memory | 1 | 1 |

**Total unique tools after deduplication: 27**

---

## 5. Tool Broker Preparation

The Tool Registry is structured for future Tool Broker integration:

| Broker Capability | Status |
|---|---|
| Tool discovery | Ready (registry is complete) |
| Tool invocation | Not implemented |
| Tool authorization | Not implemented |
| Tool audit logging | Not implemented |
| Tool versioning | Not implemented |

---

*MEOW Deliverable 6 of 15*
