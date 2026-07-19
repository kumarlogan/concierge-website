// EPIC-002-006G PHASE 3 — Controlled (non-autonomous) workflow orchestrator.
import { describe, it, expect } from "vitest";
import type { Principal } from "../../hermes/contracts/platform-api.js";
import { ControlledWorkflow } from "../../hermes/admin/console/workflow.js";

const reader: Principal = { id: "principal:human:viewer", permissions: ["hermes:admin:read"] };
const operator: Principal = {
  id: "principal:human:op",
  permissions: ["hermes:admin:read", "hermes:admin:task-write"],
};

function buildWithStep() {
  const wf = new ControlledWorkflow("wf-1", "demo");
  let ran = false;
  wf.addStep({
    id: "s1",
    description: "mutating action",
    run: () => {
      ran = true;
    },
  });
  return { wf, getRan: () => ran };
}

describe("EPIC-002-006G Phase 3 — non-autonomous workflow", () => {
  it("cannot execute before approval (fail-closed)", async () => {
    const { wf, getRan } = buildWithStep();
    wf.submit(operator);
    expect(wf.state).toBe("awaiting-approval");
    await expect(wf.execute(operator)).rejects.toThrow(/approval required/);
    expect(getRan()).toBe(false);
  });

  it("refuses approval without task-write permission", () => {
    const { wf } = buildWithStep();
    wf.submit(operator);
    expect(() => wf.approve(reader)).toThrow(/task-write/);
    expect(wf.state).toBe("awaiting-approval");
  });

  it("executes only after an explicit human approval", async () => {
    const { wf, getRan } = buildWithStep();
    wf.submit(operator);
    wf.approve(operator);
    expect(wf.state).toBe("approved");
    await wf.execute(operator);
    expect(wf.state).toBe("completed");
    expect(getRan()).toBe(true);
  });

  it("records the human approver", async () => {
    const { wf } = buildWithStep();
    wf.submit(operator);
    wf.approve(operator);
    expect(wf.summary().approvedBy).toBe("principal:human:op");
  });

  it("cannot be approved twice / from wrong state", () => {
    const { wf } = buildWithStep();
    expect(() => wf.approve(operator)).toThrow(); // not submitted yet
  });

  it("stops and fails on a throwing step", async () => {
    const wf = new ControlledWorkflow("wf-2", "fail-demo");
    wf.addStep({ id: "bad", description: "boom", run: () => { throw new Error("kaboom"); } });
    wf.submit(operator);
    wf.approve(operator);
    await expect(wf.execute(operator)).rejects.toThrow("kaboom");
    expect(wf.state).toBe("failed");
  });

  it("allows a human to cancel before execution", () => {
    const { wf } = buildWithStep();
    wf.submit(operator);
    wf.cancel(operator);
    expect(wf.state).toBe("cancelled");
  });
});
