import { defineConfig } from "vitest/config";
import { resolve } from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@hermes": resolve(__dirname, "hermes"),
      "@shared": resolve(__dirname, "shared"),
    },
  },
  test: {
    include: ["**/*.test.ts"],
    exclude: [
      "**/node_modules/**",
      // Custom-runner test files (use ad-hoc check() instead of vitest describe/it)
      "hermes/services/workforce/d1-backend.test.ts",
      "hermes/services/execution/gateway/__tests__/approval.regression.test.ts*",
      "hermes/services/providers/trust/__tests__/trust.regression.test.ts*",
      "hermes/services/activation/providers/deployment/__tests__/epic007.launch.test.ts*",
      // Cloudflare-vitest-pool only — require @cloudflare/vitest-pool-workers
      "workers/tests/auth/engine.integration.test.ts*",
      "workers/tests/integration/api.test.ts*",
      "workers/tests/ops/ops.integration.test.ts*",
      "workers/tests/telegram/bot.integration.test.ts*",
    ],
    environment: "node",
    globals: true,
  },
});