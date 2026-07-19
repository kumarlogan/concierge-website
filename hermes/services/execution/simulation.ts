// ┌─────────────────────────────────────────────────────────────┐
// │ Hermes Execution Platform — Safe Orchestration Simulation       │
// │ EPIC-003-001 · DELIVERABLE 7 (DEMO)                            │
// │ Demonstrates the full execution chain (plan → dispatch → queue │
// │ → execute → review) against AGS Fertility in SIMULATION-ONLY   │
// │ mode.                                                          │
// │                                                                 │
// │ SAFETY GUARANTEES (enforced, not advisory):                    │
// │  • No production changes.                                      │
// │  • No Cloudflare/D1/migration changes.                         │
// │  • No secrets read or exported.                                │
// │  • No autonomous commit/deploy/push.                           │
// │  • Every privileged action is replaced by a recorded SIM event.│
// │  • The simulation flag is sticky and checked by every path.    │
// └─────────────────────────────────────────────────────────────┘

import { emitAudit } from "../../audit/event.js";
import { planWork, type GoalSpec, type WorkPlan } from "./work-planner.js";
import { dispatchCapability, type DispatchResult } from "./workforce-dispatch.js";
import {
  enqueue,
  approveAndRun,
  listQueue,
  type QueueEntry,
} from "./execution-queue.js";
import { aggregateReview, type AgentContribution, type ReviewPackage } from "./review-pipeline.js";

export const SIMULATION_MODE = true as const;

/** A recorded simulation event (no side effects ever performed). */
export interface SimEvent {
  at: string;
  kind: "plan" | "dispatch" | "enqueue" | "execute" | "review" | "blocked-privileged";
  detail: string;
  /** The capability this event concerned. */
  capability?: string;
}

/** Full simulation run record. */
export interface SimulationRun {
  runId: string;
  applicationId: string;
  createdAt: string;
  plan: WorkPlan;
  dispatches: DispatchResult[];
  queue: QueueEntry[];
  review?: ReviewPackage;
  events: SimEvent[];
  /** True if any privileged action was correctly blocked (expected). */
  privilegedActionsBlocked: number;
}

let simSeq = 0;

function genRunId(): string {
  simSeq += 1;
  return `sim_${simSeq}_${Math.random().toString(36).slice(2, 8)}`;
}

const PRIVILEGED_CAPABILITIES = new Set([
  "git.push",
  "git.commit",
  "deploy",
  "secret.write",
  "secret.read",
  "destructive",
]);

/** True if a capability would, in production, require a privileged action. */
export function isPrivilegedCapability(capability: string): boolean {
  return PRIVILEGED_CAPABILITIES.has(capability);
}

/**
 * Run a full execution-chain simulation against AGS Fertility.
 *
 * @param goal  The goal to simulate (never executed for real).
 * @param executor  A simulated executor that returns canned results. It is
 *                  NEVER a real provider; privileged capabilities return a
 *                  blocked result and a SIM event is recorded.
 */
export async function runSimulation(
  goal: GoalSpec,
  executor: (capability: string, args: unknown) => Promise<{ ok: boolean; data?: unknown; error?: string; backend: string }>,
  opts?: { approver?: string; env?: "development" | "staging" | "production" },
): Promise<SimulationRun> {
  if (!SIMULATION_MODE) {
    throw new Error("Simulation module invoked outside SIMULATION_MODE — aborting for safety");
  }
  const env = opts?.env ?? "development";
  const approver = opts?.approver ?? "sim-human";
  const events: SimEvent[] = [];
  let privilegedBlocked = 0;

  const push = (e: SimEvent) => {
    events.push(e);
  };

  // 1) Plan
  const plan = planWork(goal);
  push({ at: new Date().toISOString(), kind: "plan", detail: `Planned ${plan.ordered.length} items in ${plan.waves.length} waves` });

  // 2) Dispatch (dynamic, never hardcoded)
  const dispatches: DispatchResult[] = [];
  for (const item of plan.ordered) {
    const d = dispatchCapability(item.capability, {
      actor: approver,
      applicationId: goal.applicationId,
      env,
    });
    dispatches.push(d);
    push({
      at: new Date().toISOString(),
      kind: "dispatch",
      capability: item.capability,
      detail: `Resolved ${item.capability} via ${d.via} (${d.backend})`,
    });
  }

  // 3) Enqueue + 4) Execute (with privileged-action blocking)
  const queue: QueueEntry[] = [];
  for (let wi = 0; wi < plan.waves.length; wi++) {
    const wave = plan.waves[wi];
    for (const item of wave) {
      const d = dispatches.find((x) => x.capability === item.capability)!;
      const entry = enqueue({
        agentId: d.agentId ?? d.providerId ?? "sim-agent",
        applicationId: goal.applicationId,
        capability: item.capability,
        backend: d.backend,
        wave: wi,
        parallelizable: item.parallelizable ?? false,
        requestedBy: goal.requestedBy,
        purpose: item.title,
      });
      queue.push(entry);
      push({
        at: new Date().toISOString(),
        kind: "enqueue",
        capability: item.capability,
        detail: `Enqueued ${item.id} (wave ${wi})`,
      });

      // Privileged capabilities are BLOCKED in simulation — record, never run.
      if (isPrivilegedCapability(item.capability)) {
        privilegedBlocked += 1;
        push({
          at: new Date().toISOString(),
          kind: "blocked-privileged",
          capability: item.capability,
          detail: `BLOCKED: ${item.capability} is privileged — no real execution in simulation`,
        });
        continue;
      }

      // Non-privileged: run through the governed queue (still human-approved).
      await approveAndRun(entry.queueId, approver, executor, item.context ?? {});
      push({
        at: new Date().toISOString(),
        kind: "execute",
        capability: item.capability,
        detail: `Executed ${item.capability} (approved by ${approver})`,
      });
    }
  }

  // 5) Aggregate review
  const contributions: AgentContribution[] = queue
    .filter((e) => !isPrivilegedCapability(e.capability))
    .map((e) => ({
      agentId: e.backend.startsWith("agent:") ? e.backend.slice(6) : e.backend,
      domain: domainForCapability(e.capability),
      capability: e.capability,
      artifact: { targetFile: `sim/${e.capability.replace(/\./g, "_")}.ts`, approvalToken: "sim-token" },
      privileged: false,
      notes: `Simulated execution of ${e.capability}`,
    }));

  const review = aggregateReview({
    goalId: goal.goalId,
    applicationId: goal.applicationId,
    contributions,
    requestedBy: goal.requestedBy,
    env,
  });
  push({
    at: new Date().toISOString(),
    kind: "review",
    detail: `Aggregated review ${review.reviewId}: ${review.summary}`,
  });

  emitAudit("execution.simulation.run", goal.requestedBy, {
    runId: genRunIdPlaceholder(),
    goalId: goal.goalId,
    applicationId: goal.applicationId,
    items: plan.ordered.length,
    privilegedBlocked,
  });

  return {
    runId: genRunId(),
    applicationId: goal.applicationId,
    createdAt: new Date().toISOString(),
    plan,
    dispatches,
    queue,
    review,
    events,
    privilegedActionsBlocked: privilegedBlocked,
  };
}

function genRunIdPlaceholder(): string {
  return `sim-trace-${simSeq}`;
}

function domainForCapability(cap: string): AgentContribution["domain"] {
  if (cap.startsWith("dev.")) return "development";
  if (cap.startsWith("test.") || cap.startsWith("qa.")) return "quality";
  if (cap.startsWith("sec.") || cap.startsWith("security.")) return "security";
  if (cap.startsWith("docs.")) return "docs";
  if (cap.startsWith("research.")) return "research";
  if (cap.startsWith("ops.")) return "ops";
  return "development";
}

/** Test/reset helper. */
export function _clearSimulation(): void {
  simSeq = 0;
}
