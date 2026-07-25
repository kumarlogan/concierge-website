// EPIC-008 PHASE4 — Approval regression suite.
// Asserts the SINGLE durable approval model (EPIC-005.6 / 005.9) behaves
// fail-closed: a structured ApprovalRef is verified against durable state and
// any mismatch/expiry/unknown/tenant-cross is DENIED. No core changes.
import { createApprovalService, type ApprovalRef } from "../approval.js";

let passed = 0;
let failed = 0;
function check(name: string, cond: boolean, detail = ""): void {
  if (cond) {
    passed++;
    console.log(`  ✓ ${name}`);
  } else {
    failed++;
    console.log(`  ✗ ${name} ${detail}`);
  }
}
function expectThrow(name: string, fn: () => void, codeSub: string): void {
  try {
    fn();
    check(name, false, `(expected throw ${codeSub})`);
  } catch (e) {
    const msg = (e as Error).message ?? "";
    const code = (e as { code?: string }).code ?? "";
    check(name, msg.includes(codeSub) || code.includes(codeSub), `(got msg="${msg}" code="${code}")`);
  }
}

const principal = { id: "u1", organizationId: "t1", tenantId: "t1", permissions: [] };
function makeStore(records: Record<string, unknown>): { get: (id: string) => { approval?: unknown } | undefined } {
  return { get: (id: string) => (id in records ? { approval: records[id] } : undefined) };
}
function ref(over: Partial<ApprovalRef> = {}): ApprovalRef {
  return {
    id: "apr_1",
    approver: "admin",
    capability: "deploy.pages",
    tenant: "t1",
    scope: "agsynergy.ca:deploy.pages",
    at: new Date().toISOString(),
    ...over,
  };
}
const approval = { approver: "admin", at: new Date().toISOString(), capability: "deploy.pages", scope: "agsynergy.ca:deploy.pages" };

console.log("APPROVAL REGRESSION SUITE");
const svc = createApprovalService(makeStore({ apr_1: approval }));

// 1. Missing id → fail-closed.
expectThrow("missing id denied", () => svc.verify(ref({ id: "" }), { capability: "deploy.pages", tenant: "t1", principal }), "APPROVAL_MISSING_ID");
// 2. Unknown approval id → denied.
expectThrow("unknown approval denied", () => svc.verify(ref({ id: "nope" }), { capability: "deploy.pages", tenant: "t1", principal }), "APPROVAL_UNKNOWN");
// 3. Capability mismatch → denied.
expectThrow("capability mismatch denied", () => svc.verify(ref({ capability: "deploy.worker" }), { capability: "deploy.worker", tenant: "t1", principal }), "APPROVAL_CAPABILITY_MISMATCH");
// 4. Tenant mismatch (cross-tenant replay) → denied.
expectThrow("tenant mismatch denied", () => svc.verify(ref({ tenant: "t2" }), { capability: "deploy.pages", tenant: "t1", principal }), "APPROVAL_TENANT_MISMATCH");
// 5. Approver mismatch → denied.
expectThrow("approver mismatch denied", () => svc.verify(ref({ approver: "other" }), { capability: "deploy.pages", tenant: "t1", principal }), "APPROVAL_APPROVER_MISMATCH");
// 6. Expired approval → denied.
expectThrow("expired approval denied", () => svc.verify(ref({ expiresAt: new Date(Date.now() - 1000).toISOString() }), { capability: "deploy.pages", tenant: "t1", principal }), "APPROVAL_EXPIRED");
// 7. Valid ref → allowed (no throw).
try {
  svc.verify(ref(), { capability: "deploy.pages", tenant: "t1", principal });
  check("valid approval allowed", true);
} catch (e) {
  check("valid approval allowed", false, (e as Error).message);
}

console.log(`\nAPPROVAL: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
