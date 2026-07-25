
import { describe, it, expect } from "vitest";
import { grantStackBApproval } from "../hermes/services/activation/provider-framework.js";
import { grantGitApproval } from "../hermes/services/activation/approval-gates.js";

describe("EPIC-005.9 P1 smoke", () => {
  it("grantGitApproval returns a structured ApprovalRef (not a string)", async () => {
    const ref = await grantGitApproval("actor1", "app1", "git.commit", "staging");
    expect(typeof ref).toBe("object");
    expect(typeof ref.id).toBe("string");
    expect(ref.id.startsWith("apr_")).toBe(true);
    expect(ref.capability).toBe("git.commit");
    expect(ref.tenant).toBe("actor1");
  });
  it("grantStackBApproval and grantGitApproval produce equivalent refs", async () => {
    const a = await grantStackBApproval("actor2", "app2", "dev.code.generate", "production");
    const b = await grantGitApproval("actor2", "app2", "git.push", "production");
    expect(a.approver).toBe("actor2");
    expect(b.approver).toBe("actor2");
  });
});
