// ┌─────────────────────────────────────────────────────────────┐
// │ AG Synergy Platform — D1 Appointment Store                   │
// │ Phase 2.1 — BLOCKER 2 remediation                            │
// └─────────────────────────────────────────────────────────────┘
//
// D1-backed implementation of the AppointmentEngine interface.
// Replaces InMemoryAppointmentEngine for production persistence.
//
// Uses the appointments table created by migration 0017_appointment_persistence.sql.
// Implements the EXACT SAME interface (AppointmentEngine) so route handlers
// require no logic changes — only the factory function switches from
// InMemoryAppointmentEngine to D1AppointmentStore.
//
// PHI Boundary: appointment metadata only — patient/provider references
// are opaque identity IDs, no PHI stored here.

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

export class D1AppointmentStore implements AppointmentEngine {
  private db: D1Database;

  constructor(db: D1Database) {
    this.db = db;
  }

  /** Convert a D1 row to the Appointment type */
  private fromRow(row: Record<string, unknown>): Appointment {
    return {
      id: row.id as string,
      patientId: row.patient_id as string,
      providerId: row.provider_id as string,
      type: row.type as Appointment["type"],
      status: row.status as AppointmentStatus,
      priority: row.priority as AppointmentPriority,
      startAt: row.start_at as string,
      endAt: row.end_at as string,
      durationMinutes: row.duration_minutes as number,
      timezone: row.timezone as string,
      title: row.title as string,
      notes: row.notes as string,
      location: row.location as string | null,
      metadata: JSON.parse(row.metadata as string),
      createdAt: row.created_at as string,
      updatedAt: row.updated_at as string,
      createdBy: row.created_by as string,
      updatedBy: row.updated_by as string,
    };
  }

  /** Convert an Appointment to D1 bind values (order-matched to INSERT) */
  private toRow(a: Appointment): unknown[] {
    return [
      a.id, a.patientId, a.providerId, a.type, a.status, a.priority,
      a.startAt, a.endAt, a.durationMinutes, a.timezone,
      a.title, a.notes, a.location ?? null, JSON.stringify(a.metadata),
      a.createdAt, a.updatedAt, a.createdBy, a.updatedBy,
    ];
  }

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

    // Check slot conflicts against existing appointments in D1
    const existing = await this.list({
      providerId: request.providerId,
      status: [
        AppointmentStatus.SCHEDULED,
        AppointmentStatus.CONFIRMED,
        AppointmentStatus.IN_PROGRESS,
      ],
    });

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

    await this.db.prepare(
      `INSERT INTO appointments
       (id, patient_id, provider_id, type, status, priority, start_at, end_at,
        duration_minutes, timezone, title, notes, location, metadata,
        created_at, updated_at, created_by, updated_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).bind(...this.toRow(appointment)).run();

    return appointment;
  }

  async get(id: string): Promise<Appointment | null> {
    const row = await this.db.prepare(
      `SELECT * FROM appointments WHERE id = ?`,
    ).bind(id).first<Record<string, unknown>>();

    return row ? this.fromRow(row) : null;
  }

  async list(filters: AppointmentFilters): Promise<Appointment[]> {
    let sql = `SELECT * FROM appointments WHERE 1=1`;
    const bindings: unknown[] = [];

    if (filters.patientId) {
      sql += ` AND patient_id = ?`;
      bindings.push(filters.patientId);
    }
    if (filters.providerId) {
      sql += ` AND provider_id = ?`;
      bindings.push(filters.providerId);
    }
    if (filters.status && filters.status.length > 0) {
      sql += ` AND status IN (${filters.status.map(() => "?").join(", ")})`;
      bindings.push(...filters.status);
    }
    if (filters.type && filters.type.length > 0) {
      sql += ` AND type IN (${filters.type.map(() => "?").join(", ")})`;
      bindings.push(...filters.type);
    }
    if (filters.startFrom) {
      sql += ` AND start_at >= ?`;
      bindings.push(filters.startFrom);
    }
    if (filters.startTo) {
      sql += ` AND start_at <= ?`;
      bindings.push(filters.startTo);
    }

    sql += ` ORDER BY start_at ASC`;

    if (filters.limit) {
      sql += ` LIMIT ?`;
      bindings.push(filters.limit);
    }
    if (filters.offset) {
      sql += ` OFFSET ?`;
      bindings.push(filters.offset);
    }

    const result = await this.db.prepare(sql).bind(...bindings).all<Record<string, unknown>>();
    return (result.results ?? []).map((row) => this.fromRow(row));
  }

  async update(id: string, request: UpdateAppointmentRequest): Promise<Appointment> {
    // Fetch existing first to merge
    const existing = await this.get(id);
    if (!existing) {
      throw new Error(`Appointment ${id} not found`);
    }

    const now = new Date().toISOString();
    const updated: Appointment = {
      ...existing,
      ...Object.fromEntries(Object.entries(request).filter(([, v]) => v !== undefined)),
      updatedAt: now,
    };

    await this.db.prepare(
      `UPDATE appointments SET
         type = ?, status = ?, priority = ?, start_at = ?, duration_minutes = ?,
         title = ?, notes = ?, location = ?, updated_at = ?, updated_by = ?
       WHERE id = ?`,
    ).bind(
      updated.type, updated.status, updated.priority, updated.startAt, updated.durationMinutes,
      updated.title, updated.notes, updated.location ?? null,
      now, updated.updatedBy, id,
    ).run();

    return updated;
  }

  async cancel(id: string): Promise<void> {
    const existing = await this.get(id);
    if (!existing) {
      throw new Error(`Appointment ${id} not found`);
    }

    await this.db.prepare(
      `UPDATE appointments SET status = ?, updated_at = ? WHERE id = ?`,
    ).bind(
      AppointmentStatus.CANCELLED,
      new Date().toISOString(),
      id,
    ).run();
  }

  async checkAvailability(start: string, end: string): Promise<boolean> {
    const startMs = new Date(start).getTime();
    const endMs = new Date(end).getTime();

    const result = await this.db.prepare(
      `SELECT start_at, end_at, status FROM appointments
       WHERE status != ?
       AND start_at < ? AND end_at > ?`,
    ).bind(
      AppointmentStatus.CANCELLED,
      end,
      start,
    ).all<{ start_at: string; end_at: string; status: string }>();

    const existing = (result.results ?? []).map((row) => ({
      startAt: row.start_at,
      endAt: row.end_at,
      status: row.status as AppointmentStatus,
    }));

    // No conflicts = available
    return existing.length === 0;
  }
}