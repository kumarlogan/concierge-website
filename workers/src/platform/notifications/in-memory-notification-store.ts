// ┌─────────────────────────────────────────────────────────────┐
// │ AG Synergy — In-Memory Notification Store                    │
// │ Wave 6 — Communication Centre                               │
// └─────────────────────────────────────────────────────────────┘

import type { Notification, NotificationPreferences } from "./notification-types.js";
import { NotificationStatus, NotificationPriority, NotificationChannel, DEFAULT_NOTIFICATION_PREFERENCES } from "./notification-types.js";

export class InMemoryNotificationStore {
  private notifications = new Map<string, Notification>();
  private preferences = new Map<string, NotificationPreferences>();

  async addNotification(notification: Notification): Promise<void> {
    this.notifications.set(notification.id, notification);
  }

  async getNotifications(identityId: string, options?: {
    unreadOnly?: boolean;
    type?: string;
    limit?: number;
    offset?: number;
  }): Promise<Notification[]> {
    let results = Array.from(this.notifications.values())
      .filter(n => n.identityId === identityId);

    if (options?.unreadOnly) {
      results = results.filter(n => n.status === NotificationStatus.UNREAD);
    }
    if (options?.type) {
      results = results.filter(n => n.type === options.type);
    }

    results.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    const limit = options?.limit ?? 50;
    const offset = options?.offset ?? 0;
    return results.slice(offset, offset + limit);
  }

  async getNotification(id: string): Promise<Notification | null> {
    return this.notifications.get(id) ?? null;
  }

  async markRead(id: string): Promise<void> {
    const notification = this.notifications.get(id);
    if (notification) {
      notification.status = NotificationStatus.READ;
      notification.readAt = new Date().toISOString();
    }
  }

  async markAllRead(identityId: string): Promise<void> {
    for (const n of this.notifications.values()) {
      if (n.identityId === identityId && n.status === NotificationStatus.UNREAD) {
        n.status = NotificationStatus.READ;
        n.readAt = new Date().toISOString();
      }
    }
  }

  async getUnreadCount(identityId: string): Promise<number> {
    return Array.from(this.notifications.values())
      .filter(n => n.identityId === identityId && n.status === NotificationStatus.UNREAD)
      .length;
  }

  async getPreferences(identityId: string): Promise<NotificationPreferences> {
    const existing = this.preferences.get(identityId);
    if (existing) return existing;

    const defaults: NotificationPreferences = {
      identityId,
      ...DEFAULT_NOTIFICATION_PREFERENCES,
    };
    this.preferences.set(identityId, defaults);
    return defaults;
  }

  async updatePreferences(identityId: string, updates: Partial<NotificationPreferences>): Promise<NotificationPreferences> {
    const current = await this.getPreferences(identityId);
    const updated: NotificationPreferences = {
      ...current,
      ...updates,
      identityId,
    };
    if (updates.channels) updated.channels = { ...current.channels, ...updates.channels };
    if (updates.quietHours) updated.quietHours = { ...current.quietHours, ...updates.quietHours };
    if (updates.typePreferences) {
      updated.typePreferences = { ...current.typePreferences };
      for (const [key, value] of Object.entries(updates.typePreferences)) {
        updated.typePreferences[key] = { ...current.typePreferences[key], ...value };
      }
    }
    this.preferences.set(identityId, updated);
    return updated;
  }

  // Seed notifications for demo/testing
  async seedSampleNotifications(identityId: string): Promise<void> {
    const sampleNotifications: Notification[] = [
      {
        id: `notif-sample-1-${Date.now()}`,
        identityId,
        type: "appointment_reminder",
        title: "Upcoming Appointment Tomorrow",
        body: "Reminder: You have a monitoring appointment tomorrow at 9:00 AM with Dr. Smith. Please arrive 15 minutes early.",
        status: NotificationStatus.UNREAD,
        priority: NotificationPriority.IMPORTANT,
        channel: NotificationChannel.IN_APP,
        actionUrl: "/patient/appointments",
        metadata: {},
        createdAt: new Date().toISOString(),
        readAt: null,
      },
      {
        id: `notif-sample-2-${Date.now()}`,
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
        id: `notif-sample-3-${Date.now()}`,
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
        id: `notif-sample-4-${Date.now()}`,
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
        id: `notif-sample-5-${Date.now()}`,
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
        id: `notif-sample-6-${Date.now()}`,
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

    for (const n of sampleNotifications) {
      this.notifications.set(n.id, n);
    }
  }
}

// Singleton
export const notificationStore = new InMemoryNotificationStore();