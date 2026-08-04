// ┌─────────────────────────────────────────────────────────────┐
// │ AG Synergy — Escalation Engine                                 │
// │ Wave 7 — Notification & Engagement Platform                  │
// │ Priority-based escalation for critical notifications.       │
// └─────────────────────────────────────────────────────────────┘

import type { Env } from "../../types/env.js";
import { EscalationLevel } from "../notifications/escalation-types.js";
import { randomUUID } from "node:crypto";

export class EscalationEngine {
  private env: Env;

  constructor(env: Env) {
    this.env = env;
  }

  async checkEscalations(): Promise<number> {
    const db = this.env.NOTIFICATIONS as D1Database | undefined;
    if (!db) return 0;

    const now = new Date();

    // Find unread notifications that have exceeded escalation timeout
    const result = await db
      .prepare(
        `SELECT id, identity_id as identityId, type, title, body, status, priority, channel, action_url as actionUrl, metadata, created_at as createdAt, read_at as readAt
         FROM notifications
         WHERE status = 'unread'
           AND priority IN ('critical', 'important')
           AND created_at < datetime('now', '-15 minutes')`,
      )
      .all();

    const notifications = result.results ?? [];
    let escalatedCount = 0;

    for (const notification of notifications) {
      const level = notification.priority === "critical" ? EscalationLevel.LEVEL_1 : EscalationLevel.LEVEL_2;
      await this.escalate(notification.id, level, notification.identityId);
      escalatedCount++;
    }

    return escalatedCount;
  }

  async escalate(notificationId: string, level: EscalationLevel, identityId: string): Promise<void> {
    const db = this.env.NOTIFICATIONS as D1Database | undefined;
    if (!db) return;

    const event = {
      id: randomUUID(),
      notificationId,
      level,
      targetRole: this.getTargetRole(level),
      triggeredAt: new Date().toISOString(),
      resolvedAt: null,
      createdAt: new Date().toISOString(),
    };

    await db
      .prepare(
        `INSERT INTO notification_escalation (id, notification_id, level, target_role, triggered_at, resolved_at, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        event.id,
        notificationId,
        level,
        event.targetRole,
        event.triggeredAt,
        event.resolvedAt,
        event.createdAt,
      )
      .run();

    // Update notification status to indicate escalation
    await db
      .prepare(`UPDATE notifications SET metadata = json_set(COALESCE(metadata, '{}'), '$.escalated', ?) WHERE id = ?`)
      .bind(JSON.stringify({ level, targetRole: event.targetRole }), notificationId)
      .run();
  }

  async getEscalationStatus(notificationId: string): Promise<{ level: number; targetRole: string; triggeredAt: string } | null> {
    const db = this.env.NOTIFICATIONS as D1Database | undefined;
    if (!db) return null;

    const result = await db
      .prepare(`SELECT level, target_role as targetRole, triggered_at as triggeredAt FROM notification_escalation WHERE notification_id = ? ORDER BY triggered_at DESC LIMIT 1`)
      .bind(notificationId)
      .first();

    return result ?? null;
  }

  private getTargetRole(level: EscalationLevel): string {
    switch (level) {
      case EscalationLevel.LEVEL_1:
        return "patient";
      case EscalationLevel.LEVEL_2:
        return "care_coordinator";
      case EscalationLevel.LEVEL_3:
        return "physician";
      default:
        return "patient";
    }
  }
}