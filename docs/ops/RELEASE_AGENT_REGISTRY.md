# RELEASE_AGENT_REGISTRY.md

**EPIC-012 — Release Management & Multi-Mode Execution**
**Phase D: Agents**
**Date:** 2026-08-01
**Product:** Hermes Platform (reusable by every future Hermes product)
**Wave:** EPIC-012
**Hermes Runtime:** v1.0 (Foundation frozen)

---

## Executive Summary

Release Agent Registry defines the agents that execute release management operations. Every agent belongs to the Release Department and follows the standard EPCL → Department → Agent → Skill → Capability execution path. All agents reuse existing Hermes platform capabilities — no new agent types, no foundation modifications.

---

## 1. Agent Registry — Release Department

### 1.1 Agent Registry Pattern (from AGENT_REGISTRY.md)

Every agent entry follows the standard schema:

| Field | Description |
|-------|-------------|
| **Agent ID** | Unique identifier within the department |
| **Purpose** | What the agent does |
| **Inputs** | What the agent receives |
| **Outputs** | What the agent produces |
| **Skills** | Skills the agent loads |
| **Capabilities** | Capabilities the agent uses |
| **Activation Policy** | When the agent activates |
| **Lifecycle** | Agent state transitions |
| **Verification** | How agent output is validated |

### 1.2 Release Department Agents

#### Release Coordinator Agent

| Field | Value |
|-------|-------|
| **Agent ID** | `release-coordinator` |
| **Purpose** | Orchestrate the complete release lifecycle across all execution modes |
| **Inputs** | Release plan (mode, target, version), Product Owner approval signal |
| **Outputs** | Release execution plan, coordination log, release summary |
| **Skills** | `release-planning`, `release-coordinate`, `release-verify` |
| **Capabilities** | ReleaseRegistry, EnvironmentResolver, DeploymentResolutionEngine |
| **Activation Policy** | On EPCL release phase dispatch |
| **Lifecycle** | PENDING → ACTIVATING → ACTIVE → COMPLETE → ARCHIVE |
| **Verification** | Release record created in ReleaseRegistry; all mode gates passed |

#### Deployment Agent

| Field | Value |
|-------|-------|
| **Agent ID** | `deployment-agent` |
| **Purpose** | Execute deployments per execution mode with integrity gate enforcement |
| **Inputs** | Deployment target (mode + environment), build artifacts, credentials |
| **Outputs** | Deployment result (success/failure), deploy log, deployment metadata |
| **Skills** | `wrangler-deploy`, `integrity-gates`, `credential-resolution`, `build-artifacts` |
| **Capabilities** | DeploymentResolutionEngine, DeploymentHealthFramework, StageDeployProvider |
| **Activation Policy** | On Release Coordinator dispatch |
| **Lifecycle** | PENDING → ACTIVATING → ACTIVE → COMPLETE → ARCHIVE |
| **Verification** | Deploy exit code 0; integrity gates passed; health checks passed |

#### Health Verification Agent

| Field | Value |
|-------|-------|
| **Agent ID** | `health-verifier` |
| **Purpose** | Run pre-deploy health checks and post-deploy smoke tests |
| **Inputs** | Deployment target, health check configuration, smoke test suite |
| **Outputs** | Health check results, smoke test results, verification report |
| **Skills** | `health-check`, `smoke-test`, `dependency-verify`, `post-deploy-verify` |
| **Capabilities** | DeploymentHealthFramework, Smoke Test Framework |
| **Activation Policy** | Pre-deploy (gate) and post-deploy (verification) |
| **Lifecycle** | PENDING → ACTIVATING → ACTIVE → COMPLETE → ARCHIVE |
| **Verification** | All health checks pass; all smoke tests pass; verification report generated |

#### Rollback Agent

| Field | Value |
|-------|-------|
| **Agent ID** | `rollback-agent` |
| **Purpose** | Monitor deployment health and execute rollback on failure |
| **Inputs** | Deployment record, health check results, rollback configuration |
| **Outputs** | Rollback result (success/failure), rollback metadata, rollback report |
| **Skills** | `rollback-execute`, `rollback-verify`, `rollback-audit` |
| **Capabilities** | ReleaseRegistry (rollback metadata), DeploymentHistory |
| **Activation Policy** | On post-deploy health check failure |
| **Lifecycle** | PENDING → ACTIVATING → ACTIVE → COMPLETE → ARCHIVE |
| **Verification** | Rollback completed; previous version restored; rollback record in ReleaseRegistry |

#### Release Notes Agent

| Field | Value |
|-------|-------|
| **Agent ID** | `release-notes-agent` |
| **Purpose** | Generate release notes, capture deployment evidence, publish release documentation |
| **Inputs** | Release record, deployment evidence, CHANGELOG.md |
| **Outputs** | Release notes document, evidence package, executive summary |
| **Skills** | `changelog-parse`, `release-notes-generate`, `evidence-collect`, `report-generate` |
| **Capabilities** | ReleaseRegistry (release record), DeploymentHistory (deployment records) |
| **Activation Policy** | On release completion (all gates passed) |
| **Lifecycle** | PENDING → ACTIVATING → ACTIVE → COMPLETE → ARCHIVE |
| **Verification** | Release notes published; evidence package complete; executive summary generated |

---

## 2. Agent-to-Skill Mapping

### 2.1 Release Coordinator Skills

| Skill | Source | Purpose |
|-------|--------|---------|
| `release-planning` | New (EPIC-012) | Parse release plan, identify mode, target, gates |
| `release-coordinate` | New (EPIC-012) | Coordinate deployment agents across modes |
| `release-verify` | New (EPIC-012) | Verify release completion, validate evidence |

### 2.2 Deployment Agent Skills

| Skill | Source | Purpose |
|-------|--------|---------|
| `wrangler-deploy` | Existing (deploy-website skill) | Execute wrangler deploy per mode |
| `integrity-gates` | Existing (repo-integrity-check, required-files-check, import-integrity-check) | Run pre-deploy integrity gates |
| `credential-resolution` | Existing (DeploymentResolutionEngine) | Resolve and validate deployment credentials |
| `build-artifacts` | Existing (pnpm build) | Build frontend and API artifacts |

### 2.3 Health Verification Agent Skills

| Skill | Source | Purpose |
|-------|--------|---------|
| `health-check` | Existing (DeploymentHealthFramework) | Run pre-deploy and post-deploy health checks |
| `smoke-test` | Existing (Smoke Test Framework) | Execute post-deploy smoke tests |
| `dependency-verify` | Existing (DeploymentHealthFramework) | Verify all dependencies are healthy |
| `post-deploy-verify` | New (EPIC-012) | Run post-deploy verification specific to mode |

### 2.4 Rollback Agent Skills

| Skill | Source | Purpose |
|-------|--------|---------|
| `rollback-execute` | New (EPIC-012) | Execute rollback to previous release |
| `rollback-verify` | New (EPIC-012) | Verify rollback success |
| `rollback-audit` | New (EPIC-012) | Record rollback in audit trail |

### 2.5 Release Notes Agent Skills

| Skill | Source | Purpose |
|-------|--------|---------|
| `changelog-parse` | New (EPIC-012) | Parse CHANGELOG.md for release entries |
| `release-notes-generate` | New (EPIC-012) | Generate structured release notes |
| `evidence-collect` | New (EPIC-012) | Collect deployment evidence artifacts |
| `report-generate` | Existing (deployment-summary.sh) | Generate deployment report |

---

## 3. Agent Activation Flow

```
EPCL releases release plan
    │
    ▼
Release Coordinator activates
    │
    ├──▶ Deployment Agent: build + deploy (per mode)
    │       │
    │       ├──▶ Health Verification Agent: pre-deploy health check
    │       │       │
    │       │       └── PASS → proceed
    │       │       └── FAIL → block deployment
    │       │
    │       ├──▶ Deploy (wrangler per mode)
    │       │
    │       └──▶ Health Verification Agent: post-deploy smoke test
    │               │
    │               └── PASS → proceed
    │               └── FAIL → trigger Rollback Agent
    │
    ├──▶ Rollback Agent (on failure)
    │       │
    │       └── Execute rollback → verify → record
    │
    └──▶ Release Notes Agent (on success)
            │
            └── Generate notes → collect evidence → publish
```

---

## 4. Agent Lifecycle (WAS-Aligned)

All release agents follow the WAS activation state machine:

```
PENDING → ACTIVATING → ACTIVE → COMPLETE → ARCHIVE
  │           │              │
  │           │              └── On failure → FAILED
  │           │
  │           └── On gate failure → REJECTED
  │
  └── On dispatch from EPCL
```

| Agent | PENDING Trigger | ACTIVATING Action | ACTIVE Action | COMPLETE Condition |
|-------|----------------|-------------------|---------------|-------------------|
| Release Coordinator | EPCL release plan dispatch | Load release plan, validate gates | Coordinate deployment agents | All agents completed |
| Deployment Agent | Release Coordinator dispatch | Resolve credentials, run integrity gates | Execute deploy per mode | Deploy exit code 0 |
| Health Verification Agent | Deployment Agent dispatch | Run health checks | Run smoke tests | All checks pass |
| Rollback Agent | Health Verification Agent failure | Identify previous release | Execute rollback | Previous version restored |
| Release Notes Agent | Deployment Agent completion | Collect evidence | Generate notes | Notes published |

---

## 5. Phase D Completion Criteria

| # | Deliverable | Status |
|---|------------|--------|
| 1 | Release Department agents defined (5 agents) | ✅ Complete |
| 2 | Agent-to-skill mapping documented | ✅ Complete |
| 3 | Agent activation flow documented | ✅ Complete |
| 4 | Agent lifecycle aligned with WAS state machine | ✅ Complete |
| 5 | RELEASE_AGENT_REGISTRY.md produced | ✅ Complete |

---

*End of Phase D — Agents*
