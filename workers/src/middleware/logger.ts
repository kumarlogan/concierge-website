// ┌─────────────────────────────────────────────────────────────┐
// │ AG Synergy Platform — Structured Logging                    │
// │ EPIC-002-003.5: Production Readiness                        │
// └─────────────────────────────────────────────────────────────┘
//
// Structured (JSON-line) logging for Workers observability.
// All log records are JSON; Cloudflare Workers logs / Tail / Logpush ingest
// them as structured events. No secrets or PII are ever logged by this helper.
//
// SENSITIVE-DATA POLICY (enforced by callers, not bypassable here):
//   - Never pass tokens, API keys, chat ids mapped to individuals, or PHI.
//   - `actor` may be a system role or opaque user id, not a real identity.
//   - Request bodies are NOT logged. At most: method, path, status, latency.

export type LogLevel = "debug" | "info" | "warn" | "error";

export interface LogRecord {
  ts: string; // ISO-8601 UTC
  level: LogLevel;
  svc: "agsynergy-api";
  env?: string;
  msg: string;
  [k: string]: unknown;
}

function emit(rec: LogRecord): void {
  // console.info maps to the Workers "info" log level in tail/dashboards.
  // Use the matching console method so the level is preserved where possible.
  const line = JSON.stringify(rec);
  switch (rec.level) {
    case "error":
      console.error(line);
      break;
    case "warn":
      console.warn(line);
      break;
    case "debug":
      console.debug(line);
      break;
    default:
      console.info(line);
  }
}

export function log(
  level: LogLevel,
  msg: string,
  fields: Record<string, unknown> = {},
  env?: string,
): void {
  emit({
    ts: new Date().toISOString(),
    level,
    svc: "agsynergy-api",
    env,
    msg,
    ...fields,
  });
}

/** Convenience wrappers. */
export const info = (msg: string, f?: Record<string, unknown>, env?: string) =>
  log("info", msg, f, env);
export const warn = (msg: string, f?: Record<string, unknown>, env?: string) =>
  log("warn", msg, f, env);
export const error = (msg: string, f?: Record<string, unknown>, env?: string) =>
  log("error", msg, f, env);
export const debug = (msg: string, f?: Record<string, unknown>, env?: string) =>
  log("debug", msg, f, env);
