// ┌─────────────────────────────────────────────────────────────┐
// │ AG Synergy Platform — Vitest Configuration (v4)             │
// │ EPIC-001-008: Testing Foundation                            │
// └─────────────────────────────────────────────────────────────┘

import { cloudflareTest } from "@cloudflare/vitest-pool-workers";
import { defineConfig } from "vitest/config";

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
  test: {
    include: ["tests/**/*.test.ts"],
    // Apply D1 migrations before any tests run (runs in Node.js)
    globalSetup: ["./tests/globalSetup.ts"],
  },
});