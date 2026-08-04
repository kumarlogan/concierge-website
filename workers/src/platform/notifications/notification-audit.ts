// ┌─────────────────────────────────────────────────────────────┐
// │ AG Synergy — Notification Audit                                 │
// │ Wave 7 — Notification & Engagement Platform                  │
// │ Audit logging for all notification lifecycle events.         │
// └─────────────────────────────────────────────────────────────┘

import type { Env } from "../../types/env.js";
import { randomUUID } from "node:crypto";

export type NotificationAuditEvent =
  | "notification.created"
  | "notification.sent"
  | "notification.delivered"
  | "notification.read"
  | "notification.dismissed"
  | "notification.escalated"
  | "notification.failed";

export interface NotificationAuditEntry {
  id: string;
  notificationId: string;
  event: NotificationAuditEvent;
  channel: string | null;
  status: string;
  errorCode: string | null;
  identityId: string;
  timestamp: string;
}

export class NotificationAudit {
  private env: Env;

  constructor(env: Env) {
    this.env = env;
  }

  async log(
    notificationId: string,
    event: NotificationAuditEvent,
    identityId: string,
    channel: string | null = null,
    status: string = "ok",
    errorCode: string | null = null,
  ): Promise<void> {
    const db = this.env.NOTIFICATIONS as D1Database | undefined;
    if (!db) return;

    const entry: NotificationAuditEntry = {
      id: randomUUID(),
      notificationId,
      event,
      channel,
      status,
      errorCode,
      identityId,
      timestamp: new Date().toISOString(),
    };

    await db
      .prepare(
        `INSERT INTO notification_audit (id, notification_id, event, channel, status, error_code, identity_id, timestamp)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        entry.id,
        entry.notificationId,
        entry.event,
        entry.channel,
        entry.status,
        entry.errorCode,
        entry.identityId,
        entry.timestamp,
      )
      .run();
  }

  async getAuditTrail(notificationId: string): Promise<NotificationAuditEntry[]> {
    const db = this.env.NOTIFICATIONS as D1Database | undefined;
    if (!db) return [];

    const result = await db
      .prepare(
        `SELECT id, notification_id as notificationId, event, channel, status, error_code as errorCode, identity_id as identityId, timestamp
         FROM notification_audit
         WHERE notification_id = ?
         ORDER BY timestamp ASC`,
      )
      .bind(notificationId)
      .all<NotificationAuditEntry>();

    return result.results ?? [];
  }
}