// ┌─────────────────────────────────────────────────────────────┐
// │ AG Synergy — D1 Notification Store                           │
// │ Wave 7 — Notification & Engagement Platform                  │
// │ Persistent notification storage backed by Cloudflare D1.     │
// └─────────────────────────────────────────────────────────────┘

import type { Notification, NotificationPreferences } from "./notification-types.js";
import {
  NotificationStatus,
  NotificationPriority,
  NotificationChannel,
  DEFAULT_NOTIFICATION_PREFERENCES,
} from "./notification-types.js";

export class D1NotificationStore {
  private db: D1Database;

  constructor(db: D1Database) {
    this.db = db;
  }

  async addNotification(notification: Notification): Promise<void> {
    await this.db.prepare(
      `INSERT INTO notifications (id, identity_id, type, title, body, status, priority, channel, action_url, metadata, created_at, read_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
      .bind(
        notification.id,
        notification.identityId,
        notification.type,
        notification.title,
        notification.body,
        notification.status,
        notification.priority,
        notification.channel,
        notification.actionUrl,
        JSON.stringify(notification.metadata),
        notification.createdAt,
        notification.readAt,
      )
      .run();
  }

  async getNotifications(
    identityId: string,
    options?: {
      unreadOnly?: boolean;
      type?: string;
      limit?: number;
      offset?: number;
    },
  ): Promise<Notification[]> {
    let query = `SELECT id, identity_id as identityId, type, title, body, status, priority, channel, action_url as actionUrl, metadata, created_at as createdAt, read_at as readAt FROM notifications WHERE identity_id = ?`;
    const bindings: (string | number | null)[] = [identityId];

    if (options?.unreadOnly) {
      query += ` AND status = 'unread'`;
    }
    if (options?.type) {
      query += ` AND type = ?`;
      bindings.push(options.type);
    }

    query += ` ORDER BY created_at DESC`;

    const limit = options?.limit ?? 50;
    const offset = options?.offset ?? 0;
    query += ` LIMIT ? OFFSET ?`;
    bindings.push(limit, offset);

    const result = await this.db.prepare(query).bind(...bindings).all<Notification>();
    return result.results ?? [];
  }

  async getNotification(id: string): Promise<Notification | null> {
    const result = await this.db
      .prepare(`SELECT id, identity_id as identityId, type, title, body, status, priority, channel, action_url as actionUrl, metadata, created_at as createdAt, read_at as readAt FROM notifications WHERE id = ?`)
      .bind(id)
      .first<Notification>();
    return result ?? null;
  }

  async markRead(id: string): Promise<void> {
    const now = new Date().toISOString();
    await this.db.prepare(`UPDATE notifications SET status = 'read', read_at = ? WHERE id = ?`).bind(now, id).run();
  }

  async markAllRead(identityId: string): Promise<void> {
    const now = new Date().toISOString();
    await this.db.prepare(`UPDATE notifications SET status = 'read', read_at = ? WHERE identity_id = ? AND status = 'unread'`).bind(now, identityId).run();
  }

  async getUnreadCount(identityId: string): Promise<number> {
    const result = await this.db
      .prepare(`SELECT COUNT(*) as count FROM notifications WHERE identity_id = ? AND status = 'unread'`)
      .bind(identityId)
      .first<{ count: number }>();
    return result?.count ?? 0;
  }

  async getPreferences(identityId: string): Promise<NotificationPreferences> {
    const result = await this.db
      .prepare(`SELECT preferences FROM notification_preferences WHERE identity_id = ?`)
      .bind(identityId)
      .first<{ preferences: string }>();

    if (result?.preferences) {
      return JSON.parse(result.preferences);
    }

    const defaults: NotificationPreferences = {
      identityId,
      ...DEFAULT_NOTIFICATION_PREFERENCES,
    };
    await this.updatePreferences(identityId, defaults);
    return defaults;
  }

  async updatePreferences(identityId: string, updates: Partial<NotificationPreferences>): Promise<NotificationPreferences> {
    const current = await this.getPreferences(identityId);
    const updated: NotificationPreferences = {
      ...current,
      ...updates,
      identityId,
    };
    if (updates.channels) {
      updated.channels = { ...current.channels, ...updates.channels };
    }
    if (updates.quietHours) {
      updated.quietHours = { ...current.quietHours, ...updates.quietHours };
    }
    if (updates.typePreferences) {
      updated.typePreferences = { ...current.typePreferences, ...updates.typePreferences };
    }

    await this.db
      .prepare(`INSERT INTO notification_preferences (identity_id, preferences) VALUES (?, ?) ON CONFLICT(identity_id) DO UPDATE SET preferences = ?`)
      .bind(identityId, JSON.stringify(updated), JSON.stringify(updated))
      .run();

    return updated;
  }

  async seedSampleNotifications(identityId: string): Promise<void> {
    const now = new Date().toISOString();
    const samples: Omit<Notification, "id">[] = [
      {
        identityId,
        type: "appointment_reminder",
        title: "Upcoming Appointment Tomorrow",
        body: "Reminder: You have a monitoring appointment tomorrow at 9:00 AM with Dr. Smith. Please arrive 15 minutes early.",
        status: NotificationStatus.UNREAD,
        priority: NotificationPriority.IMPORTANT,
        channel: NotificationChannel.IN_APP,
        actionUrl: "/patient/appointments",
        metadata: {},
        createdAt: now,
        readAt: null,
      },
      {
        identityId,
        type: "medication_reminder",
        title: "Medication Reminder: Gonal-F",
        body: "Time for your evening dose of Gonal-F (225 IU). Take at approximately the same time each day.",
        status: NotificationStatus.UNREAD,
        priority: NotificationPriority.IMPORTANT,
        channel: NotificationChannel.IN_APP,
        actionUrl: null,
        metadata: {},
        createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
        readAt: null,
      },
      {
        identityId,
        type: "lab_result",
        title: "Lab Results Available",
        body: "Your recent blood work results are now available. Please review in the portal.",
        status: NotificationStatus.UNREAD,
        priority: NotificationPriority.IMPORTANT,
        channel: NotificationChannel.IN_APP,
        actionUrl: "/patient/documents",
        metadata: {},
        createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
        readAt: null,
      },
      {
        identityId,
        type: "timeline_update",
        title: "Treatment Phase Update",
        body: "Great news! You have moved to the Ovarian Stimulation phase. Check your care plan for daily instructions.",
        status: NotificationStatus.READ,
        priority: NotificationPriority.IMPORTANT,
        channel: NotificationChannel.IN_APP,
        actionUrl: "/patient/care-plan",
        metadata: {},
        createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
        readAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
      },
      {
        identityId,
        type: "document_shared",
        title: "New Document Shared",
        body: "Your treatment consent form has been uploaded to the Document Centre.",
        status: NotificationStatus.UNREAD,
        priority: NotificationPriority.INFORMATIONAL,
        channel: NotificationChannel.IN_APP,
        actionUrl: "/patient/documents",
        metadata: {},
        createdAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(),
        readAt: null,
      },
      {
        identityId,
        type: "clinic_announcement",
        title: "Holiday Hours Update",
        body: "The clinic will be closed on Monday, August 3rd for the Civic Holiday. Emergency contact information has been sent to your email on file.",
        status: NotificationStatus.UNREAD,
        priority: NotificationPriority.INFORMATIONAL,
        channel: NotificationChannel.IN_APP,
        actionUrl: null,
        metadata: {},
        createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
        readAt: null,
      },
    ];

    for (const sample of samples) {
      const notification: Notification = {
        ...sample,
        id: `notif-d1-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      };
      await this.addNotification(notification);
    }
  }
}
