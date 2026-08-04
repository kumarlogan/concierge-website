// ┌─────────────────────────────────────────────────────────────┐
// │ AG Synergy — Notification Analytics                              │
// │ Wave 7 — Notification & Engagement Platform                  │
// │ Delivery analytics computed from audit events.               │
// └─────────────────────────────────────────────────────────────┘

import type { Env } from "../../types/env.js";
import { randomUUID } from "node:crypto";

export class NotificationAnalytics {
  private env: Env;

  constructor(env: Env) {
    this.env = env;
  }

  async recordDelivery(notificationType: string, channel: string, status: string): Promise<void> {
    const db = this.env.NOTIFICATIONS as D1Database | undefined;
    if (!db) return;

    const today = new Date().toISOString().split("T")[0];

    await db
      .prepare(
        `INSERT INTO notification_analytics (id, date, notification_type, channel, delivered_count, read_count, dismissed_count, failed_count, escalated_count, avg_delivery_time_ms, avg_read_time_ms, engagement_rate, created_at)
         VALUES (?, ?, ?, ?, CASE WHEN ? = 'delivered' THEN 1 ELSE 0 END, CASE WHEN ? = 'read' THEN 1 ELSE 0 END, CASE WHEN ? = 'dismissed' THEN 1 ELSE 0 END, CASE WHEN ? = 'failed' THEN 1 ELSE 0 END, 0, 0, 0, ?)
         ON CONFLICT(date, notification_type, channel) DO UPDATE SET
           delivered_count = delivered_count + CASE WHEN ? = 'delivered' THEN 1 ELSE 0 END,
           read_count = read_count + CASE WHEN ? = 'read' THEN 1 ELSE 0 END,
           dismissed_count = dismissed_count + CASE WHEN ? = 'dismissed' THEN 1 ELSE 0 END,
           failed_count = failed_count + CASE WHEN ? = 'failed' THEN 1 ELSE 0 END,
           engagement_rate = CASE WHEN (delivered_count + CASE WHEN ? = 'delivered' THEN 1 ELSE 0 END) > 0
             THEN CAST(read_count + CASE WHEN ? = 'read' THEN 1 ELSE 0 END AS REAL) / (delivered_count + CASE WHEN ? = 'delivered' THEN 1 ELSE 0 END)
             ELSE 0 END,
           created_at = ?`,
      )
      .bind(
        randomUUID(), today, notificationType, channel,
        status, status, status, status, today,
        status, status, status, status, today,
      )
      .run();
  }

  async getAnalytics(date?: string): Promise<{ date: string; notificationType: string; channel: string; deliveredCount: number; readCount: number; dismissedCount: number; failedCount: number; escalatedCount: number; engagementRate: number }[]> {
    const db = this.env.NOTIFICATIONS as D1Database | undefined;
    if (!db) return [];

    const targetDate = date ?? new Date().toISOString().split("T")[0];

    const result = await db
      .prepare(
        `SELECT date, notification_type as notificationType, channel, delivered_count as deliveredCount, read_count as readCount, dismissed_count as dismissedCount, failed_count as failedCount, escalated_count as escalatedCount, engagement_rate as engagementRate
         FROM notification_analytics
         WHERE date = ?
         ORDER BY notification_type, channel`,
      )
      .bind(targetDate)
      .all();

    return result.results ?? [];
  }
}