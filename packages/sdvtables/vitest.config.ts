import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";
import sdvplotPkg from "../sdvplot/package.json" with { type: "json" };
import sportyPkg from "../sporty/package.json" with { type: "json" };
import pkg from "./package.json" with { type: "json" };

/**
 * Package specifier -> SOURCE file, anchored (as examples/sources.ts ALIASES does): a bare-string alias also matches
 * "<key>/…", so "@sportsdataverse/sdvplot" would rewrite ".../plot" to ".../src/index.ts/plot". No ordering hazard.
 */
const exact = (spec: string, file: string): { find: RegExp; replacement: string } => ({
  find: new RegExp(`^${spec}$`),
  replacement: fileURLToPath(new URL(file, import.meta.url)),
});
export default defineConfig({
  resolve: {
    alias: [
      exact("@sportsdataverse/sdvplot", "../sdvplot/src/index.ts"),
      exact("@sportsdataverse/sdvplot/export", "../sdvplot/src/export/index.ts"),
      // the linked-interactivity tests render sdvplot's Plot marks and link them (Phase 8)
      exact("@sportsdataverse/sdvplot/plot", "../sdvplot/src/plot/index.ts"),
      exact("@sportsdataverse/sdvplot/interact", "../sdvplot/src/interact/index.ts"),
      exact("@sportsdataverse/sporty", "../sporty/src/index.ts"),
      exact("@sportsdataverse/sporty/plot", "../sporty/src/plot.ts"),
      // the export guide's snippet (examples/snippets/export) imports this package by name; the render test runs it
      exact("@sportsdataverse/sdvtables", "src/index.ts"),
      exact("@sportsdataverse/sdvtables/export", "src/export/index.ts"),
    ],
  },
  define: {
    __SDVTABLES_VERSION__: JSON.stringify(pkg.version),
    __SDVPLOT_VERSION__: JSON.stringify(sdvplotPkg.version),
    __SPORTY_VERSION__: JSON.stringify(sportyPkg.version), // sporty source is aliased in (via sdvplot/plot)
  },
  test: {
    testTimeout: 60_000,
    hookTimeout: 60_000,
    include: ["test/**/*.test.ts", "test/**/*.test.tsx"],
    typecheck: { enabled: true, include: ["test/**/*.test-d.ts"] },
  },
});
