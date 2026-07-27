# Release Management — Platform Interfaces

> **AI Platform Capability — Platform Interface Contracts**
> All platform interfaces for the Release Management Platform.
>
> **Version:** 1.0.0 — Architecture
> **Status:** Architecture Complete
> **Last Updated:** 2026-07-27

## Governance Header

```
Company:        AGS
Platform:       AI Platform
Capability:     Release Management Platform
Document:       Platform Interfaces
Framework:      WEF v1.0 (Workforce Execution Framework)
```

---

## 1. Interface Overview

| # | Interface | Purpose | Consumers |
|---|-----------|---------|-----------|
| 1 | `ReleaseService` | End-to-end release lifecycle management | Pipeline, Operator, PSER |
| 2 | `EnvironmentService` | Environment configuration and resolution | Pipeline, Products |
| 3 | `DeploymentService` | Single environment deployment | Pipeline |
| 4 | `PromotionService` | Preview → Production promotion | Pipeline, Operator |
| 5 | `RollbackService` | Production rollback | Pipeline, Operator |
| 6 | `SmokeTestService` | Smoke test orchestration | Pipeline, Promotion Gate |
| 7 | `ReleaseRegistry` | Release metadata storage and retrieval | Pipeline, PSER, Dashboards |
| 8 | `VersionResolver` | Version source-of-truth resolution | Pipeline, Health endpoint |
| 9 | `DeploymentHistory` | Deployment audit trail | PSER, Dashboards |
| 10 | `PromotionGate` | Gate criteria evaluation | PromotionService |

---

## 2. Interface Contracts

### 2.1 ReleaseService

```typescript
interface ReleaseService {
  /**
   * Initiate a full release cycle.
   * Triggers: build → deploy (preview) → verify → promotion gate → deploy (production) → record
   */
  initiateRelease(params: {
    product: string;
    version: string;
    git_commit: string;
    branch: string;
    initiated_by: string;
  }): Promise<Release>;

  /**
   * Get current release status.
   */
  getReleaseStatus(releaseId: string): Promise<ReleaseStatus>;

  /**
   * Cancel an in-progress release.
   */
  cancelRelease(releaseId: string, reason: string): Promise<void>;

  /**
   * List releases for a product.
   */
  listReleases(product: string, options?: {
    limit?: number;
    offset?: number;
    status?: ReleaseStatus;
  }): Promise<Release[]>;
}

interface Release {
  release_id: string;
  product: string;
  version: string;
  git_commit: string;
  branch: string;
  status: "pending" | "building" | "deploying_preview" | "verifying_preview"
       | "promotion_pending" | "promoting" | "deploying_production"
       | "verifying_production" | "completed" | "failed" | "cancelled";
  stages: ReleaseStage[];
  initiated_by: string;
  initiated_at: string;
  completed_at?: string;
}

interface ReleaseStage {
  stage: "build" | "deploy_preview" | "verify_preview" | "promotion_gate"
       | "deploy_production" | "verify_production" | "record";
  status: "pending" | "in_progress" | "completed" | "failed" | "skipped";
  started_at?: string;
  completed_at?: string;
}
```

### 2.2 EnvironmentService

```typescript
interface EnvironmentService {
  /**
   * Resolve environment configuration for a product and environment.
   */
  getEnvironmentConfig(params: {
    product: string;
    environment: "development" | "preview" | "production";
  }): Promise<EnvironmentConfig>;

  /**
   * Validate environment configuration.
   */
  validateEnvironmentConfig(config: EnvironmentConfig): Promise<{
    valid: boolean;
    errors: string[];
    warnings: string[];
  }>;

  /**
   * List all configured environments for a product.
   */
  listEnvironments(product: string): Promise<EnvironmentSummary[]>;
}

interface EnvironmentConfig {
  name: string;
  api_base_url: string;
  workers: {
    name: string;
    env_name: string;
  };
  pages: {
    project: string;
    branch: string;
  };
  d1: {
    database: string;
    database_id: string;
  };
  kv: {
    namespace: string;
    namespace_id: string;
  };
  r2: {
    bucket: string;
  };
}

interface EnvironmentSummary {
  name: string;
  status: "configured" | "deployed" | "unknown";
  last_deployment?: string;
  current_version?: string;
}
```

### 2.3 DeploymentService

```typescript
interface DeploymentService {
  /**
   * Deploy to a specific environment.
   */
  deploy(params: {
    product: string;
    environment: "preview" | "production";
    version: string;
    git_commit: string;
    artifacts: {
      workers_source: string;
      pages_source: string;
    };
  }): Promise<Deployment>;

  /**
   * Get deployment status.
   */
  getDeploymentStatus(deploymentId: string): Promise<DeploymentStatus>;

  /**
   * List deployments for a product.
   */
  listDeployments(product: string, options?: {
    limit?: number;
    environment?: string;
  }): Promise<Deployment[]>;
}

interface Deployment {
  deployment_id: string;
  product: string;
  environment: string;
  version: string;
  git_commit: string;
  status: "pending" | "in_progress" | "completed" | "failed" | "rolled_back";
  workers_deployment_id?: string;
  pages_deployment_id?: string;
  d1_migrations_applied: number;
  deployed_at?: string;
  deployed_by?: string;
  rollback_checkpoint_id?: string;
}
```

### 2.4 PromotionService

```typescript
interface PromotionService {
  /**
   * Request promotion from Preview to Production.
   */
  requestPromotion(params: {
    deployment_id: string;
    product: string;
    version: string;
    git_commit: string;
    requested_by: string;
  }): Promise<PromotionRequest>;

  /**
   * Evaluate promotion gate criteria.
   */
  evaluateGate(promotionId: string): Promise<PromotionGateEvaluation>;

  /**
   * Approve or deny a promotion request.
   */
  approvePromotion(promotionId: string, approvedBy: string, reason?: string): Promise<PromotionResult>;
  denyPromotion(promotionId: string, deniedBy: string, reason: string): Promise<void>;

  /**
   * Get promotion request status.
   */
  getPromotionStatus(promotionId: string): Promise<PromotionStatus>;
}

interface PromotionRequest {
  promotion_id: string;
  deployment_id: string;
  product: string;
  from_environment: string;
  to_environment: string;
  version: string;
  git_commit: string;
  status: "pending_gate" | "gate_evaluating" | "gate_passed" | "gate_failed"
       | "pending_approval" | "approved" | "denied" | "expired";
  requested_by: string;
  requested_at: string;
  approved_by?: string;
  approved_at?: string;
  expires_at: string;
}

interface PromotionResult {
  promotion_id: string;
  status: "approved" | "denied";
  deployment_id: string;
  production_deployment_id?: string;
}
```

### 2.5 RollbackService

```typescript
interface RollbackService {
  /**
   * Request a rollback.
   */
  requestRollback(params: {
    product: string;
    environment: string;
    reason: string;
    target_version?: string;         // Omit for automatic previous version
    requested_by: string;
  }): Promise<RollbackRequest>;

  /**
   * Get rollback checkpoint for a deployment.
   */
  getCheckpoint(deploymentId: string): Promise<RollbackCheckpoint | null>;

  /**
   * Get the latest rollback checkpoint for an environment.
   */
  getLatestCheckpoint(product: string, environment: string): Promise<RollbackCheckpoint | null>;

  /**
   * Execute a rollback.
   */
  executeRollback(rollbackId: string, approvedBy: string): Promise<RollbackResult>;
}

interface RollbackRequest {
  rollback_id: string;
  product: string;
  environment: string;
  status: "pending_approval" | "approved" | "denied" | "in_progress" | "completed" | "failed";
  current_version: string;
  target_version: string;
  reason: string;
  requested_by: string;
  requested_at: string;
  approved_by?: string;
  checkpoint_id?: string;
}

interface RollbackResult {
  rollback_id: string;
  status: "completed" | "failed";
  resolved_version: string;
  health_check_passed: boolean;
  smoke_tests_passed: boolean;
  completed_at: string;
}

interface RollbackCheckpoint {
  checkpoint_id: string;
  deployment_id: string;
  product: string;
  environment: string;
  current_version: string;
  current_git_commit: string;
  current_worker_deployment: string;
  current_pages_deployment: string;
  current_d1_migrations: number;
  captured_at: string;
  captured_by: string;
}
```

### 2.6 SmokeTestService

```typescript
interface SmokeTestService {
  /**
   * Run smoke tests against an environment.
   */
  runSmokeTests(params: {
    base_url: string;
    environment: string;
    product: string;
  }): Promise<SmokeTestSuite>;

  /**
   * Get smoke test results for a deployment.
   */
  getSmokeTestResults(deploymentId: string): Promise<SmokeTestSuite | null>;

  /**
   * Register a smoke test suite for a product.
   */
  registerSmokeTestSuite(product: string, testSuite: SmokeTestDefinition): Promise<void>;
}

interface SmokeTestSuite {
  name: string;
  environment: string;
  product: string;
  results: SmokeTestResult[];
  passed: boolean;
  duration_ms: number;
  timestamp: string;
}

interface SmokeTestResult {
  name: string;
  passed: boolean;
  status: number;
  duration_ms?: number;
  details?: Record<string, unknown>;
}

interface SmokeTestDefinition {
  name: string;
  description: string;
  endpoint: string;
  method: "GET" | "POST" | "OPTIONS";
  expected_status: number[];
  timeout_ms: number;
}
```

### 2.7 ReleaseRegistry

```typescript
interface ReleaseRegistry {
  /**
   * Record a release.
   */
  recordRelease(release: Release): Promise<void>;

  /**
   * Get release by ID.
   */
  getRelease(releaseId: string): Promise<Release | null>;

  /**
   * Get latest release for a product.
   */
  getLatestRelease(product: string): Promise<Release | null>;

  /**
   * Query releases.
   */
  queryReleases(filter: {
    product?: string;
    version?: string;
    status?: ReleaseStatus;
    from_date?: string;
    to_date?: string;
    limit?: number;
  }): Promise<Release[]>;
}
```

### 2.8 VersionResolver

```typescript
interface VersionResolver {
  /**
   * Resolve the current version from CHANGELOG.md.
   */
  resolveCurrentVersion(): Promise<string>;

  /**
   * Validate a version string.
   */
  validateVersion(version: string): boolean;

  /**
   * Compare two versions.
   * Returns: -1 if a < b, 0 if a === b, 1 if a > b
   */
  compareVersions(a: string, b: string): number;

  /**
   * Get the next version based on the version scheme.
   */
  getNextVersion(current: string, bump: "major" | "minor" | "patch"): string;
}
```

### 2.9 DeploymentHistory

```typescript
interface DeploymentHistory {
  /**
   * Record a deployment event.
   */
  recordDeployment(deployment: Deployment): Promise<void>;

  /**
   * Get deployment history for a product.
   */
  getDeploymentHistory(product: string, options?: {
    limit?: number;
    environment?: string;
    from_date?: string;
    to_date?: string;
  }): Promise<Deployment[]>;

  /**
   * Get deployment by ID.
   */
  getDeployment(deploymentId: string): Promise<Deployment | null>;

  /**
   * Get the current active deployment for a product and environment.
   */
  getCurrentDeployment(product: string, environment: string): Promise<Deployment | null>;
}
```

### 2.10 PromotionGate

```typescript
interface PromotionGate {
  /**
   * Evaluate all gate criteria for a promotion.
   */
  evaluate(params: {
    promotion_id: string;
    product: string;
    version: string;
    git_commit: string;
    preview_url: string;
  }): Promise<PromotionGateEvaluation>;

  /**
   * Get gate criteria definitions.
   */
  getCriteria(): Promise<PromotionGateCriterion[]>;

  /**
   * Override a criterion (emergency only).
   */
  overrideCriterion(criterionId: string, reason: string, overriddenBy: string): Promise<void>;
}

interface PromotionGateEvaluation {
  gate_id: string;
  promotion_id: string;
  product: string;
  version: string;
  criteria: {
    id: string;
    description: string;
    status: "met" | "unmet" | "waived";
    evidence?: string;
    verified_at?: string;
  }[];
  overall: "pass" | "fail";
  evaluated_at: string;
  summary: string;
}

interface PromotionGateCriterion {
  id: string;
  description: string;
  verification_method: string;
  required: boolean;
  waiver_allowed: boolean;
  order: number;
}
```

---

## 3. Interface Dependencies

```
ReleaseService
  ├── DeploymentService
  ├── PromotionService
  │     ├── PromotionGate
  │     └── SmokeTestService
  ├── RollbackService
  ├── ReleaseRegistry
  ├── VersionResolver
  └── EnvironmentService

PromotionService
  ├── SmokeTestService
  └── PromotionGate

RollbackService
  └── ReleaseRegistry
      └── DeploymentHistory
```

---

## 4. Implementation Notes

| Interface | Implementation Priority | Notes |
|-----------|------------------------|-------|
| `VersionResolver` | P0 | Exists as health endpoint — formalize interface |
| `ReleaseRegistry` | P1 | D1-backed, KV-cached |
| `DeploymentService` | P1 | Wraps wrangler CLI |
| `EnvironmentService` | P1 | Config-driven |
| `SmokeTestService` | P1 | Test runner + result aggregator |
| `DeploymentHistory` | P1 | D1-backed |
| `PromotionGate` | P2 | Gate criteria engine |
| `PromotionService` | P2 | Orchestrates promotion flow |
| `RollbackService` | P2 | Checkpoint + recovery |
| `ReleaseService` | P2 | Top-level orchestrator |

---

*Release Management Platform — AI Platform Capability*
*Platform Interfaces — v1.0.0*
*Last updated: 2026-07-27*