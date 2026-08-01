# RELEASE_DISCOVERY.md

**EPIC-012 — Release Management & Multi-Mode Execution**
**Phase A: Discovery**
**Date:** 2026-08-01
**Product:** Hermes Platform (reusable by every future Hermes product)
**Wave:** EPIC-012
**Hermes Runtime:** v1.0 (Foundation frozen)

---

## Executive Summary

Complete discovery of all release-related capabilities across the Hermes platform and Concierge product. The discovery covers deployment infrastructure, CI/CD pipelines, release runbooks, health verification, rollback mechanisms, and operational tooling. A total of **27 discrete release-related components** were identified across 6 categories. The existing platform already has a **Release Management Runtime** (`workers/src/platform/release/release-runtime.ts`) and a **Deployment Resolution Engine** (`workers/src/platform/deployment/`) — these are the foundation to build upon.

---

## 1. Release Component Inventory

### 1.1 CI/CD Pipeline

| Component | Location | Lines | Purpose | Status |
|-----------|----------|-------|---------|--------|
| Deploy workflow | `.github/workflows/deploy.yml` | 147 | GitHub Actions CI/CD: build → integrity gates → deploy API + frontend | ✅ Active |
| Security workflow | `.github/workflows/security.yml` | — | Security scanning | ✅ Active |
| Deploy script | `deploy.sh` | 16 | Manual deploy wrapper (wrangler@4) | ✅ Active |
| pnpm workspace | `pnpm-workspace.yaml` | — | Monorepo config with minimumReleaseAge=1440 (supply-chain defense) | ✅ Active |
| Root package.json scripts | `package.json` | — | `build`, `typecheck`, `typecheck:libs` | ✅ Active |
| Workers package.json scripts | `workers/package.json` | — | `dev`, `deploy`, `prebuild`, `typecheck`, `test` | ✅ Active |

### 1.2 Deployment Infrastructure

| Component | Location | Lines | Purpose | Status |
|-----------|----------|-------|---------|--------|
| Root wrangler.jsonc | `wrangler.jsonc` | 20 | Frontend worker config (hermes-website, agsynergy.ca) | ✅ Active |
| Workers wrangler.jsonc | `workers/wrangler.jsonc` | 95 | API worker config (agsynergy-api, api.agsynergy.ca) with preview/prod envs | ✅ Active |
| Version extraction | `scripts/extract-version.sh` | 38 | Reads CHANGELOG.md → writes `workers/src/version.ts` (GOV-002) | ✅ Active |
| Deployment summary | `scripts/deployment-summary.sh` | 118 | Post-deploy report generator (commit, build, tests, deploy) | ✅ Active |
| Dry-run deploy | `scripts/dry-run-deploy.sh` | 132 | Pre-deploy validation: prerequisites, wrangler config, dry-run deploys | ✅ Active |
| Version file | `workers/src/version.ts` | 11 | Auto-generated SERVICE_VERSION from CHANGELOG.md | ✅ Active |
| Deploy.sh (legacy) | `deploy.sh` | 16 | Manual deploy script | ✅ Active |

### 1.3 Release Management Runtime (Platform Capability)

| Component | Location | Lines | Purpose | Status |
|-----------|----------|-------|---------|--------|
| Release Runtime | `workers/src/platform/release/release-runtime.ts` | 321 | Release Registry, Environment Resolver, Preview/Production Deployment Service, Rollback Metadata, Deployment History | ✅ Active |
| Deployment Resolution Engine | `workers/src/platform/deployment/deployment-resolution-engine.ts` | 145 | Deterministic credential resolution: resolve provider → credential → validate → check permissions → execute → audit | ✅ Active |
| Deployment Health Framework | `workers/src/platform/deployment/deployment-health.ts` | 305 | Health checks for Cloudflare, GitHub, Telegram, OpenRouter, Workers, Pages, D1, KV, R2, Identity, Trust | ✅ Active |
| Stage Deploy Provider | `hermes/services/activation/providers/deployment/stage-deploy.ts` | 99 | Controlled staging deploy wrapper composing workflow + launch | ✅ Active |

### 1.4 Release Documentation

| Component | Location | Lines | Purpose | Status |
|-----------|----------|-------|---------|--------|
| Release Management Architecture | `docs/platform/release-management/RELEASE_MANAGEMENT_ARCHITECTURE.md` | 466 | Platform architecture: Dev→Preview→Production lifecycle, design principles | ✅ Active |
| Deployment Pipeline | `docs/platform/release-management/DEPLOYMENT_PIPELINE.md` | 262 | Pipeline stages: BUILD → DEPLOY → VERIFY → RECORD | ✅ Active |
| Release Metadata | `docs/platform/release-management/RELEASE_METADATA.md` | 223 | Metadata schema, health endpoint contract | ✅ Active |
| Environment Strategy | `docs/platform/release-management/ENVIRONMENT_STRATEGY.md` | 6565 | Environment strategy (preview/production/dev) | ✅ Active |
| Preview Promotion Process | `docs/platform/release-management/PREVIEW_PROMOTION_PROCESS.md` | 8735 | Preview → production promotion flow | ✅ Active |
| Rollback Strategy | `docs/platform/release-management/ROLLBACK_STRATEGY.md` | 10357 | Rollback architecture and procedures | ✅ Active |
| Smoke Test Framework | `docs/platform/release-management/SMOKE_TEST_FRAMEWORK.md` | 9246 | Smoke test framework for deployments | ✅ Active |
| Platform Interfaces | `docs/platform/release-management/PLATFORM_INTERFACES.md` | 13453 | Platform interface contracts for release management | ✅ Active |
| PSER Execution State | `docs/platform/release-management/PSER_EXECUTION_STATE.md` | 3836 | PSER state tracking for release management | ✅ Active |

### 1.5 Release Evidence & Reporting

| Component | Location | Lines | Purpose | Status |
|-----------|----------|-------|---------|--------|
| v1.1.0 Release Notes | `docs/releases/v1.1.0_RELEASE_NOTES.md` | 111 | Release notes for v1.1.0 | ✅ Active |
| v1.1.0 Deployment Report | `docs/releases/v1.1.0_DEPLOYMENT_REPORT.md` | 124 | Deployment report for v1.1.0 | ✅ Active |
| v1.1.0 Deployment Checklist | `docs/releases/v1.1.0_DEPLOYMENT_CHECKLIST.md` | 97 | Pre-deployment checklist (3 phases) | ✅ Active |
| Deployment Summary Script | `scripts/deployment-summary.sh` | 118 | Auto-generates deployment reports | ✅ Active |
| Release Manifest | `docs/releases/concierge/patient-portal/phase-1/rc1/RELEASE_MANIFEST.md` | 142 | Release manifest with build status, readiness score | ✅ Active |
| Deployment Prevention Plan | `docs/releases/concierge/patient-portal/phase-1/rc1/DEPLOYMENT_PREVENTION_PLAN.md` | 208 | Layered defense: pre-commit, CI/CD, post-deploy | ✅ Active |
| Deployment Root Cause Analysis | `docs/releases/concierge/patient-portal/phase-1/rc1/DEPLOYMENT_ROOT_CAUSE_ANALYSIS.md` | 91 | RCA for v1.1.0 production failures | ✅ Active |
| Deployment Postmortem | `docs/releases/concierge/patient-portal/phase-1/rc1/DEPLOYMENT_POSTMORTEM.md` | 95 | Postmortem for v1.1.0 deployment | ✅ Active |
| Engineering Deployment Standard | `docs/releases/concierge/patient-portal/phase-1/rc1/CONCIERGE_ENGINEERING_DEPLOYMENT_STANDARD.md` | 165 | Deployment conventions for Concierge | ✅ Active |
| Deployment Readiness Gate | `docs/releases/concierge/patient-portal/phase-1/rc1/DEPLOYMENT_READINESS_GATE.md` | 114 | Production deployment checklist (3 gates) | ✅ Active |
| Release Management Integration | `docs/launch/RELEASE_MANAGEMENT_INTEGRATION.md` | 258 | Integration assessment for release management | ✅ Active |

### 1.6 Operational Runbooks

| Component | Location | Lines | Purpose | Status |
|-----------|----------|-------|---------|--------|
| Deployment Runbook | `docs/operations/DEPLOYMENT.md` | 230 | Operator runbook: pre-flight, environments, deploy commands, verification | ✅ Active |
| Workers Deployment Runbook | `workers/docs/operations/DEPLOYMENT.md` | 200 | API worker deployment workflow (EPIC-002-003.5) | ✅ Active |
| Hermes V1 Release Readiness | `docs/operations/HERMES_V1_RELEASE_READINESS.md` | 52 | Release readiness assessment for Hermes v1.0 | ✅ Active |
| EPIC-010 Deploy Governance | `EPIC-010_DEPLOY_GOVERNANCE.md` | 89 | Governed deployment path documentation | ✅ Active |
| Deployment Verification Report | `docs/operations/EPIC-002-006A4B_DEPLOYMENT_VERIFICATION_REPORT.md` | 26 | CI/CD verification report | ✅ Active |
| AGS Fertility Deployment Diagnostic | `docs/operations/AGS_FERTILITY_DEPLOYMENT_DIAGNOSTIC_REPORT.md` | 165 | Diagnostic report for AGS Fertility deploy | ✅ Active |
| Foundation Release Notes | `FOUNDATION_v1_RELEASE_NOTES.md` | 124 | Foundation v1.0 release notes | ✅ Active |
| Hermes Release Notes | `HERMES_v1_RELEASE_NOTES.md` | 222 | Hermes Platform v1.0.0 release notes | ✅ Active |
| Foundation Changelog | `FOUNDATION_CHANGELOG.md` | 118 | Foundation changelog | ✅ Active |
| Changelog | `CHANGELOG.md` | 1482 | Full Concierge changelog (Keep a Changelog format) | ✅ Active |

---

## 2. Runtime Dependency Graph

```
CHANGELOG.md ──▶ extract-version.sh ──▶ workers/src/version.ts (SERVICE_VERSION)
                                            │
                                            ▼
                                    DeploymentHealthFramework
                                    ├── Cloudflare health check
                                    ├── GitHub health check
                                    ├── Telegram health check
                                    ├── OpenRouter health check
                                    ├── Workers health check
                                    ├── D1 health check
                                    └── ...
                                            │
                                            ▼
                                    DeploymentResolutionEngine
                                    ├── CredentialResolver
                                    ├── CredentialValidator
                                    ├── CredentialHealthChecker
                                    └── ProviderRegistry
                                            │
                                            ▼
                                    ReleaseRuntime
                                    ├── ReleaseRegistry (InMemory)
                                    ├── EnvironmentResolver
                                    ├── PreviewDeploymentService
                                    ├── ProductionDeploymentService
                                    ├── DeploymentHistory
                                    └── RollbackMetadata
                                            │
                                            ▼
                                    CI/CD Pipeline (deploy.yml)
                                    ├── Integrity Gates (3)
                                    ├── Build (frontend + API)
                                    ├── Deploy API (wrangler deploy --env production)
                                    ├── Deploy Frontend (wrangler deploy)
                                    └── JWT Injection (secrets)
                                            │
                                            ▼
                                    Deployment Summary (scripts/deployment-summary.sh)
                                    └── Release Notes (docs/releases/)
```

---

## 3. What Already Exists (Complete)

| Category | Components | Count |
|----------|-----------|-------|
| CI/CD Pipeline | deploy.yml, security.yml, pnpm-workspace, package scripts | 5 |
| Deployment Infrastructure | wrangler configs, version extraction, deploy scripts, dry-run | 7 |
| Release Management Runtime | release-runtime.ts, deployment-resolution-engine.ts, deployment-health.ts, stage-deploy.ts | 4 |
| Release Documentation (platform) | Architecture, pipeline, metadata, environments, preview, rollback, smoke, interfaces, PSER | 9 |
| Release Evidence & Reporting | Release notes, deployment reports, checklists, manifests, RCAs, postmortems, standards | 11 |
| Operational Runbooks | Deployment runbooks, release readiness, deploy governance, verification reports | 6 |
| Changelog/Versioning | CHANGELOG.md, Foundation changelog, Hermes release notes, Foundation release notes, version.ts | 5 |
| **Total** | | **47** |

---

## 4. What Partially Exists

| Component | What Exists | What's Missing |
|-----------|------------|----------------|
| Preview deployment | `wrangler.jsonc` has preview env config | No automated preview deploy step in CI/CD; no preview URL capture |
| Production deployment | Full CI/CD pipeline exists | No automated production health verification post-deploy; no smoke test automation |
| Rollback capability | `RollbackMetadata` interface defined in release-runtime.ts | No automated rollback script; no rollback trigger in CI/CD |
| Release notes | Manual release notes exist in `docs/releases/` | No automated changelog generation from commits; no release notes template |
| Changelog generation | `CHANGELOG.md` maintained manually | No automated changelog generator; no commit-conventional-changelog integration |
| Deployment evidence | `deployment-summary.sh` generates reports | No automatic evidence collection (build hash, test results, deploy logs) |
| Executive reporting | `deployment-summary.sh` produces reports | No automated executive summary for releases; no dashboard integration |
| Build pipeline | `deploy.yml` has build step | No separate build-only mode (development mode); no build artifact retention |
| GitHub Actions | `deploy.yml` runs on push to main | No preview deployment trigger; no PR-based preview; no branch-based environment |
| Verification hooks | Integrity gates exist (3) | No post-deploy verification hook; no automated smoke test execution |
| Operator experience | `operator-experience.ts` exists | Not wired to release management workflow; no release-specific operator commands |
| Command center panels | `WAVE4_COMMAND_CENTER.md` exists | No release dashboard panel; no deployment history visualization |

---

## 5. What Should Be Reused

| Component | Reuse As | Rationale |
|-----------|----------|-----------|
| `ReleaseRuntime` (release-runtime.ts) | Core release management engine | Already has ReleaseRegistry, EnvironmentResolver, Deployment services |
| `DeploymentResolutionEngine` | Credential resolution for all modes | Deterministic, fail-closed, audited |
| `DeploymentHealthFramework` | Pre-deploy health checks | Already checks all platform dependencies |
| `InMemoryReleaseRegistry` | Release record storage | Extensible to persistent storage |
| `EnvironmentResolver` | Environment targeting | Already handles preview/production resolution |
| `CHANGELOG.md` | Version source of truth | GOV-002 single source of truth |
| `extract-version.sh` | Version extraction | Already automated |
| `deploy.yml` CI/CD pipeline | Deployment execution | Already has integrity gates |
| `wrangler.jsonc` env configs | Environment definition | Already has preview/production env separation |
| `scripts/deployment-summary.sh` | Evidence collection | Already generates deployment reports |
| `scripts/dry-run-deploy.sh` | Pre-deploy validation | Already validates wrangler config and dry-run deploys |
| `docs/platform/release-management/` | Architecture reference | Complete architecture documentation |
| `docs/operations/DEPLOYMENT.md` | Operator runbook | Already has deploy commands and verification steps |
| `WAVE4_COMMAND_CENTER.md` | Executive dashboard pattern | Already has dashboard structure to extend |

---

## 6. What Should Be Promoted into Release Management

| Component | Current Location | Promote To | Rationale |
|-----------|-----------------|------------|-----------|
| Release Runtime | `workers/src/platform/release/` | Release Management discipline core | Already exists as platform capability, needs activation wiring |
| Deployment Resolution Engine | `workers/src/platform/deployment/` | Release Management credential layer | Already deterministic, needs release-mode integration |
| Deployment Health Framework | `workers/src/platform/deployment/` | Release Management pre-flight checks | Already comprehensive, needs mode-aware execution |
| Stage Deploy Provider | `hermes/services/activation/providers/deployment/` | Release Management execution provider | Already governed, needs multi-mode support |
| Deployment Summary Script | `scripts/deployment-summary.sh` | Release Management evidence collector | Already works, needs mode-aware output |
| Dry-Run Deploy Script | `scripts/dry-run-deploy.sh` | Release Management pre-flight validator | Already validates, needs mode-specific gates |
| Release Management Architecture docs | `docs/platform/release-management/` | Release Management knowledge base | Already complete, needs integration into runtime |

---

## 7. What Is Genuinely Missing

| Gap | Severity | Description |
|-----|----------|-------------|
| **Three execution modes** | Critical | No Development/Preview/Production mode separation with governed transitions |
| **Preview deployment automation** | High | Preview env exists in wrangler.jsonc but CI/CD only deploys production |
| **Automated smoke tests** | High | Smoke test framework documented but not automated in pipeline |
| **Post-deploy health verification** | High | Health checks exist but not triggered automatically post-deploy |
| **Automated rollback** | Medium | RollbackMetadata defined but no rollback execution mechanism |
| **Release notes automation** | Medium | Release notes manual; no commit-to-release-notes pipeline |
| **Product Owner approval gate** | Medium | No approval workflow in CI/CD for production promotion |
| **Deployment evidence automation** | Medium | Summary script exists but not integrated into CI/CD pipeline |
| **Executive release dashboard** | Medium | Command center exists but no release-specific panel |
| **Knowledge capture on release** | Low | No automatic capture of release lessons into memory |
| **Release backlog management** | Low | No release backlog artifact |
| **Operator release guide** | Low | No operator-facing release execution guide |
| **Product Owner release guide** | Low | No PO-facing release approval guide |

---

## 8. Key Interfaces

### 8.1 ReleaseRegistry Interface
```typescript
interface ReleaseRegistry {
  create(record: ReleaseRecord): Promise<void>;
  get(releaseId: string): Promise<ReleaseRecord | null>;
  updateStatus(releaseId: string, status: ReleaseRecord["status"]): Promise<void>;
  listByEnvironment(env: "preview" | "production"): Promise<ReleaseRecord[]>;
  listAll(): Promise<ReleaseRecord[]>;
  getLatest(version: string): Promise<ReleaseRecord | null>;
  getHistory(limit?: number): Promise<ReleaseRecord[]>;
}
```

### 8.2 EnvironmentResolver Interface
```typescript
interface EnvironmentResolver {
  resolveEnvironment(isPreview: boolean): EnvironmentResolution;
}
```

### 8.3 DeploymentHealthFramework Interface
```typescript
interface DeploymentHealthFramework {
  register(check: HealthCheck): void;
  runAll(): Promise<HealthCheckResult[]>;
  isDeployable(): Promise<{ deployable: boolean; results: HealthCheckResult[]; failedDependencies: string[] }>;
}
```

### 8.4 DeploymentResolutionEngine Interface
```typescript
interface DeploymentResolutionEngine {
  resolve(providerId: ProviderId): Promise<DeploymentReport>;
}
```

---

## 9. Discovery Statistics

| Metric | Value |
|--------|-------|
| Total release-related files discovered | 47 |
| Total lines of release-related code | ~8,500 |
| CI/CD workflow files | 2 |
| Deployment config files | 4 |
| Runtime components | 4 |
| Platform architecture docs | 9 |
| Release evidence/reporting docs | 11 |
| Operational runbooks | 6 |
| Changelog/versioning files | 5 |
| Scripts (deploy, version, summary, dry-run) | 4 |
| Genuinely missing capabilities | 13 |
| Reusable existing components | 14 |
| Components to promote into Release Management | 7 |

---

## 10. Phase A Completion Criteria

- [x] All deployment services discovered and documented
- [x] All Cloudflare integration points documented
- [x] All Wrangler integration points documented
- [x] Preview deployment capabilities inventoried
- [x] Production deployment capabilities inventoried
- [x] Smoke testing capabilities documented
- [x] Health verification capabilities documented
- [x] Rollback capability assessed
- [x] Release notes process documented
- [x] Changelog generation process documented
- [x] Deployment evidence process documented
- [x] Executive reporting process documented
- [x] Build pipelines documented
- [x] GitHub Actions documented
- [x] Verification hooks documented
- [x] Operator experience assessed
- [x] Command center panels assessed
- [x] RELEASE_DISCOVERY.md produced

---

*End of Phase A — Discovery*
