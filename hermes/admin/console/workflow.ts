// ┌─────────────────────────────────────────────────────────────┐
// │ Hermes Admin Console — Controlled Workflow Orchestrator         │
// │ EPIC-002-006G · PHASE 3                                        │
// │ A FIRST, deliberately NON-AUTONOMOUS controller. A workflow can │
// │ be drafted by a human, but it CANNOT execute until a separate   │
// │ human explicitly calls approve(). There is no self-approval,    │
// │ no timer that auto-runs, no autonomous progression. Every       │
// │ transition out of awaiting-approval requires a human principal  │
// │ with the controlling permission.                                │
// │                                                 BOUNDARY:      │
// │  • Imports only the Principal contract + permission helpers.    │
// │  • Step bodies are supplied by the caller (the human's intent)  │
// │    and run only after human approval.                           │
// │  • Cannot mint or bypass the human checkpoint.                  │
// └─────────────────────────────────────────────────────────────┘

import type { Principal } from "../../contracts/platform-api.js";

export type WorkflowState =
  | "drafted"
  | "submitted"
  | "awaiting-approval"
  | "approved"
  | "executing"
  | "completed"
  | "failed"
  | "cancelled";

export interface WorkflowStep {
  id: string;
  /** Human-readable description (shown in console + audit). */
  description: string;
  /** The actual action. Runs ONLY after human approval. */
  run: (principal: Principal) => Promise<void> | void;
}

export interface WorkflowEvent {
  at: string;
  state: WorkflowState;
  by: string; // principal id or "system"
  note?: string;
}

const REQUIRED_APPROVE_PERM = "hermes:admin:task-write";
const REQUIRED_CANCEL_PERM = "hermes:admin:task-write";

function hasPermission(p: Principal, perm: string): boolean {
  return Array.isArray(p.permissions) && p.permissions.includes(perm);
}

/**
 * A controlled, human-gated workflow. Non-autonomous by construction:
 * approval is a separate, required human action before execution.
 */
export class ControlledWorkflow {
  readonly id: string;
  private _state: WorkflowState = "drafted";
  private readonly history: WorkflowEvent[] = [];
  private readonly steps: WorkflowStep[] = [];
  private approvedBy: string | null = null;

  constructor(
    id: string,
    private readonly label: string,
  ) {
    this.id = id;
    this.record("system", "drafted", "created");
  }

  get state(): WorkflowState {
    return this._state;
  }

  get events(): readonly WorkflowEvent[] {
    return this.history;
  }

  /** Draft steps. Only allowed before submission. */
  addStep(step: WorkflowStep): void {
    if (this._state !== "drafted") {
      throw new Error(`Cannot add steps in state '${this._state}'`);
    }
    this.steps.push(step);
  }

  /** Human submits the workflow for approval. */
  submit(principal: Principal): void {
    if (this._state !== "drafted") {
      throw new Error(`Cannot submit in state '${this._state}'`);
    }
    if (this.steps.length === 0) {
      throw new Error("Cannot submit a workflow with zero steps");
    }
    this._state = "awaiting-approval";
    this.record(principal.id, "submitted", `${this.steps.length} steps`);
  }

  /**
   * HUMAN CHECKPOINT. The only path from awaiting-approval → approved.
   * Requires an explicit human principal with the approval permission.
   * There is no other route — no timer, no self-approval.
   */
  approve(principal: Principal): void {
    if (this._state !== "awaiting-approval") {
      throw new Error(`Cannot approve in state '${this._state}'`);
    }
    if (!hasPermission(principal, REQUIRED_APPROVE_PERM)) {
      this.record(principal.id, this._state, "approval DENIED: missing permission");
      throw new Error(`Approval requires '${REQUIRED_APPROVE_PERM}'`);
    }
    this.approvedBy = principal.id;
    this._state = "approved";
    this.record(principal.id, "approved");
  }

  /**
   * Execute the steps. Fails closed if not explicitly approved by a human.
   * If already executed/completed/failed/cancelled, refuses to re-run.
   */
  async execute(principal: Principal): Promise<void> {
    if (this._state !== "approved") {
      throw new Error(`Cannot execute in state '${this._state}' (approval required)`);
    }
    if (this.approvedBy === null) {
      throw new Error("Refusing to execute: no human approval on record");
    }
    this._state = "executing";
    this.record(principal.id, "executing");
    for (const step of this.steps) {
      try {
        await step.run(principal);
        this.record(principal.id, "executing", `step ok: ${step.id}`);
      } catch (err) {
        this._state = "failed";
        this.record(principal.id, "failed", `step '${step.id}': ${(err as Error).message}`);
        throw err;
      }
    }
    this._state = "completed";
    this.record(principal.id, "completed");
  }

  /** Human cancels. Not available once completed/failed. */
  cancel(principal: Principal): void {
    if (this._state === "completed" || this._state === "failed") {
      throw new Error(`Cannot cancel in state '${this._state}'`);
    }
    if (!hasPermission(principal, REQUIRED_CANCEL_PERM)) {
      throw new Error(`Cancel requires '${REQUIRED_CANCEL_PERM}'`);
    }
    this._state = "cancelled";
    this.record(principal.id, "cancelled");
  }

  /** Console-friendly summary. */
  summary(): { id: string; label: string; state: WorkflowState; approvedBy: string | null; steps: string[] } {
    return {
      id: this.id,
      label: this.label,
      state: this._state,
      approvedBy: this.approvedBy,
      steps: this.steps.map((s) => `${s.id}: ${s.description}`),
    };
  }

  private record(by: string, state: WorkflowState, note?: string): void {
    this.history.push({ at: new Date().toISOString(), state, by, note });
  }
}
