// ┌─────────────────────────────────────────────────────────────┐
// │ AG Synergy Platform — Operations API Route Handlers          │
// │ Phase 2: Operations Platform Foundation                      │
// │ EPIC-002-003A: Operations API Foundation                     │
// └─────────────────────────────────────────────────────────────┘
//
// Route handlers for the Operations interface. HTTP concerns ONLY:
//   - parse query string / JSON body
//   - call the ops service
//   - translate service results → HTTP responses
//
// Authorization is enforced by the auth middleware BEFORE these handlers run
// (the router registers them behind requirePermission guards in index.ts).
// Every handler here may assume a resolved Principal is attached to the
// request via the `ctx` extension below. This keeps RBAC logic out of the
// route layer entirely (ADR-003).
//
// Architecture: Request → Router → [auth middleware] → Route → Service → D1

import type { Env, RouteHandler } from "../types/env.js";
import {
  listLeads,
  getLead,
  updateLead,
  assignLead,
  myLeads,
  getDashboard,
  getTimeline,
  OpsServiceError,
  type LeadListQuery,
  type LeadUpdateInput,
} from "../services/opsService.js";

// ── Principal attachment ───────────────────────────────────────────
// The auth middleware resolves identity; we stash the Principal on the
// request object so handlers can read actingUserId without re-resolving.
// (Declared on Request via a module-augmentation-free symbol to avoid
// polluting the global Request type.)
const PRINCIPAL_KEY = Symbol.for("agsynergy.principal");

export interface OpsPrincipal {
  userId: string;
  roleName: string;
}

export function attachPrincipal(request: Request, principal: OpsPrincipal): void {
  (request as unknown as Record<symbol, OpsPrincipal>)[PRINCIPAL_KEY] = principal;
}

export function getPrincipal(request: Request): OpsPrincipal | undefined {
  return (request as unknown as Record<symbol, OpsPrincipal>)[PRINCIPAL_KEY];
}

// ── Helpers ─────────────────────────────────────────────────────────

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/** Parse a numeric query param, falling back to undefined. */
function num(param: string | null): number | undefined {
  if (param === null) return undefined;
  const n = Number(param);
  return Number.isNaN(n) ? undefined : n;
}

/** Build a typed LeadListQuery from a URL's search params. */
function parseListQuery(url: URL): LeadListQuery {
  const params = url.searchParams;
  const scopeRaw = params.get("scope");
  const scope =
    scopeRaw === "unassigned" || scopeRaw === "mine" || scopeRaw === "all"
      ? scopeRaw
      : "all";
  const sortRaw = params.get("sort");
  const sort =
    sortRaw === "created_at" ||
    sortRaw === "updated_at" ||
    sortRaw === "priority" ||
    sortRaw === "status"
      ? sortRaw
      : "created_at";
  const orderRaw = params.get("order");
  const order = orderRaw === "asc" ? "asc" : "desc";

  return {
    status: params.get("status") ?? undefined,
    priority: params.get("priority") ?? undefined,
    scope,
    limit: num(params.get("limit")),
    offset: num(params.get("offset")),
    sort,
    order,
  };
}

// ── GET /api/v1/ops/leads ───────────────────────────────────────────

export const listOpsLeads: RouteHandler = async (request, env, _params) => {
  const principal = getPrincipal(request);
  const query = parseListQuery(new URL(request.url));

  // Scope "mine" requires the acting user id.
  if (query.scope === "mine" && principal) {
    query.actingUserId = principal.userId;
  }

  try {
    const result = await listLeads(env.DB, query);
    return json({ success: true, ...result });
  } catch (err) {
    if (err instanceof OpsServiceError) {
      return json({ success: false, error: err.code, message: err.message }, err.status);
    }
    console.error("listOpsLeads failed:", err instanceof Error ? err.message : String(err));
    return json({ success: false, error: "internal_error", message: "Unexpected error" }, 500);
  }
};

// ── GET /api/v1/ops/leads/mine ──────────────────────────────────────

export const listMyLeads: RouteHandler = async (request, env, _params) => {
  const principal = getPrincipal(request);
  if (!principal) {
    return json({ success: false, error: "unauthenticated", message: "No principal" }, 401);
  }
  const url = new URL(request.url);
  try {
    const result = await myLeads(env.DB, principal.userId, {
      status: url.searchParams.get("status") ?? undefined,
      priority: url.searchParams.get("priority") ?? undefined,
      limit: num(url.searchParams.get("limit")),
      offset: num(url.searchParams.get("offset")),
      sort: (url.searchParams.get("sort") as LeadListQuery["sort"]) ?? "created_at",
      order: url.searchParams.get("order") === "asc" ? "asc" : "desc",
    });
    return json({ success: true, ...result });
  } catch (err) {
    console.error("listMyLeads failed:", err instanceof Error ? err.message : String(err));
    return json({ success: false, error: "internal_error", message: "Unexpected error" }, 500);
  }
};

// ── GET /api/v1/ops/leads/:id ───────────────────────────────────────

export const getOpsLead: RouteHandler = async (request, env, params) => {
  const leadId = params.id;
  if (!leadId) {
    return json({ success: false, error: "bad_request", message: "Missing lead id" }, 400);
  }
  const lead = await getLead(env.DB, leadId);
  if (!lead) {
    return json({ success: false, error: "not_found", message: "Lead not found" }, 404);
  }
  return json({ success: true, lead });
};

// ── PATCH /api/v1/ops/leads/:id ─────────────────────────────────────

export const patchOpsLead: RouteHandler = async (request, env, params) => {
  const leadId = params.id;
  if (!leadId) {
    return json({ success: false, error: "bad_request", message: "Missing lead id" }, 400);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ success: false, error: "validation_error", message: "Invalid JSON" }, 400);
  }
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return json({ success: false, error: "validation_error", message: "Body must be an object" }, 400);
  }

  const input = body as LeadUpdateInput;
  const principal = getPrincipal(request);
  const result = await updateLead(env.DB, leadId, input);
  if (!result.success) {
    return json({ success: false, error: result.error, message: result.message }, result.status);
  }
  // Audit log: record lead status changes for compliance (PRG-021).
  writeLeadAuditLog(
    env.DB,
    leadId,
    principal?.userId ?? null,
    `update_lead:${Object.keys(input).join(",")}`,
  ).catch(() => {/* non-critical */});
  return json({ success: true, lead: result.lead });
};

// ── POST /api/v1/ops/leads/:id/assign ───────────────────────────────

export const assignOpsLead: RouteHandler = async (request, env, params) => {
  const leadId = params.id;
  if (!leadId) {
    return json({ success: false, error: "bad_request", message: "Missing lead id" }, 400);
  }

  const principal = getPrincipal(request);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ success: false, error: "validation_error", message: "Invalid JSON" }, 400);
  }
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return json({ success: false, error: "validation_error", message: "Body must be an object" }, 400);
  }

  // { assignee_id: string | null }. Omitting → unassign.
  const assigneeId = (body as { assignee_id?: unknown }).assignee_id ?? null;
  if (assigneeId !== null && typeof assigneeId !== "string") {
    return json(
      { success: false, error: "validation_error", message: "assignee_id must be a string or null" },
      400,
    );
  }

  const result = await assignLead(
    env.DB,
    leadId,
    assigneeId as string | null,
    principal?.userId,
  );
  if (!result.success) {
    return json({ success: false, error: result.error, message: result.message }, result.status);
  }
  return json({ success: true, lead: result.lead });
};

// ── GET /api/v1/ops/dashboard ───────────────────────────────────────

export const getOpsDashboard: RouteHandler = async (_request, env, _params) => {
  try {
    const dashboard = await getDashboard(env.DB);
    return json({ success: true, dashboard });
  } catch (err) {
    console.error("getOpsDashboard failed:", err instanceof Error ? err.message : String(err));
    return json({ success: false, error: "internal_error", message: "Unexpected error" }, 500);
  }
};

// ── GET /api/v1/ops/timeline ────────────────────────────────────────

export const getOpsTimeline: RouteHandler = async (request, env, _params) => {
  const url = new URL(request.url);
  const limit = num(url.searchParams.get("limit")) ?? 15;
  try {
    const events = await getTimeline(env.DB, Math.min(Math.max(limit, 1), 100));
    return json({ success: true, events });
  } catch (err) {
    console.error("getOpsTimeline failed:", err instanceof Error ? err.message : String(err));
    return json({ success: false, error: "internal_error", message: "Unexpected error" }, 500);
  }
};


// ── Audit log helper ──────────────────────────────────────────────────────────
// Writes a record to audit_logs for every lead mutation. Fire-and-forget.
async function writeLeadAuditLog(
  db: any,
  leadId: string,
  actorId: string | null,
  action: string,
): Promise<void> {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  await db
    .prepare(
      `INSERT INTO audit_logs (id, actor_id, action, target_type, target_id, decision, created_at)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)`,
    )
    .bind(id, actorId, action, "lead", leadId, "ALLOW", now)
    .run();
}