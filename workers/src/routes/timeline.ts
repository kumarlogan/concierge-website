// ┌─────────────────────────────────────────────────────────────┐
// │ AG Synergy API — Timeline Routes                            │
// │ Workstream A: Patient Journey Timeline data                 │
// │ PATIENT ZERO EXPERIENCE — No fake healthcare data           │
// └─────────────────────────────────────────────────────────────┘

import type { Env, RouteHandler } from "../types/env.js";
import { withJwtAuth, getIdentityId } from "../middleware/jwt-auth.js";

// ── Data Types ────────────────────────────────────────────────

interface CarePlanPhase {
  id: string;
  name: string;
  description: string;
  order: number;
  status: "not_started" | "in_progress" | "completed";
  startDate: string | null;
  completedDate: string | null;
  tasks: string[];
}

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

interface Milestone {
  id: string;
  title: string;
  description: string;
  date: string;
  type: "registration" | "consultation" | "treatment_plan" | "procedure" | "follow_up" | "success";
  achieved: boolean;
  achievedAt: string | null;
}

interface TimelineData {
  carePlan: {
    phases: CarePlanPhase[];
    currentPhase: string | null;
    progressPercent: number;
  };
  tasks: Task[];
  milestones: Milestone[];
}

// ── Patient Zero Default State ────────────────────────────────
// A brand-new patient who has only completed registration
// must NEVER appear to have begun treatment.

function createPatientZeroData(): TimelineData {
  const now = new Date().toISOString();
  return {
    carePlan: {
      phases: [],
      currentPhase: null,
      progressPercent: 0,
    },
    tasks: [],
    milestones: [
      {
        id: "ms-registration",
        title: "Account Created",
        description: "Welcome to AG Synergy. Your fertility journey has not yet begun. Your next step is completing your profile and requesting your first consultation.",
        date: now,
        type: "registration",
        achieved: true,
        achievedAt: now,
      },
    ],
  };
}

// ── Per-Identity In-Memory Store ─────────────────────────────
// Each patient has their own store so no two patients share state.

const perIdentityTimelineStores = new Map<string, TimelineData>();

function getOrCreateTimelineStore(identityId: string): TimelineData {
  if (!perIdentityTimelineStores.has(identityId)) {
    perIdentityTimelineStores.set(identityId, createPatientZeroData());
  }
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  return perIdentityTimelineStores.get(identityId)!;
}

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
}): void {
  router.get("/api/v1/timeline", withJwtAuth(_getTimeline));
  router.get("/api/v1/timeline/phases", withJwtAuth(_getPhases));
  router.get("/api/v1/timeline/tasks", withJwtAuth(_getTasks));
  router.get("/api/v1/timeline/tasks/:id", withJwtAuth(_getTaskById));
  router.patch("/api/v1/timeline/tasks/:id", withJwtAuth(_updateTask));
  router.get("/api/v1/timeline/milestones", withJwtAuth(_getMilestones));
  router.get("/api/v1/timeline/milestones/:id", withJwtAuth(_getMilestoneById));
}

// ── Handler Implementations ──────────────────────────────────

async function _getTimeline(
  request: Request,
  _env: Env,
  _params: Record<string, string>,
): Promise<Response> {
  const identityId = getIdentityId(request);
  const store = getOrCreateTimelineStore(identityId);
  return json({ timeline: store });
}

async function _getPhases(
  request: Request,
  _env: Env,
  _params: Record<string, string>,
): Promise<Response> {
  const identityId = getIdentityId(request);
  const store = getOrCreateTimelineStore(identityId);
  return json({ phases: store.carePlan.phases, currentPhase: store.carePlan.currentPhase, progressPercent: store.carePlan.progressPercent });
}

async function _getTasks(
  request: Request,
  _env: Env,
  _params: Record<string, string>,
): Promise<Response> {
  const identityId = getIdentityId(request);
  const store = getOrCreateTimelineStore(identityId);
  const url = new URL(request.url);
  const status = url.searchParams.get("status");
  const phaseId = url.searchParams.get("phaseId");

  let tasks = [...store.tasks];
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
  const store = getOrCreateTimelineStore(identityId);
  const task = store.tasks.find((t) => t.id === params.id);
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
  const store = getOrCreateTimelineStore(identityId);
  const taskIndex = store.tasks.findIndex((t) => t.id === params.id);
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

    const task = store.tasks[taskIndex];
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

    store.tasks[taskIndex] = task;
    return json({ task });
  } catch (err) {
    return error(err instanceof Error ? err.message : "Failed to update task", 400);
  }
}

async function _getMilestones(
  request: Request,
  _env: Env,
  _params: Record<string, string>,
): Promise<Response> {
  const identityId = getIdentityId(request);
  const store = getOrCreateTimelineStore(identityId);
  const url = new URL(request.url);
  const achieved = url.searchParams.get("achieved");

  let milestones = [...store.milestones];
  if (achieved !== null) {
    const isAchieved = achieved === "true";
    milestones = milestones.filter((m) => m.achieved === isAchieved);
  }
  return json({ milestones });
}

async function _getMilestoneById(
  request: Request,
  _env: Env,
  params: Record<string, string>,
): Promise<Response> {
  const identityId = getIdentityId(request);
  const store = getOrCreateTimelineStore(identityId);
  const milestone = store.milestones.find((m) => m.id === params.id);
  if (!milestone) {
    return error("Milestone not found", 404);
  }
  return json({ milestone });
}