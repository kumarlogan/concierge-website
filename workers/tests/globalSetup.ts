// ┌─────────────────────────────────────────────────────────────┐
// │ AG Synergy Platform — Global Test Setup (Node.js)           │
// │ EPIC-001-008: Testing Foundation                            │
// │ EPIC-003-004 / M1: idempotent D1 seeding                  │
// └─────────────────────────────────────────────────────────────┘
//
// Runs in Node before the Workers vitest pool starts.
// Seeds the local Miniflare D1 with the migration schema by
// executing the SQL migration file via wrangler's local D1.
//
// Hygiene fix (M1): `wrangler d1 migrations apply` is NOT idempotent
// across repeated runs in the same .wrangler/state dir — migration 0004
// INSERTs fixed-UUID role_permissions rows with no ON CONFLICT guard,
// so the 2nd+ run throws `UNIQUE constraint failed`, which corrupts the
// shared Miniflare D1 state during a parallel full-suite run and
// intermittently breaks `@hermes/*` module resolution in dependents
// (e.g. identity/principal.ts). We guard by probing whether the seed
// table already has rows and skipping the apply when it does. No
// migration files are modified (constitution: no migrations).

import { execSync } from "node:child_process";
import { join } from "node:path";

/** Run a wrangler d1 command against the local (--local) D1, return stdout. */
function wranglerD1(args: string): { ok: boolean; stdout: string; stderr: string } {
  try {
    const stdout = execSync(`npx wrangler@4 d1 ${args}`, {
      cwd: join(import.meta.dirname, ".."),
      stdio: "pipe",
      timeout: 30_000,
      encoding: "utf8",
    }) as string;
    return { ok: true, stdout, stderr: "" };
  } catch (err) {
    const e = err as { stdout?: string; stderr?: string; message?: string };
    return {
      ok: false,
      stdout: e.stdout ?? "",
      stderr: e.stderr ?? e.message ?? String(err),
    };
  }
}

/** True when the seed table already has rows (migrations already applied). */
function seedAlreadyApplied(): boolean {
  const res = wranglerD1(
    `execute agsynergy-db --local --command "SELECT COUNT(*) AS c FROM role_permissions;"`,
  );
  if (!res.ok) return false;
  // When piped, wrangler emits JSON: {"results":[{"c":12}],"success":true,...}
  try {
    const json = JSON.parse(res.stdout.trim());
    const rows = json?.results?.[0];
    const count = Number(rows?.c ?? rows?.[0]?.c);
    return Number.isFinite(count) && count > 0;
  } catch {
    // Fallback: scan for a non-zero integer anywhere in the output.
    const m = res.stdout.match(/(\d+)/);
    const count = m ? Number(m[1]) : NaN;
    return Number.isFinite(count) && count > 0;
  }
}

export function setup(): void {
  const workersDir = join(import.meta.dirname, "..");

  // Idempotency guard: skip the (non-reentrant) migration apply when the
  // seed table already has rows. This prevents the UNIQUE-constraint
  // collision that corrupts shared D1 state on repeated full-suite runs.
  if (seedAlreadyApplied()) {
    console.log("[globalSetup] D1 seed already present — skipping migrations");
    return;
  }

  try {
    execSync(`npx wrangler@4 d1 migrations apply agsynergy-db --local`, {
      cwd: workersDir,
      stdio: "pipe",
      timeout: 30_000,
    });
    console.log("[globalSetup] D1 migrations applied for test environment");
  } catch (err) {
    // Containerized CI or cold environments may need this
    console.warn(
      `[globalSetup] D1 migration warning: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}
