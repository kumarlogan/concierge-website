// ┌─────────────────────────────────────────────────────────────┐
// │ Tests — Resource Authorization Middleware                    │
// └─────────────────────────────────────────────────────────────┘
//
// These tests pin the behaviour that closes the IDOR/BOLA family of defects:
// an authenticated patient must never reach another patient's records, and
// clinic staff must retain cross-patient access. Both directions are tested,
// because a guard that is merely restrictive breaks the clinic workspace.

import { describe, it, expect } from "vitest";
import type { AuthenticatedIdentity } from "../../src/middleware/jwt-auth.js";
import {
  AuthzError,
  STAFF_IDENTITY_TYPES,
  isStaffIdentity,
  requireStaff,
  assertOwnership,
  assertParticipant,
  resolveScopedIdentityId,
  authzErrorResponse,
} from "../../src/middleware/authz.js";

function identity(id: string, identityType = "patient"): AuthenticatedIdentity {
  return { identityId: id, identityType, mfaLevel: 0 };
}

const patientA = identity("identity-aaa");
const patientB = identity("identity-bbb");
const clinic = identity("identity-clinic", "clinic");
const staff = identity("identity-staff", "staff");
const admin = identity("identity-admin", "administrator");

describe("isStaffIdentity", () => {
  it("recognises every staff identity type", () => {
    for (const type of STAFF_IDENTITY_TYPES) {
      expect(isStaffIdentity(type)).toBe(true);
    }
  });

  it("rejects patients", () => {
    expect(isStaffIdentity("patient")).toBe(false);
  });

  it("fails closed on unknown, future and empty identity types", () => {
    expect(isStaffIdentity("partner")).toBe(false);
    expect(isStaffIdentity("ai_worker")).toBe(false);
    expect(isStaffIdentity("some_future_type")).toBe(false);
    expect(isStaffIdentity("")).toBe(false);
    expect(isStaffIdentity(null)).toBe(false);
    expect(isStaffIdentity(undefined)).toBe(false);
  });
});

describe("requireStaff", () => {
  it("permits clinic, staff and administrator", () => {
    expect(() => requireStaff(clinic)).not.toThrow();
    expect(() => requireStaff(staff)).not.toThrow();
    expect(() => requireStaff(admin)).not.toThrow();
  });

  it("denies patients with a 403 AuthzError", () => {
    expect(() => requireStaff(patientA)).toThrow(AuthzError);
    try {
      requireStaff(patientA);
    } catch (err) {
      expect((err as AuthzError).status).toBe(403);
      expect((err as AuthzError).code).toBe("STAFF_REQUIRED");
    }
  });
});

describe("assertOwnership", () => {
  it("permits the owner", () => {
    expect(() => assertOwnership(patientA, "identity-aaa", "appointment")).not.toThrow();
  });

  it("denies a different patient", () => {
    expect(() => assertOwnership(patientA, "identity-bbb", "appointment")).toThrow(AuthzError);
  });

  it("permits staff to reach another identity's record", () => {
    expect(() => assertOwnership(clinic, "identity-aaa", "appointment")).not.toThrow();
    expect(() => assertOwnership(admin, patientB.identityId, "appointment")).not.toThrow();
  });

  it("fails closed when the owner cannot be determined", () => {
    expect(() => assertOwnership(patientA, null, "appointment")).toThrow(AuthzError);
    expect(() => assertOwnership(patientA, undefined, "appointment")).toThrow(AuthzError);
    expect(() => assertOwnership(patientA, "", "appointment")).toThrow(AuthzError);
  });

  it("reports NOT_OWNER rather than leaking whether the record exists", () => {
    try {
      assertOwnership(patientA, "identity-bbb", "appointment");
    } catch (err) {
      expect((err as AuthzError).code).toBe("NOT_OWNER");
      expect((err as AuthzError).message).not.toContain("identity-bbb");
    }
  });
});

describe("assertParticipant", () => {
  it("permits a sender or a recipient", () => {
    expect(() => assertParticipant(patientA, ["identity-aaa", "identity-clinic"], "thread")).not.toThrow();
    expect(() => assertParticipant(patientA, ["identity-clinic", "identity-aaa"], "thread")).not.toThrow();
  });

  it("denies a non-participant", () => {
    expect(() => assertParticipant(patientB, ["identity-aaa", "identity-clinic"], "thread")).toThrow(AuthzError);
  });

  it("denies an empty thread so ids cannot be probed", () => {
    expect(() => assertParticipant(patientA, [], "thread")).toThrow(AuthzError);
  });

  it("ignores null and undefined participants", () => {
    expect(() => assertParticipant(patientA, [null, undefined], "thread")).toThrow(AuthzError);
  });

  it("permits staff regardless of participation", () => {
    expect(() => assertParticipant(clinic, ["identity-aaa", "identity-bbb"], "thread")).not.toThrow();
    expect(() => assertParticipant(staff, [], "thread")).not.toThrow();
  });
});

describe("resolveScopedIdentityId", () => {
  it("defaults to the caller's own identity when no filter is supplied", () => {
    expect(resolveScopedIdentityId(patientA, null)).toBe("identity-aaa");
    expect(resolveScopedIdentityId(patientA, undefined)).toBe("identity-aaa");
    expect(resolveScopedIdentityId(patientA, "")).toBe("identity-aaa");
  });

  it("permits a patient to name their own identity explicitly", () => {
    expect(resolveScopedIdentityId(patientA, "identity-aaa")).toBe("identity-aaa");
  });

  it("denies a patient naming another identity", () => {
    expect(() => resolveScopedIdentityId(patientA, "identity-bbb")).toThrow(AuthzError);
    try {
      resolveScopedIdentityId(patientA, "identity-bbb");
    } catch (err) {
      expect((err as AuthzError).code).toBe("SCOPE_VIOLATION");
    }
  });

  it("does NOT silently rescope to the caller — it denies", () => {
    // Regression guard. Silently returning the caller's own id would turn an
    // attempted cross-patient read into a plausible 200 and hide the attempt.
    let threw = false;
    try {
      resolveScopedIdentityId(patientA, "identity-bbb");
    } catch {
      threw = true;
    }
    expect(threw).toBe(true);
  });

  it("permits staff to query another identity", () => {
    expect(resolveScopedIdentityId(clinic, "identity-aaa")).toBe("identity-aaa");
    expect(resolveScopedIdentityId(admin, "identity-bbb")).toBe("identity-bbb");
  });
});

describe("authzErrorResponse", () => {
  it("maps AuthzError to a 403 JSON response", async () => {
    const response = authzErrorResponse(new AuthzError("nope", "NOT_OWNER"));
    expect(response).not.toBeNull();
    expect(response!.status).toBe(403);
    const body = (await response!.json()) as Record<string, unknown>;
    expect(body.error).toBe("Forbidden");
    expect(body.code).toBe("NOT_OWNER");
  });

  it("returns null for unrelated errors so they keep propagating", () => {
    expect(authzErrorResponse(new Error("boom"))).toBeNull();
    expect(authzErrorResponse("not an error")).toBeNull();
  });
});
