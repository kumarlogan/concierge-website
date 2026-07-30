// ┌─────────────────────────────────────────────────────────────┐
// │ Concierge Product — Timeline API Client                      │
// │ Consumes the Workstream A Timeline REST API.                 │
// └─────────────────────────────────────────────────────────────┘

import { tokenStore } from "./patient-api";

const API_BASE = import.meta.env.VITE_API_BASE ?? "";

// ── Authenticated fetch helper ────────────────────────────

async function authFetch(input: RequestInfo, init?: RequestInit): Promise<Response> {
  const token = tokenStore.getAccessToken();
  const headers: Record<string, string> = {
    ...(init?.headers as Record<string, string>),
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  return fetch(input, { ...init, headers });
}

export interface CarePlanPhase {
  id: string;
  name: string;
  description: string;
  order: number;
  status: "not_started" | "in_progress" | "completed";
  startDate: string | null;
  completedDate: string | null;
  tasks: string[];
}

export interface Task {
  id: string;
  title: string;
  description: string;
  phaseId: string;
  status: "pending" | "in_progress" | "completed";
  dueDate: string | null;
  completedAt: string | null;
  createdAt: string;
}

export interface Milestone {
  id: string;
  title: string;
  description: string;
  date: string;
  type: "registration" | "consultation" | "treatment_plan" | "procedure" | "follow_up" | "success";
  achieved: boolean;
  achievedAt: string | null;
}

export interface TimelineData {
  carePlan: {
    phases: CarePlanPhase[];
    currentPhase: string | null;
    progressPercent: number;
  };
  tasks: Task[];
  milestones: Milestone[];
}

export async function getTimeline(): Promise<TimelineData> {
  const res = await authFetch(`${API_BASE}/api/v1/timeline`);
  if (!res.ok) throw new Error(`Failed to fetch timeline: ${res.status}`);
  const data: { timeline: TimelineData } = await res.json();
  return data.timeline;
}

export async function getPhases(): Promise<{ phases: CarePlanPhase[]; currentPhase: string | null; progressPercent: number }> {
  const res = await authFetch(`${API_BASE}/api/v1/timeline/phases`);
  if (!res.ok) throw new Error(`Failed to fetch phases: ${res.status}`);
  return res.json();
}

export async function getTasks(filters?: { status?: string; phaseId?: string }): Promise<Task[]> {
  const params = new URLSearchParams();
  if (filters?.status) params.set("status", filters.status);
  if (filters?.phaseId) params.set("phaseId", filters.phaseId);
  const qs = params.toString();
  const res = await authFetch(`${API_BASE}/api/v1/timeline/tasks${qs ? `?${qs}` : ""}`);
  if (!res.ok) throw new Error(`Failed to fetch tasks: ${res.status}`);
  const data: { tasks: Task[] } = await res.json();
  return data.tasks;
}

export async function getTask(id: string): Promise<Task> {
  const res = await authFetch(`${API_BASE}/api/v1/timeline/tasks/${id}`);
  if (!res.ok) throw new Error(`Failed to fetch task: ${res.status}`);
  const data: { task: Task } = await res.json();
  return data.task;
}

export async function updateTask(id: string, updates: Partial<{ status: string; title: string; description: string; dueDate: string }>): Promise<Task> {
  const res = await authFetch(`${API_BASE}/api/v1/timeline/tasks/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(updates),
  });
  if (!res.ok) throw new Error(`Failed to update task: ${res.status}`);
  const data: { task: Task } = await res.json();
  return data.task;
}

export async function getMilestones(filters?: { achieved?: boolean }): Promise<Milestone[]> {
  const params = new URLSearchParams();
  if (filters?.achieved !== undefined) params.set("achieved", String(filters.achieved));
  const qs = params.toString();
  const res = await authFetch(`${API_BASE}/api/v1/timeline/milestones${qs ? `?${qs}` : ""}`);
  if (!res.ok) throw new Error(`Failed to fetch milestones: ${res.status}`);
  const data: { milestones: Milestone[] } = await res.json();
  return data.milestones;
}

export async function getMilestone(id: string): Promise<Milestone> {
  const res = await authFetch(`${API_BASE}/api/v1/timeline/milestones/${id}`);
  if (!res.ok) throw new Error(`Failed to fetch milestone: ${res.status}`);
  const data: { milestone: Milestone } = await res.json();
  return data.milestone;
}