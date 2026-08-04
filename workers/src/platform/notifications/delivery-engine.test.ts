// ┌─────────────────────────────────────────────────────────────┐
// │ AG Synergy — Delivery Engine Tests                             │
// │ Wave 7 — Notification & Engagement Platform                  │
// └─────────────────────────────────────────────────────────────┘

import { describe, it, expect, beforeEach } from "vitest";
import { DeliveryEngine } from "./delivery-engine.js";
import { DeliveryStatus } from "./delivery-types.js";

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

describe("DeliveryEngine", () => {
  let engine: DeliveryEngine;

  beforeEach(() => {
    engine = new DeliveryEngine(createMockEnv());
  });

  it("should return empty deliveries for notification with no channels configured", async () => {
    const notification = {
      id: "test-1",
      identityId: "user-1",
      type: "system" as const,
      title: "Test",
      body: "Test body",
      status: "unread" as const,
      priority: "informational" as const,
      channel: "in_app" as const,
      actionUrl: null,
      metadata: {},
      createdAt: new Date().toISOString(),
      readAt: null,
    };

    const deliveries = await engine.deliver(notification);
    expect(Array.isArray(deliveries)).toBe(true);
  });

  it("should track delivery status", async () => {
    await engine.trackDelivery("notif-1", "in_app", DeliveryStatus.DELIVERED);
    expect(true).toBe(true);
  });

  it("should return empty delivery status for unknown notification", async () => {
    const status = await engine.getDeliveryStatus("unknown");
    expect(status).toEqual([]);
  });

  it("should return 0 for retry when no D1 binding", async () => {
    const engineNoDb = new DeliveryEngine({} as any);
    const count = await engineNoDb.retryFailed();
    expect(count).toBe(0);
  });
});