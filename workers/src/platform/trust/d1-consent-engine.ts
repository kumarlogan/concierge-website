// ┌─────────────────────────────────────────────────────────────┐
// │ AI Platform — D1-backed Consent Engine                      │
// │ Implements the same public interface as ConsentEngine but   │
// │ persists to Cloudflare D1 using the 0006 production schema. │
// │ PRG-011 — replaces in-memory singleton for persistence.     │
// └─────────────────────────────────────────────────────────────┘
//
// Schema note (PRG-014 resolved by migration 0012):
//   consents.granted  INTEGER  0=denied | 1=granted | 2=withdrawn
//   consents.scope    TEXT     JSON-stringified string[]
//   consents.metadata TEXT     JSON-stringified object
//
// PHI Boundary: This engine stores consent metadata only. PHI references
// are opaque IDs. No PHI payloads are written or read here.

import type {
  ConsentGrantRequest,
  ConsentRevokeRequest,
  ConsentHistoryEntry,
  ConsentSnapshot,
  ConsentEvaluationResult,
  ConsentType,
  ConsentSource,
} from "./types.js";

// ── D1 row shapes ─────────────────────────────────────────────

interface ConsentRow {
  id: string;
  identity_id: string;
  consent_type: string;
  granted: number;           // 0=denied, 1=granted, 2=withdrawn
  scope: string;             // JSON array
  purpose: string;
  source: string;
  delegator_id: string | null;
  expires_at: string | null;
  version: number;
  metadata: string;          // JSON object
  created_at: string;
  revoked_at: string | null;
  version_token: string;
  updated_at: string | null;
}

// ── Helpers ───────────────────────────────────────────────────

function generateVersionToken(identityId: string, consentType: string, timestamp: string): string {
  const data = `${identityId}:${consentType}:${timestamp}:${crypto.randomUUID()}`;
  let h = 0x811c9dc5;
  for (let i = 0; i < data.length; i++) {
    h ^= data.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return ("00000000" + (h >>> 0).toString(16)).slice(-8) + "-" + data.slice(0, 8);
}

function parseScope(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try { return JSON.parse(raw) as string[]; } catch { return []; }
}

function stringifyScope(scope: string[] | undefined | null): string {
  return JSON.stringify(scope ?? []);
}

function parseMetadata(raw: string | null | undefined): Record<string, unknown> {
  if (!raw) return {};
  try { return JSON.parse(raw) as Record<string, unknown>; } catch { return {}; }
}

function rowToHistoryEntry(row: ConsentRow): ConsentHistoryEntry {
  const granted = row.granted === 1;
  return {
    id: row.id,
    consentId: row.id,
    identityId: row.identity_id,
    consentType: row.consent_type as ConsentType,
    granted,
    scope: parseScope(row.scope),
    purpose: row.purpose ?? "",
    source: row.source as ConsentSource,
    version: row.version,
    changedBy:
      row.source === "delegation" ? (row.delegator_id ?? row.identity_id) : row.identity_id,
    changeReason: row.revoked_at ? "Consent withdrawn" : "Consent granted",
    expiresAt: row.expires_at ?? null,
    revokedAt: row.revoked_at ?? null,
    createdAt: row.created_at,
  };
}

function buildEmptySnapshot(identityId: string, consentType: ConsentType): ConsentSnapshot {
  return {
    id: crypto.randomUUID(),
    identityId,
    sessionId: "",
    consentType,
    granted: false,
    scope: [],
    purpose: "",
    source: "explicit" as ConsentSource,
    expiresAt: null,
    version: 0,
    versionToken: "",
    capturedAt: new Date().toISOString(),
  };
}

// ── D1ConsentEngine ───────────────────────────────────────────

export class D1ConsentEngine {
  constructor(private readonly db: D1Database) {}

  // ── Grant ──────────────────────────────────────────────────

  async grant(
    request: ConsentGrantRequest,
  ): Promise<{ id: string; granted: boolean; versionToken: string; createdAt: string }> {
    const now = new Date().toISOString();
    const consentId = crypto.randomUUID();
    const versionToken = generateVersionToken(request.identityId, request.consentType, now);
    const metadataStr = JSON.stringify(request.metadata ?? {});

    await this.db
      .prepare(
        `INSERT INTO consents
           (id, identity_id, consent_type, granted, scope, purpose, source,
            delegator_id, expires_at, version, metadata, created_at, revoked_at,
            version_token, updated_at)
         VALUES (?, ?, ?, 1, ?, ?, ?, ?, ?, 1, ?, ?, NULL, ?, ?)`,
      )
      .bind(
        consentId,
        request.identityId,
        request.consentType,
        stringifyScope(request.scope),
        request.purpose ?? "",
        request.source,
        request.delegatorId ?? null,
        request.expiresAt ?? null,
        metadataStr,
        now,
        versionToken,
        now,
      )
      .run();

    // UPSERT into consent_registry (track current state per identity+type)
    const registryId = crypto.randomUUID();
    await this.db
      .prepare(
        `INSERT INTO consent_registry
           (id, identity_id, consent_type, current_state, expires_at, version_token, updated_at)
         VALUES (?, ?, ?, 'granted', ?, ?, ?)
         ON CONFLICT(identity_id, consent_type) DO UPDATE SET
           current_state  = 'granted',
           expires_at     = excluded.expires_at,
           version_token  = excluded.version_token,
           updated_at     = excluded.updated_at`,
      )
      .bind(
        registryId,
        request.identityId,
        request.consentType,
        request.expiresAt ?? null,
        versionToken,
        now,
      )
      .run();

    return { id: consentId, granted: true, versionToken, createdAt: now };
  }

  // ── Withdraw ───────────────────────────────────────────────

  async withdraw(
    request: ConsentRevokeRequest,
  ): Promise<{ consentId: string; revoked: boolean; revokedAt: string }> {
    const now = new Date().toISOString();

    // Look up the consent row to get identity_id and current version
    const existing = await this.db
      .prepare(`SELECT * FROM consents WHERE id = ? LIMIT 1`)
      .bind(request.consentId)
      .first<ConsentRow>();

    if (!existing) {
      throw new D1ConsentEngineError(
        `Consent not found: ${request.consentId}`,
        "CONSENT_NOT_FOUND",
      );
    }

    const newVersion = existing.version + 1;
    const versionToken = generateVersionToken(existing.identity_id, existing.consent_type, now);

    // Mark as withdrawn (granted=2) on the main consents row
    await this.db
      .prepare(
        `UPDATE consents
         SET granted = 2, revoked_at = ?, version = ?, version_token = ?, updated_at = ?
         WHERE id = ?`,
      )
      .bind(now, newVersion, versionToken, now, request.consentId)
      .run();

    // Write immutable audit entry to consent_versions
    // reason goes here (not on consents, which has no reason column in 0006)
    const versionId = crypto.randomUUID();
    await this.db
      .prepare(
        `INSERT INTO consent_versions
           (id, consent_id, version, identity_id, consent_type, granted,
            scope, purpose, source, delegator_id, expires_at, metadata,
            created_at, revoked_at, version_token, changed_by, change_reason)
         VALUES (?, ?, ?, ?, ?, 2, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        versionId,
        request.consentId,
        newVersion,
        existing.identity_id,
        existing.consent_type,
        existing.scope,
        existing.purpose,
        existing.source,
        existing.delegator_id ?? null,
        existing.expires_at ?? null,
        existing.metadata,
        now,
        now,
        versionToken,
        request.revokedBy,
        request.reason,
      )
      .run();

    // Update consent_registry to reflect withdrawn state
    await this.db
      .prepare(
        `UPDATE consent_registry
         SET current_state = 'withdrawn', version_token = ?, updated_at = ?
         WHERE identity_id = ? AND consent_type = ?`,
      )
      .bind(versionToken, now, existing.identity_id, existing.consent_type)
      .run();

    return { consentId: request.consentId, revoked: true, revokedAt: now };
  }

  // ── History ────────────────────────────────────────────────

  async getHistory(request: {
    identityId: string;
    consentType?: ConsentType;
    limit: number;
    offset: number;
  }): Promise<{ entries: ConsentHistoryEntry[]; total: number }> {
    let countStmt: D1PreparedStatement;
    let rowsStmt: D1PreparedStatement;

    if (request.consentType) {
      countStmt = this.db
        .prepare(
          `SELECT COUNT(*) as cnt FROM consents
           WHERE identity_id = ? AND consent_type = ?`,
        )
        .bind(request.identityId, request.consentType);
      rowsStmt = this.db
        .prepare(
          `SELECT * FROM consents
           WHERE identity_id = ? AND consent_type = ?
           ORDER BY created_at DESC
           LIMIT ? OFFSET ?`,
        )
        .bind(request.identityId, request.consentType, request.limit, request.offset);
    } else {
      countStmt = this.db
        .prepare(`SELECT COUNT(*) as cnt FROM consents WHERE identity_id = ?`)
        .bind(request.identityId);
      rowsStmt = this.db
        .prepare(
          `SELECT * FROM consents
           WHERE identity_id = ?
           ORDER BY created_at DESC
           LIMIT ? OFFSET ?`,
        )
        .bind(request.identityId, request.limit, request.offset);
    }

    const [countResult, rowsResult] = await Promise.all([
      countStmt.first<{ cnt: number }>(),
      rowsStmt.all<ConsentRow>(),
    ]);

    const total = countResult?.cnt ?? 0;
    const entries = (rowsResult.results ?? []).map(rowToHistoryEntry);

    return { entries, total };
  }

  // ── Snapshot ───────────────────────────────────────────────

  async captureSnapshot(identityId: string, sessionId: string): Promise<ConsentSnapshot[]> {
    const now = new Date().toISOString();

    const result = await this.db
      .prepare(
        `SELECT * FROM consents
         WHERE identity_id = ?
           AND granted = 1
           AND revoked_at IS NULL
           AND (expires_at IS NULL OR expires_at > datetime('now'))
         ORDER BY created_at DESC`,
      )
      .bind(identityId)
      .all<ConsentRow>();

    return (result.results ?? []).map((row) => ({
      id: crypto.randomUUID(),
      identityId,
      sessionId,
      consentType: row.consent_type as ConsentType,
      granted: true,
      scope: parseScope(row.scope),
      purpose: row.purpose ?? "",
      source: row.source as ConsentSource,
      expiresAt: row.expires_at ?? null,
      version: row.version,
      versionToken: row.version_token,
      capturedAt: now,
    }));
  }

  // ── Evaluation ─────────────────────────────────────────────
  // Note: synchronous in the in-memory engine. Kept async here since D1 is
  // always async; callers that call .evaluate() must await it.

  async evaluate(
    identityId: string,
    consentType: ConsentType,
    purposeOfUse?: string,
  ): Promise<ConsentEvaluationResult> {
    const now = new Date().toISOString();

    const row = await this.db
      .prepare(
        `SELECT * FROM consents
         WHERE identity_id = ?
           AND consent_type = ?
           AND granted = 1
           AND revoked_at IS NULL
           AND (expires_at IS NULL OR expires_at > datetime('now'))
         ORDER BY created_at DESC
         LIMIT 1`,
      )
      .bind(identityId, consentType)
      .first<ConsentRow>();

    if (!row) {
      return {
        granted: false,
        consentType,
        scope: [],
        purposeMatch: false,
        expired: false,
        revoked: false,
        source: "explicit" as ConsentSource,
        snapshot: buildEmptySnapshot(identityId, consentType),
        reason: "No active consent found — denied by default",
      };
    }

    const scope = parseScope(row.scope);
    const purposeMatch = purposeOfUse
      ? (row.purpose ?? "").includes(purposeOfUse) || scope.includes(purposeOfUse)
      : true;

    return {
      granted: true,
      consentType,
      scope,
      purposeMatch,
      expired: false,
      revoked: false,
      source: row.source as ConsentSource,
      snapshot: {
        id: crypto.randomUUID(),
        identityId,
        sessionId: "",
        consentType,
        granted: true,
        scope,
        purpose: row.purpose ?? "",
        source: row.source as ConsentSource,
        expiresAt: row.expires_at ?? null,
        version: row.version,
        versionToken: row.version_token,
        capturedAt: now,
      },
      reason: "Active consent found",
    };
  }

  // ── Expiration Check ───────────────────────────────────────

  async checkExpired(): Promise<
    { consentId: string; identityId: string; consentType: ConsentType }[]
  > {
    // Find all consents that have passed their expires_at but are still
    // marked granted=1 and not yet revoked.
    const result = await this.db
      .prepare(
        `SELECT id, identity_id, consent_type FROM consents
         WHERE granted = 1
           AND revoked_at IS NULL
           AND expires_at IS NOT NULL
           AND expires_at <= datetime('now')`,
      )
      .all<{ id: string; identity_id: string; consent_type: string }>();

    const rows = result.results ?? [];
    if (rows.length === 0) return [];

    const now = new Date().toISOString();

    // Bulk-expire: mark withdrawn (granted=2) and set revoked_at
    for (const row of rows) {
      const versionToken = generateVersionToken(row.identity_id, row.consent_type, now);
      await this.db
        .prepare(
          `UPDATE consents
           SET granted = 2, revoked_at = ?, version_token = ?, updated_at = ?
           WHERE id = ? AND granted = 1`,
        )
        .bind(now, versionToken, now, row.id)
        .run();

      await this.db
        .prepare(
          `UPDATE consent_registry
           SET current_state = 'expired', version_token = ?, updated_at = ?
           WHERE identity_id = ? AND consent_type = ?`,
        )
        .bind(versionToken, now, row.identity_id, row.consent_type)
        .run();
    }

    return rows.map((r) => ({
      consentId: r.id,
      identityId: r.identity_id,
      consentType: r.consent_type as ConsentType,
    }));
  }
}

export class D1ConsentEngineError extends Error {
  constructor(
    message: string,
    public readonly code: string,
  ) {
    super(message);
    this.name = "D1ConsentEngineError";
  }
}
