// ┌─────────────────────────────────────────────────────────────┐
// │ AG Synergy — Wave 8 Integration Tests                       │
// │ End-to-end patient journey validation.                     │
// │ Verifies: Appointments, Messaging, Dashboard integration.  │
// └─────────────────────────────────────────────────────────────┘

import { describe, it, expect, beforeEach } from "vitest";
import { InMemoryAppointmentEngine } from "../../src/platform/appointments/in-memory-appointment-engine.js";
import { InMemoryMessageEngine } from "../../src/platform/messaging/in-memory-message-engine.js";
import type { ConsentVerificationResult } from "../../src/platform/appointments/appointment-engine.js";
import type { ConsentVerificationResult as MessageConsentResult } from "../../src/platform/messaging/message-engine.js";
import {
  AppointmentStatus,
  AppointmentType,
  AppointmentPriority,
} from "../../src/platform/appointments/appointment-types.js";
import { MessageStatus, MessageType } from "../../src/platform/messaging/message-types.js";

const consent: ConsentVerificationResult = {
  decision: { allowed: true, reason: "test", precedence: 1 },
  consentTypes: ["appointment_scheduling", "messaging"],
  verified: true,
};

const deniedConsent: ConsentVerificationResult = {
  decision: { allowed: false, reason: "denied", precedence: 1 },
  consentTypes: [],
  verified: false,
};

const messageConsent: MessageConsentResult = {
  decision: { allowed: true, reason: "test", precedence: 1 },
  consentTypes: ["messaging"],
  verified: true,
};

const deniedMessageConsent: MessageConsentResult = {
  decision: { allowed: false, reason: "denied", precedence: 1 },
  consentTypes: [],
  verified: false,
};

// ── Appointment Engine Integration ──────────────────────────

describe("Wave 8 — Appointment Engine Integration", () => {
  let engine: InMemoryAppointmentEngine;

  beforeEach(() => {
    engine = new InMemoryAppointmentEngine();
  });

  it("creates an appointment with consent verification", async () => {
    const futureDate = new Date(Date.now() + 86_400_000).toISOString();
    const appointment = await engine.create(
      {
        patientId: "patient-001",
        providerId: "provider-001",
        type: AppointmentType.CONSULTATION,
        startAt: futureDate,
        durationMinutes: 30,
        timezone: "America/Vancouver",
        title: "Initial Consultation",
        notes: "First visit",
      },
      consent,
    );

    expect(appointment.id).toBeDefined();
    expect(appointment.patientId).toBe("patient-001");
    expect(appointment.status).toBe(AppointmentStatus.SCHEDULED);
    expect(appointment.title).toBe("Initial Consultation");
  });

  it("rejects appointment creation without consent", async () => {
    const futureDate = new Date(Date.now() + 86_400_000).toISOString();
    await expect(
      engine.create(
        {
          patientId: "patient-001",
          providerId: "provider-001",
          type: AppointmentType.CONSULTATION,
          startAt: futureDate,
          durationMinutes: 30,
          timezone: "America/Vancouver",
          title: "No Consent",
        },
        deniedConsent,
      ),
    ).rejects.toThrow("Consent not verified");
  });

  it("retrieves an appointment by ID", async () => {
    const futureDate = new Date(Date.now() + 86_400_000).toISOString();
    const created = await engine.create(
      {
        patientId: "patient-002",
        providerId: "provider-001",
        type: AppointmentType.FOLLOW_UP,
        startAt: futureDate,
        durationMinutes: 15,
        timezone: "America/Vancouver",
        title: "Follow Up",
      },
      consent,
    );

    const retrieved = await engine.get(created.id);
    expect(retrieved).not.toBeNull();
    expect(retrieved!.id).toBe(created.id);
  });

  it("lists appointments with filters", async () => {
    const now = Date.now();
    await engine.create(
      {
        patientId: "patient-003",
        providerId: "provider-001",
        type: AppointmentType.CONSULTATION,
        startAt: new Date(now + 86_400_000).toISOString(),
        durationMinutes: 30,
        timezone: "America/Vancouver",
        title: "Consultation",
      },
      consent,
    );
    await engine.create(
      {
        patientId: "patient-003",
        providerId: "provider-002",
        type: AppointmentType.PROCEDURE,
        startAt: new Date(now + 172_800_000).toISOString(),
        durationMinutes: 60,
        timezone: "America/Vancouver",
        title: "Procedure",
      },
      consent,
    );

    const byPatient = await engine.list({ patientId: "patient-003" });
    expect(byPatient).toHaveLength(2);

    const byProvider = await engine.list({ providerId: "provider-001" });
    expect(byProvider).toHaveLength(1);
  });

  it("cancels an appointment", async () => {
    const futureDate = new Date(Date.now() + 86_400_000).toISOString();
    const created = await engine.create(
      {
        patientId: "patient-004",
        providerId: "provider-001",
        type: AppointmentType.TELEHEALTH,
        startAt: futureDate,
        durationMinutes: 30,
        timezone: "America/Vancouver",
        title: "Telehealth Visit",
      },
      consent,
    );

    await engine.cancel(created.id);
    const cancelled = await engine.get(created.id);
    expect(cancelled!.status).toBe(AppointmentStatus.CANCELLED);
  });

  it("checks availability", async () => {
    const now = Date.now();
    const slot1Start = new Date(now + 86_400_000).toISOString();
    const slot1End = new Date(now + 86_400_000 + 1_800_000).toISOString();

    const available = await engine.checkAvailability(slot1Start, slot1End);
    expect(available).toBe(true);

    // Book the slot
    await engine.create(
      {
        patientId: "patient-005",
        providerId: "provider-001",
        type: AppointmentType.CONSULTATION,
        startAt: slot1Start,
        durationMinutes: 30,
        timezone: "America/Vancouver",
        title: "Booked",
      },
      consent,
    );

    // Same slot should now be unavailable
    const nowAvailable = await engine.checkAvailability(slot1Start, slot1End);
    expect(nowAvailable).toBe(false);
  });
});

// ── Message Engine Integration ──────────────────────────────

describe("Wave 8 — Message Engine Integration", () => {
  let engine: InMemoryMessageEngine;

  beforeEach(() => {
    engine = new InMemoryMessageEngine();
  });

  it("sends a message with consent verification", async () => {
    const message = await engine.send(
      {
        threadId: "thread-001",
        senderId: "patient-001",
        recipientId: "provider-001",
        type: MessageType.TEXT,
        subject: "Question about treatment",
        content: "I have a question about my upcoming appointment.",
      },
      messageConsent,
    );

    expect(message.id).toBeDefined();
    expect(message.status).toBe(MessageStatus.SENT);
    expect(message.threadId).toBe("thread-001");
  });

  it("rejects message without consent", async () => {
    await expect(
      engine.send(
        {
          threadId: "thread-002",
          senderId: "patient-001",
          recipientId: "provider-001",
          type: MessageType.TEXT,
          subject: "No consent",
          content: "This should fail",
        },
        deniedMessageConsent,
      ),
    ).rejects.toThrow("Consent not verified");
  });

  it("retrieves a message by ID", async () => {
    const sent = await engine.send(
      {
        threadId: "thread-003",
        senderId: "patient-002",
        recipientId: "provider-001",
        type: MessageType.TEXT,
        subject: null,
        content: "Hello",
      },
      messageConsent,
    );

    const retrieved = await engine.get(sent.id);
    expect(retrieved).not.toBeNull();
    expect(retrieved!.id).toBe(sent.id);
  });

  it("lists messages in a thread", async () => {
    const threadId = "thread-004";
    await engine.send(
      {
        threadId,
        senderId: "patient-003",
        recipientId: "provider-001",
        type: MessageType.TEXT,
        subject: null,
        content: "Message 1",
      },
      messageConsent,
    );
    await engine.send(
      {
        threadId,
        senderId: "provider-001",
        recipientId: "patient-003",
        type: MessageType.TEXT,
        subject: null,
        content: "Reply 1",
      },
      messageConsent,
    );

    const messages = await engine.listThread(threadId);
    expect(messages).toHaveLength(2);
  });

  it("lists threads for a participant", async () => {
    await engine.send(
      {
        threadId: "thread-005",
        senderId: "patient-004",
        recipientId: "provider-001",
        type: MessageType.TEXT,
        subject: null,
        content: "Hello from patient",
      },
      messageConsent,
    );

    const threads = await engine.listThreads("patient-004");
    expect(threads).toHaveLength(1);
    expect(threads[0].threadId).toBe("thread-005");
  });

  it("updates delivery status", async () => {
    const sent = await engine.send(
      {
        threadId: "thread-006",
        senderId: "patient-005",
        recipientId: "provider-001",
        type: MessageType.TEXT,
        subject: null,
        content: "Status test",
      },
      messageConsent,
    );

    await engine.updateDeliveryStatus(sent.id, "delivered");
    const msg = await engine.get(sent.id);
    expect(msg!.status).toBe("delivered");
    expect(msg!.deliveredAt).not.toBeNull();

    await engine.updateDeliveryStatus(sent.id, "read");
    const readMsg = await engine.get(sent.id);
    expect(readMsg!.status).toBe("read");
    expect(readMsg!.readAt).not.toBeNull();
  });
});

// ── Cross-Capability Integration ────────────────────────────

describe("Wave 8 — Cross-Capability Integration", () => {
  it("appointment + messaging lifecycle", async () => {
    const apptEngine = new InMemoryAppointmentEngine();
    const msgEngine = new InMemoryMessageEngine();

    // Step 1: Book appointment
    const futureDate = new Date(Date.now() + 86_400_000).toISOString();
    const appointment = await apptEngine.create(
      {
        patientId: "patient-int-001",
        providerId: "provider-int-001",
        type: AppointmentType.CONSULTATION,
        startAt: futureDate,
        durationMinutes: 30,
        timezone: "America/Vancouver",
        title: "Integration Test Consultation",
      },
      consent,
    );
    expect(appointment.status).toBe(AppointmentStatus.SCHEDULED);

    // Step 2: Send confirmation message
    const message = await msgEngine.send(
      {
        threadId: `thread-${appointment.id}`,
        senderId: "provider-int-001",
        recipientId: "patient-int-001",
        type: MessageType.APPOINTMENT_CONFIRMATION,
        subject: "Appointment Confirmed",
        content: `Your appointment "${appointment.title}" is confirmed for ${appointment.startAt}.`,
      },
      messageConsent,
    );
    expect(message.type).toBe(MessageType.APPOINTMENT_CONFIRMATION);

    // Step 3: Verify both exist
    const retrievedAppt = await apptEngine.get(appointment.id);
    expect(retrievedAppt).not.toBeNull();

    const retrievedMsg = await msgEngine.get(message.id);
    expect(retrievedMsg).not.toBeNull();
    expect(retrievedMsg!.threadId).toBe(`thread-${appointment.id}`);

    // Step 4: Cancel appointment
    await apptEngine.cancel(appointment.id);
    const cancelledAppt = await apptEngine.get(appointment.id);
    expect(cancelledAppt!.status).toBe(AppointmentStatus.CANCELLED);

    // Step 5: Send cancellation notice
    await msgEngine.send(
      {
        threadId: `thread-${appointment.id}`,
        senderId: "provider-int-001",
        recipientId: "patient-int-001",
        type: MessageType.SYSTEM,
        subject: "Appointment Cancelled",
        content: `Your appointment "${appointment.title}" has been cancelled.`,
      },
      messageConsent,
    );

    // Step 6: Verify thread has both messages
    const threadMessages = await msgEngine.listThread(`thread-${appointment.id}`);
    expect(threadMessages).toHaveLength(2);
  });

  it("consent enforcement across capabilities", async () => {
    const apptEngine = new InMemoryAppointmentEngine();
    const msgEngine = new InMemoryMessageEngine();

    // Both should reject without consent
    const futureDate = new Date(Date.now() + 86_400_000).toISOString();
    await expect(
      apptEngine.create(
        {
          patientId: "patient-denied",
          providerId: "provider-001",
          type: AppointmentType.CONSULTATION,
          startAt: futureDate,
          durationMinutes: 30,
          timezone: "America/Vancouver",
          title: "Should Fail",
        },
        deniedConsent,
      ),
    ).rejects.toThrow("Consent not verified");

    await expect(
      msgEngine.send(
        {
          threadId: "thread-denied",
          senderId: "patient-denied",
          recipientId: "provider-001",
          type: MessageType.TEXT,
          subject: null,
          content: "Should fail",
        },
        deniedMessageConsent,
      ),
    ).rejects.toThrow("Consent not verified");
  });
});
