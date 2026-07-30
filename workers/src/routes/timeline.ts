// ┌─────────────────────────────────────────────────────────────┐
// │ AG Synergy API — Timeline Routes                            │
// │ Wave 3 — Timeline Engine (Platform-backed)                  │
// │ PATIENT ZERO EXPERIENCE — No fake healthcare data           │
// └─────────────────────────────────────────────────────────────┘

import type { Env, RouteHandler } from "../types/env.js";
import { withJwtAuth, getIdentityId } from "../middleware/jwt-auth.js";
import { timelineEngine } from "../platform/timeline/index.js";

// ── Helpers ──────────────────────────────────────────────────

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function error(message: string, status = 400): Response {
  return json({ error: message }, status);
}

// ── Route Registration ───────────────────────────────────────

export function registerTimelineRoutes(router: {
  get: (path: string, handler: RouteHandler) => void;
  patch: (path: string, handler: RouteHandler) => void;
  post: (path: string, handler: RouteHandler) => void;
}): void {
  router.get("/api/v1/timeline", withJwtAuth(_getTimeline));
  router.get("/api/v1/timeline/stages", withJwtAuth(_getStages));
  router.get("/api/v1/timeline/stages/current", withJwtAuth(_getCurrentStage));
  router.post("/api/v1/timeline/stages/advance", withJwtAuth(_advanceStage));
  router.get("/api/v1/timeline/milestones", withJwtAuth(_getMilestones));
  router.get("/api/v1/timeline/milestones/:id", withJwtAuth(_getMilestoneById));
  router.post("/api/v1/timeline/milestones", withJwtAuth(_createMilestone));
  router.post("/api/v1/timeline/milestones/:id/achieve", withJwtAuth(_achieveMilestone));
  router.get("/api/v1/timeline/events", withJwtAuth(_getEvents));
  router.get("/api/v1/timeline/progress", withJwtAuth(_getProgress));
  router.get("/api/v1/timeline/dates", withJwtAuth(_getExpectedDates));
  // Legacy routes (backward compatible)
  router.get("/api/v1/timeline/phases", withJwtAuth(_getPhases));
  router.get("/api/v1/timeline/tasks", withJwtAuth(_getTasks));
  router.get("/api/v1/timeline/tasks/:id", withJwtAuth(_getTaskById));
  router.patch("/api/v1/timeline/tasks/:id", withJwtAuth(_updateTask));
}

// ── Handler Implementations ──────────────────────────────────

async function _getTimeline(
  request: Request,
  _env: Env,
  _params: Record<string, string>,
): Promise<Response> {
  const identityId = getIdentityId(request);
  const timeline = await timelineEngine.getTimeline(identityId);
  return json({ timeline });
}

async function _getStages(
  request: Request,
  _env: Env,
  _params: Record<string, string>,
): Promise<Response> {
  const identityId = getIdentityId(request);
  const stages = await timelineEngine.getStages(identityId);
  return json({ stages });
}

async function _getCurrentStage(
  request: Request,
  _env: Env,
  _params: Record<string, string>,
): Promise<Response> {
  const identityId = getIdentityId(request);
  const stage = await timelineEngine.getCurrentStage(identityId);
  if (!stage) {
    return json({ stage: null, message: "All stages completed" });
  }
  return json({ stage });
}

async function _advanceStage(
  request: Request,
  _env: Env,
  _params: Record<string, string>,
): Promise<Response> {
  const identityId = getIdentityId(request);
  let notes: string | undefined;
  try {
    const body = (await request.json()) as { notes?: string };
    notes = body.notes;
  } catch {
    // No body, that's fine
  }
  try {
    const nextStage = await timelineEngine.advanceStage(identityId, notes);
    return json({ stage: nextStage });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to advance stage";
    return error(message, 400);
  }
}

async function _getMilestones(
  request: Request,
  _env: Env,
  _params: Record<string, string>,
): Promise<Response> {
  const identityId = getIdentityId(request);
  const url = new URL(request.url);
  const achieved = url.searchParams.get("achieved");
  const achievedFilter = achieved !== null ? achieved === "true" : undefined;
  const milestones = await timelineEngine.getMilestones(identityId, achievedFilter);
  return json({ milestones });
}

async function _getMilestoneById(
  request: Request,
  _env: Env,
  params: Record<string, string>,
): Promise<Response> {
  const identityId = getIdentityId(request);
  const milestone = await timelineEngine.getMilestone(identityId, params.id);
  if (!milestone) {
    return error("Milestone not found", 404);
  }
  return json({ milestone });
}

async function _createMilestone(
  request: Request,
  _env: Env,
  _params: Record<string, string>,
): Promise<Response> {
  const identityId = getIdentityId(request);
  try {
    const body = (await request.json()) as {
      type: string;
      title: string;
      description: string;
      expectedDate?: string;
    };
    const milestone = await timelineEngine.createMilestone(
      identityId,
      body.type as any,
      body.title,
      body.description,
      body.expectedDate,
    );
    return json({ milestone }, 201);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to create milestone";
    return error(message, 400);
  }
}

async function _achieveMilestone(
  request: Request,
  _env: Env,
  params: Record<string, string>,
): Promise<Response> {
  const identityId = getIdentityId(request);
  try {
    const milestone = await timelineEngine.achieveMilestone(identityId, params.id);
    return json({ milestone });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to achieve milestone";
    return error(message, 404);
  }
}

async function _getEvents(
  request: Request,
  _env: Env,
  _params: Record<string, string>,
): Promise<Response> {
  const identityId = getIdentityId(request);
  const url = new URL(request.url);
  const category = url.searchParams.get("category") as any;
  const events = await timelineEngine.getEvents(identityId, category ?? undefined);
  return json({ events });
}

async function _getProgress(
  request: Request,
  _env: Env,
  _params: Record<string, string>,
): Promise<Response> {
  const identityId = getIdentityId(request);
  const progress = await timelineEngine.getProgress(identityId);
  return json({ progress });
}

async function _getExpectedDates(
  request: Request,
  _env: Env,
  _params: Record<string, string>,
): Promise<Response> {
  const identityId = getIdentityId(request);
  const dates = await timelineEngine.getExpectedDates(identityId);
  return json({ expectedDates: dates });
}

// ── Legacy Routes (Phase 2 backward compat) ─────────────────

async function _getPhases(
  request: Request,
  _env: Env,
  _params: Record<string, string>,
): Promise<Response> {
  const identityId = getIdentityId(request);
  const stages = await timelineEngine.getStages(identityId);
  const currentStage = await timelineEngine.getCurrentStage(identityId);
  const progress = await timelineEngine.getProgress(identityId);

  const phases = stages.map((s) => ({
    id: s.stage,
    name: s.label,
    description: `${s.label} stage of IVF treatment journey.`,
    order: IVF_STAGES.indexOf(s.stage) + 1,
    status: s.status === "active" ? "in_progress" : s.status,
    startDate: s.enteredAt,
    completedDate: s.completedAt,
    tasks: [],
  }));

  return json({
    phases,
    currentPhase: currentStage?.stage ?? null,
    progressPercent: progress.overallPercent,
  });
}

// Import for backward compat
import { IVF_STAGES } from "../platform/timeline/index.js";

// ── Legacy Task Types (kept for backward compat) ─────────────

interface Task {
  id: string;
  title: string;
  description: string;
  phaseId: string;
  status: "pending" | "in_progress" | "completed";
  dueDate: string | null;
  completedAt: string | null;
  createdAt: string;
}

const perIdentityTaskStores = new Map<string, Task[]>();

function getOrCreateTaskStore(identityId: string): Task[] {
  if (!perIdentityTaskStores.has(identityId)) {
    perIdentityTaskStores.set(identityId, []);
  }
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  return perIdentityTaskStores.get(identityId)!;
}

async function _getTasks(
  request: Request,
  _env: Env,
  _params: Record<string, string>,
): Promise<Response> {
  const identityId = getIdentityId(request);
  const store = getOrCreateTaskStore(identityId);
  const url = new URL(request.url);
  const status = url.searchParams.get("status");
  const phaseId = url.searchParams.get("phaseId");

  let tasks = [...store];
  if (status) {
    tasks = tasks.filter((t) => t.status === status);
  }
  if (phaseId) {
    tasks = tasks.filter((t) => t.phaseId === phaseId);
  }
  return json({ tasks });
}

async function _getTaskById(
  request: Request,
  _env: Env,
  params: Record<string, string>,
): Promise<Response> {
  const identityId = getIdentityId(request);
  const store = getOrCreateTaskStore(identityId);
  const task = store.find((t) => t.id === params.id);
  if (!task) {
    return error("Task not found", 404);
  }
  return json({ task });
}

async function _updateTask(
  request: Request,
  _env: Env,
  params: Record<string, string>,
): Promise<Response> {
  const identityId = getIdentityId(request);
  const store = getOrCreateTaskStore(identityId);
  const taskIndex = store.findIndex((t) => t.id === params.id);
  if (taskIndex === -1) {
    return error("Task not found", 404);
  }

  try {
    const body = (await request.json()) as Partial<{
      status: string;
      title: string;
      description: string;
      dueDate: string;
    }>;

    const task = store[taskIndex];
    if (body.status !== undefined) {
      task.status = body.status as Task["status"];
      if (body.status === "completed") {
        task.completedAt = new Date().toISOString();
      } else {
        task.completedAt = null;
      }
    }
    if (body.title !== undefined) task.title = body.title;
    if (body.description !== undefined) task.description = body.description;
    if (body.dueDate !== undefined) task.dueDate = body.dueDate;

    store[taskIndex] = task;
    return json({ task });
  } catch (err) {
    return error(err instanceof Error ? err.message : "Failed to update task", 400);
  }
}