// ┌─────────────────────────────────────────────────────────────┐
// │ AG Synergy Platform — Operations Service                     │
// │ Phase 2: Operations Platform Foundation                      │
// │ EPIC-002-003A: Operations API Foundation                     │
// └─────────────────────────────────────────────────────────────┘
//
// Business logic for the Operations interface. This service owns all read /
// write operations against lead data that the Operations API exposes:
//
//   - listLeads:   paginated, filtered ops queue
//   - getLead:     single lead detail (+ assignee display name)
//   - updateLead:  mutate status / priority / notes (with audit trail hook)
//   - assignLead:  claim / reassign a lead to an operations user
//   - myLeads:     leads assigned to the calling principal
//   - getDashboard: aggregate counts + recent activity for the ops overview
//   - getTimeline:  recent lead events + audit decisions (activity feed)
//
// Architecture: Route → Service → D1
//
// CRITICAL (ADR-003): this service contains NO permission checks. Authorization
// is enforced upstream by the auth middleware (`requirePermission`). The
// service receives an optional `actingUserId` for assignment scoping and audit
// attribution, but it never decides *whether* a caller may act — only *how*.
//
// `assigned_to` is a soft link to users(id). Assignment is operational
// metadata; leads outlive user records (see migration 0003).

import type { D1Database } from "@cloudflare/workers-types";

// ── Types ────────────────────────────────────────────────────────

/** A lead row as exposed by the Operations API (never raw DB row). */
export interface LeadView {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  treatment_interest: string | null;
  message: string | null;
  status: string;
  priority: string;
  notes: string | null;
  assigned_to: string | null;
  assignee_name: string | null;
  created_at: string;
  updated_at: string;
}

/** Allowed lead lifecycle statuses (guards against garbage writes). */
export const LEAD_STATUSES = [
  "new",
  "contacted",
  "qualified",
  "disqualified",
] as const;
export type LeadStatus = (typeof LEAD_STATUSES)[number];

/** Allowed priority tiers for the ops queue. */
export const LEAD_PRIORITIES = ["low", "normal", "high", "urgent"] as const;
export type LeadPriority = (typeof LEAD_PRIORITIES)[number];

/** Allowed assignment-scope filters for listLeads. */
export type AssigneeScope = "all" | "unassigned" | "mine";

/** Query parameters for the ops lead list. */
export interface LeadListQuery {
  status?: string;
  priority?: string;
  scope?: AssigneeScope;
  /** When scope === "mine", restrict to this user id. */
  actingUserId?: string;
  limit?: number;
  offset?: number;
  /** Sort field — only whitelisted columns are accepted. */
  sort?: "created_at" | "updated_at" | "priority" | "status";
  order?: "asc" | "desc";
}

/** Result of a paginated lead list. */
export interface LeadListResult {
  leads: LeadView[];
  total: number;
  limit: number;
  offset: number;
}

/** A single timeline event for the activity feed. */
export interface TimelineEvent {
  id: string;
  kind: "lead" | "audit";
  lead_id: string | null;
  summary: string;
  actor_id: string | null;
  occurred_at: string;
}

/** Dashboard aggregate payload. */
export interface DashboardView {
  totals: {
    leads: number;
    leads_new: number;
    leads_contacted: number;
    leads_qualified: number;
    leads_disqualified: number;
    unassigned: number;
    urgent: number;
  };
  by_priority: Record<string, number>;
  recent_leads: LeadView[];
  recent_activity: TimelineEvent[];
}

// ── Constants ─────────────────────────────────────────────────────

const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 100;

/** Whitelist of sortable columns (prevents SQL injection via sort param). */
const SORTABLE_COLUMNS = new Set([
  "created_at",
  "updated_at",
  "priority",
  "status",
]);

/** Priority ordering weight for tie-breaking sort. */
const PRIORITY_WEIGHT: Record<string, number> = {
  urgent: 0,
  high: 1,
  normal: 2,
  low: 3,
};

// ── Validation helpers ──────────────────────────────────────────────

function isValidStatus(value: string): value is LeadStatus {
  return (LEAD_STATUSES as readonly string[]).includes(value);
}

function isValidPriority(value: string): value is LeadPriority {
  return (LEAD_PRIORITIES as readonly string[]).includes(value);
}

function clampLimit(value: number | undefined): number {
  if (value === undefined || Number.isNaN(value)) return DEFAULT_LIMIT;
  return Math.min(Math.max(Math.trunc(value), 1), MAX_LIMIT);
}

function clampOffset(value: number | undefined): number {
  if (value === undefined || Number.isNaN(value)) return 0;
  return Math.max(Math.trunc(value), 0);
}

// ── Row mapping ─────────────────────────────────────────────────────

interface LeadRow {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  treatment_interest: string | null;
  message: string | null;
  status: string;
  priority: string;
  notes: string | null;
  assigned_to: string | null;
  assignee_name: string | null;
  created_at: string;
  updated_at: string;
}

function toLeadView(row: LeadRow): LeadView {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    phone: row.phone,
    treatment_interest: row.treatment_interest,
    message: row.message,
    status: row.status,
    priority: row.priority,
    notes: row.notes,
    assigned_to: row.assigned_to,
    assignee_name: row.assignee_name,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

/** Lookup a lead row by id, joining the assignee display name. */
async function fetchLeadRow(
  db: D1Database,
  leadId: string,
): Promise<LeadRow | null> {
  const stmt = db
    .prepare(
      `SELECT l.id, l.name, l.email, l.phone, l.treatment_interest, l.message,
              l.status, l.priority, l.notes, l.assigned_to, l.created_at, l.updated_at,
              u.display_name AS assignee_name
       FROM leads l
       LEFT JOIN users u ON u.id = l.assigned_to
       WHERE l.id = ?1 LIMIT 1`,
    )
    .bind(leadId);
  return (await stmt.first<LeadRow>()) ?? null;
}

// ── Service: listLeads ──────────────────────────────────────────────

/**
 * Paginated, filtered lead list for the ops queue.
 *
 * @param db            D1 binding
 * @param query         Filters + pagination (validated internally)
 * @returns LeadListResult with total count
 */
export async function listLeads(
  db: D1Database,
  query: LeadListQuery = {},
): Promise<LeadListResult> {
  const limit = clampLimit(query.limit);
  const offset = clampOffset(query.offset);

  // Build WHERE clause from validated filters.
  const where: string[] = [];
  const binds: unknown[] = [];

  if (query.status) {
    if (!isValidStatus(query.status)) {
      throw new OpsServiceError("invalid_status", `Unknown status: ${query.status}`, 400);
    }
    where.push(`l.status = ?${binds.length + 1}`);
    binds.push(query.status);
  }

  if (query.priority) {
    if (!isValidPriority(query.priority)) {
      throw new OpsServiceError("invalid_priority", `Unknown priority: ${query.priority}`, 400);
    }
    where.push(`l.priority = ?${binds.length + 1}`);
    binds.push(query.priority);
  }

  if (query.scope === "unassigned") {
    where.push(`l.assigned_to IS NULL`);
  } else if (query.scope === "mine") {
    if (!query.actingUserId) {
      throw new OpsServiceError("missing_actor", "scope 'mine' requires actingUserId", 400);
    }
    where.push(`l.assigned_to = ?${binds.length + 1}`);
    binds.push(query.actingUserId);
  }

  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

  // Total count (respects same filters).
  const countStmt = db
    .prepare(`SELECT COUNT(*) AS c FROM leads l ${whereSql}`)
    .bind(...binds);
  const countRow = await countStmt.first<{ c: number }>();
  const total = countRow ? Number(countRow.c) : 0;

  // Sort clause — column whitelisted, order hardcoded. Leads columns are
  // qualified with `l.` because the query JOINs `users u` (which also has
  // created_at/updated_at) and an unqualified name is ambiguous.
  const sortCol =
    query.sort && SORTABLE_COLUMNS.has(query.sort) ? `l.${query.sort}` : "l.created_at";
  const order = query.order === "asc" ? "ASC" : "DESC";

  const dataStmt = db
    .prepare(
      `SELECT l.id, l.name, l.email, l.phone, l.treatment_interest, l.message,
              l.status, l.priority, l.notes, l.assigned_to, l.created_at, l.updated_at,
              u.display_name AS assignee_name
       FROM leads l
       LEFT JOIN users u ON u.id = l.assigned_to
       ${whereSql}
       ORDER BY ${sortCol} ${order}
       LIMIT ?${binds.length + 1} OFFSET ?${binds.length + 2}`,
    )
    .bind(...binds, limit, offset);

  const rows = await dataStmt.all<LeadRow>();
  const leads = (rows.results ?? []).map(toLeadView);

  return { leads, total, limit, offset };
}

// ── Service: getLead ────────────────────────────────────────────────

/**
 * Fetch a single lead by id. Returns null if not found.
 */
export async function getLead(
  db: D1Database,
  leadId: string,
): Promise<LeadView | null> {
  const row = await fetchLeadRow(db, leadId);
  return row ? toLeadView(row) : null;
}

// ── Service: updateLead ─────────────────────────────────────────────

/** Fields a caller may update on a lead. */
export interface LeadUpdateInput {
  status?: string;
  priority?: string;
  notes?: string;
}

/** Result of an update operation. */
export type LeadMutationResult =
  | { success: true; lead: LeadView }
  | { success: false; error: string; message: string; status: number };

/**
 * Update mutable lead fields (status / priority / notes).
 * Rejects unknown enum values with 400. Returns 404 if the lead is missing.
 */
export async function updateLead(
  db: D1Database,
  leadId: string,
  input: LeadUpdateInput,
): Promise<LeadMutationResult> {
  const existing = await fetchLeadRow(db, leadId);
  if (!existing) {
    return { success: false, error: "not_found", message: "Lead not found", status: 404 };
  }

  const nextStatus = input.status ?? existing.status;
  const nextPriority = input.priority ?? existing.priority;
  const nextNotes = input.notes === undefined ? existing.notes : input.notes;

  if (input.status !== undefined && !isValidStatus(input.status)) {
    return {
      success: false,
      error: "invalid_status",
      message: `Unknown status: ${input.status}`,
      status: 400,
    };
  }
  if (input.priority !== undefined && !isValidPriority(input.priority)) {
    return {
      success: false,
      error: "invalid_priority",
      message: `Unknown priority: ${input.priority}`,
      status: 400,
    };
  }

  const now = new Date().toISOString();
  await db
    .prepare(
      `UPDATE leads
       SET status = ?1, priority = ?2, notes = ?3, updated_at = ?4
       WHERE id = ?5`,
    )
    .bind(nextStatus, nextPriority, nextNotes, now, leadId)
    .run();

  const updated = await fetchLeadRow(db, leadId);
  if (!updated) {
    return {
      success: false,
      error: "internal_error",
      message: "Failed to re-read lead after update",
      status: 500,
    };
  }
  return { success: true, lead: toLeadView(updated) };
}

// ── Service: assignLead ─────────────────────────────────────────────

/**
 * Assign (or unassign) a lead to an operations user.
 *
 * @param db            D1 binding
 * @param leadId        target lead
 * @param assigneeId    user id to assign, or null to unassign (return to pool)
 * @param actingUserId  the principal performing the action (for audit context)
 */
export async function assignLead(
  db: D1Database,
  leadId: string,
  assigneeId: string | null,
  _actingUserId?: string,
): Promise<LeadMutationResult> {
  const existing = await fetchLeadRow(db, leadId);
  if (!existing) {
    return { success: false, error: "not_found", message: "Lead not found", status: 404 };
  }

  // Validate assignee exists (when assigning, not unassigning).
  if (assigneeId !== null) {
    const userRow = await db
      .prepare(`SELECT id FROM users WHERE id = ?1 LIMIT 1`)
      .bind(assigneeId)
      .first<{ id: string }>();
    if (!userRow) {
      return {
        success: false,
        error: "invalid_assignee",
        message: "Assignee user does not exist",
        status: 400,
      };
    }
  }

  const now = new Date().toISOString();
  await db
    .prepare(
      `UPDATE leads SET assigned_to = ?1, updated_at = ?2 WHERE id = ?3`,
    )
    .bind(assigneeId, now, leadId)
    .run();

  const updated = await fetchLeadRow(db, leadId);
  if (!updated) {
    return {
      success: false,
      error: "internal_error",
      message: "Failed to re-read lead after assignment",
      status: 500,
    };
  }
  return { success: true, lead: toLeadView(updated) };
}

// ── Service: myLeads ────────────────────────────────────────────────

/**
 * Convenience wrapper around listLeads scoped to a single user.
 */
export async function myLeads(
  db: D1Database,
  actingUserId: string,
  query: Omit<LeadListQuery, "scope" | "actingUserId"> = {},
): Promise<LeadListResult> {
  return listLeads(db, { ...query, scope: "mine", actingUserId });
}

// ── Service: getDashboard ───────────────────────────────────────────

/**
 * Aggregate dashboard for the ops overview. Counts are computed with a single
 * GROUP BY pass; recent leads + recent activity come from focused queries.
 */
export async function getDashboard(
  db: D1Database,
  recentLimit = 8,
): Promise<DashboardView> {
  // Total + status breakdown in one scan.
  const breakdown = await db
    .prepare(
      `SELECT status, COUNT(*) AS c FROM leads GROUP BY status`,
    )
    .all<{ status: string; c: number }>();

  const counts: Record<string, number> = {
    new: 0,
    contacted: 0,
    qualified: 0,
    disqualified: 0,
  };
  let total = 0;
  for (const row of breakdown.results ?? []) {
    if (row.status in counts) counts[row.status] = Number(row.c);
    total += Number(row.c);
  }

  const unassignedRow = await db
    .prepare(`SELECT COUNT(*) AS c FROM leads WHERE assigned_to IS NULL`)
    .first<{ c: number }>();
  const unassigned = unassignedRow ? Number(unassignedRow.c) : 0;

  const urgentRow = await db
    .prepare(`SELECT COUNT(*) AS c FROM leads WHERE priority = 'urgent'`)
    .first<{ c: number }>();
  const urgent = urgentRow ? Number(urgentRow.c) : 0;

  // Priority distribution.
  const prioRows = await db
    .prepare(`SELECT priority, COUNT(*) AS c FROM leads GROUP BY priority`)
    .all<{ priority: string; c: number }>();
  const by_priority: Record<string, number> = {};
  for (const row of prioRows.results ?? []) {
    by_priority[row.priority] = Number(row.c);
  }

  const recentLeadsRows = await db
    .prepare(
      `SELECT l.id, l.name, l.email, l.phone, l.treatment_interest, l.message,
              l.status, l.priority, l.notes, l.assigned_to, l.created_at, l.updated_at,
              u.display_name AS assignee_name
       FROM leads l
       LEFT JOIN users u ON u.id = l.assigned_to
       ORDER BY l.updated_at DESC LIMIT ?1`,
    )
    .bind(recentLimit)
    .all<LeadRow>();
  const recent_leads = (recentLeadsRows.results ?? []).map(toLeadView);

  const recent_activity = await getTimeline(db, recentLimit);

  return {
    totals: {
      leads: total,
      leads_new: counts.new,
      leads_contacted: counts.contacted,
      leads_qualified: counts.qualified,
      leads_disqualified: counts.disqualified,
      unassigned,
      urgent,
    },
    by_priority,
    recent_leads,
    recent_activity,
  };
}

// ── Service: getTimeline ────────────────────────────────────────────

/**
 * Recent activity feed combining lead mutations (from leads.updated_at) and
 * authorization decisions (from audit_logs). Each event is normalised to a
 * TimelineEvent.
 */
export async function getTimeline(
  db: D1Database,
  limit = 15,
): Promise<TimelineEvent[]> {
  // Lead updates in the window.
  const leadRows = await db
    .prepare(
      `SELECT id, status, priority, assigned_to, updated_at
       FROM leads ORDER BY updated_at DESC LIMIT ?1`,
    )
    .bind(limit)
    .all<{
      id: string;
      status: string;
      priority: string;
      assigned_to: string | null;
      updated_at: string;
    }>();

  const leadEvents: TimelineEvent[] = (leadRows.results ?? []).map((r) => ({
    id: `lead:${r.id}:${r.updated_at}`,
    kind: "lead",
    lead_id: r.id,
    summary: `Lead updated — status=${r.status}, priority=${r.priority}${
      r.assigned_to ? `, assigned=${r.assigned_to}` : ", unassigned"
    }`,
    actor_id: r.assigned_to,
    occurred_at: r.updated_at,
  }));

  // Audit decisions in the window.
  const auditRows = await db
    .prepare(
      `SELECT id, actor_id, action, target_type, target_id, decision, created_at
       FROM audit_logs ORDER BY created_at DESC LIMIT ?1`,
    )
    .bind(limit)
    .all<{
      id: string;
      actor_id: string | null;
      action: string;
      target_type: string | null;
      target_id: string | null;
      decision: string;
      created_at: string;
    }>();

  const auditEvents: TimelineEvent[] = (auditRows.results ?? []).map((r) => ({
    id: `audit:${r.id}`,
    kind: "audit",
    lead_id: r.target_type === "lead" ? r.target_id : null,
    summary: `Auth ${r.decision} — ${r.action}${
      r.target_type ? ` on ${r.target_type}${r.target_id ? `:${r.target_id}` : ""}` : ""
    }`,
    actor_id: r.actor_id,
    occurred_at: r.created_at,
  }));

  // Merge + sort by time descending, cap to limit.
  const merged = [...leadEvents, ...auditEvents]
    .sort((a, b) => (a.occurred_at < b.occurred_at ? 1 : -1))
    .slice(0, limit);

  return merged;
}

// ── Error type ──────────────────────────────────────────────────────

/**
 * Typed error for service-level validation / lookup failures. The route layer
 * translates `status` into the HTTP response code.
 */
export class OpsServiceError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status: number = 400,
  ) {
    super(message);
    this.name = "OpsServiceError";
  }
}
