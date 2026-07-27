// ┌─────────────────────────────────────────────────────────────┐
// │ AI Platform — In-Memory Appointment Engine                   │
// │ Concrete implementation of AppointmentEngine interface.     │
// │ Wave 8 — End-to-End Integration                              │
// └─────────────────────────────────────────────────────────────┘
//
// D1-backed implementation replaces this for production.
// This implementation satisfies the engine contract and enables
// integration testing without external dependencies.

import { randomUUID } from "node:crypto";
import type { AppointmentEngine, ConsentVerificationResult } from "./appointment-engine.js";
import type {
  Appointment,
  CreateAppointmentRequest,
  UpdateAppointmentRequest,
  AppointmentFilters,
} from "./appointment-types.js";
import { AppointmentStatus, AppointmentPriority } from "./appointment-types.js";
import { checkSlotConflict } from "./appointment-validation.js";

export class InMemoryAppointmentEngine implements AppointmentEngine {
  private store = new Map<string, Appointment>();

  async create(
    request: CreateAppointmentRequest,
    consent: ConsentVerificationResult,
  ): Promise<Appointment> {
    if (!consent.verified) {
      throw new Error("Consent not verified for appointment creation");
    }

    const endAt = new Date(
      new Date(request.startAt).getTime() + request.durationMinutes * 60_000,
    ).toISOString();

    // Check slot conflicts against existing appointments
    const existing = Array.from(this.store.values()).filter(
      (a) => a.providerId === request.providerId && a.status !== AppointmentStatus.CANCELLED,
    );
    const validation = checkSlotConflict(
      { startAt: request.startAt, endAt, providerId: request.providerId },
      existing,
    );
    if (!validation.valid) {
      throw new Error(`Validation failed: ${validation.errors.join(", ")}`);
    }

    const now = new Date().toISOString();
    const appointment: Appointment = {
      id: randomUUID(),
      patientId: request.patientId,
      providerId: request.providerId,
      type: request.type,
      status: AppointmentStatus.SCHEDULED,
      priority: request.priority ?? AppointmentPriority.NORMAL,
      startAt: request.startAt,
      endAt,
      durationMinutes: request.durationMinutes,
      timezone: request.timezone,
      title: request.title,
      notes: request.notes ?? "",
      location: request.location ?? null,
      metadata: request.metadata ?? {},
      createdAt: now,
      updatedAt: now,
      createdBy: request.patientId,
      updatedBy: request.patientId,
    };

    this.store.set(appointment.id, appointment);
    return appointment;
  }

  async get(id: string): Promise<Appointment | null> {
    return this.store.get(id) ?? null;
  }

  async list(filters: AppointmentFilters): Promise<Appointment[]> {
    let results = Array.from(this.store.values());

    if (filters.patientId) {
      results = results.filter((a) => a.patientId === filters.patientId);
    }
    if (filters.providerId) {
      results = results.filter((a) => a.providerId === filters.providerId);
    }
    if (filters.status && filters.status.length > 0) {
      results = results.filter((a) => filters.status!.includes(a.status));
    }
    if (filters.type && filters.type.length > 0) {
      results = results.filter((a) => filters.type!.includes(a.type));
    }
    if (filters.startFrom) {
      const from = new Date(filters.startFrom).getTime();
      results = results.filter((a) => new Date(a.startAt).getTime() >= from);
    }
    if (filters.startTo) {
      const to = new Date(filters.startTo).getTime();
      results = results.filter((a) => new Date(a.startAt).getTime() <= to);
    }

    // Sort by startAt ascending
    results.sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime());

    if (filters.offset) {
      results = results.slice(filters.offset);
    }
    if (filters.limit) {
      results = results.slice(0, filters.limit);
    }

    return results;
  }

  async update(id: string, request: UpdateAppointmentRequest): Promise<Appointment> {
    const existing = this.store.get(id);
    if (!existing) {
      throw new Error(`Appointment ${id} not found`);
    }

    const now = new Date().toISOString();
    const updated: Appointment = {
      ...existing,
      ...Object.fromEntries(Object.entries(request).filter(([, v]) => v !== undefined)),
      updatedAt: now,
    };

    this.store.set(id, updated);
    return updated;
  }

  async cancel(id: string): Promise<void> {
    const existing = this.store.get(id);
    if (!existing) {
      throw new Error(`Appointment ${id} not found`);
    }

    this.store.set(id, {
      ...existing,
      status: AppointmentStatus.CANCELLED,
      updatedAt: new Date().toISOString(),
    });
  }

  async checkAvailability(start: string, end: string): Promise<boolean> {
    const startMs = new Date(start).getTime();
    const endMs = new Date(end).getTime();

    for (const appt of this.store.values()) {
      if (appt.status === AppointmentStatus.CANCELLED) continue;
      const apptStart = new Date(appt.startAt).getTime();
      const apptEnd = new Date(appt.endAt).getTime();
      if (startMs < apptEnd && endMs > apptStart) {
        return false;
      }
    }

    return true;
  }
}
