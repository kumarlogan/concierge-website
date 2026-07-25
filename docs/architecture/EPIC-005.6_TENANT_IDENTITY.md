# EPIC-005.6 — Tenant & Identity Unification (PHASE 4)

**Requirement:** Every execution path uses `Principal` + `tenantId` + `scopes` + `enforceTenant()`.
No capability execution may occur without tenant context.

---

## 1. Current State (from baseline)

| Path | Has `Principal`? | Has `tenantId`? | Calls `enforceTenant`? |
|------|------------------|-----------------|------------------------|
| A (`UCP.execute`) | via `req.principal` (optional) | via `req.targetTenantId` (optional) | ✅ only if `targetTenantId` asserted |
| B (`executeCapability`) | `ctx.actor` (free string) | ❌ none | ❌ |
| C (`coordinator.run`) | `principal: Principal` ✅ | `ex.tenant` ✅ | ✅ in `policyRequestFromStore` |
| D (`git-provider`) | none | none | ❌ |
| E (`ToolProvider.run`) | none | none | ❌ |
| F (`task.ts`) | `approver` (string) | via task `applicationId` | partial |

Only Path C consistently carries a `Principal` + tenant. Path A handles it *if asserted* but
never *requires* it. Paths B/D/E have **no** tenant concept at all (Bypass #2, #5).

---

## 2. Unification Rule

`HermesExecutionGateway.execute(req)` makes tenant context **mandatory**:

```
ExecutionRequest {
  principal: Principal;        // REQUIRED, validated non-empty id + tenantId + scopes
  tenantId: string;            // REQUIRED, MUST === principal.tenantId
  ...
}
```

The gateway rejects (`DENY`, audit) any request where:
- `principal` is missing / not a `Principal`,
- `principal.tenantId` is missing/empty,
- `req.tenantId` is missing/empty,
- `req.tenantId !== principal.tenantId`.

This single check eliminates Bypass #2 (Stack B tenant-less exec) and Bypass #5 (tool primitive
tenant-less exec) at the boundary, before any capability lookup.

---

## 3. `Principal` Contract (locked)

From `contracts/platform-api.ts` (already defined):

```ts
interface Principal {
  id: string;
  organizationId: string;   // = tenantId for tenant-scoped principals
  tenantId: string;         // REQUIRED on every execution
  scopes: string[];         // capability/permission scopes
  // ...
}
```

Every execution path funnels through `Principal`. The legacy `ctx.actor: string` (Stack B) and
`approver: string` (task substrate) are replaced by `Principal` throughout.

---

## 4. `enforceTenant` (reused, not reimplemented)

`admin/access.ts` already provides `withinTenantScope(principal, target, { requireScope: true })`
which hard-fails when `principal.tenantId` is absent (`requireScope: true` → throw on missing).
The gateway calls it as step 2 with `requireScope: true`, guaranteeing a hard wall:

- Unknown tenant → `enforceTenant` throws → gateway DENY (validation #3).
- Missing tenant → `requireScope: true` throws → gateway DENY (validation #2).
- Cross-tenant request → scope check fails → gateway DENY.

No path may skip this. The gateway is the only caller that proceeds to capability resolution,
so tenant enforcement is uniformly applied to A/B/C/D/E.

---

## 5. Migration

1. **Stack B** (`executeCapability`): add `principal: Principal` + `tenantId` to `ctx`; call
   `enforceTenant` first; then route through gateway (Stack B becomes a private adapter).
2. **Git provider** (`git-provider.ts`): callers must supply a `Principal` + `tenantId`;
   `pushBranch`/`commitChanges` gate on a verifiable `ApprovalRef`, not a string token.
3. **ToolProvider** (`tools/*`): each tool becomes a registered capability with a `Principal` +
   `tenantId`; `ToolProvider.run` is invoked only via the gateway.
4. **Task substrate** (`agents/task.ts`): `approveTask(id, approver: Principal)` — approver must
   be a `Principal`; the secondary task's approver equals the human approver's principal, not the
   executing agent.

*End of PHASE 4. Design only.*
