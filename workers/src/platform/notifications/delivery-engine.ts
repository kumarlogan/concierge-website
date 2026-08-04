// ┌─────────────────────────────────────────────────────────────┐
// │ AG Synergy — Delivery Engine                                   │
// │ Wave 7 — Notification & Engagement Platform                  │
// │ Multi-channel delivery engine with status tracking.          │
// └─────────────────────────────────────────────────────────────┘

import type { Env } from "../../types/env.js";
import type { Notification } from "../notifications/notification-types.js";
import { DeliveryStatus, type NotificationDelivery } from "../notifications/delivery-types.js";
import { randomUUID } from "node:crypto";

export class DeliveryEngine {
  private env: Env;

  constructor(env: Env) {
    this.env = env;
  }

  async deliver(notification: Notification): Promise<NotificationDelivery[]> {
    const deliveries: NotificationDelivery[] = [];

    const channels = this.getChannelsForNotification(notification);

    for (const channel of channels) {
      const delivery = await this.deliverToChannel(notification, channel);
      deliveries.push(delivery);
    }

    return deliveries;
  }

  private getChannelsForNotification(notification: Notification): string[] {
    const channelMap: Record<string, string[]> = {
      appointment_reminder: ["in_app", "sms"],
      medication_reminder: ["in_app", "sms"],
      timeline_update: ["in_app"],
      lab_result: ["in_app", "email"],
      document_shared: ["in_app", "email"],
      clinic_announcement: ["in_app", "email"],
      system: ["in_app"],
    };
    return channelMap[notification.type] ?? ["in_app"];
  }

  private async deliverToChannel(notification: Notification, channel: string): Promise<NotificationDelivery> {
    const delivery: NotificationDelivery = {
      id: randomUUID(),
      notificationId: notification.id,
      channel,
      status: DeliveryStatus.PENDING,
      error: null,
      retryCount: 0,
      lastRetryAt: null,
      deliveredAt: null,
      createdAt: new Date().toISOString(),
    };

    try {
      // Simulate delivery — in production this calls external services
      // (FCM/APNs for push, SES/SMTP for email, Twilio for SMS)
      delivery.status = DeliveryStatus.SENT;
      delivery.deliveredAt = new Date().toISOString();

      // Store delivery record in D1
      await this.storeDelivery(delivery);
    } catch (err) {
      delivery.status = DeliveryStatus.FAILED;
      delivery.error = err instanceof Error ? err.message : "Unknown delivery error";
      await this.storeDelivery(delivery);
    }

    return delivery;
  }

  private async storeDelivery(delivery: NotificationDelivery): Promise<void> {
    const db = this.env.NOTIFICATIONS as D1Database | undefined;
    if (!db) return;

    await db
      .prepare(
        `INSERT INTO notification_delivery (id, notification_id, channel, status, error, retry_count, last_retry_at, delivered_at, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        delivery.id,
        delivery.notificationId,
        delivery.channel,
        delivery.status,
        delivery.error,
        delivery.retryCount,
        delivery.lastRetryAt,
        delivery.deliveredAt,
        delivery.createdAt,
      )
      .run();
  }

  async trackDelivery(notificationId: string, channel: string, status: DeliveryStatus): Promise<void> {
    const db = this.env.NOTIFICATIONS as D1Database | undefined;
    if (!db) return;

    await db
      .prepare(`UPDATE notification_delivery SET status = ?, last_retry_at = ? WHERE notification_id = ? AND channel = ?`)
      .bind(status, new Date().toISOString(), notificationId, channel)
      .run();
  }

  async getDeliveryStatus(notificationId: string): Promise<NotificationDelivery[]> {
    const db = this.env.NOTIFICATIONS as D1Database | undefined;
    if (!db) return [];

    const result = await db
      .prepare(`SELECT id, notification_id as notificationId, channel, status, error, retry_count as retryCount, last_retry_at as lastRetryAt, delivered_at as deliveredAt, created_at as createdAt FROM notification_delivery WHERE notification_id = ?`)
      .bind(notificationId)
      .all<NotificationDelivery>();

    return result.results ?? [];
  }

  async retryFailed(): Promise<number> {
    const db = this.env.NOTIFICATIONS as D1Database | undefined;
    if (!db) return 0;

    const failed = await db
      .prepare(`SELECT id, notification_id as notificationId, channel, status, error, retry_count as retryCount, last_retry_at as lastRetryAt, delivered_at as deliveredAt, created_at as createdAt FROM notification_delivery WHERE status = 'failed' AND retry_count < 3`)
      .all<NotificationDelivery>();

    const results = failed.results ?? [];
    for (const delivery of results) {
      delivery.retryCount++;
      delivery.lastRetryAt = new Date().toISOString();
      delivery.status = DeliveryStatus.PENDING;

      await this.storeDelivery(delivery);
      // Re-attempt delivery
      await this.trackDelivery(delivery.notificationId, delivery.channel, DeliveryStatus.SENT);
    }

    return results.length;
  }
}