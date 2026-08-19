// ┌─────────────────────────────────────────────────────────────┐
// │ AI Platform — D1 Message Store                                │
// │ Phase 2.1 — BLOCKER 3 remediation                           │
// │ D1-backed implementation of MessageEngine interface.       │
// │ Replaces InMemoryMessageEngine to eliminate data-loss risk  │
// │ on Worker restarts.                                         │
// └─────────────────────────────────────────────────────────────┘
//
// PHI Boundary: message content is encrypted by the runtime
// envelope before storage. This store handles persistence only;
// encryption/decryption happens at the service layer above.

import type { D1Database } from "@cloudflare/workers-types";
import type { MessageEngine, ConsentVerificationResult } from "./message-engine.js";
import type {
  Message,
  CreateMessageRequest,
  ThreadQuery,
} from "./message-types.js";
import { MessageStatus, MessageType } from "./message-types.js";

export class D1MessageStore implements MessageEngine {
  constructor(private readonly db: D1Database) {}

  async send(request: CreateMessageRequest, consent: ConsentVerificationResult): Promise<Message> {
    if (!consent.verified) {
      throw new Error("Consent not verified for message delivery");
    }

    const now = new Date().toISOString();
    const id = crypto.randomUUID();

    // Ensure the thread exists
    await this.db
      .prepare("INSERT OR IGNORE INTO message_threads (thread_id, created_at, updated_at, subject) VALUES (?, ?, ?, ?)")
      .bind(request.threadId, now, now, request.subject ?? null)
      .run();

    // Insert the message
    await this.db
      .prepare(`
        INSERT INTO messages (
          id, thread_id, sender_id, recipient_id, type, status, subject,
          content, content_type, metadata, created_at, updated_at,
          sent_at, delivered_at, read_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .bind(
        id,
        request.threadId,
        request.senderId,
        request.recipientId,
        request.type,
        MessageStatus.SENT,
        request.subject ?? null,
        request.content,
        request.contentType ?? "text/plain",
        JSON.stringify(request.metadata ?? {}),
        now,
        now,
        now,
        null,
        null,
      )
      .run();

    // Update thread updated_at
    await this.db
      .prepare("UPDATE message_threads SET updated_at = ? WHERE thread_id = ?")
      .bind(now, request.threadId)
      .run();

    return {
      id,
      threadId: request.threadId,
      senderId: request.senderId,
      recipientId: request.recipientId,
      type: request.type as MessageType,
      status: MessageStatus.SENT,
      subject: request.subject ?? null,
      content: request.content,
      contentType: request.contentType ?? "text/plain",
      metadata: request.metadata ?? {},
      createdAt: now,
      updatedAt: now,
      sentAt: now,
      deliveredAt: null,
      readAt: null,
    };
  }

  async get(id: string): Promise<Message | null> {
    const row = await this.db
      .prepare(
        `SELECT id, thread_id, sender_id, recipient_id, type, status, subject,
                content, content_type, metadata, created_at, updated_at,
                sent_at, delivered_at, read_at
         FROM messages WHERE id = ?`,
      )
      .bind(id)
      .first<{
        id: string;
        thread_id: string;
        sender_id: string;
        recipient_id: string;
        type: string;
        status: string;
        subject: string | null;
        content: string;
        content_type: string;
        metadata: string;
        created_at: string;
        updated_at: string;
        sent_at: string | null;
        delivered_at: string | null;
        read_at: string | null;
      }>();

    if (!row) return null;

    return this.rowToMessage(row);
  }

  async listThread(threadId: string, limit = 50, offset = 0): Promise<Message[]> {
    const rows = await this.db
      .prepare(
        `SELECT id, thread_id, sender_id, recipient_id, type, status, subject,
                content, content_type, metadata, created_at, updated_at,
                sent_at, delivered_at, read_at
         FROM messages WHERE thread_id = ?
         ORDER BY created_at ASC
         LIMIT ? OFFSET ?`,
      )
      .bind(threadId, limit, offset)
      .all<{
        id: string;
        thread_id: string;
        sender_id: string;
        recipient_id: string;
        type: string;
        status: string;
        subject: string | null;
        content: string;
        content_type: string;
        metadata: string;
        created_at: string;
        updated_at: string;
        sent_at: string | null;
        delivered_at: string | null;
        read_at: string | null;
      }>();

    return rows.results.map((row) => this.rowToMessage(row));
  }

  async listThreads(
    participantId: string,
    limit = 20,
    offset = 0,
  ): Promise<{ threadId: string; lastMessage: Message; unreadCount: number }[]> {
    // Fetch all messages where this participant is sender or recipient,
    // ordered by created_at descending so we can build thread summaries.
    const rows = await this.db
      .prepare(
        `SELECT id, thread_id, sender_id, recipient_id, type, status, subject,
                content, content_type, metadata, created_at, updated_at,
                sent_at, delivered_at, read_at
         FROM messages
         WHERE sender_id = ? OR recipient_id = ?
         ORDER BY created_at DESC
         LIMIT 500`,
      )
      .bind(participantId, participantId)
      .all<{
        id: string;
        thread_id: string;
        sender_id: string;
        recipient_id: string;
        type: string;
        status: string;
        subject: string | null;
        content: string;
        content_type: string;
        metadata: string;
        created_at: string;
        updated_at: string;
        sent_at: string | null;
        delivered_at: string | null;
        read_at: string | null;
      }>();

    const threadMap = new Map<string, Message[]>();
    for (const row of rows.results) {
      const msg = this.rowToMessage(row);
      const existing = threadMap.get(msg.threadId) ?? [];
      existing.push(msg);
      threadMap.set(msg.threadId, existing);
    }

    const threads = Array.from(threadMap.entries()).map(([threadId, msgs]) => {
      msgs.sort(
        (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
      );
      const lastMessage = msgs[msgs.length - 1];
      const unreadCount = msgs.filter(
        (m) => m.recipientId === participantId && m.status !== MessageStatus.READ,
      ).length;
      return { threadId, lastMessage, unreadCount };
    });

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
    const now = new Date().toISOString();
    const updates: string[] = ["status = ?"];
    const bindings: unknown[] = [status];

    if (status === "delivered") {
      updates.push("delivered_at = ?");
      bindings.push(now);
    }
    if (status === "read") {
      updates.push("read_at = ?");
      bindings.push(now);
    }

    const result = await this.db
      .prepare(
        `UPDATE messages SET ${updates.join(", ")}, updated_at = ? WHERE id = ?`,
      )
      .bind(...bindings, now, id)
      .run();

    if (result.meta?.changes === 0 || (result.meta?.changes ?? 0) === 0) {
      throw new Error(`Message ${id} not found`);
    }
  }

  // ── Internal helpers ───────────────────────────────────────

  private rowToMessage(row: {
    id: string;
    thread_id: string;
    sender_id: string;
    recipient_id: string;
    type: string;
    status: string;
    subject: string | null;
    content: string;
    content_type: string;
    metadata: string;
    created_at: string;
    updated_at: string;
    sent_at: string | null;
    delivered_at: string | null;
    read_at: string | null;
  }): Message {
    return {
      id: row.id,
      threadId: row.thread_id,
      senderId: row.sender_id,
      recipientId: row.recipient_id,
      type: row.type as MessageType,
      status: row.status as MessageStatus,
      subject: row.subject,
      content: row.content,
      contentType: row.content_type,
      metadata: this.safeJson(row.metadata),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      sentAt: row.sent_at,
      deliveredAt: row.delivered_at,
      readAt: row.read_at,
    };
  }

  private safeJson(str: string): Record<string, unknown> {
    if (!str || str === "{}") return {};
    try {
      return JSON.parse(str);
    } catch {
      return {};
    }
  }
}
