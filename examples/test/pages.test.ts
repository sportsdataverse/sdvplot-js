import { mkdirSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative } from "node:path";
import { STANDINGS } from "@sportsdataverse/examples/data";
import { defineTable } from "@sportsdataverse/sdvtables";
import { prepare, renderHTML } from "@sportsdataverse/sdvtables/html";
import { hockeyRink } from "@sportsdataverse/sporty";
import { toSVG } from "@sportsdataverse/sporty/svg";
import { beforeAll, expect, test } from "vitest";
import { writePages } from "../scripts/pages.js";
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
beforeAll(async () => {
  const spec = defineTable<(typeof STANDINGS)[number]>()
    .columns((c) => [c.logo("team", { league: "nfl" }), c.int("wins")])
    .build();
  await prepare(spec);
  for (const r of [
    row("sdvtables/html/t", "sdvtables", renderHTML(spec, STANDINGS)),
    row("sporty/svg/rink", "sporty", toSVG(hockeyRink("nhl"))),
  ]) {
    mkdirSync(dirname(join(out, `${r.id}.json`)), { recursive: true });
    writeFileSync(join(out, `${r.id}.json`), JSON.stringify(r));
  }
});

const tree = (dir: string): Record<string, string> => {
  const files: Record<string, string> = {};
  const walk = (d: string): void => {
    for (const f of readdirSync(d, { withFileTypes: true })) {
      const p = join(d, f.name);
      if (f.isDirectory()) walk(p);
      else files[relative(dir, p).split("\\").join("/")] = readFileSync(p, "utf8");
    }
  };
  walk(dir);
  return files;
};

test("Review Focus 4: the gallery is a pure function of examples/out (two runs, identical bytes)", () => {
  const a = mkdtempSync(join(tmpdir(), "sdv-docs-"));
  const b = mkdtempSync(join(tmpdir(), "sdv-docs-"));
  writePages(out, a);
  writePages(out, b);
  expect(tree(b)).toEqual(tree(a));
  expect(Object.keys(tree(a)).sort()).toEqual([
    "docs/gallery/_category_.json",
    "docs/gallery/index.mdx",
    "docs/gallery/sdvplot/index.mdx",
    "docs/gallery/sdvtables/html/_category_.json",
    "docs/gallery/sdvtables/html/t.mdx",
    "docs/gallery/sdvtables/index.mdx",
    "docs/gallery/sporty/index.mdx",
    "docs/gallery/sporty/svg/_category_.json",
    "docs/gallery/sporty/svg/rink.mdx",
    "static/examples/sporty/svg/rink.svg",
  ]);
  expect(tree(a)["docs/gallery/sdvtables/html/t.mdx"]).toContain('title: "<sdvtables/html/t>"');
});
