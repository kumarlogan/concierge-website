// ┌─────────────────────────────────────────────────────────────┐
// │ AI Platform — Message Audit Logger                             │
// ══════════════════════════════════════════════════════════

import type { Message, MessageStatus } from "./message-types.js";

export interface MessageAuditEvent {
  action: "sent" | "delivered" | "read" | "failed";
  messageId: string;
  threadId: string;
  performedBy: string;
  timestamp: string;
  metadata: Record<string, unknown>;
}

export interface MessageAuditLogger {
  log(event: MessageAuditEvent): Promise<void>;
  getThreadHistory(threadId: string): Promise<MessageAuditEvent[]>;
}