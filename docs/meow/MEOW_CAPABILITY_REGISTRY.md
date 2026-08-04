# MEOW — Capability Registry

> **Document:** MEOW_CAPABILITY_REGISTRY.md
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

The Capability Registry is the canonical registry of every reusable capability in Hermes. Every capability has exactly one owner, one version, one maturity level, and one documentation reference. No duplicate capabilities exist.

---

## 2. Registry Schema

Each capability entry contains:

| Field | Type | Description |
|---|---|---|
| Name | string | Unique capability name |
| Purpose | string | What the capability does |
| Owner Department | string | Owning department |
| Owner Agent | string | Owning agent (if applicable) |
| Consumers | list | Systems/products that consume this capability |
| Dependencies | list | Other capabilities this depends on |
| Lifecycle | enum | Active / Deprecated / Planned |
| Current Version | string | Semver version |
| Certification | enum | Certified / In Progress / Not Certified |
| Health | enum | Healthy / Degraded / Unhealthy |
| Evidence | string | Link to evidence |
| Documentation | string | Link to documentation |
| Related Runtime | string | Link to runtime implementation |
| Future Provider | string | Planned provider (if any) |

---

## 3. Capability Inventory

### 3.1 Workforce Activation (WAS)

| Field | Value |
|---|---|
| Name | Workforce Activation System |
| Purpose | Activate, manage, and deactivate workforce agents |
| Owner Department | Hermes Platform |
| Owner Agent | WAS Operator |
| Consumers | EPCL, PES, Release Orchestrator |
| Dependencies | Identity Provider, Trust Layer |
| Lifecycle | Active |
| Current Version | 1.0.0 |
| Certification | Certified |
| Health | Healthy |
| Evidence | docs/ops/WAVE4_CERTIFICATION.md |
| Documentation | docs/platform/workforce-activation/WAS_ARCHITECTURE.md |
| Related Runtime | workers/src/platform/was/ |
| Future Provider | MCP (prepared, not implemented) |

### 3.2 Executive Planning & Control (EPCL)

| Field | Value |
|---|---|
| Name | Executive Planning & Control Layer |
| Purpose | Decompose initiatives, allocate tokens, execute plans |
| Owner Department | Hermes Platform |
| Owner Agent | EPCL Operator |
| Consumers | WAS, Release Orchestrator, Dashboard |
| Dependencies | WAS, Capability Registry |
| Lifecycle | Active |
| Current Version | 1.0.0 |
| Certification | Certified |
| Health | Healthy |
| Evidence | docs/ops/WAVE4_CERTIFICATION.md |
| Documentation | docs/platform/executive-planning-control/EPCL_ARCHITECTURE.md |
| Related Runtime | workers/src/platform/epcl/ |
| Future Provider | MCP (prepared, not implemented) |

### 3.3 Project State Execution Registry (PSER)

| Field | Value |
|---|---|
| Name | Project State Execution Registry |
| Purpose | Track execution state of projects and tasks |
| Owner Department | Hermes Platform |
| Owner Agent | PSER Operator |
| Consumers | EPCL, WAS |
| Dependencies | WAS, Identity Provider |
| Lifecycle | Active |
| Current Version | 1.0.0 |
| Certification | Certified |
| Health | Healthy |
| Evidence | docs/ops/WAVE4_CERTIFICATION.md |
| Documentation | docs/platform/project-state-registry/PSER_ARCHITECTURE.md |
| Related Runtime | workers/src/platform/pes/ |
| Future Provider | MCP (prepared, not implemented) |

### 3.4 Capability Registry (Meta)

| Field | Value |
|---|---|
| Name | Capability Registry |
| Purpose | Register all reusable capabilities |
| Owner Department | Hermes Platform |
| Owner Agent | Registry Operator |
| Consumers | All subsystems |
| Dependencies | None (self-referencing) |
| Lifecycle | Active |
| Current Version | 1.0.0 |
| Certification | Certified |
| Health | Healthy |
| Evidence | docs/platform/capability-registry/CAPABILITY_REGISTRY.md |
| Documentation | docs/platform/capability-registry/CAPABILITY_REGISTRY.md |
| Related Runtime | N/A (registry metadata) |
| Future Provider | Capability Broker (prepared) |

### 3.5 Trust & Identity

| Field | Value |
|---|---|
| Name | Trust & Identity Platform |
| Purpose | Authentication, authorization, identity management |
| Owner Department | Hermes Platform |
| Owner Agent | Identity Operator |
| Consumers | WAS, EPCL, PES, all runtimes |
| Dependencies | None (foundational) |
| Lifecycle | Active |
| Current Version | 1.0.0 |
| Certification | Certified |
| Health | Healthy |
| Evidence | docs/certification/SECURITY_CERTIFICATION.md |
| Documentation | docs/platform/trust-identity/TRUST_AND_IDENTITY_ARCHITECTURE.md |
| Related Runtime | workers/src/platform/identity/ |
| Future Provider | MCP (prepared, not implemented) |

### 3.6 Release Management

| Field | Value |
|---|---|
| Name | Release Management |
| Purpose | Manage release pipeline, gates, and promotion |
| Owner Department | Hermes Platform |
| Owner Agent | Release Orchestrator |
| Consumers | All products |
| Dependencies | EPCL, WAS, PSER |
| Lifecycle | Active |
| Current Version | 1.0.0 |
| Certification | Certified |
| Health | Healthy |
| Evidence | docs/ops/RELEASE_CERTIFICATION_FINAL.md |
| Documentation | docs/platform/release-management/RELEASE_MANAGEMENT_ARCHITECTURE.md |
| Related Runtime | workers/src/platform/release/ |
| Future Provider | MCP (prepared, not implemented) |

### 3.7 Provider Framework

| Field | Value |
|---|---|
| Name | Provider Framework |
| Purpose | Abstract, register, and manage external providers |
| Owner Department | Hermes Platform |
| Owner Agent | Provider Operator |
| Consumers | All subsystems |
| Dependencies | Trust & Identity |
| Lifecycle | Active |
| Current Version | 1.0.0 |
| Certification | Certified |
| Health | Healthy |
| Evidence | docs/architecture/PROVIDER_AUTHORING_GUIDE.md |
| Documentation | docs/architecture/PROVIDER_MARKETPLACE.md |
| Related Runtime | workers/src/platform/providers/ |
| Future Provider | MCP (prepared, not implemented) |

### 3.8 Governance Framework

| Field | Value |
|---|---|
| Name | Governance Framework |
| Purpose | Phase gates, decision logging, certification |
| Owner Department | Hermes Platform |
| Owner Agent | Governance Operator |
| Consumers | All subsystems |
| Dependencies | None (foundational) |
| Lifecycle | Active |
| Current Version | 1.0.0 |
| Certification | Certified |
| Health | Healthy |
| Evidence | docs/certification/GOVERNANCE_CERTIFICATION.md |
| Documentation | docs/governance/GOVERNANCE_INDEX.md |
| Related Runtime | N/A (governance metadata) |
| Future Provider | MCP (prepared, not implemented) |

### 3.9 Executive Dashboard

| Field | Value |
|---|---|
| Name | Executive Dashboard |
| Purpose | Multi-level visibility for executives |
| Owner Department | Hermes Platform |
| Owner Agent | Dashboard Operator |
| Consumers | Product Owner, Executive Leadership |
| Dependencies | All subsystems |
| Lifecycle | Active |
| Current Version | 1.0.0 |
| Certification | Certified |
| Health | Healthy |
| Evidence | docs/ops/EXECUTIVE_DASHBOARD_RELEASE.md |
| Documentation | docs/ops/EXECUTIVE_COMMAND_CENTER.md |
| Related Runtime | N/A (dashboard metadata) |
| Future Provider | MCP (prepared, not implemented) |

### 3.10 Memory & Knowledge

| Field | Value |
|---|---|
| Name | Memory & Knowledge System |
| Purpose | Persistent memory, knowledge graph, self-improvement |
| Owner Department | Hermes Platform |
| Owner Agent | Memory Operator |
| Consumers | All subsystems |
| Dependencies | None (foundational) |
| Lifecycle | Active |
| Current Version | 1.0.0 |
| Certification | Certified |
| Health | Healthy |
| Evidence | docs/KNOWLEDGE_GRAPH.md (OCI) |
| Documentation | docs/MEMORY_SCHEMA.md (OCI) |
| Related Runtime | hermes/ (OCI) |
| Future Provider | MCP (prepared, not implemented) |

---

## 4. Capability Ownership

| Capability | Owner | No Duplicate |
|---|---|---|
| WAS | Hermes Platform | ✅ |
| EPCL | Hermes Platform | ✅ |
| PSER | Hermes Platform | ✅ |
| Capability Registry | Hermes Platform | ✅ |
| Trust & Identity | Hermes Platform | ✅ |
| Release Management | Hermes Platform | ✅ |
| Provider Framework | Hermes Platform | ✅ |
| Governance Framework | Hermes Platform | ✅ |
| Executive Dashboard | Hermes Platform | ✅ |
| Memory & Knowledge | Hermes Platform | ✅ |

---

## 5. No Duplicate Capabilities

All 10 capabilities have exactly one owner. No duplicate capabilities exist.

---

*MEOW Deliverable 3 of 15*
