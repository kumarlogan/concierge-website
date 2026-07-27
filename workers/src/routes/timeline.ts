// ┌─────────────────────────────────────────────────────────────┐
// │ AG Synergy API — Timeline Routes                            │
// │ Workstream A: Patient Journey Timeline data                 │
// └─────────────────────────────────────────────────────────────┘

import type { Env, RouteHandler } from "../types/env.js";

// ── Mock Data ────────────────────────────────────────────────

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

const mockTimelineData: TimelineData = {
  carePlan: {
    phases: [
      {
        id: "phase-1",
        name: "Initial Consultation",
        description: "Complete your initial consultation with our fertility specialist to discuss your medical history and treatment goals.",
        order: 1,
        status: "completed",
        startDate: "2025-01-15T09:00:00Z",
        completedDate: "2025-01-20T11:00:00Z",
        tasks: ["Register with clinic", "Complete medical history form", "Attend initial consultation"],
      },
      {
        id: "phase-2",
        name: "Diagnostic Testing",
        description: "Undergo recommended diagnostic tests to assess fertility health and identify any underlying conditions.",
        order: 2,
        status: "completed",
        startDate: "2025-02-01T08:00:00Z",
        completedDate: "2025-02-15T16:00:00Z",
        tasks: ["Blood work panel", "Ultrasound scan", "Semen analysis (if applicable)"],
      },
      {
        id: "phase-3",
        name: "Treatment Planning",
        description: "Work with your care team to develop a personalized fertility treatment plan based on diagnostic results.",
        order: 3,
        status: "in_progress",
        startDate: "2025-03-01T10:00:00Z",
        completedDate: null,
        tasks: ["Review diagnostic results", "Discuss treatment options", "Finalize treatment plan", "Consent to procedures"],
      },
      {
        id: "phase-4",
        name: "Treatment Cycle",
        description: "Begin your fertility treatment cycle, including medication, monitoring, and the treatment procedure.",
        order: 4,
        status: "not_started",
        startDate: null,
        completedDate: null,
        tasks: ["Medication orientation", "Monitoring appointments", "Procedure day preparation", "Treatment procedure"],
      },
      {
        id: "phase-5",
        name: "Recovery & Follow-up",
        description: "Post-treatment recovery, follow-up appointments, and ongoing support from your care team.",
        order: 5,
        status: "not_started",
        startDate: null,
        completedDate: null,
        tasks: ["Post-procedure recovery", "Follow-up appointment", "Pregnancy test (if applicable)", "Ongoing support check-in"],
      },
    ],
    currentPhase: "phase-3",
    progressPercent: 40,
  },
  tasks: [
    {
      id: "task-1",
      title: "Review diagnostic results",
      description: "Log into the portal to review your recent diagnostic test results before your next appointment.",
      phaseId: "phase-3",
      status: "completed",
      dueDate: "2025-03-05T23:59:00Z",
      completedAt: "2025-03-04T14:30:00Z",
      createdAt: "2025-03-01T10:00:00Z",
    },
    {
      id: "task-2",
      title: "Discuss treatment options",
      description: "Attend consultation with Dr. Sharma to discuss available treatment options based on your results.",
      phaseId: "phase-3",
      status: "in_progress",
      dueDate: "2025-03-12T23:59:00Z",
      completedAt: null,
      createdAt: "2025-03-01T10:00:00Z",
    },
    {
      id: "task-3",
      title: "Finalize treatment plan",
      description: "Review and finalize your personalized treatment plan with your care coordinator.",
      phaseId: "phase-3",
      status: "pending",
      dueDate: "2025-03-20T23:59:00Z",
      completedAt: null,
      createdAt: "2025-03-01T10:00:00Z",
    },
    {
      id: "task-4",
      title: "Consent to procedures",
      description: "Review and sign consent forms for your chosen treatment procedures.",
      phaseId: "phase-3",
      status: "pending",
      dueDate: "2025-03-25T23:59:00Z",
      completedAt: null,
      createdAt: "2025-03-01T10:00:00Z",
    },
    {
      id: "task-5",
      title: "Blood work panel",
      description: "Complete the full blood work panel ordered by your fertility specialist.",
      phaseId: "phase-2",
      status: "completed",
      dueDate: "2025-02-05T23:59:00Z",
      completedAt: "2025-02-03T09:15:00Z",
      createdAt: "2025-02-01T08:00:00Z",
    },
    {
      id: "task-6",
      title: "Medication orientation",
      description: "Attend medication orientation session to learn about your treatment medications and schedule.",
      phaseId: "phase-4",
      status: "pending",
      dueDate: "2025-04-01T23:59:00Z",
      completedAt: null,
      createdAt: "2025-03-01T10:00:00Z",
    },
  ],
  milestones: [
    {
      id: "ms-1",
      title: "Account Created",
      description: "Your patient portal account was successfully created.",
      date: "2025-01-10T00:00:00Z",
      type: "registration",
      achieved: true,
      achievedAt: "2025-01-10T14:00:00Z",
    },
    {
      id: "ms-2",
      title: "Initial Consultation Completed",
      description: "You completed your initial consultation with our fertility specialist.",
      date: "2025-01-20T00:00:00Z",
      type: "consultation",
      achieved: true,
      achievedAt: "2025-01-20T11:00:00Z",
    },
    {
      id: "ms-3",
      title: "Diagnostics Completed",
      description: "All recommended diagnostic tests have been completed and results are available.",
      date: "2025-02-15T00:00:00Z",
      type: "consultation",
      achieved: true,
      achievedAt: "2025-02-15T16:00:00Z",
    },
    {
      id: "ms-4",
      title: "Treatment Plan Finalized",
      description: "Your personalized treatment plan will be finalized with your care team.",
      date: "2025-03-20T00:00:00Z",
      type: "treatment_plan",
      achieved: false,
      achievedAt: null,
    },
    {
      id: "ms-5",
      title: "Treatment Cycle Started",
      description: "Your first treatment cycle begins — an important step forward.",
      date: "2025-04-01T00:00:00Z",
      type: "procedure",
      achieved: false,
      achievedAt: null,
    },
    {
      id: "ms-6",
      title: "Procedure Day",
      description: "Your scheduled treatment procedure day. Your care team will be with you every step.",
      date: "2025-04-15T00:00:00Z",
      type: "procedure",
      achieved: false,
      achievedAt: null,
    },
    {
      id: "ms-7",
      title: "Follow-up Complete",
      description: "Post-treatment follow-up appointment to check on your recovery and next steps.",
      date: "2025-05-01T00:00:00Z",
      type: "follow_up",
      achieved: false,
      achievedAt: null,
    },
  ],
};

// ── In-Memory Store (singleton) ────────────────────────────────

function getTimelineStore(_env: Env): TimelineData {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if (!(globalThis as any).__timelineStore) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis as any).__timelineStore = { ...mockTimelineData };
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (globalThis as any).__timelineStore;
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
  router.get("/api/v1/timeline", _getTimeline);
  router.get("/api/v1/timeline/phases", _getPhases);
  router.get("/api/v1/timeline/tasks", _getTasks);
  router.get("/api/v1/timeline/tasks/:id", _getTaskById);
  router.patch("/api/v1/timeline/tasks/:id", _updateTask);
  router.get("/api/v1/timeline/milestones", _getMilestones);
  router.get("/api/v1/timeline/milestones/:id", _getMilestoneById);
}

// ── Handler Implementations ──────────────────────────────────

async function _getTimeline(
  _request: Request,
  env: Env,
  _params: Record<string, string>,
): Promise<Response> {
  const store = getTimelineStore(env);
  return json({ timeline: store });
}

async function _getPhases(
  _request: Request,
  env: Env,
  _params: Record<string, string>,
): Promise<Response> {
  const store = getTimelineStore(env);
  return json({ phases: store.carePlan.phases, currentPhase: store.carePlan.currentPhase, progressPercent: store.carePlan.progressPercent });
}

async function _getTasks(
  request: Request,
  env: Env,
  _params: Record<string, string>,
): Promise<Response> {
  const store = getTimelineStore(env);
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
  _request: Request,
  env: Env,
  params: Record<string, string>,
): Promise<Response> {
  const store = getTimelineStore(env);
  const task = store.tasks.find((t) => t.id === params.id);
  if (!task) {
    return error("Task not found", 404);
  }
  return json({ task });
}

async function _updateTask(
  request: Request,
  env: Env,
  params: Record<string, string>,
): Promise<Response> {
  const store = getTimelineStore(env);
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
  env: Env,
  _params: Record<string, string>,
): Promise<Response> {
  const store = getTimelineStore(env);
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
  _request: Request,
  env: Env,
  params: Record<string, string>,
): Promise<Response> {
  const store = getTimelineStore(env);
  const milestone = store.milestones.find((m) => m.id === params.id);
  if (!milestone) {
    return error("Milestone not found", 404);
  }
  return json({ milestone });
}