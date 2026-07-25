import { defineConfig } from "vitest/config";
import { resolve } from "node:path";

// EPIC-005.9 regression suite config (pure unit tests, no Workers runtime).
// Lives beside workers/node_modules so `vitest/config` resolves.
export default defineConfig({
  root: resolve(__dirname, ".."),
  resolve: {
    alias: {
      "@hermes": resolve(__dirname, "../hermes"),
      "@shared": resolve(__dirname, "../shared"),
    },
  },
  test: {
    pool: "threads",
    include: ["hermes/services/providers/**/*.test.ts", "hermes/services/activation/**/*.test.ts", "hermes/services/execution/**/*.test.ts", "hermes/audit/**/*.test.ts"],
    environment: "node",
    includeSource: [],
  },
});
