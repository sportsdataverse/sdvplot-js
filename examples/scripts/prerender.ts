import { abs } from "../sources.js";
import { prerender } from "./gate.js";

try {
  await prerender({
    root: abs("examples"),
    files: ["test/examples.test.ts"],
    out: abs("examples/out"),
    static: abs("docs/static"),
  });
} catch (e) {
  console.error(e instanceof Error ? e.message : String(e));
  process.exit(1);
}
console.log("prerender: examples/out and docs/static/examples written");
