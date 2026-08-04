// ┌─────────────────────────────────────────────────────────────┐
// │ AG Synergy — Notification Audit Tests                         │
// │ Wave 7 — Notification & Engagement Platform                  │
// └─────────────────────────────────────────────────────────────┘

import { describe, it, expect, beforeEach } from "vitest";
import { NotificationAudit } from "./notification-audit.js";

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

describe("NotificationAudit", () => {
  let audit: NotificationAudit;

  beforeEach(() => {
    audit = new NotificationAudit(createMockEnv());
  });

  it("should log an audit event without error", async () => {
    await audit.log("notif-1", "notification.created", "user-1");
    expect(true).toBe(true);
  });

  it("should return empty audit trail for unknown notification", async () => {
    const trail = await audit.getAuditTrail("unknown");
    expect(trail).toEqual([]);
  });
});