// ┌─────────────────────────────────────────────────────────────┐
// │ AG Synergy API — Timeline Routes                              │
// │ Wave 3 — Patient Journey Timeline                            │
// │ PATIENT ZERO EXPERIENCE — No fake healthcare data           │
// └─────────────────────────────────────────────────────────────┘

import type { Env, RouteHandler } from "../types/env.js";
import { withJwtAuth, getIdentityId } from "../middleware/jwt-auth.js";
import { D1TimelineEngine } from "../platform/timeline/d1-timeline-engine.js";
import type { TimelineEngine } from "../platform/timeline/index.js";
import type { IvfStage, StageStatus, Milestone, TimelineEvent, ProgressSummary, ExpectedDateInfo, FullTimeline } from "../platform/timeline/index.js";

// ── Engine Instance ────────────────────────────────────────
// PRG-006: migrated from per-request InMemoryTimelineEngine to
// D1-backed D1TimelineEngine for persistent patient state.

function getEngine(env: Env): TimelineEngine {
  return new D1TimelineEngine(env.DB);
}

// ── Helper ─────────────────────────────────────────────────

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function error(message: string, status = 400): Response {
  return json({ error: message }, status);
}

// ── Route Registration ─────────────────────────────────────

export function registerTimelineRoutes(router: {
  get: (path: string, handler: RouteHandler) => void;
  patch: (path: string, handler: RouteHandler) => void;
}): void {
  router.get("/api/v1/timeline", withJwtAuth(_getTimeline));
  router.get("/api/v1/timeline/stages", withJwtAuth(_getStages));
  router.get("/api/v1/timeline/stages/:stage", withJwtAuth(_getStage));
  router.patch("/api/v1/timeline/stages/:stage/advance", withJwtAuth(_advanceStage));
  router.get("/api/v1/timeline/milestones", withJwtAuth(_getMilestones));
  router.get("/api/v1/timeline/milestones/:id", withJwtAuth(_getMilestoneById));
  router.patch("/api/v1/timeline/milestones/:id/achieve", withJwtAuth(_achieveMilestone));
  router.get("/api/v1/timeline/events", withJwtAuth(_getEvents));
  router.get("/api/v1/timeline/progress", withJwtAuth(_getProgress));
  router.get("/api/v1/timeline/expected-dates", withJwtAuth(_getExpectedDates));
}

// ── Handler Implementations ────────────────────────────────

async function _getTimeline(
  request: Request,
  env: Env,
  _params: Record<string, string>,
): Promise<Response> {
  const identityId = getIdentityId(request);
  const engine = getEngine(env);
  const timeline = await engine.getTimeline(identityId);
  return json({ timeline });
}

async function _getStages(
  request: Request,
  env: Env,
  _params: Record<string, string>,
): Promise<Response> {
  const identityId = getIdentityId(request);
  const engine = getEngine(env);
  const stages = await engine.getStages(identityId);
  return json({ stages });
}

async function _getStage(
  request: Request,
  env: Env,
  params: Record<string, string>,
): Promise<Response> {
  const identityId = getIdentityId(request);
  const stage = params.stage as IvfStage;
  const engine = getEngine(env);
  const result = await engine.getStage(identityId, stage);
  if (!result) {
    return error("Stage not found", 404);
  }
  return json({ stage: result });
}

async function _advanceStage(
  request: Request,
  env: Env,
  params: Record<string, string>,
): Promise<Response> {
  const identityId = getIdentityId(request);
  const stage = params.stage as IvfStage;
  const engine = getEngine(env);

  try {
    const body = (await request.json()) as { notes?: string };
    const notes = body.notes ?? "";

    // Validate stage exists and is active
    const currentStage = await engine.getStage(identityId, stage);
    if (!currentStage) {
      return error(`Stage not found: ${stage}`, 404);
    }

    // For advance, we advance the current active stage
    const result = await engine.advanceStage(identityId, notes);
    return json({ stage: result });
  } catch (err) {
    return error(err instanceof Error ? err.message : "Failed to advance stage", 400);
  }
}

async function _getMilestones(
  request: Request,
  env: Env,
  _params: Record<string, string>,
): Promise<Response> {
  const identityId = getIdentityId(request);
  const engine = getEngine(env);
  const milestones = await engine.getMilestones(identityId);
  return json({ milestones });
}

async function _getMilestoneById(
  request: Request,
  env: Env,
  params: Record<string, string>,
): Promise<Response> {
  const identityId = getIdentityId(request);
  const engine = getEngine(env);
  const milestone = await engine.getMilestone(identityId, params.id);
  if (!milestone) {
    return error("Milestone not found", 404);
  }
  return json({ milestone });
}

async function _achieveMilestone(
  request: Request,
  env: Env,
  params: Record<string, string>,
): Promise<Response> {
  const identityId = getIdentityId(request);
  const engine = getEngine(env);
  try {
    const milestone = await engine.achieveMilestone(identityId, params.id);
    return json({ milestone });
  } catch (err) {
    return error(err instanceof Error ? err.message : "Failed to achieve milestone", 400);
  }
}

async function _getEvents(
  request: Request,
  env: Env,
  _params: Record<string, string>,
): Promise<Response> {
  const identityId = getIdentityId(request);
  const engine = getEngine(env);
  const events = await engine.getEvents(identityId);
  return json({ events });
}

async function _getProgress(
  request: Request,
  env: Env,
  _params: Record<string, string>,
): Promise<Response> {
  const identityId = getIdentityId(request);
  const engine = getEngine(env);
  const progress = await engine.getProgress(identityId);
  return json({ progress });
}

async function _getExpectedDates(
  request: Request,
  env: Env,
  _params: Record<string, string>,
): Promise<Response> {
  const identityId = getIdentityId(request);
  const engine = getEngine(env);
  const dates = await engine.getExpectedDates(identityId);
  return json({ expectedDates: dates });
}
