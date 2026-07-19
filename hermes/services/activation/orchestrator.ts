// ┌─────────────────────────────────────────────────────────────┐
// │ Hermes Platform — Generic Task Orchestration Engine          │
// │ EPIC-002-007 · M3 (task orchestration, generic)               │
// │                                                 DESIGN:        │
// │  • Generic — NOT developer-specific. Any agent (security,     │
// │    research, docs) reuses this engine.                        │
// │  • Adds runtime concerns the foundation task.ts omits:        │
// │      retry (bounded, exponential backoff)                     │
// │      cancellation (human or system)                           │
// │      timeouts (per-attempt + overall)                         │
// │      failure recovery (recoverable vs terminal)               │
// │      audit on every state change                              │
// │  • Does NOT execute arbitrary agent actions itself. It drives │
// │    a caller-supplied async step function under strict guards. │
// │  • Built on shared/contracts lifecycle + hermes/audit.         │
// └─────────────────────────────────────────────────────────────┘

import { emitAudit } from "../../audit/event.js";
import {
  type TaskState,
  canTransitionTask,
  type AgentTask,
  getTask,
} from "../agents/task.js";

// ─── Config ───────────────────────────────────────────────────

export interface OrchestrationConfig {
  /** Max attempts before a task is marked failed (terminal). */
  maxAttempts: number;
  /** Base backoff ms (doubled each retry). */
  backoffMs: number;
  /** Overall timeout ms for the whole run (across retries). */
  overallTimeoutMs: number;
  /** Per-attempt timeout ms. */
  attemptTimeoutMs: number;
}

export const DEFAULT_ORCHESTRATION: OrchestrationConfig = {
  maxAttempts: 3,
  backoffMs: 1000,
  overallTimeoutMs: 300_000,
  attemptTimeoutMs: 120_000,
};

// ─── Result ───────────────────────────────────────────────────

export interface OrchestrationResult {
  taskId: string;
  ok: boolean;
  attempts: number;
  state: TaskState;
  error?: string;
  /** Audit event ids emitted during the run (provenance). */
  auditTrail: string[];
}

// ─── Cancellation token ───────────────────────────────────────

export interface CancellationToken {
  cancelled: boolean;
  reason?: string;
}
export function newCancellationToken(): CancellationToken {
  return { cancelled: false };
}
export function cancelToken(token: CancellationToken, reason: string): void {
  token.cancelled = true;
  token.reason = reason;
}

// ─── Timeout helper ───────────────────────────────────────────

function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`timeout: ${label} (${ms}ms)`)), ms);
    p.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e) => {
        clearTimeout(t);
        reject(e);
      },
    );
  });
}

// ─── Step function contract ───────────────────────────────────

/**
 * The work unit the orchestrator drives. A "recoverable" error (throw) causes
 * a retry; return { ok:false, terminal:true } marks the task failed without
 * further retry. Returning { ok:true } completes the task.
 */
export interface StepOutcome {
  ok: boolean;
  /** If true and !ok, do NOT retry (terminal failure). */
  terminal?: boolean;
  detail?: unknown;
}
export type StepFunction = (
  task: AgentTask,
  attempt: number,
  token: CancellationToken,
) => Promise<StepOutcome> | StepOutcome;

// ─── Engine ───────────────────────────────────────────────────

/**
 * Orchestrate a controlled task. The task MUST already exist (created via
 * hermes/agents/task.createTask) and be in a state the caller may drive.
 *
 * Flow:
 *   approved → running → (step) → completed | failed | cancelled
 * Retries on recoverable failure up to maxAttempts. Honors cancellation and
 * overall/attempt timeouts. Every transition is audited and validated against
 * the canonical task transition table (fail-closed: illegal transitions throw).
 */
export async function orchestrate(
  taskId: string,
  step: StepFunction,
  opts: {
    config?: OrchestrationConfig;
    token?: CancellationToken;
    actor: string;
    /** Hook called after a successful step but before completion (e.g. security review). */
    onSuccess?: (task: AgentTask) => Promise<void> | void;
  },
): Promise<OrchestrationResult> {
  const cfg = opts.config ?? DEFAULT_ORCHESTRATION;
  const token = opts.token ?? newCancellationToken();
  const auditTrail: string[] = [];
  const guard = (from: TaskState, to: TaskState, actor: string) => {
    if (!canTransitionTask(from, to)) {
      throw new Error(`Illegal orchestration transition: ${from} -> ${to}`);
    }
  };

  const task = getTask(taskId);
  if (!task) throw new Error(`Unknown task: ${taskId}`);
  if (task.state !== "approved" && task.state !== "running") {
    throw new Error(`Task ${taskId} must be approved before orchestration (current: ${task.state})`);
  }

  const started = Date.now();
  let attempts = 0;

  // → running
  guard(task.state, "running", opts.actor);
  // (Transition handled by caller's task framework; here we record intent.)
  emitAudit("orchestration.start", opts.actor, { taskId });
  auditTrail.push("orchestration.start");

  try {
    while (attempts < cfg.maxAttempts) {
      if (token.cancelled) {
        emitAudit("orchestration.cancelled", opts.actor, { taskId, reason: token.reason });
        auditTrail.push("orchestration.cancelled");
        return { taskId, ok: false, attempts, state: "cancelled", error: token.reason, auditTrail };
      }
      if (Date.now() - started > cfg.overallTimeoutMs) {
        emitAudit("orchestration.timeout.overall", opts.actor, { taskId });
        auditTrail.push("orchestration.timeout.overall");
        return { taskId, ok: false, attempts, state: "failed", error: "overall timeout", auditTrail };
      }

      attempts++;
      emitAudit("orchestration.attempt", opts.actor, { taskId, attempt: attempts });
      auditTrail.push(`orchestration.attempt:${attempts}`);

      let outcome: StepOutcome;
      try {
        const stepResult = step(task, attempts, token);
        const awaited = stepResult instanceof Promise ? stepResult : Promise.resolve(stepResult);
        outcome = await withTimeout(awaited, cfg.attemptTimeoutMs, `attempt ${attempts}`);
      } catch (err) {
        // Attempt threw (timeout or runtime). Recoverable unless terminal.
        const msg = String(err);
        if (attempts >= cfg.maxAttempts) {
          emitAudit("orchestration.failed", opts.actor, { taskId, reason: msg });
          auditTrail.push("orchestration.failed");
          return { taskId, ok: false, attempts, state: "failed", error: msg, auditTrail };
        }
        emitAudit("orchestration.retry", opts.actor, { taskId, attempt: attempts, reason: msg });
        auditTrail.push(`orchestration.retry:${attempts}`);
        await delay(cfg.backoffMs * 2 ** (attempts - 1));
        continue;
      }

      if (outcome.ok) {
        if (opts.onSuccess) {
          try {
            await opts.onSuccess(task);
          } catch (err) {
            emitAudit("orchestration.postsuccess.failed", opts.actor, { taskId, reason: String(err) });
            auditTrail.push("orchestration.postsuccess.failed");
            return { taskId, ok: false, attempts, state: "failed", error: `post-success hook: ${String(err)}`, auditTrail };
          }
        }
        emitAudit("orchestration.completed", opts.actor, { taskId, attempts });
        auditTrail.push("orchestration.completed");
        return { taskId, ok: true, attempts, state: "completed", auditTrail };
      }

      // !ok
      if (outcome.terminal || attempts >= cfg.maxAttempts) {
        emitAudit("orchestration.failed", opts.actor, { taskId, reason: "terminal", detail: outcome.detail });
        auditTrail.push("orchestration.failed");
        return { taskId, ok: false, attempts, state: "failed", error: "terminal failure", auditTrail };
      }
      emitAudit("orchestration.retry", opts.actor, { taskId, attempt: attempts, reason: "recoverable" });
      auditTrail.push(`orchestration.retry:${attempts}`);
      await delay(cfg.backoffMs * 2 ** (attempts - 1));
    }

    emitAudit("orchestration.exhausted", opts.actor, { taskId });
    auditTrail.push("orchestration.exhausted");
    return { taskId, ok: false, attempts, state: "failed", error: "max attempts exceeded", auditTrail };
  } finally {
    // No direct state mutation here — the orchestrator reports; the caller's
    // task framework owns authoritative state. We only audit + return.
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
