// ┌─────────────────────────────────────────────────────────────┐
// │ Wave 7 — Messaging Tests                                       │
// ═══════════════════════════════════════════════════════════

import { describe, it, expect } from "vitest";
import { MessageStatus, MessageType } from "../../src/platform/messaging/message-types.js";

describe("Message Types", () => {
  it("defines all message statuses", () => {
    expect(MessageStatus.DRAFT).toBe("draft");
    expect(MessageStatus.SENT).toBe("sent");
    expect(MessageStatus.DELIVERED).toBe("delivered");
    expect(MessageStatus.READ).toBe("read");
    expect(MessageStatus.FAILED).toBe("failed");
  });

  it("defines all message types", () => {
    expect(MessageType.TEXT).toBe("text");
    expect(MessageType.SYSTEM).toBe("system");
    expect(MessageType.NOTIFICATION).toBe("notification");
    expect(MessageType.DOCUMENT_REFERENCE).toBe("document_reference");
    expect(MessageType.APPOINTMENT_CONFIRMATION).toBe("appointment_confirmation");
    expect(MessageType.APPOINTMENT_REMINDER).toBe("appointment_reminder");
  });
});