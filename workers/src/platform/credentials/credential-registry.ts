// ┌─────────────────────────────────────────────────────────────┐
// │ AI Platform — Credential Registry (In-Memory + D1)           │
// │ EPIC-PLATFORM-001: Credential & Secrets Management           │
// │ Reusable platform capability — NOT Concierge-specific         │
// └─────────────────────────────────────────────────────────────┘
//
// The Credential Registry is the single source of truth for all
// credential records. It enforces "one active credential per provider"
// and provides CRUD operations with full audit trails.

import { CredentialStatus as CS, CredentialAction } from "./types.js";
import type {
  CredentialRecord,
  CredentialRegistry,
  CredentialStatus,
  AuditEntry,
  ProviderId,
} from "./types.js";

/**
 * In-memory credential registry implementation.
 * In production, this would be backed by D1. For the platform
 * capability, the interface contract is the primary deliverable;
 * the in-memory implementation is the initial runtime.
 */
export class InMemoryCredentialRegistry implements CredentialRegistry {
  private readonly store: Map<ProviderId, CredentialRecord> = new Map();
  private readonly auditLog: AuditEntry[] = [];

  async get(providerId: ProviderId): Promise<CredentialRecord | null> {
    return this.store.get(providerId) ?? null;
  }

  async set(record: CredentialRecord): Promise<void> {
    const existing = this.store.get(record.providerId);
    if (existing && existing.status === CS.ACTIVE) {
      // Deactivate existing active credential before registering new one
      existing.status = CS.DISABLED;
      existing.updatedAt = new Date().toISOString();
    }
    record.auditHistory = [
      ...(existing?.auditHistory ?? []),
      this.createAuditEntry(record.providerId, CredentialAction.REGISTERED, "Credential registered/updated"),
    ];
    this.store.set(record.providerId, record);
  }

  async listAll(): Promise<CredentialRecord[]> {
    return Array.from(this.store.values());
  }

  async remove(providerId: ProviderId): Promise<void> {
    this.store.delete(providerId);
  }

  async updateStatus(
    providerId: ProviderId,
    status: CredentialStatus,
  ): Promise<void> {
    const record = this.store.get(providerId);
    if (!record) return;
    const previousStatus = record.status;
    record.status = status;
    record.updatedAt = new Date().toISOString();
    record.auditHistory.push(
      this.createAuditEntry(
        providerId,
        CredentialAction.REGISTERED,
        `Status changed: ${previousStatus} → ${status}`,
      ),
    );
  }

  /**
   * Get the audit log for a specific provider or all providers.
   */
  getAuditLog(providerId?: ProviderId): AuditEntry[] {
    if (providerId) {
      const record = this.store.get(providerId);
      return record?.auditHistory ?? [];
    }
    return [...this.auditLog];
  }

  private createAuditEntry(
    providerId: ProviderId,
    action: CredentialAction,
    details: string,
  ): AuditEntry {
    return {
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      action,
      providerId,
      actor: "platform-credential-registry",
      details,
      previousStatus: null,
      newStatus: null,
    };
  }
}

// Singleton default registry for the module.
export const credentialRegistry = new InMemoryCredentialRegistry();