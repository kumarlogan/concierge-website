// ┌─────────────────────────────────────────────────────────────┐
// │ AG Synergy Platform — Global Test Setup (Node.js)           │
// │ EPIC-001-008: Testing Foundation                            │
// └─────────────────────────────────────────────────────────────┘
//
// Runs in Node before the Workers vitest pool starts.
// Seeds the local Miniflare D1 with the migration schema by
// executing the SQL migration file via wrangler's local D1.

import { execSync } from "node:child_process";
import { join } from "node:path";

export function setup(): void {
  const workersDir = join(import.meta.dirname, "..");

  // Apply migrations to the local D1 database
  // This creates/updates the .wrangler/state/v3/d1 SQLite file
  // that Miniflare uses for integration tests.
  try {
    execSync("npx wrangler@4 d1 migrations apply agsynergy-db --local", {
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