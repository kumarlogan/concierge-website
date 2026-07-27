// ┌─────────────────────────────────────────────────────────────┐
// │ AI Platform — In-Memory Message Engine                       │
// │ Concrete implementation of MessageEngine interface.          │
// │ Wave 8 — End-to-End Integration                              │
// └─────────────────────────────────────────────────────────────┘
//
// D1-backed implementation replaces this for production.
// PHI: message content is treated as encrypted at rest.

import { randomUUID } from "node:crypto";
import type { MessageEngine, ConsentVerificationResult } from "./message-engine.js";
import type {
  Message,
  CreateMessageRequest,
  ThreadQuery,
} from "./message-types.js";
import { MessageStatus } from "./message-types.js";

export class InMemoryMessageEngine implements MessageEngine {
  private messages = new Map<string, Message>();

  async send(
    request: CreateMessageRequest,
    consent: ConsentVerificationResult,
  ): Promise<Message> {
    if (!consent.verified) {
      throw new Error("Consent not verified for message delivery");
    }

    const now = new Date().toISOString();
    const message: Message = {
      id: randomUUID(),
      threadId: request.threadId,
      senderId: request.senderId,
      recipientId: request.recipientId,
      type: request.type,
      status: MessageStatus.SENT,
      subject: request.subject,
      content: request.content,
      contentType: request.contentType ?? "text/plain",
      metadata: request.metadata ?? {},
      createdAt: now,
      updatedAt: now,
      sentAt: now,
      deliveredAt: null,
      readAt: null,
    };

    this.messages.set(message.id, message);
    return message;
  }

  async get(id: string): Promise<Message | null> {
    return this.messages.get(id) ?? null;
  }

  async listThread(threadId: string, limit = 50, offset = 0): Promise<Message[]> {
    let results = Array.from(this.messages.values())
      .filter((m) => m.threadId === threadId)
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

    results = results.slice(offset, offset + limit);
    return results;
  }

  async listThreads(
    participantId: string,
    limit = 20,
    offset = 0,
  ): Promise<{ threadId: string; lastMessage: Message; unreadCount: number }[]> {
    const threadMap = new Map<string, Message[]>();

    for (const msg of this.messages.values()) {
      if (msg.senderId !== participantId && msg.recipientId !== participantId) continue;
      const existing = threadMap.get(msg.threadId) ?? [];
      existing.push(msg);
      threadMap.set(msg.threadId, existing);
    }

    const threads = Array.from(threadMap.entries()).map(([threadId, msgs]) => {
      msgs.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
      const lastMessage = msgs[msgs.length - 1];
      const unreadCount = msgs.filter(
        (m) => m.recipientId === participantId && m.status !== MessageStatus.READ,
      ).length;
      return { threadId, lastMessage, unreadCount };
    });

    // Sort by most recent last message
    threads.sort(
      (a, b) =>
        new Date(b.lastMessage.createdAt).getTime() -
        new Date(a.lastMessage.createdAt).getTime(),
    );

    return threads.slice(offset, offset + limit);
  }

  async updateDeliveryStatus(
    id: string,
    status: "sent" | "delivered" | "read",
  ): Promise<void> {
    const msg = this.messages.get(id);
    if (!msg) {
      throw new Error(`Message ${id} not found`);
    }

    const now = new Date().toISOString();
    const updated: Message = {
      ...msg,
      status: status as MessageStatus,
      updatedAt: now,
      ...(status === "delivered" ? { deliveredAt: now } : {}),
      ...(status === "read" ? { readAt: now } : {}),
    };

    this.messages.set(id, updated);
  }
}
