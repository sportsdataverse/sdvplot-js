import { defineConfig } from "vitest/config";

// Root options for the vitest.workspace.ts projects. Coverage is global in a workspace, so it lives here; CI runs
// `pnpm test:coverage` and uploads coverage/lcov.info to Codecov.
export default defineConfig({
  test: {
    coverage: {
      provider: "v8",
      reporter: ["text-summary", "lcov"],
      include: ["packages/*/src/**"],
      // the generated index shards (build:index) are data: loading them all would count as covered code
      exclude: ["packages/sdvplot/src/data/**"],
    },
  },
});
