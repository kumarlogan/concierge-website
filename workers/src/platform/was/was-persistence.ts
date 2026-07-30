// ┌─────────────────────────────────────────────────────────────┐
// │ AI Platform — WAS Persistence Backend                        │
// │ Provides persistence for ActivationLifecycle state through   │
// │ an abstraction similar to ExecutionPersistenceBackend.       │
// │ Supports D1 (production) and Memory (testing) backends.      │
// │ Product-agnostic, reusable across all AGS products.         │
// └─────────────────────────────────────────────────────────────┘

import type { D1Database } from "@cloudflare/workers-types";
import {
  ActivationState,
  type ActivationLifecycle,
} from "./types.js";

// ══════════════════════════════════════════════════════════════
// WAS Persistence Backend Interface
// ══════════════════════════════════════════════════════════════

export interface WASPersistenceBackend {
  /** Save (upsert) an activation lifecycle record. */
  put(activation: ActivationLifecycle): Promise<void>;

  /** Get a single activation lifecycle by ID. */
  get(activationId: string): Promise<ActivationLifecycle | null>;

  /** List all recoverable (non-terminal) activations. */
  listRecoverable(): Promise<ActivationLifecycle[]>;

  /** List all activations belonging to a plan. */
  listByPlan(planId: string): Promise<ActivationLifecycle[]>;

  /** Delete an activation lifecycle record. */
  delete(activationId: string): Promise<void>;

  /** Clear all activation records. For testing. */
  clear(): Promise<void>;
}

// ══════════════════════════════════════════════════════════════
// D1 WAS Persistence Backend
// ══════════════════════════════════════════════════════════════

/**
 * Production D1-backed WAS persistence.
 * Stores activation lifecycle state in the `was_activation_state` table.
 */
export class D1WASPersistenceBackend implements WASPersistenceBackend {
  private db: D1Database | null = null;
  private fallback: MemoryWASPersistenceBackend | null = null;
  private degraded = false;

  constructor(db: D1Database | null = null) {
    this.db = db;
  }

  /** Set the D1 database instance (available after binding injection). */
  setDB(db: D1Database): void {
    this.db = db;
    this.degraded = false;
  }

  /** Set a memory fallback when D1 is unavailable. */
  setFallback(fallback: MemoryWASPersistenceBackend): void {
    this.fallback = fallback;
  }

  /** Check if the backend is in degraded mode. */
  isDegraded(): boolean {
    return this.degraded;
  }

  /** Reset degraded state. */
  clearDegraded(): void {
    this.degraded = false;
  }

  async put(activation: ActivationLifecycle): Promise<void> {
    if (!this.db) {
      if (this.fallback) {
        await this.fallback.put(activation);
        return;
      }
      throw new WASPersistenceError("D1 database not available");
    }

    try {
      const sql = `
        INSERT OR REPLACE INTO was_activation_state (
          activation_id, plan_id, state, created_at, updated_at, completed_at,
          idempotency_key, validation_json, activated_batches_json,
          failure_json, rejection_json, checkpoint_version
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;

      await this.db
        .prepare(sql)
        .bind(
          activation.id,
          activation.planId,
          activation.state,
          activation.createdAt,
          activation.updatedAt,
          activation.completedAt,
          activation.idempotencyKey,
          activation.validation ? JSON.stringify(activation.validation) : null,
          JSON.stringify(activation.activatedBatches),
          activation.failure ? JSON.stringify(activation.failure) : null,
          activation.rejection ? JSON.stringify(activation.rejection) : null,
          1,
        )
        .run();
    } catch (err) {
      this.degraded = true;
      if (this.fallback) {
        await this.fallback.put(activation);
        return;
      }
      throw new WASPersistenceError(
        `D1 write failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  async get(activationId: string): Promise<ActivationLifecycle | null> {
    if (!this.db) {
      if (this.fallback) return this.fallback.get(activationId);
      throw new WASPersistenceError("D1 database not available");
    }

    try {
      const result = await this.db
        .prepare("SELECT * FROM was_activation_state WHERE activation_id = ?")
        .bind(activationId)
        .first<SerializedActivation>();

      if (!result) return null;
      return deserializeActivation(result);
    } catch (err) {
      if (this.fallback) return this.fallback.get(activationId);
      throw new WASPersistenceError(
        `D1 read failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  async listRecoverable(): Promise<ActivationLifecycle[]> {
    if (!this.db) {
      if (this.fallback) return this.fallback.listRecoverable();
      throw new WASPersistenceError("D1 database not available");
    }

    try {
      const results = await this.db
        .prepare(
          "SELECT * FROM was_activation_state WHERE state NOT IN ('deactivated', 'failed', 'rejected')",
        )
        .all<SerializedActivation>();

      return results.results.map(deserializeActivation);
    } catch (err) {
      if (this.fallback) return this.fallback.listRecoverable();
      throw new WASPersistenceError(
        `D1 list recovery failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  async listByPlan(planId: string): Promise<ActivationLifecycle[]> {
    if (!this.db) {
      if (this.fallback) return this.fallback.listByPlan(planId);
      throw new WASPersistenceError("D1 database not available");
    }

    try {
      const results = await this.db
        .prepare("SELECT * FROM was_activation_state WHERE plan_id = ?")
        .bind(planId)
        .all<SerializedActivation>();

      return results.results.map(deserializeActivation);
    } catch (err) {
      if (this.fallback) return this.fallback.listByPlan(planId);
      throw new WASPersistenceError(
        `D1 list by plan failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  async delete(activationId: string): Promise<void> {
    if (!this.db) {
      if (this.fallback) {
        await this.fallback.delete(activationId);
        return;
      }
      throw new WASPersistenceError("D1 database not available");
    }

    try {
      await this.db
        .prepare("DELETE FROM was_activation_state WHERE activation_id = ?")
        .bind(activationId)
        .run();
    } catch (err) {
      if (this.fallback) {
        await this.fallback.delete(activationId);
        return;
      }
      throw new WASPersistenceError(
        `D1 delete failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  async clear(): Promise<void> {
    if (!this.db) {
      if (this.fallback) {
        await this.fallback.clear();
        return;
      }
      throw new WASPersistenceError("D1 database not available");
    }

    try {
      await this.db.prepare("DELETE FROM was_activation_state").run();
    } catch (err) {
      if (this.fallback) {
        await this.fallback.clear();
        return;
      }
      throw new WASPersistenceError(
        `D1 clear failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }
}

// ══════════════════════════════════════════════════════════════
// Memory WAS Persistence Backend (Testing / Fallback)
// ══════════════════════════════════════════════════════════════

export class MemoryWASPersistenceBackend implements WASPersistenceBackend {
  private store: Map<string, ActivationLifecycle> = new Map();

  async put(activation: ActivationLifecycle): Promise<void> {
    this.store.set(activation.id, {
      ...activation,
      activatedBatches: [...activation.activatedBatches],
    });
  }

  async get(activationId: string): Promise<ActivationLifecycle | null> {
    const entry = this.store.get(activationId);
    return entry
      ? { ...entry, activatedBatches: [...entry.activatedBatches] }
      : null;
  }

  async listRecoverable(): Promise<ActivationLifecycle[]> {
    return Array.from(this.store.values()).filter(
      (a) =>
        a.state !== ActivationState.DEACTIVATED &&
        a.state !== ActivationState.FAILED &&
        a.state !== ActivationState.REJECTED,
    );
  }

  async listByPlan(planId: string): Promise<ActivationLifecycle[]> {
    return Array.from(this.store.values()).filter((a) => a.planId === planId);
  }

  async delete(activationId: string): Promise<void> {
    this.store.delete(activationId);
  }

  async clear(): Promise<void> {
    this.store.clear();
  }

  /** Get all entries count — for testing. */
  get size(): number {
    return this.store.size;
  }

  /** Get all keys — for testing. */
  get keys(): string[] {
    return Array.from(this.store.keys());
  }
}

// ══════════════════════════════════════════════════════════════
// Error
// ══════════════════════════════════════════════════════════════

export class WASPersistenceError extends Error {
  constructor(message: string) {
    super(`WASPersistenceError: ${message}`);
    this.name = "WASPersistenceError";
  }
}

// ══════════════════════════════════════════════════════════════
// Serialization helpers
// ══════════════════════════════════════════════════════════════

interface SerializedActivation {
  activation_id: string;
  plan_id: string;
  state: string;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
  idempotency_key: string;
  validation_json: string | null;
  activated_batches_json: string;
  failure_json: string | null;
  rejection_json: string | null;
  checkpoint_version: number;
}

function deserializeActivation(
  row: SerializedActivation,
): ActivationLifecycle {
  const stateValues: Record<string, ActivationState> = {
    pending: ActivationState.PENDING,
    validating: ActivationState.VALIDATING,
    activating: ActivationState.ACTIVATING,
    active: ActivationState.ACTIVE,
    deactivating: ActivationState.DEACTIVATING,
    deactivated: ActivationState.DEACTIVATED,
    failed: ActivationState.FAILED,
    rejected: ActivationState.REJECTED,
  };

  return {
    id: row.activation_id,
    planId: row.plan_id,
    state: stateValues[row.state] ?? ActivationState.FAILED,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    completedAt: row.completed_at,
    idempotencyKey: row.idempotency_key,
    validation: row.validation_json ? JSON.parse(row.validation_json) : null,
    activatedBatches: JSON.parse(row.activated_batches_json),
    failure: row.failure_json ? JSON.parse(row.failure_json) : null,
    rejection: row.rejection_json ? JSON.parse(row.rejection_json) : null,
  };
}