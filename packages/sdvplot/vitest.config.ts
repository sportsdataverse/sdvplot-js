import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";
import sportyPkg from "../sporty/package.json" with { type: "json" };
import pkg from "./package.json" with { type: "json" };
export default defineConfig({
  resolve: {
    alias: {
      "@sportsdataverse/sporty/plot": fileURLToPath(new URL("../sporty/src/plot.ts", import.meta.url)),
      "@sportsdataverse/sporty/d3": fileURLToPath(new URL("../sporty/src/d3.ts", import.meta.url)),
      "@sportsdataverse/sporty": fileURLToPath(new URL("../sporty/src/index.ts", import.meta.url)),
    },
  },
  define: {
    __SDVPLOT_VERSION__: JSON.stringify(pkg.version),
    __SPORTY_VERSION__: JSON.stringify(sportyPkg.version), // sporty source is aliased in, so its build-time constant is needed here too
  },
  test: {
    testTimeout: 60_000,
    include: ["test/**/*.test.ts", "test/**/*.test.tsx"],
    typecheck: { enabled: true, include: ["test/**/*.test-d.ts"] },
  },
});
