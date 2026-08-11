// Separate vitest config for the Phase L PRODUCTION REPLAY harness.
//
// The default workers vitest config uses the cloudflareTest (workerd/Miniflare)
// pool, whose test environment does NOT inherit the CI shell process.env
// (it uses the worker's .dev.vars instead). The production replay needs the
// CI-injected PROD_JWT_PRIVATE_KEY / PROD_JWT_KID secrets from the shell, so
// it must run in the plain Node pool where process.env is inherited.
//
// Run with:  npx vitest run --config vitest.replay.config.ts

import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/prod-replay/**/*.test.ts"],
    environment: "node",
    // These tests hit the live production API; never run them in the
    // Miniflare pool.
    pool: "threads",
  },
});
