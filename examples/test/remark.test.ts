import { mkdirSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { hockeyRink } from "@sportsdataverse/sporty";
import { toSVG } from "@sportsdataverse/sporty/svg";
import { beforeAll, expect, test } from "vitest";
import remarkLive, { INLINE_LIMIT } from "../scripts/remark-live.js";
import { abs } from "../sources.js";
import type { Prerendered } from "../src/contract.js";

const out = mkdtempSync(join(tmpdir(), "sdv-out-"));
const row = (id: string, pkg: Prerendered["package"], markup: string): Prerendered => ({
  id,
  package: pkg,
  title: `<${id}>`,
  tags: ["t"],
  code: "x;\n",
  lang: "ts",
  file: `src/${id}.ts`,
  kind: "markup",
  markup,
});
// Phase 4 (sdvtables/html) is not on this branch: Task 8 swaps this literal for
// renderHTML(spec, STANDINGS). The quotes, braces and entities are what MDX would mangle if the plugin did.
const table =
  '<table class="sdv-table"><thead><tr><th>Team</th><th>W</th></tr></thead><tbody>' +
  '<tr><td><img src="data:image/png;base64,AAAA" alt="KC"> {KC}</td><td>14</td></tr>' +
  "<tr><td>A&amp;M &lt;&gt; `x`</td><td>7</td></tr></tbody></table>";
beforeAll(() => {
  for (const r of [
    row("sdvtables/html/t", "sdvtables", table),
    row("sporty/svg/rink", "sporty", toSVG(hockeyRink("nhl"))),
  ]) {
    mkdirSync(dirname(join(out, `${r.id}.json`)), { recursive: true });
    writeFileSync(join(out, `${r.id}.json`), JSON.stringify(r));
  }
});

const live = (id: string) => ({
  type: "root",
  children: [
    {
      type: "mdxJsxFlowElement",
      name: "Live",
      attributes: [{ type: "mdxJsxAttribute", name: "id", value: id }],
    },
  ],
});
const props = (tree: ReturnType<typeof live>): Record<string, unknown> =>
  Object.fromEntries(
    (tree.children[0]?.attributes ?? []).map((a: { name: string; value?: unknown }) => [a.name, a.value]),
  );

test("Review Focus 2: <Live> receives the table markup byte for byte; a 450 KB rink becomes a file URL", () => {
  const t = live("sdvtables/html/t");
  remarkLive({ outDir: out })(t, { path: "a.mdx" });
  expect(props(t).markup).toBe(table);
  const r = live("sporty/svg/rink");
  remarkLive({ outDir: out })(r, { path: "a.mdx" });
  expect(props(r)).toMatchObject({ src: "/examples/sporty/svg/rink.svg", kind: "markup", lang: "ts" });
  expect(props(r).markup).toBeUndefined();
  expect(table.length).toBeLessThan(INLINE_LIMIT);
});

test("an unknown or repeated <Live id> fails the docs build", () => {
  expect(() => remarkLive({ outDir: out })(live("nope/missing"), { path: "a.mdx" })).toThrow(
    'a.mdx: no prerendered example "nope/missing"',
  );
  const twice = live("sdvtables/html/t");
  twice.children.push(...live("sdvtables/html/t").children);
  expect(() => remarkLive({ outDir: out })(twice, { path: "b.mdx" })).toThrow("appears twice");
});

interface LoaderContext {
  getOptions(): { outDir: string };
  addDependency(file: string): void;
}
const liveDeps: ((this: LoaderContext, source: string) => string) & { liveIds(source: string): string[] } =
  createRequire(import.meta.url)("../scripts/live-deps.cjs");

test("a page depends on the outputs its <Live> tags inline, so a warm build cache recompiles it when one changes", () => {
  const deps: string[] = [];
  const page = `# A\n\n<Live id="sdvplot/core/a" />\n\n<Live\n  id='sdvplot/plot/b'\n  thumb href="/gallery/b" />\n`;
  const ctx: LoaderContext = {
    getOptions: () => ({ outDir: "out" }),
    addDependency: (f) => void deps.push(f),
  };
  expect(liveDeps.call(ctx, page)).toBe(page);
  expect(deps).toEqual([join("out", "sdvplot/core/a.json"), join("out", "sdvplot/plot/b.json")]);
  // Every <Live> on a hand-written or generated docs page names its id where the loader finds it.
  const docs = abs("docs/docs");
  for (const p of readdirSync(docs, { recursive: true, encoding: "utf8" }).filter((f) => /\.mdx?$/.test(f))) {
    const text = readFileSync(join(docs, p), "utf8");
    expect(liveDeps.liveIds(text).length, p).toBe(text.match(/<Live\b/g)?.length ?? 0);
  }
});
