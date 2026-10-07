import { rmSync } from "node:fs";
import { startVitest } from "vitest/node";
import { abs } from "../sources.js";

// The gate IS the prerenderer: the same run that proves every example works writes what the docs serve.
const out = abs("examples/out");
rmSync(out, { recursive: true, force: true });
process.env.SDV_EXAMPLES_OUT = out;
const vitest = await startVitest("test", ["test/examples.test.ts"], {
  root: abs("examples"),
  run: true,
  watch: false,
});
const failed = vitest === undefined ? 1 : vitest.state.getCountOfFailedTests();
await vitest?.close();
if (failed > 0 || process.exitCode) {
  console.error(`prerender: ${failed} example(s) failed; the docs are never built from a failing gate`);
  process.exit(1);
}
console.log("prerender: examples/out written");
