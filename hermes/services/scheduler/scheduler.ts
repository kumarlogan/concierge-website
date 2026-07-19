// ┌─────────────────────────────────────────────────────────────┐
// │ Hermes Platform — Scheduler Service (contract stub)            │
// │ EPIC-002-006C · PHASE 1                                        │
// │ In-process scheduler boundary. Maps to shared/interfaces/      │
// │ scheduler (Cloudflare Cron Triggers + Queue). No vendor code.  │
// └─────────────────────────────────────────────────────────────┘

import type { Scheduler } from "../../../shared/interfaces/scheduler.js";

export interface Schedule {
  id: string;
  /** Cron expression or ISO interval. */
  when: string;
  /** Target service/agent to invoke. */
  target: string;
  enabled: boolean;
}

const SCHEDULES = new Map<string, Schedule>();

export function registerSchedule(s: Schedule): Schedule {
  SCHEDULES.set(s.id, s);
  return s;
}

export function listSchedules(): Schedule[] {
  return [...SCHEDULES.values()];
}

/**
 * Bind a concrete Scheduler (e.g. Cloudflare Cron) without importing
 * the SDK here. The provider is injected — satisfies "no SDK in business logic".
 */
export function bindScheduler(_provider: Scheduler): void {
  // Hook for future provider wiring; intentionally no-op in planning build.
}
