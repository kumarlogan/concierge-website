// ┌─────────────────────────────────────────────────────────────┐
// │ AG Synergy — Messaging API Client                              │
// │ Patient-facing API client for Secure Messaging.               │
// ═══════════════════════════════════════════════════════════

const API_BASE = import.meta.env.VITE_API_BASE ?? "";

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
  const res = await fetch(`${API_BASE}/api/v1/messages/threads`);
  if (!res.ok) throw new Error(`Failed to fetch threads: ${res.status}`);
  const data: { threads: MessageThread[] } = await res.json();
  return data.threads ?? [];
}

export async function getThreadMessages(threadId: string): Promise<Message[]> {
  const res = await fetch(`${API_BASE}/api/v1/messages/threads/${threadId}`);
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
  const res = await fetch(`${API_BASE}/api/v1/messages`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`Failed to send message: ${res.status}`);
  const json: { message: Message } = await res.json();
  return json.message;
}