// ┌─────────────────────────────────────────────────────────────┐
// │ AI Platform — Message Types                                  │
// ════════════════════════════════════════════════════════════

export enum MessageStatus {
  DRAFT = "draft",
  SENT = "sent",
  DELIVERED = "delivered",
  READ = "read",
  FAILED = "failed",
}

export enum MessageType {
  TEXT = "text",
  SYSTEM = "system",
  NOTIFICATION = "notification",
  DOCUMENT_REFERENCE = "document_reference",
  APPOINTMENT_CONFIRMATION = "appointment_confirmation",
  APPOINTMENT_REMINDER = "appointment_reminder",
}

export interface Message {
  id: string;
  threadId: string;
  senderId: string;        // opaque identity reference
  recipientId: string;      // opaque identity reference
  type: MessageType;
  status: MessageStatus;
  subject: string | null;
  content: string;          // encrypted at rest; plaintext only in memory
  contentType: string;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  sentAt: string | null;
  deliveredAt: string | null;
  readAt: string | null;
}

export interface CreateMessageRequest {
  threadId: string;
  senderId: string;
  recipientId: string;
  type: MessageType;
  subject: string | null;
  content: string;
  contentType?: string;
  metadata?: Record<string, unknown>;
}

export interface ThreadQuery {
  participantId: string;
  limit?: number;
  offset?: number;
  unreadOnly?: boolean;
}