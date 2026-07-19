// EPIC-002-006G PHASE 2 — Console session: verified-principal boundary.
import { describe, it, expect } from "vitest";
import type { Principal } from "../../hermes/contracts/platform-api.js";
import {
  verifyPrincipal,
  ConsoleSession,
} from "../../hermes/admin/console/session.js";

const human: Principal = {
  id: "principal:human:kl",
  permissions: ["hermes:admin:read", "hermes:admin:task-write"],
};

describe("EPIC-002-006G Phase 2 — session & verified principal", () => {
  it("verifies a genuine human principal", () => {
    const v = verifyPrincipal(human);
    expect(v).not.toBeNull();
    expect(v!.id).toBe("principal:human:kl");
    expect(v!.__verified).toBe("human-identity-checked");
  });

  it("rejects an agent principal (fail-closed)", () => {
    const agent: Principal = { id: "agent:dev-1", permissions: ["hermes:admin:read"] };
    expect(verifyPrincipal(agent)).toBeNull();
  });

  it("rejects a service-account principal", () => {
    const svc: Principal = { id: "svc:ci", permissions: ["hermes:admin:read"] };
    expect(verifyPrincipal(svc)).toBeNull();
  });

  it("rejects a principal with no human id prefix", () => {
    const weird: Principal = { id: "root", permissions: ["hermes:admin:read"] };
    expect(verifyPrincipal(weird)).toBeNull();
  });

  it("rejects malformed / non-object input", () => {
    expect(verifyPrincipal(null)).toBeNull();
    expect(verifyPrincipal("principal:human:x")).toBeNull();
    expect(verifyPrincipal({ id: "principal:human:x" })).toBeNull(); // missing permissions
  });

  it("establishes a session only for verified humans", () => {
    const sess = ConsoleSession.establish(human);
    expect(sess.id).toBe("principal:human:kl");
    expect(sess.describe().permissionCount).toBe(2);
  });

  it("throws when establishing a session for a non-human", () => {
    const agent: Principal = { id: "agent:dev-1", permissions: ["hermes:admin:read"] };
    expect(() => ConsoleSession.establish(agent)).toThrow(/human-identity verification/);
  });

  it("derives a role hint from permissions", () => {
    expect(ConsoleSession.establish(human).describe().role).toBe("operator");
  });
});
