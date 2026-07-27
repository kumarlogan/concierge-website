// ┌─────────────────────────────────────────────────────────────┐
// │ AI Platform — Secure Messaging Capability                     │
// │ Product-agnostic messaging with PHI isolation.               │
// │ Reusable across all AGS products.                            │
// │ Wave 7 — Appointment Management & Messaging                  │
// └─────────────────────────────────────────────────────────────┘
//
// PHI Boundary: Message content is treated as PHI. Content is
// stored encrypted; API responses return opaque metadata only.
// Sender and recipient are opaque identity IDs. Consent verification
// required before any message delivery.

import type { Message, CreateMessageRequest, ThreadQuery } from "./message-types.js";
import type { Decision } from "../trust/types.js";

export interface ConsentVerificationResult {
  decision: Decision;
  consentTypes: string[];
  verified: boolean;
}

export interface MessageEngine {
  /** Send a message, verifying consent and PHI compliance */
  send(request: CreateMessageRequest, consent: ConsentVerificationResult): Promise<Message>;
  /** Retrieve a message by ID */
  get(id: string): Promise<Message | null>;
  /** List messages in a thread */
  listThread(threadId: string, limit?: number, offset?: number): Promise<Message[]>;
  /** List threads for a participant */
  listThreads(participantId: string, limit?: number, offset?: number): Promise<{ threadId: string; lastMessage: Message; unreadCount: number }[]>;
  /** Update message delivery status */
  updateDeliveryStatus(id: string, status: "sent" | "delivered" | "read"): Promise<void>;
}