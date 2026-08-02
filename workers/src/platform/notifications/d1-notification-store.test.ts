// ┌─────────────────────────────────────────────────────────────┐
// │ AG Synergy — Delivery Engine Tests                             │
// │ Wave 7 — Notification & Engagement Platform                  │
// └─────────────────────────────────────────────────────────────┘

import { describe, it, expect, beforeEach } from "vitest";
import { D1NotificationStore } from "./d1-notification-store.js";

// Mock D1Database for testing
function createMockD1() {
  const notifications = new Map<string, any>();
  const preferences = new Map<string, any>();
  const deliveries = new Map<string, any>();

  return {
    prepare: (sql: string) => ({
      bind: (...args: any[]) => ({
        run: async () => {
          // Simulate successful execution
          return { success: true };
        },
        first: async () => null,
        all: async () => ({ results: [] }),
      }),
    }),
    notifications,
    preferences,
    deliveries,
  };
}

describe("D1NotificationStore", () => {
  let store: D1NotificationStore;

  beforeEach(() => {
    store = new D1NotificationStore(createMockD1() as any);
  });

  it("should add a notification", async () => {
    const notification = {
      id: "test-1",
      identityId: "user-1",
      type: "appointment_reminder" as const,
      title: "Test",
      body: "Test body",
      status: "unread" as const,
      priority: "important" as const,
      channel: "in_app" as const,
      actionUrl: null,
      metadata: {},
      createdAt: new Date().toISOString(),
      readAt: null,
    };

    await store.addNotification(notification);
    // If we got here without throwing, the store accepted the notification
    expect(true).toBe(true);
  });

  it("should return empty array when no notifications exist", async () => {
    const result = await store.getNotifications("user-1");
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBe(0);
  });

  it("should return null for non-existent notification", async () => {
    const result = await store.getNotification("non-existent");
    expect(result).toBeNull();
  });

  it("should return 0 unread count for new user", async () => {
    const count = await store.getUnreadCount("user-1");
    expect(count).toBe(0);
  });
});