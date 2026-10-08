import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";
import sdvplotPkg from "../sdvplot/package.json" with { type: "json" };
import pkg from "./package.json" with { type: "json" };
export default defineConfig({
  resolve: {
    alias: {
      // the subpath BEFORE the bare key: a string alias also matches "<key>/…" and would rewrite to …/src/index.ts/export
      "@sportsdataverse/sdvplot/export": fileURLToPath(
        new URL("../sdvplot/src/export/index.ts", import.meta.url),
      ),
      "@sportsdataverse/sdvplot": fileURLToPath(new URL("../sdvplot/src/index.ts", import.meta.url)),
      // the export guide's snippet (examples/snippets/export) imports this package by name; the render test runs it
      "@sportsdataverse/sdvtables/export": fileURLToPath(new URL("src/export/index.ts", import.meta.url)),
      "@sportsdataverse/sdvtables": fileURLToPath(new URL("src/index.ts", import.meta.url)),
    },
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
