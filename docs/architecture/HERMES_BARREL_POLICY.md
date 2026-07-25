# Hermes Barrel Policy (PHASE 2)

**Status:** Enforced
**Applies to:** `hermes/services/**/index.ts`, `workers/src/**/index.ts`

---

## 1. Principle

> Every feature module **owns its exports**. A barrel exists to *re-advertise* a
> module's public surface — never to wire cross-module dependencies, never to
> execute side effects.

A platform that controls execution must have a **provable and reproducible
build**. Ambiguous or circular barrel exports make the build non-deterministic
and hide import-side-effect bugs. This policy removes that class of risk.

---

## 2. Rules

1. **Namespace re-exports preferred.**
   `export * as Execution from "./execution/index.js";`
   Namespaced barrels prevent name collisions between sibling modules and make
   the import boundary explicit at call sites (`services.Execution.Coordinator`).

2. **No side effects in barrels.**
   A barrel file must contain **only** `export` statements (and an optional
   header comment). No top-level `new`, no `setActiveProvider()`, no I/O.

3. **No circular imports.**
   `A` may not import from `B` while `B` imports from `A` (directly or through a
   barrel). If a cycle is needed, extract the shared type/contract into
   `hermes/contracts/**` and have both depend on the contract, not each other.

4. **Lazy exports where required.**
   Heavy or side-effectful singletons (e.g. the active provider bundle) are
   exported as **functions** (`getActiveProvider()`), not eagerly constructed
   values. This keeps barrel load cheap and deterministic.

5. **Feature modules own their exports.**
   `execution/index.ts` re-exports exactly the execution public surface
   (queue, planner, dispatcher, coordinator, policy-evaluator, idempotency,
   lease, metrics). It does NOT re-export security or provider internals.

6. **EPIC-004.6 additions are explicit.**
   Trust-hardening modules (`policy-evaluator`, `idempotency`, `lease`,
   `metrics`) are listed individually in `execution/index.ts` with a comment
   marking their epic, so their presence in the boundary is auditable.

---

## 3. Current Conformance

| Barrel | Style | Side effects? | Conforms? |
|---|---|---|---|
| `hermes/services/index.ts` | namespace (`export * as`) | none | ✅ |
| `hermes/services/execution/index.ts` | named (`export *`) | none | ✅ |
| `hermes/services/security/index.ts` | named (`export *`) | none | ✅ |
| `hermes/services/providers/index.ts` | mixed (types + `export *`) | none (lazy `getActiveProvider`) | ✅ |

**No circular imports detected.** `providers/index.ts` correctly isolates the
vendor SDK seam: business logic imports `shared/interfaces`, never provider SDKs
directly. The capability seam (`capability.js`) is appended last, cleanly.

---

## 4. Audit Checklist (run before each release)

- [ ] Each barrel file contains only `export` statements + header comment.
- [ ] No `import` in a barrel resolves back to a sibling barrel (cycle check).
- [ ] No `new X()` / I/O at barrel top level.
- [ ] EPIC-004.6 trust modules present and individually listed in `execution/index.ts`.
- [ ] `tsc --noEmit` on `workers/` reports 0 errors referencing barrels.
