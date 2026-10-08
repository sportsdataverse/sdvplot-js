import { mkdirSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { STANDINGS } from "@sportsdataverse/examples/data";
import { defineTable } from "@sportsdataverse/sdvtables";
import { prepare, renderHTML } from "@sportsdataverse/sdvtables/html";
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
// A real rendered table: an inline <style> full of braces, quoted attributes and <img> URLs, all of which MDX
// would mangle if the plugin handed it markup instead of a string prop.
let table = "";
beforeAll(async () => {
  const spec = defineTable<(typeof STANDINGS)[number]>()
    .columns((c) => [c.logo("team", { league: "nfl" }), c.int("wins")])
    .build();
  await prepare(spec);
  table = renderHTML(spec, STANDINGS);
  for (const r of [
    row("sdvtables/html/t", "sdvtables", table),
    row("sporty/svg/rink", "sporty", toSVG(hockeyRink("nhl"))),
    {
      ...row("sdvplot/plotly/f", "sdvplot", '<pre class="sdv-value">{}</pre>'),
      kind: "value",
      browser: true,
    },
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
  // the tags, space-separated: Live credits a data source by its tag (StatsBomb's logo for "statsbomb")
  expect(props(t).tags).toBe("t");
  const r = live("sporty/svg/rink");
  remarkLive({ outDir: out })(r, { path: "a.mdx" });
  expect(props(r)).toMatchObject({ src: "/examples/sporty/svg/rink.svg", kind: "markup", lang: "ts" });
  expect(props(r).markup).toBeUndefined();
  expect(table.length).toBeLessThan(INLINE_LIMIT);
});

test("a browser upgrade reaches <Live> as a boolean attribute, so the server-rendered page knows of it", () => {
  const t = live("sdvplot/plotly/f");
  remarkLive({ outDir: out })(t, { path: "a.mdx" });
  expect(t.children[0]?.attributes).toContainEqual({ type: "mdxJsxAttribute", name: "browser", value: null });
  const plain = live("sdvtables/html/t");
  remarkLive({ outDir: out })(plain, { path: "a.mdx" });
  expect(props(plain)).not.toHaveProperty("browser");
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
  getOptions(): { outDir: string; snippetDir?: string };
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

test("<Snippet file> becomes a code block holding that snippet; an unknown file fails the docs build", () => {
  const snippet = (file: string) => ({
    type: "root",
    children: [
      {
        type: "mdxJsxFlowElement",
        name: "Snippet",
        attributes: [{ type: "mdxJsxAttribute", name: "file", value: file }],
      },
    ],
  });
  const snippetDir = abs("examples/snippets");
  const t = snippet("game-on-paper/WinProbabilityChart.svelte");
  remarkLive({ outDir: out, snippetDir })(t, { path: "a.mdx" });
  expect(t.children[0]).toMatchObject({
    type: "code",
    lang: "html",
    meta: 'title="WinProbabilityChart.svelte"',
    value: readFileSync(join(snippetDir, "game-on-paper/WinProbabilityChart.svelte"), "utf8").trimEnd(),
  });
  expect(() => remarkLive({ outDir: out, snippetDir })(snippet("nope.svelte"), { path: "a.mdx" })).toThrow(
    'a.mdx: no snippet "nope.svelte"',
  );
  const deps: string[] = [];
  liveDeps.call(
    { getOptions: () => ({ outDir: "out", snippetDir: "snip" }), addDependency: (f) => void deps.push(f) },
    '<Snippet file="a/B.svelte" />',
  );
  expect(deps).toEqual([join("snip", "a/B.svelte")]);
});
