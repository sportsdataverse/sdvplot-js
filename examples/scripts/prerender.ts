import { abs } from "../sources.js";
import { prerender } from "./gate.js";
import { writePages } from "./pages.js";

const out = abs("examples/out");
try {
  await prerender({
    root: abs("examples"),
    files: ["test/examples.test.ts"],
    out,
    static: abs("docs/static"),
  });
} catch (e) {
  console.error(e instanceof Error ? e.message : String(e));
  process.exit(1);
}
writePages(out, abs("docs"));
console.log("prerender: examples/out, docs/docs/gallery and docs/static/examples written");
