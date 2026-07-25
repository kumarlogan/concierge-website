export default {
  test: {
    include: ["**/*.test.ts"],
    exclude: [
      // Custom-runner files (use ad-hoc check() — not vitest suites)
      "services/workforce/d1-backend.test.ts",
      "services/execution/gateway/__tests__/approval.regression.test.ts",
      "services/providers/trust/__tests__/trust.regression.test.ts",
      "services/activation/providers/deployment/__tests__/epic007.launch.test.ts",
      // Requires @hermes/services/activation package resolution (experimental)
      "services/providers/__tests__/epic-005.9.test.ts",
    ],
    environment: "node",
    globals: true,
  },
  resolve: {
    tsconfig: "./tsconfig.json",
  },
};