// ┌─────────────────────────────────────────────────────────────┐
// │ AG Synergy Platform — Vitest Configuration (v4)             │
// │ EPIC-001-008: Testing Foundation                            │
// └─────────────────────────────────────────────────────────────┘

import { cloudflareTest } from "@cloudflare/vitest-pool-workers";
import { defineConfig } from "vitest/config";
import { resolve } from "node:path";
import { generateKeyPairSync } from "node:crypto";

// ───────────────────────────────────────────────────────────────
// Deterministic synthetic JWT keypair for the test pool.
//
// The Phase L/M security-attack harnesses sign real RS256 JWTs and
// assert on the worker's real JWT verification path. They read the
// key from env (JWT_PRIVATE_KEY / JWT_KID) and the worker verifies
// with PLATFORM_JWT_PUBLIC_KEY. Locally these came from an untracked
// workers/.dev.vars. In CI no .dev.vars exists, so the harnesses
// crashed on `undefined`. Instead of relying on a hand-maintained
// secret file, generate a fresh synthetic keypair here at pool load —
// deterministic, self-contained, and present in BOTH the test env
// and the worker env, so CI behaves identically to local.
// ───────────────────────────────────────────────────────────────
const KID = "test-pool-jwt-kid";
const { privateKey, publicKey } = generateKeyPairSync("rsa", {
  modulusLength: 2048,
  publicExponent: 0x10001,
  privateKeyEncoding: { type: "pkcs8", format: "pem" },
  publicKeyEncoding: { type: "spki", format: "pem" },
});
// The worker verifies with PLATFORM_JWT_PUBLIC_KEY but issues with
// JWT_PRIVATE_KEY (index.ts / jwt-auth.ts). Both must carry the keypair.
const jwtBindings = {
  JWT_PRIVATE_KEY: privateKey,
  JWT_PUBLIC_KEY: publicKey,
  JWT_KID: KID,
  PLATFORM_JWT_PUBLIC_KEY: publicKey,
  PLATFORM_JWT_KID: KID,
};

export default defineConfig({
  plugins: [
    cloudflareTest({
      wrangler: { configPath: "./wrangler.jsonc" },
      miniflare: {
        // Use the same D1 persistence directory as wrangler dev
        // so tests see the schema from applied migrations.
        d1Persist: "./.wrangler/state/v3/d1",
        // Inject the synthetic JWT keypair so the security-attack
        // harnesses can sign and the worker can verify — in CI and local.
        bindings: jwtBindings,
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