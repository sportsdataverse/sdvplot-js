import { preloadAll, setWarningHandler } from "@sportsdataverse/sdvplot";
import { beforeAll, expect, test } from "vitest";
import { defineTable } from "../src/define.js";
import { createTable } from "../src/engine.js";
import { renderHTML } from "../src/html/index.js";
import { renderPager, renderToolbar } from "../src/html/interactive.js";
import { many, rows, spec } from "./fixtures/engine.js";
import type { Standing } from "./fixtures/standings.js";

beforeAll(async () => {
  setWarningHandler(() => {});
  await preloadAll();
});

test("static render has no controls", () => {
  const html = renderHTML(spec, rows);
  // the shared stylesheet names .sdvt-toolbar and th[aria-sort] (Task 3 BASE_CSS), so match the markup, not the words
  expect(html).not.toContain(' aria-sort="');
  expect(html).not.toContain('class="sdvt-toolbar"');
  expect(html).not.toContain("data-sdv-pager");
});
test("interactive layout: style, toolbar, body block, no pager when pageSize is Infinity", () => {
  const t = createTable(spec, rows);
  t.setSort("wins", "desc");
  const html = renderHTML(t, { fonts: false });
  expect(html).toMatch(
    /^<div class="sdvt sdvt-theme-sdv sdvt-t-[0-9a-f]{8}" id="sdvt-[0-9a-f]{8}" data-sdvt-theme="sdv" data-sdvt-density="compact"><style>/,
  );
  expect(html).toContain('</style><div class="sdvt-toolbar">');
  expect(html).toContain('</div><div class="sdvt-body" data-sdv-body=""><table>');
  expect(html).toContain(
    'data-col="wins" data-kind="int" aria-sort="descending"><button type="button" class="sdvt-sort" data-sdv-sort="wins">Wins</button>',
  );
  expect(html).not.toContain("data-sdv-pager");
  expect(html.match(/<tr class="sdvt-row"/g)?.length).toBe(8);
  expect(html.indexOf("BUF")).toBeGreaterThan(html.indexOf("KC")); // desc by wins: KC 15 first
});
test("toolbar: global filter first, then one input per filterable column, value last and escaped", () => {
  const t = createTable(spec, rows);
  t.setGlobalFilter(`a"b`);
  t.setFilter("team", "l");
  expect(renderToolbar(t)).toBe(
    '<div class="sdvt-toolbar">' +
      '<input type="search" class="sdvt-global-filter" data-sdv-global-filter="" placeholder="Search" aria-label="Search all columns" value="a&quot;b"/>' +
      '<input type="search" class="sdvt-filter" data-sdv-filter="team" placeholder="Filter Team" aria-label="Filter Team" value="l"/>' +
      "</div>",
  );
});
test("pager renders the current page only; disabled at the edges", () => {
  const t = createTable(spec, many, { pageSize: 10 });
  expect(renderPager(t)).toBe(
    '<nav class="sdvt-pager" data-sdv-pager="" aria-label="Pagination"><button type="button" class="sdvt-page" data-sdv-page="prev" aria-label="Previous page" disabled="">‹</button><span class="sdvt-page-label" data-sdv-page-label="">1 / 3</span><button type="button" class="sdvt-page" data-sdv-page="next" aria-label="Next page">›</button></nav>',
  );
  t.setPage(2);
  const html = renderHTML(t);
  expect(html).toContain(
    'data-sdv-page-label="">3 / 3</span><button type="button" class="sdvt-page" data-sdv-page="next" aria-label="Next page" disabled="">',
  );
  expect(html.match(/<tr class="sdvt-row"/g)?.length).toBe(5);
  expect(html).toContain("T21");
  expect(html).not.toContain("T01");
});
test("hidden columns disappear from head and body", () => {
  const t = createTable(spec, rows);
  t.toggleColumn("net_epa");
  expect(renderHTML(t)).not.toContain('data-col="net_epa"');
});
test("J31: selected rows carry sdvt-selected; under an EXTERNAL filter colour scales span all rows (decision 4 amended)", () => {
  const pills = defineTable<Standing>()
    .columns((c) => [c.text("team"), c.colorPills("net_epa", { digits: 3 })])
    .rowKey("team")
    .build();
  const fill = (html: string, team: string): string | undefined =>
    html
      .split("<tr ")
      .find((r) => r.includes(`>${team}</td>`))
      ?.match(/background-color:\s*(#[0-9a-f]{6})/i)?.[1];
  const topTwo = (r: Standing): boolean => r.team === "KC" || r.team === "BUF";
  const t = createTable(pills, rows);
  const kc = fill(renderHTML(t), "KC");
  expect(kc).toMatch(/^#/);
  t.setExternalFilter(topTwo);
  expect(fill(renderHTML(t), "KC")).toBe(kc); // KC 0.071: mid-scale over all 8 rows, the bottom of the 2 shown
  const u = createTable(pills, rows);
  u.setFilter("team", (_v, r) => topTwo(r));
  expect(fill(renderHTML(u), "KC")).not.toBe(kc); // the table's own filters keep decision 4
  t.setSelection(new Set(["BUF"]));
  expect(renderHTML(t)).toContain('<tr class="sdvt-row sdvt-selected" data-row="1"');
});
