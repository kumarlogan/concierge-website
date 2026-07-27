// ┌─────────────────────────────────────────────────────────────┐
// │ AI Platform — Credential Audit Log                            │
// │ EPIC-PLATFORM-001: Credential & Secrets Management           │
// │ Reusable platform capability — NOT Concierge-specific         │
// └─────────────────────────────────────────────────────────────┘
//
// Maintains a complete audit trail of all credential lifecycle events.
// Immutable append-only log. Hermes never modifies or deletes audit entries.

import type { AuditEntry, CredentialRecord, ProviderId } from "./types.js";
import { credentialRegistry } from "./credential-registry.js";

/**
 * Credential Audit Log — provides read access to audit history.
 * The audit log is append-only; entries are never modified or deleted.
 */
export class CredentialAuditLog {
  /**
   * Get all audit entries for a provider.
   */
  async getEntries(providerId: ProviderId): Promise<AuditEntry[]> {
    const record = await credentialRegistry.get(providerId);
    return record?.auditHistory ?? [];
  }

  /**
   * Get all audit entries across all providers.
   */
  async getAllEntries(): Promise<AuditEntry[]> {
    const records = await credentialRegistry.listAll();
    const all: AuditEntry[] = [];
    for (const record of records) {
      all.push(...record.auditHistory);
    }
    return all.sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
    );
  }

  /**
   * Check if a specific action was performed on a provider.
   */
  async hasAction(
    providerId: ProviderId,
    action: string,
  ): Promise<boolean> {
    const entries = await this.getEntries(providerId);
    return entries.some((e) => e.action === action);
  }

  /**
   * Get the most recent audit entry for a provider.
   */
  async getLatestEntry(
    providerId: ProviderId,
  ): Promise<AuditEntry | null> {
    const entries = await this.getEntries(providerId);
    return entries[0] ?? null;
  }
}

export const credentialAuditLog = new CredentialAuditLog();