import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";
import sdvplotPkg from "../sdvplot/package.json" with { type: "json" };
import pkg from "./package.json" with { type: "json" };
export default defineConfig({
  resolve: {
    alias: { "@sportsdataverse/sdvplot": fileURLToPath(new URL("../sdvplot/src/index.ts", import.meta.url)) },
  },
  define: {
    __SDVTABLES_VERSION__: JSON.stringify(pkg.version),
    __SDVPLOT_VERSION__: JSON.stringify(sdvplotPkg.version),
  },
  test: {
    testTimeout: 60_000,
    hookTimeout: 60_000,
    include: ["test/**/*.test.ts", "test/**/*.test.tsx"],
    typecheck: { enabled: true, include: ["test/**/*.test-d.ts"] },
  },
});
