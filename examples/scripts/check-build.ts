import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parseHTML } from "linkedom";
import { abs } from "../sources.js";
import { pagePath, readRows } from "./pages.js";
import { overLimit } from "./remark-live.js";

// Review Focus 2 end to end: on each gallery page the static copy of an inline output is the prerendered markup.
// Compared as parsed DOM. The build does not minify HTML (docs/build.env): swc's minifier rewrites these outputs.
const build = process.argv[2] ?? abs("docs/build");
const dom = (html: string): string =>
  parseHTML(`<!doctype html><html><body><div id="x">${html}</div></body></html>`).document.getElementById("x")
    ?.innerHTML ?? "";
let checked = 0;
const differ: string[] = [];
for (const r of readRows(abs("examples/out"))) {
  if (overLimit(r.markup)) continue;
  const { document } = parseHTML(readFileSync(join(build, "gallery", pagePath(r), "index.html"), "utf8"));
  const shown = document.querySelector(`figure[data-example="${r.id}"] .sdv-live-static`)?.innerHTML;
  checked++;
  if (shown !== dom(r.markup)) differ.push(r.id);
}
console.log(`check-build: ${checked} inline outputs compared with their pages; ${differ.length} differ`);
if (differ.length > 0) {
  console.error(differ.join("\n"));
  process.exit(1);
}
