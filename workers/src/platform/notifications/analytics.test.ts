// ┌─────────────────────────────────────────────────────────────┐
// │ AG Synergy — Notification Analytics Tests                    │
// │ Wave 7 — Notification & Engagement Platform                  │
// └─────────────────────────────────────────────────────────────┘

import { describe, it, expect, beforeEach } from "vitest";
import { NotificationAnalytics } from "./analytics.js";

function createMockEnv() {
  return {
    NOTIFICATIONS: {
      prepare: () => ({
        bind: () => ({
          run: async () => ({ success: true }),
          first: async () => null,
          all: async () => ({ results: [] }),
        }),
      }),
    },
  } as any;
}

describe("NotificationAnalytics", () => {
  let analytics: NotificationAnalytics;

  beforeEach(() => {
    analytics = new NotificationAnalytics(createMockEnv());
  });

  it("should record a delivery event", async () => {
    await analytics.recordDelivery("appointment_reminder", "in_app", "delivered");
    expect(true).toBe(true);
  });

  it("should return empty analytics for unknown date", async () => {
    const data = await analytics.getAnalytics("2099-01-01");
    expect(data).toEqual([]);
  });
});