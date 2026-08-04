// ┌─────────────────────────────────────────────────────────────┐
// │ AG Synergy — Workflow API Client (Wave 8)                    │
// │ Consumes the Workflow Engine REST API.                       │
// └─────────────────────────────────────────────────────────────┘

import { tokenStore } from "./patient-api";

const API_BASE = import.meta.env.VITE_API_BASE ?? "";

async function authFetch(input: RequestInfo, init?: RequestInit): Promise<Response> {
  const token = tokenStore.getAccessToken();
  const headers = new Headers(init?.headers);
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  headers.set("Content-Type", "application/json");
  return fetch(input, { ...init, headers });
}

// ═══════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════

export interface WorkflowInstance {
  id: string;
  workflowType: string;
  currentState: string;
  stateHistory: string[];
  context: Record<string, unknown>;
  priority: "low" | "medium" | "high" | "urgent";
  createdAt: string;
  updatedAt: string;
  slaDeadline?: string;
  progress?: number;
  approvalGates?: ApprovalGateStatus[];
  timelineEvents?: TimelineEvent[];
}

export interface ApprovalGateStatus {
  gateType: string;
  status: "pending" | "approved" | "rejected" | "escalated";
  description?: string;
  decidedAt?: string;
  decidedBy?: string;
}

export interface TimelineEvent {
  title: string;
  description?: string;
  timestamp: string;
}

export interface TaskInstance {
  id: string;
  workflowInstanceId: string;
  title: string;
  description?: string;
  state: string;
  priority: string;
  assignedTo?: string;
  dueDate?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AuditEntry {
  id: string;
  workflowInstanceId: string;
  action: string;
  actor: string;
  details?: Record<string, unknown>;
  timestamp: string;
}

export interface WorkflowListResponse {
  workflows: WorkflowInstance[];
  total: number;
  page: number;
  pageSize: number;
}

// ═══════════════════════════════════════════════════════════
// API Functions
// ═══════════════════════════════════════════════════════════

export async function getWorkflows(params?: {
  page?: number;
  pageSize?: number;
  state?: string;
  type?: string;
}): Promise<WorkflowListResponse> {
  const q = new URLSearchParams();
  if (params?.page) q.set("page", String(params.page));
  if (params?.pageSize) q.set("pageSize", String(params.pageSize));
  if (params?.state) q.set("state", params.state);
  if (params?.type) q.set("type", params.type);
  const res = await authFetch(`${API_BASE}/api/v1/workflows?${q.toString()}`);
  if (!res.ok) throw new Error(`Failed to fetch workflows: ${res.status}`);
  return res.json();
}

export async function getWorkflow(id: string): Promise<WorkflowInstance> {
  const res = await authFetch(`${API_BASE}/api/v1/workflows/${id}`);
  if (!res.ok) throw new Error(`Failed to fetch workflow: ${res.status}`);
  return res.json();
}

export async function getWorkflowTasks(workflowId: string): Promise<TaskInstance[]> {
  const res = await authFetch(`${API_BASE}/api/v1/workflows/${workflowId}/tasks`);
  if (!res.ok) throw new Error(`Failed to fetch tasks: ${res.status}`);
  return res.json();
}

export async function getWorkflowAudit(workflowId: string): Promise<AuditEntry[]> {
  const res = await authFetch(`${API_BASE}/api/v1/workflows/${workflowId}/audit`);
  if (!res.ok) throw new Error(`Failed to fetch audit: ${res.status}`);
  return res.json();
}

export async function advanceWorkflowStage(id: string, action: string): Promise<WorkflowInstance> {
  const res = await authFetch(`${API_BASE}/api/v1/workflows/${id}/advance`, {
    method: "POST",
    body: JSON.stringify({ action }),
  });
  if (!res.ok) throw new Error(`Failed to advance workflow: ${res.status}`);
  return res.json();
}

export async function requestApproval(workflowId: string, gateType: string): Promise<WorkflowInstance> {
  const res = await authFetch(`${API_BASE}/api/v1/workflows/${workflowId}/approve`, {
    method: "POST",
    body: JSON.stringify({ gateType }),
  });
  if (!res.ok) throw new Error(`Failed to request approval: ${res.status}`);
  return res.json();
}

export async function submitApprovalDecision(workflowId: string, gateType: string, decision: "approve" | "reject", evidence?: string): Promise<WorkflowInstance> {
  const res = await authFetch(`${API_BASE}/api/v1/workflows/${workflowId}/approval-decision`, {
    method: "POST",
    body: JSON.stringify({ gateType, decision, evidence }),
  });
  if (!res.ok) throw new Error(`Failed to submit approval: ${res.status}`);
  return res.json();
}