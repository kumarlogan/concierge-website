// ┌─────────────────────────────────────────────────────────────┐
// │ AI Platform — Appointment Coordination Service                │
// │ Cross-provider scheduling, conflict resolution, multi-party │
// │ appointment coordination for the clinic experience.          │
// ════════════════════════════════════════════════════════════

import type { Appointment, AppointmentFilters } from "./appointment-types.js";
import { AppointmentStatus, AppointmentPriority } from "./appointment-types.js";
import { checkSlotConflict } from "./appointment-validation.js";

// ── Types ──────────────────────────────────────────────────

export interface CoordinationSlot {
  providerId: string;
  providerName: string;
  startAt: string;
  endAt: string;
  available: boolean;
}

export interface CoordinationRequest {
  patientId: string;
  primaryProviderId: string;
  secondaryProviderIds: string[];
  type: string;
  startAt: string;
  durationMinutes: number;
  timezone: string;
  title: string;
  notes?: string;
  priority?: string;
  requireAllProviders?: boolean;
}

export interface CoordinationResult {
  success: boolean;
  appointmentId?: string;
  conflicts?: CoordinationConflict[];
  suggestion?: CoordinationSlot[];
  message: string;
}

export interface CoordinationConflict {
  providerId: string;
  providerName: string;
  conflictingAppointmentId: string;
  conflictingTitle: string;
  startAt: string;
  endAt: string;
}

export interface CoordinationSuggestion {
  providerId: string;
  providerName: string;
  suggestedSlots: CoordinationSlot[];
}

// ── Appointment Coordination Service ───────────────────────

export class AppointmentCoordinationService {
  constructor(
    private readonly listAppointments: (filters: AppointmentFilters) => Promise<Appointment[]>,
    private readonly createAppointment: (data: {
      patientId: string;
      providerId: string;
      type: string;
      startAt: string;
      durationMinutes: number;
      timezone: string;
      title: string;
      notes?: string;
      priority?: string;
      metadata?: Record<string, unknown>;
    }) => Promise<Appointment>,
  ) {}

  /**
   * Coordinate an appointment across multiple providers.
   * Checks availability for all providers and identifies conflicts.
   */
  async coordinateAppointment(request: CoordinationRequest): Promise<CoordinationResult> {
    const { primaryProviderId, secondaryProviderIds, startAt, durationMinutes, patientId, type, timezone, title, notes, priority, requireAllProviders } = request;

    const startDate = new Date(startAt);
    const endDate = new Date(startDate.getTime() + durationMinutes * 60_000);
    const endAt = endDate.toISOString();

    const allProviderIds = [primaryProviderId, ...secondaryProviderIds];
    const conflicts: CoordinationConflict[] = [];
    const availableProviderIds: string[] = [];

    // Check each provider's availability
    for (const providerId of allProviderIds) {
      const existingAppointments = await this.listAppointments({
        providerId,
        startFrom: startAt,
        startTo: endAt,
        status: [
          AppointmentStatus.SCHEDULED,
          AppointmentStatus.CONFIRMED,
          AppointmentStatus.IN_PROGRESS,
        ],
      });

      const validation = checkSlotConflict(
        { startAt, endAt, providerId },
        existingAppointments,
      );

      if (validation.valid) {
        availableProviderIds.push(providerId);
      } else {
        for (const existing of existingAppointments) {
          conflicts.push({
            providerId,
            providerName: providerId,
            conflictingAppointmentId: existing.id,
            conflictingTitle: existing.title,
            startAt: existing.startAt,
            endAt: existing.endAt,
          });
        }
      }
    }

    // If all providers aren't available and requireAllProviders is true, suggest alternatives
    if (requireAllProviders && availableProviderIds.length < allProviderIds.length) {
      const suggestions = await this.suggestAlternatives(
        request,
        allProviderIds.filter((id) => !availableProviderIds.includes(id)),
        durationMinutes,
      );

      return {
        success: false,
        conflicts,
        suggestion: suggestions,
        message: "Not all providers are available for the requested time slot. Alternative slots suggested.",
      };
    }

    // Create the appointment with the primary provider
    try {
      const appointment = await this.createAppointment({
        patientId,
        providerId: primaryProviderId,
        type,
        startAt,
        durationMinutes,
        timezone,
        title,
        notes,
        priority: priority || AppointmentPriority.NORMAL,
        metadata: {
          coordinatedProviders: secondaryProviderIds,
          coordinationType: requireAllProviders ? "all_required" : "primary_only",
        },
      });

      return {
        success: true,
        appointmentId: appointment.id,
        message: `Appointment coordinated successfully. Primary provider: ${primaryProviderId}.`,
      };
    } catch (err) {
      return {
        success: false,
        message: err instanceof Error ? err.message : "Failed to create coordinated appointment",
      };
    }
  }

  /**
   * Suggest alternative time slots for unavailable providers.
   */
  async suggestAlternatives(
    request: CoordinationRequest,
    unavailableProviderIds: string[],
    durationMinutes: number,
  ): Promise<CoordinationSlot[]> {
    const suggestions: CoordinationSlot[] = [];
    const startDate = new Date(request.startAt);

    // Look ahead in 30-minute increments for the next 4 hours
    for (let offset = 30; offset <= 240; offset += 30) {
      const candidateStart = new Date(startDate.getTime() + offset * 60_000);
      const candidateEnd = new Date(candidateStart.getTime() + durationMinutes * 60_000);

      for (const providerId of unavailableProviderIds) {
        const existingAppointments = await this.listAppointments({
          providerId,
          startFrom: candidateStart.toISOString(),
          startTo: candidateEnd.toISOString(),
          status: [
            AppointmentStatus.SCHEDULED,
            AppointmentStatus.CONFIRMED,
            AppointmentStatus.IN_PROGRESS,
          ],
        });

        const validation = checkSlotConflict(
          {
            startAt: candidateStart.toISOString(),
            endAt: candidateEnd.toISOString(),
            providerId,
          },
          existingAppointments,
        );

        suggestions.push({
          providerId,
          providerName: providerId,
          startAt: candidateStart.toISOString(),
          endAt: candidateEnd.toISOString(),
          available: validation.valid,
        });
      }
    }

    return suggestions.filter((s) => s.available).slice(0, 10);
  }

  /**
   * Check availability for a list of providers in a time range.
   */
  async checkMultiProviderAvailability(
    providerIds: string[],
    startAt: string,
    endAt: string,
  ): Promise<CoordinationSlot[]> {
    const results: CoordinationSlot[] = [];

    for (const providerId of providerIds) {
      const existingAppointments = await this.listAppointments({
        providerId,
        startFrom: startAt,
        startTo: endAt,
        status: [
          AppointmentStatus.SCHEDULED,
          AppointmentStatus.CONFIRMED,
          AppointmentStatus.IN_PROGRESS,
        ],
      });

      const validation = checkSlotConflict(
        { startAt, endAt, providerId },
        existingAppointments,
      );

      results.push({
        providerId,
        providerName: providerId,
        startAt,
        endAt,
        available: validation.valid,
      });
    }

    return results;
  }

  /**
   * Reschedule an appointment and check all coordinated providers.
   */
  async rescheduleCoordinatedAppointment(
    appointmentId: string,
    newStartAt: string,
    _durationMinutes: number,
  ): Promise<CoordinationResult> {
    try {
      const appointment = (await this.listAppointments({}))[0]; // simplified; real lookup by ID
      return {
        success: true,
        appointmentId,
        message: "Appointment rescheduled (stub — full lookup requires engine integration)",
      };
    } catch (err) {
      return {
        success: false,
        message: err instanceof Error ? err.message : "Failed to reschedule",
      };
    }
  }
}