# MEOW — Provider Registry

> **Document:** MEOW_PROVIDER_REGISTRY.md
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

The Provider Registry prepares Hermes for external providers and MCP. It registers providers, the capabilities they supply, their authentication requirements, approval policies, and audit requirements. No provider is implemented — only registered.

---

## 2. Provider Schema

Each provider entry contains:

| Field | Type | Description |
|---|---|---|
| Name | string | Unique provider name |
| Type | enum | External / Internal / MCP (future) |
| Capabilities Supplied | list | Capabilities this provider provides |
| Authentication | string | Authentication method |
| Approval Requirements | list | Gates required for provider access |
| Policies | list | Operational policies |
| Audit Requirements | list | Audit logging requirements |
| Owner | string | Owning department |
| Status | enum | Registered / Active / Pending / Deprecated |

---

## 3. Registered Providers

### 3.1 GitHub

| Field | Value |
|---|---|
| Name | GitHub |
| Type | External |
| Capabilities Supplied | Source control, CI/CD, PR management, issue tracking, secret management |
| Authentication | Personal Access Token (PAT), OAuth App, GitHub Actions |
| Approval Requirements | GATE-09 (Architecture Review) for provider changes, GATE-10 (Security Review) for secret access |
| Policies | No hardcoded secrets, PAT rotation every 90 days, least-privilege scopes |
| Audit Requirements | All secret access logged, all PAT usage logged, all repo operations logged |
| Owner | Hermes Platform |
| Status | Active |

### 3.2 Cloudflare

| Field | Value |
|---|---|
| Name | Cloudflare |
| Type | External |
| Capabilities Supplied | Workers runtime, Pages hosting, D1 database, R2 storage, KV store, CDN, DNS, Access (email-OTP) |
| Authentication | API Token, Account ID, Service Tokens |
| Approval Requirements | GATE-09 (Architecture Review) for runtime changes, GATE-10 (Security Review) for data access |
| Policies | No hardcoded secrets, API token rotation every 90 days, least-privilege scopes |
| Audit Requirements | All API calls logged, all data access logged, all deployment operations logged |
| Owner | Hermes Platform |
| Status | Active |

### 3.3 Browser

| Field | Value |
|---|---|
| Name | Browser |
| Type | Internal |
| Capabilities Supplied | Web UI rendering, user interaction, form submission, navigation |
| Authentication | Session-based (Cloudflare Access email-OTP) |
| Approval Requirements | GATE-08 (PO Review) for UX changes |
| Policies | No persistent secrets in browser, CSP headers enforced, XSS protection |
| Audit Requirements | All user actions logged, all form submissions logged |
| Owner | Hermes Platform |
| Status | Active |

### 3.4 Filesystem

| Field | Value |
|---|---|
| Name | Filesystem |
| Type | Internal |
| Capabilities Supplied | Local file read/write, directory traversal, file watching |
| Authentication | OS-level permissions |
| Approval Requirements | GATE-09 (Architecture Review) for filesystem access changes |
| Policies | No secrets in plaintext files, no world-readable sensitive files |
| Audit Requirements | All file operations logged |
| Owner | Hermes Platform |
| Status | Active |

### 3.5 Database

| Field | Value |
|---|---|
| Name | Database |
| Type | Internal |
| Capabilities Supplied | Data persistence, queries, migrations, schema management |
| Authentication | Service credentials, D1 connection strings |
| Approval Requirements | GATE-09 (Architecture Review) for schema changes, GATE-10 (Security Review) for data access |
| Policies | No hardcoded credentials, migration scripts versioned, backup strategy enforced |
| Audit Requirements | All queries logged, all schema changes logged, all data access logged |
| Owner | Hermes Platform |
| Status | Active |

### 3.6 Terminal

| Field | Value |
|---|---|
| Name | Terminal |
| Type | Internal |
| Capabilities Supplied | Shell execution, command running, process management |
| Authentication | OS-level user context |
| Approval Requirements | GATE-07 (Emergency Approval) for production terminal access |
| Policies | No destructive commands without approval, command history logged |
| Audit Requirements | All commands logged, all process spawns logged |
| Owner | Hermes Platform |
| Status | Active |

---

## 4. MCP Provider Preparation (Not Implemented)

| Field | Value |
|---|---|
| Name | MCP Provider (future) |
| Type | MCP (future) |
| Capabilities Supplied | Tool broker, capability broker, provider resolution, capability resolution |
| Authentication | TBD — to be defined when MCP is implemented |
| Approval Requirements | GATE-08 (PO Approval) required before MCP implementation |
| Policies | TBD |
| Audit Requirements | TBD |
| Owner | Hermes Platform |
| Status | Registered (not implemented) |

---

## 5. Provider Resolution

| Capability | Current Provider | Future Provider |
|---|---|---|
| Source Control | GitHub | GitHub (no change) |
| CI/CD | GitHub Actions | GitHub Actions (no change) |
| Runtime | Cloudflare Workers | Cloudflare Workers (no change) |
| Hosting | Cloudflare Pages | Cloudflare Pages (no change) |
| Database | D1 (Cloudflare) | D1 (Cloudflare) (no change) |
| Storage | R2 (Cloudflare) | R2 (Cloudflare) (no change) |
| Authentication | Cloudflare Access | Cloudflare Access (no change) |
| Tool Execution | Terminal + Filesystem | MCP Tool Broker (future) |
| Capability Discovery | Capability Registry | MCP Capability Broker (future) |
| Provider Discovery | Provider Registry | MCP Provider Registry (future) |

---

## 6. No Duplicate Providers

All 6 providers have exactly one entry. No duplicate providers exist.

---

*MEOW Deliverable 5 of 15*
