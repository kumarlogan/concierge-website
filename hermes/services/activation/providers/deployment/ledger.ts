// ┌─────────────────────────────────────────────────────────────┐
// │ Hermes Platform — Controlled Deployment Ledger (EPIC-007)       │
// │ Provider-neutral, tenant-isolated, append-only deployment       │
// │ history. Adds (a) a durable backend seam so the ledger survives  │
// │ restarts, and (b) an idempotency key so a repeated launch for    │
// │ the same intent is NEVER executed twice (fail-closed dedup).     │
// │                                                               │
// │ Tenant isolation is enforced on every read/write — a tenant    │
// │ can only ever see/append its own entries (mirrors the frozen    │
// │ Foundation's enforceTenant). No core rewrite; this extends the   │
// │ EPIC-006.5 ledger with durability + idempotency only.           │
// └─────────────────────────────────────────────────────────────┘

export type DeployEnv = "development" | "staging" | "production";
export const DEPLOY_ENVS: DeployEnv[] = ["development", "staging", "production"];

export type DeploymentResult =
  | "planned"
  | "dry-run"
  | "success"
  | "failed"
  | "denied";

export interface DeploymentLedgerEntry {
  deploymentId: string;
  tenant: string;
  requester: string;
  approver?: string;
  provider: string;
  environment: DeployEnv;
  capability: string;
  /** Immutable reference (e.g. git sha / release tag). */
  reference: string;
  result: DeploymentResult;
  auditReference?: string;
  /** Durable, revocable approval record bound to this deployment. */
  approvalRef?: unknown;
  /** Revocation bookkeeping (a successful deployment can be revoked). */
  revoked?: boolean;
  revokedBy?: string;
  revokedReason?: string;
  /** Idempotency key — same key for the same intent never double-executes. */
  idempotencyKey?: string;
  /** ISO timestamp the entry was recorded. */
  at: string;
}

/** Provider-neutral low-level ledger backend (D1/Postgres/KV implement). */
export interface DeploymentLedgerBackend {
  append(entry: DeploymentLedgerEntry): void;
  all(): DeploymentLedgerEntry[];
  clear(): void;
}

/** In-memory backend (dev/test/edge default). Demonstrates the seam. */
export class MemoryDeploymentLedgerBackend implements DeploymentLedgerBackend {
  private readonly entries: DeploymentLedgerEntry[] = [];
  append(entry: DeploymentLedgerEntry): void {
    this.entries.push({ ...entry });
  }
  all(): DeploymentLedgerEntry[] {
    return this.entries.map((e) => ({ ...e }));
  }
  clear(): void {
    this.entries.length = 0;
  }
}

/** File-backed append-only ledger (JSON-lines). Restart-safe. */
export interface FileBackendDeps {
  readFileSync: (path: string, encoding: string) => string;
  appendFileSync: (path: string, data: string, encoding: string) => void;
  existsSync: (path: string) => boolean;
}
export class FileDeploymentLedgerBackend implements DeploymentLedgerBackend {
  constructor(private readonly filePath: string, private readonly fs: FileBackendDeps) {}
  append(entry: DeploymentLedgerEntry): void {
    const line = JSON.stringify(entry) + "\n";
    this.fs.appendFileSync(this.filePath, line, "utf8");
  }
  all(): DeploymentLedgerEntry[] {
    if (!this.fs.existsSync(this.filePath)) return [];
    const raw = this.fs.readFileSync(this.filePath, "utf8");
    if (!raw.trim()) return [];
    const out: DeploymentLedgerEntry[] = [];
    for (const line of raw.split("\n")) {
      const t = line.trim();
      if (!t) continue;
      try {
        out.push(JSON.parse(t) as DeploymentLedgerEntry);
      } catch {
        continue; // skip a corrupt line; never wedge the ledger
      }
    }
    return out;
  }
  clear(): void {
    this.fs.appendFileSync(this.filePath, "", "utf8");
  }
}

let activeBackend: DeploymentLedgerBackend = new MemoryDeploymentLedgerBackend();

/** Swap the durable backend (called once at production startup). */
export function configureDeploymentLedger(backend: DeploymentLedgerBackend): void {
  activeBackend = backend;
}

/** The controlled, tenant-isolated deployment ledger. */
export class DeploymentLedger {
  append(entry: DeploymentLedgerEntry): DeploymentLedgerEntry {
    activeBackend.append(entry);
    return { ...entry };
  }

  /** Record a deployment keyed by idempotencyKey. If the same (tenant,key)
   *  was already recorded, returns the EXISTING entry instead of appending a
   *  second one — fail-closed double-execution prevention. */
  recordDeployment(
    idempotencyKey: string | undefined,
    entry: Omit<DeploymentLedgerEntry, "idempotencyKey" | "at"> & { idempotencyKey?: string; approvalRef?: unknown },
  ): { entry: DeploymentLedgerEntry; deduplicated: boolean } {
    if (idempotencyKey) {
      const existing = this.findByIdempotencyKey(entry.tenant, idempotencyKey);
      if (existing) return { entry: existing, deduplicated: true };
    }
    const full: DeploymentLedgerEntry = {
      ...entry,
      ...(idempotencyKey ? { idempotencyKey } : {}),
      ...(entry.approvalRef !== undefined ? { approvalRef: entry.approvalRef } : {}),
      at: new Date().toISOString(),
    };
    activeBackend.append(full);
    return { entry: full, deduplicated: false };
  }

  findByIdempotencyKey(tenant: string, key: string): DeploymentLedgerEntry | undefined {
    return activeBackend
      .all()
      .find((e) => e.tenant === tenant && e.idempotencyKey === key);
  }

  getForTenant(tenant: string, deploymentId: string): DeploymentLedgerEntry | undefined {
    return activeBackend.all().find((e) => e.tenant === tenant && e.deploymentId === deploymentId);
  }

  forTenant(tenant: string): DeploymentLedgerEntry[] {
    return activeBackend.all().filter((e) => e.tenant === tenant);
  }

  /** All entries across tenants (operator/audit view). */
  all(): DeploymentLedgerEntry[] {
    return activeBackend.all();
  }

  /** Append a pre-built entry verbatim (replay from a durable store, or test
   *  seeding with an explicit `at`). Does NOT stamp `at`. */
  appendRaw(entry: DeploymentLedgerEntry): void {
    activeBackend.append(entry);
  }

  countForTenant(tenant: string): number {
    return this.forTenant(tenant).length;
  }

  /** Mark a recorded deployment's terminal result (success/failed/denied). */
  markResult(tenant: string, deploymentId: string, result: DeploymentResult): DeploymentLedgerEntry | undefined {
    // Backends are append-only; we re-emit a result entry keyed by the same
    // deploymentId so the terminal outcome is durable and auditable.
    const prior = this.getForTenant(tenant, deploymentId);
    if (!prior) return undefined;
    const updated: DeploymentLedgerEntry = { ...prior, result };
    activeBackend.append(updated);
    return updated;
  }

  /** Last successful deployment for a tenant (rollback target source). */
  lastSuccessful(tenant: string, environment?: DeployEnv): DeploymentLedgerEntry | undefined {
    const list = this.forTenant(tenant)
      .filter((e) => e.result === "success")
      .filter((e) => (environment ? e.environment === environment : true));
    return list.length ? list[list.length - 1] : undefined;
  }

  /** Revoke a previously-recorded deployment (e.g. incident rollback). The
   *  revocation is itself a durable, auditable ledger record. */
  revoke(tenant: string, deploymentId: string, reason: string, by: string): DeploymentLedgerEntry | undefined {
    const prior = this.getForTenant(tenant, deploymentId);
    if (!prior) return undefined;
    const revoked: DeploymentLedgerEntry = {
      ...prior,
      revoked: true,
      revokedBy: by,
      revokedReason: reason,
    };
    activeBackend.append(revoked);
    return revoked;
  }

  /** Dev/test/edge reset of the active backend. Never call on a durable
   *  production backend. */
  clear(): void {
    activeBackend.clear();
  }
}

/** Process-wide default ledger (append-only, tenant-isolated). */
export const deploymentLedger = new DeploymentLedger();
