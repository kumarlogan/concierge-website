// ┌─────────────────────────────────────────────────────────────┐
// │ AI Platform — Safe D1 Binding Wrapper                        │
// │ Wave 8.1 — Production Hardening (P0 defect fix)              │
// └─────────────────────────────────────────────────────────────┘
//
// ROOT CAUSE (live 500 on register/login):
//   Cloudflare D1 rejects `undefined` bind values with
//   `D1_TYPE_ERROR: Type 'undefined' not supported for value 'undefined'`.
//   The local unit-test stub (in-memory D1) does NOT enforce this type
//   restriction, so the defect never surfaced in CI — it only appears
//   against the real production D1 database.
//
// FIX:
//   Wrap env.DB at the request boundary so every `.prepare(...).bind(...)`
//   across the entire worker coerces `undefined` → `null`. A Proxy is used
//   so all other D1 behaviour (run/all/first/batch, native internals) is
//   preserved untouched. This is a single-point fix covering identity,
//   ops, clinic, timeline, appointments, messaging, documents, and audit.
//
// NOTE: This is a fail-safe guard. Call sites should still prefer explicit
// `?? null` for non-nullable columns (defence in depth), but this wrapper
// guarantees no `undefined` ever reaches the real D1 driver.

import type { D1Database, D1PreparedStatement } from "@cloudflare/workers-types";

/** Coerce a single bind value: undefined → null (D1-safe). */
function coerceBindValue(value: unknown): unknown {
  return value === undefined ? null : value;
}

/**
 * Wrap a D1Database so that any `.bind(...)` arguments are coerced:
 *   - `undefined` becomes `null` (D1 rejects `undefined`)
 *   - all other values pass through unchanged
 * Everything else (run/all/first/batch, native internals) is delegated
 * transparently via the Proxy.
 */
export function createSafeD1(database: D1Database): D1Database {
  return new Proxy(database, {
    get(target, prop, receiver) {
      const value = Reflect.get(target, prop, receiver);

      // Intercept `prepare` so we can wrap the returned statement.
      if (prop === "prepare" && typeof value === "function") {
        return (query: string): D1PreparedStatement => {
          const stmt = (target as D1Database).prepare(query);
          return new Proxy(stmt, {
            get(stmtTarget, stmtProp, stmtReceiver) {
              const stmtValue = Reflect.get(stmtTarget, stmtProp, stmtReceiver);

              // Intercept `bind` to coerce args before they reach D1.
              if (stmtProp === "bind" && typeof stmtValue === "function") {
                return (...args: unknown[]): D1PreparedStatement =>
                  (
                    stmtValue as (
                      ...a: unknown[]
                    ) => D1PreparedStatement
                  ).call(stmtTarget, ...args.map(coerceBindValue));
              }

              // Delegate every other method/property, preserving `this`
              // by binding functions to the real statement object. This
              // keeps native D1 methods (run/all/first/batch) and the
              // local test stub working identically.
              if (typeof stmtValue === "function") {
                return (stmtValue as (...a: unknown[]) => unknown).bind(
                  stmtTarget,
                );
              }
              return stmtValue;
            },
          });
        };
      }

      // Delegate all other DB methods, preserving `this`.
      if (typeof value === "function") {
        return (value as (...a: unknown[]) => unknown).bind(target);
      }
      return value;
    },
  }) as D1Database;
}
