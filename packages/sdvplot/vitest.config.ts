import { defineConfig } from "vitest/config";
import pkg from "./package.json" with { type: "json" };
export default defineConfig({
  define: { __SDVPLOT_VERSION__: JSON.stringify(pkg.version) },
  test: {
    testTimeout: 60_000,
    include: ["test/**/*.test.ts", "test/**/*.test.tsx"],
    typecheck: { enabled: true, include: ["test/**/*.test-d.ts"] },
  },
});
