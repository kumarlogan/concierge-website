// ┌─────────────────────────────────────────────────────────────┐
// │ AG Synergy Platform — Vitest Configuration (v4)             │
// │ EPIC-001-008: Testing Foundation                            │
// └─────────────────────────────────────────────────────────────┘

import { cloudflareTest } from "@cloudflare/vitest-pool-workers";
import { defineConfig } from "vitest/config";
import { resolve } from "node:path";

export default defineConfig({
  plugins: [
    cloudflareTest({
      wrangler: { configPath: "./wrangler.jsonc" },
      miniflare: {
        // Use the same D1 persistence directory as wrangler dev
        // so tests see the schema from applied migrations.
        d1Persist: "./.wrangler/state/v3/d1",
      },
    }),
  ],
  resolve: {
    alias: {
      "@hermes": resolve(__dirname, "../hermes"),
      "@shared": resolve(__dirname, "../shared"),
    },
  },
  test: {
    include: ["tests/**/*.test.ts"],
    // Apply D1 migrations before any tests run (runs in Node.js)
    globalSetup: ["./tests/globalSetup.ts"],
    exclude: [
      // Workforce persistence tests use FileWorkflowBackend with
      // renameSync, which fails under the Cloudflare vitest pool.
      // Run these with the Node-native hermes vitest config instead.
      "tests/workforce-persistence.test.ts",
      "tests/workforce-activation.test.ts",
      // Custom-runner (non-vitest) files
      "tests-epic0059/p1-smoke.test.ts",
      // Launch smoke tests require a live deployment — run with
      // SMOKE_TEST_URL against a deployed or local dev server.
      "tests/launch/smoke-tests.test.ts",
    ],
  },
});