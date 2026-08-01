// ┌─────────────────────────────────────────────────────────────┐
// │ AG Synergy — Messaging API Client                              │
// │ Patient-facing API client for Secure Messaging.               │
// ═══════════════════════════════════════════════════════════

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

export interface Message {
  id: string;
  threadId: string;
  senderId: string;
  recipientId: string;
  type: string;
  status: string;
  subject: string | null;
  content: string;
  contentType: string;
  createdAt: string;
  sentAt: string | null;
  deliveredAt: string | null;
  readAt: string | null;
}

export interface MessageThread {
  threadId: string;
  lastMessage: Message;
  unreadCount: number;
}

export async function getThreads(): Promise<MessageThread[]> {
  const res = await authFetch(`${API_BASE}/api/v1/messages/threads`);
  if (!res.ok) throw new Error(`Failed to fetch threads: ${res.status}`);
  const data: { threads: MessageThread[] } = await res.json();
  return data.threads ?? [];
}

export async function getThreadMessages(threadId: string): Promise<Message[]> {
  const res = await authFetch(`${API_BASE}/api/v1/messages/threads/${threadId}`);
  if (!res.ok) throw new Error(`Failed to fetch messages: ${res.status}`);
  const data: { messages: Message[] } = await res.json();
  return data.messages ?? [];
}

export async function sendMessage(data: {
  threadId: string;
  recipientId: string;
  type: string;
  subject?: string;
  content: string;
  contentType?: string;
}): Promise<Message> {
  const res = await authFetch(`${API_BASE}/api/v1/messages`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`Failed to send message: ${res.status}`);
  const json: { message: Message } = await res.json();
  return json.message;
}

// ── Notification API ───────────────────────────────────────

export interface Notification {
  id: string;
  identityId: string;
  type: "appointment_reminder" | "medication_reminder" | "timeline_update" | "lab_result" | "document_shared" | "clinic_announcement" | "system";
  title: string;
  body: string;
  status: "unread" | "read" | "dismissed";
  priority: "critical" | "important" | "informational";
  channel: "in_app" | "sms" | "email" | "push";
  actionUrl: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  readAt: string | null;
}

export interface NotificationPreferences {
  identityId: string;
  channels: {
    sms: boolean;
    email: boolean;
    push: boolean;
    in_app: boolean;
  };
  dailyCap: number;
  quietHours: {
    enabled: boolean;
    start: string;
    end: string;
  };
  pauseNonCritical: boolean;
  typePreferences: Record<string, {
    channel: string[];
    enabled: boolean;
  }>;
}

export async function getNotifications(options?: {
  unreadOnly?: boolean;
  type?: string;
  limit?: number;
  offset?: number;
}): Promise<Notification[]> {
  const params = new URLSearchParams();
  if (options?.unreadOnly) params.set("unreadOnly", "true");
  if (options?.type) params.set("type", options.type);
  if (options?.limit) params.set("limit", String(options.limit));
  if (options?.offset) params.set("offset", String(options.offset));
  const qs = params.toString();
  const res = await authFetch(`${API_BASE}/api/v1/notifications${qs ? `?${qs}` : ""}`);
  if (!res.ok) throw new Error(`Failed to fetch notifications: ${res.status}`);
  const data: { notifications: Notification[] } = await res.json();
  return data.notifications ?? [];
}

export async function getUnreadCount(): Promise<number> {
  const res = await authFetch(`${API_BASE}/api/v1/notifications/unread-count`);
  if (!res.ok) return 0;
  const data: { unreadCount: number } = await res.json();
  return data.unreadCount ?? 0;
}

export async function markNotificationRead(id: string): Promise<void> {
  await authFetch(`${API_BASE}/api/v1/notifications/${id}/read`, { method: "PATCH" });
}

export async function markAllNotificationsRead(): Promise<number> {
  const res = await authFetch(`${API_BASE}/api/v1/notifications/read-all`, { method: "PATCH" });
  if (!res.ok) return 0;
  const data: { markedRead: number } = await res.json();
  return data.markedRead ?? 0;
}

export async function getNotificationPreferences(): Promise<NotificationPreferences> {
  const res = await authFetch(`${API_BASE}/api/v1/notifications/preferences`);
  if (!res.ok) throw new Error(`Failed to fetch preferences: ${res.status}`);
  const data: { preferences: NotificationPreferences } = await res.json();
  return data.preferences;
}

export async function updateNotificationPreferences(updates: Partial<NotificationPreferences>): Promise<NotificationPreferences> {
  const res = await authFetch(`${API_BASE}/api/v1/notifications/preferences`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(updates),
  });
  if (!res.ok) throw new Error(`Failed to update preferences: ${res.status}`);
  const data: { preferences: NotificationPreferences } = await res.json();
  return data.preferences;
}