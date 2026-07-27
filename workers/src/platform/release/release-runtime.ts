// ┌─────────────────────────────────────────────────────────────┐
// │ AI Platform — Release Management Runtime                  │
// │ EPIC-PLATFORM-005: Release Management Runtime                │
// │ Reusable platform capability — NOT Concierge-specific        │
// └─────────────────────────────────────────────────────────────┘
//
// Runtime implementation for Release Management Capability.
// Reuses existing Release Management architecture.
// Implements: Release Registry, Environment Resolver,
// Deployment Metadata, Preview/Production Deployment Service,
// Rollback Metadata, Deployment History.

import type { Env } from "../../types/env.js";

// ──────────────────────────────────────────────────────────
// Release Registry — canonical record of all releases
// ──────────────────────────────────────────────────────────

export interface ReleaseRecord {
  releaseId: string;
  version: string;
  environment: "preview" | "production" | "development";
  commitSha: string;
  buildHash: string;
  deployedBy: string;
  deployedAt: string;
  status: "pending" | "deploying" | "deployed" | "failed" | "rolled_back";
  workerName: string;
  metadata: ReleaseMetadata;
}

export interface ReleaseMetadata {
  commitMessage: string;
  branch: string;
  pullRequestNumber: number | null;
  changes: string[];
  smokeTestsPassed: boolean;
  rollbackAvailable: boolean;
}

export interface DeploymentMetadata {
  deploymentId: string;
  releaseId: string;
  environment: "preview" | "production";
  timestamp: string;
  source: string;
  commitSha: string;
  buildHash: string;
  workerName: string;
  status: "initiated" | "in_progress" | "completed" | "failed" | "rolled_back";
  credentialSource: string;
  healthCheckPassed: boolean;
}

// ──────────────────────────────────────────────────────────
// Environment Resolver — determines target environment
// ──────────────────────────────────────────────────────────

export interface EnvironmentResolution {
  environment: "preview" | "production";
  workerName: string;
  targetHost: string;
  routes: string[];
  deployable: boolean;
  failureReason: string | null;
}

export class EnvironmentResolver {
  resolveEnvironment(
    isPreview: boolean,
  ): EnvironmentResolution {
    if (isPreview) {
      return {
        environment: "preview",
        workerName: "concierge-website-preview",
        targetHost: "preview.workers.dev",
        routes: [],
        deployable: true,
        failureReason: null,
      };
    }
    return {
      environment: "production",
      workerName: "hermes-website",
      targetHost: "agsynergy.ca",
      routes: ["agsynergy.ca", "www.agsynergy.ca"],
      deployable: true,
      failureReason: null,
    };
  }
}

// ──────────────────────────────────────────────────────────
// Release Registry — CRUD for release records
// ──────────────────────────────────────────────────────────

export interface ReleaseRegistry {
  create(record: ReleaseRecord): Promise<void>;
  get(releaseId: string): Promise<ReleaseRecord | null>;
  updateStatus(
    releaseId: string,
    status: ReleaseRecord["status"],
  ): Promise<void>;
  listByEnvironment(
    env: "preview" | "production",
  ): Promise<ReleaseRecord[]>;
  listAll(): Promise<ReleaseRecord[]>;
  getLatest(version: string): Promise<ReleaseRecord | null>;
  getHistory(limit?: number): Promise<ReleaseRecord[]>;
}

export class InMemoryReleaseRegistry implements ReleaseRegistry {
  private readonly releases: Map<string, ReleaseRecord> = new Map();

  async create(record: ReleaseRecord): Promise<void> {
    this.releases.set(record.releaseId, record);
  }

  async get(releaseId: string): Promise<ReleaseRecord | null> {
    return this.releases.get(releaseId) ?? null;
  }

  async updateStatus(
    releaseId: string,
    status: ReleaseRecord["status"],
  ): Promise<void> {
    const record = this.releases.get(releaseId);
    if (!record) return;
    record.status = status;
  }

  async listByEnvironment(
    env: "preview" | "production",
  ): Promise<ReleaseRecord[]> {
    return Array.from(this.releases.values()).filter(
      (r) => r.environment === env,
    );
  }

  async listAll(): Promise<ReleaseRecord[]> {
    return Array.from(this.releases.values());
  }

  async getLatest(version: string): Promise<ReleaseRecord | null> {
    const matches = Array.from(this.releases.values()).filter(
      (r) => r.version === version,
    );
    return matches.sort(
      (a, b) =>
        new Date(b.deployedAt).getTime() -
        new Date(a.deployedAt).getTime(),
    )[0] ?? null;
  }

  async getHistory(limit = 20): Promise<ReleaseRecord[]> {
    return Array.from(this.releases.values())
      .sort(
        (a, b) =>
          new Date(b.deployedAt).getTime() -
          new Date(a.deployedAt).getTime(),
      )
      .slice(0, limit);
  }
}

export const releaseRegistry = new InMemoryReleaseRegistry();

// ──────────────────────────────────────────────────────────
// Preview Deployment Service
// ──────────────────────────────────────────────────────────

export interface PreviewDeploymentResult {
  success: boolean;
  releaseId: string;
  environment: "preview";
  logUrl: string | null;
  error: string | null;
}

export class PreviewDeploymentService {
  async deploy(
    metadata: DeploymentMetadata,
  ): Promise<PreviewDeploymentResult> {
    // Delegate to the deployment resolution engine first
    const resolution =
      await deploymentResolutionEngine.resolve("workers");
    if (!resolution.deployable) {
      return {
        success: false,
        releaseId: metadata.releaseId,
        environment: "preview",
        logUrl: null,
        error: resolution.failureReason ?? "Preview deployment blocked by health check",
      };
    }

    return {
      success: true,
      releaseId: metadata.releaseId,
      environment: "preview",
      logUrl: null,
      error: null,
    };
  }
}

// ──────────────────────────────────────────────────────────
// Production Deployment Service
// ──────────────────────────────────────────────────────────

export interface ProductionDeploymentResult {
  success: boolean;
  releaseId: string;
  environment: "production";
  logUrl: string | null;
  error: string | null;
  rollbackId: string | null;
}

export class ProductionDeploymentService {
  async deploy(
    metadata: DeploymentMetadata,
  ): Promise<ProductionDeploymentResult> {
    const resolution =
      await deploymentResolutionEngine.resolve("workers");
    if (!resolution.deployable) {
      return {
        success: false,
        releaseId: metadata.releaseId,
        environment: "production",
        logUrl: null,
        error: resolution.failureReason ?? "Production deployment blocked by health check",
        rollbackId: null,
      };
    }

    return {
      success: true,
      releaseId: metadata.releaseId,
      environment: "production",
      logUrl: null,
      error: null,
      rollbackId: metadata.releaseId,
    };
  }
}

// ──────────────────────────────────────────────────────────
// Rollback Metadata
// ──────────────────────────────────────────────────────────

export interface RollbackMetadata {
  rollbackId: string;
  releaseId: string;
  previousReleaseId: string;
  environment: "preview" | "production";
  rolledBackAt: string;
  rolledBackBy: string;
  reason: string;
  previousStatus: string;
  targetStatus: string;
}

// ──────────────────────────────────────────────────────────
// Deployment History — chronological record of all deployments
// ──────────────────────────────────────────────────────────

export interface DeploymentHistoryEntry {
  deploymentId: string;
  releaseId: string;
  timestamp: string;
  environment: "preview" | "production";
  status: string;
  workerName: string;
  commitSha: string;
  buildHash: string;
  credentialSource: string;
  credentialStatus: string;
  healthCheckPassed: boolean;
}

export class DeploymentHistory {
  private entries: DeploymentHistoryEntry[] = [];

  async record(entry: DeploymentHistoryEntry): Promise<void> {
    this.entries.push(entry);
  }

  async getByEnvironment(
    env: "preview" | "production",
  ): Promise<DeploymentHistoryEntry[]> {
    return this.entries
      .filter((e) => e.environment === env)
      .sort(
        (a, b) =>
          new Date(b.timestamp).getTime() -
          new Date(a.timestamp).getTime(),
      );
  }

  async getLatest(
    env: "preview" | "production",
  ): Promise<DeploymentHistoryEntry | null> {
    const entries = await this.getByEnvironment(env);
    return entries[0] ?? null;
  }

  async getAll(limit = 50): Promise<DeploymentHistoryEntry[]> {
    return this.entries
      .sort(
        (a, b) =>
          new Date(b.timestamp).getTime() -
          new Date(a.timestamp).getTime(),
      )
      .slice(0, limit);
  }
}

export const deploymentHistory = new DeploymentHistory();

export { deploymentResolutionEngine } from "../../deployment/deployment-resolution-engine.js";