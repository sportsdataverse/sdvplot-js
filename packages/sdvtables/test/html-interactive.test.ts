import { preloadAll, setWarningHandler } from "@sportsdataverse/sdvplot";
import { beforeAll, expect, test } from "vitest";
import { defineTable } from "../src/define.js";
import { createTable } from "../src/engine.js";
import { renderHTML } from "../src/html/index.js";
import { renderPager, renderToolbar } from "../src/html/interactive.js";
import { tableId } from "../src/table-id.js";
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
  expect(html).toContain(
    '</div><div class="sdvt-body" data-sdv-body=""><table role="grid" aria-multiselectable="true">',
  );
  expect(html).toContain(
    'data-col="wins" data-kind="int" aria-sort="descending"><button type="button" class="sdvt-sort" data-sdv-sort="wins">Wins</button>',
  );
  expect(html).not.toContain("data-sdv-pager");
  expect(html.match(/<tr class="sdvt-row"/g)?.length).toBe(8);
  expect(html.indexOf("BUF")).toBeGreaterThan(html.indexOf("KC")); // desc by wins: KC 15 first
});
test("toolbar: global filter first, then one input per filterable column, each with a hidden <label for>, value last and escaped", () => {
  const t = createTable(spec, rows);
  t.setGlobalFilter(`a"b`);
  t.setFilter("team", "l");
  const id = tableId(spec);
  const sr =
    "position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0";
  expect(renderToolbar(t)).toBe(
    `<div class="sdvt-toolbar">${[
      `<label for="${id}-search" style="${sr}">Search all columns</label>`,
      `<input type="search" id="${id}-search" class="sdvt-global-filter" data-sdv-global-filter="" placeholder="Search" value="a&quot;b"/>`,
      `<label for="${id}-filter-0" style="${sr}">Filter Team</label>`,
      `<input type="search" id="${id}-filter-0" class="sdvt-filter" data-sdv-filter="team" placeholder="Filter Team" value="l"/>`,
    ].join("")}</div>`,
  );
});
test("pager renders the current page only; aria-disabled at the edges (M1); the label is a polite live region (M2)", () => {
  const t = createTable(spec, many, { pageSize: 10 });
  expect(renderPager(t)).toBe(
    '<nav class="sdvt-pager" data-sdv-pager="" aria-label="Pagination"><button type="button" class="sdvt-page" data-sdv-page="prev" aria-label="Previous page" aria-disabled="true">‹</button><span class="sdvt-page-label" data-sdv-page-label="" aria-live="polite">Page 1 of 4</span><button type="button" class="sdvt-page" data-sdv-page="next" aria-label="Next page">›</button></nav>',
  );
  t.setPage(3);
  const html = renderHTML(t);
  expect(html).toContain(
    'data-sdv-page-label="" aria-live="polite">Page 4 of 4</span><button type="button" class="sdvt-page" data-sdv-page="next" aria-label="Next page" aria-disabled="true">',
  );
  expect(html.match(/<tr class="sdvt-row"/g)?.length).toBe(2); // TEN, WAS
  expect(html).toContain(">TEN<");
  expect(html).not.toContain(">ARI<");
  expect(html).toContain(' .sdvt-page[aria-disabled="true"]{opacity:.4;cursor:default}');
  expect(html).not.toContain(" disabled");
});
test("hidden columns disappear from head and body", () => {
  const t = createTable(spec, rows);
  t.toggleColumn("net_epa");
  expect(renderHTML(t)).not.toContain('data-col="net_epa"');
});
test("J31 + A49: selected rows carry sdvt-selected; under ANY filter colour scales span all source rows", () => {
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
  expect(fill(renderHTML(u), "KC")).toBe(kc); // A49: the table's own filters hold colours still too
  t.setSelection(new Set(["BUF"]));
  expect(renderHTML(t)).toContain('<tr class="sdvt-row sdvt-selected" data-row="1"');
});
test("a continuous legend with columns: spans domainRows, so its range holds still across pages", () => {
  const legend = defineTable<Standing>()
    .columns((c) => [c.text("team"), c.int("wins")])
    .legendContinuous({ columns: ["wins"] })
    .build();
  const t = createTable(legend, many, { pageSize: 10 });
  t.setExternalFilter((r) => r.wins > 3); // a brush that hides the 3-win teams: the domain still spans all 32 rows
  const legendOf = (html: string): string | undefined =>
    html.match(/<div class="sdvt-legend[\s\S]*?<\/div><\/div>/)?.[0];
  const page1 = legendOf(renderHTML(t));
  t.setPage(1);
  const page2 = legendOf(renderHTML(t));
  expect(page1).toContain('<span class="sdvt-legend-lab">3</span>');
  expect(page1).toContain('<span class="sdvt-legend-lab">15</span>');
  expect(page2).toBe(page1);
});
test("snake is rejected for an interactive table: one <tr> holds several rows, so sort, selection and hover would miss", () => {
  const snaked = defineTable<Standing>()
    .columns((c) => [c.text("team"), c.int("wins")])
    .snake({ nCols: 2 })
    .build();
  expect(() => renderHTML(snaked, rows)).not.toThrow(); // static snake is unchanged
  expect(() => renderHTML(createTable(snaked, rows))).toThrow(
    /snake cannot be combined with an interactive table/,
  );
});

/** The <tr> holding `team`'s cell, or "" (test helper on the real STANDINGS teams). */
const rowOf = (html: string, team: string): string =>
  html
    .split("<tr ")
    .find((r) => r.includes(`>${team}</td>`))
    ?.split("</tr>")[0] ?? "";
const teamsWith = (html: string, mark: string): string[] =>
  html
    .split("<tr ")
    .filter((r) => r.includes(mark))
    .map((r) => r.match(/data-col="team"[^>]*>([A-Z]+)</)?.[1] ?? "?");
const legendOf = (h: string): string | undefined =>
  h.match(/<div class="sdvt-legend[\s\S]*?<\/div><\/div>/)?.[0];

test("A49 (I1): a filter or page whose rows are all null in a colour column renders; scales come from the source rows", () => {
  for (const kind of ["colorPills", "colorRanks"] as const) {
    const s = defineTable<Standing>()
      .columns((c) => [
        c.text("team", { filterable: true }),
        kind === "colorPills" ? c.colorPills("net_epa", { digits: 3 }) : c.colorRanks("net_epa"),
      ])
      .legendContinuous()
      .rowKey("team")
      .build();
    const all = renderHTML(createTable(s, rows));
    const t = createTable(s, rows);
    t.setFilter("team", "NE"); // NE is the one team whose net_epa is null
    const ne = renderHTML(t);
    expect(rowOf(ne, "NE")).toContain('data-col="net_epa"');
    if (kind === "colorPills") expect(rowOf(ne, "NE")).not.toContain("background-color");
    else expect(rowOf(ne, "NE")).toContain("background-color:#ffffff"); // colorRanks' na fill
    expect(legendOf(ne)).toBe(legendOf(all)); // the continuous legend spans the source rows
    const p = createTable(s, rows, { pageSize: 7, sort: { col: "net_epa", dir: "desc" } });
    p.setPage(1); // nulls sort last, so page 2 holds only NE
    expect(p.rows.map((r) => r.team)).toEqual(["NE"]);
    expect(() => renderHTML(p)).not.toThrow();
  }
});
test("A49 (I4): outlier limits and rowAccent levels come from the source rows, not the shown ones", () => {
  const out = defineTable<Standing>()
    .columns((c) => [c.text("team"), c.num("net_epa", { digits: 3 })])
    .outliers(["net_epa"], { method: "iqr", threshold: 0.5, symbol: "†" })
    .rowKey("team")
    .build();
  const t = createTable(out, rows);
  expect(teamsWith(renderHTML(t), "†")).toEqual(["LV", "BUF"]);
  t.setExternalFilter((r) => r.team !== "LV" && r.team !== "BUF"); // a brush that hides both outliers
  expect(teamsWith(renderHTML(t), "†")).toEqual([]); // before A49: NYJ, which is no outlier of the column
  t.setExternalFilter(null);
  t.setFilter("team", (_v, r) => r.team !== "NE");
  expect(teamsWith(renderHTML(t), "†")).toEqual(["LV", "BUF"]);

  const accent = defineTable<Standing>()
    .columns((c) => [c.text("team"), c.text("division")])
    .rowAccent("division", { palette: ["#ff0000", "#0000ff"], hide: false })
    .rowKey("team")
    .build();
  const border = (h: string): string | undefined => rowOf(h, "KC").match(/border-left:[^;"]*/)?.[0];
  const a = createTable(accent, rows);
  const kc = border(renderHTML(a));
  expect(kc).toMatch(/#0000ff$/); // levels East, West: West is the second colour
  a.setExternalFilter((r) => r.division === "West");
  expect(border(renderHTML(a))).toBe(kc);
});
test("A49 (I2): index row selectors name SOURCE rows in an interactive render, under paging, filtering and sorting", () => {
  const bold = defineTable<Standing>()
    .columns((c) => [c.text("team", { filterable: true }), c.int("wins")])
    .boldRows([5]) // STANDINGS[5] is MIA
    .build();
  const isBold = (h: string, team: string): boolean => rowOf(h, team).includes("font-weight:bold");
  const t = createTable(bold, rows, { pageSize: 3 });
  expect(renderHTML(t)).not.toContain("font-weight:bold"); // KC LAC DEN: MIA is not shown, and nothing throws
  t.setPage(1);
  const p2 = renderHTML(t); // LV BUF MIA
  expect(isBold(p2, "MIA")).toBe(true);
  expect(isBold(p2, "LV") || isBold(p2, "BUF")).toBe(false);
  t.setFilter("team", "MI"); // typing: MIA alone, page position 0
  expect(isBold(renderHTML(t), "MIA")).toBe(true);
  t.setFilter("team", "K"); // KC alone
  expect(renderHTML(t)).not.toContain("font-weight:bold");
  const u = createTable(bold, rows, { sort: { col: "wins", dir: "desc" } });
  expect(isBold(renderHTML(u), "MIA")).toBe(true); // MIA, not whoever sorts into position 5
  expect(() => renderHTML(bold, rows.slice(0, 3))).toThrow(/row 5 is outside 0..2/); // static unchanged
  const eight = defineTable<Standing>()
    .columns((c) => [c.text("team")])
    .boldRows([8])
    .build();
  expect(() => renderHTML(createTable(eight, rows))).toThrow(/row 8 is outside 0..7/); // still a spec error
  // spotlight on a page without its row: the shown rows still dim, and no "matched no rows" warning
  const msgs: string[] = [];
  setWarningHandler((m) => msgs.push(m));
  try {
    const spot = defineTable<Standing>()
      .columns((c) => [c.text("team")])
      .spotlight([5])
      .build();
    expect(rowOf(renderHTML(createTable(spot, rows, { pageSize: 3 })), "KC")).toMatch(/style="color:/);
  } finally {
    setWarningHandler(() => {});
  }
  expect(msgs.filter((m) => m.includes("matched no rows"))).toEqual([]);
});
test("M8: a filter label is the SHOWN header text; a hidden column (engine or decoration) renders no input", () => {
  const s = defineTable<Standing>()
    .columns((c) => [
      c.text("team", { filterable: true }),
      c.text("qb", { filterable: true }),
      c.int("pf", { filterable: true }),
      c.text("division", { filterable: true }),
    ])
    .marginalia(["qb"], { label: "Signal caller" })
    .scaleNote(["pf"], { where: "label" })
    .rowAccent("division", { palette: ["#ff0000", "#0000ff"] }) // hides its key column by default
    .build();
  const t = createTable(s, rows);
  t.setFilter("qb", "Jo");
  const html = renderHTML(t);
  expect(html).toContain('placeholder="Filter Signal caller"');
  expect(html).toContain('placeholder="Filter Pf (000s)"');
  expect(html).not.toContain('data-sdv-filter="division"');
  expect(renderToolbar(t)).toBe(html.match(/<div class="sdvt-toolbar">.*?<\/div>/)?.[0]); // the default labels agree
  t.toggleColumn("qb");
  const hid = renderHTML(t);
  expect(hid).not.toContain('data-sdv-filter="qb"'); // the filter stays active in the engine, with no input
  expect(t.state.filters.qb).toBe("Jo");
  expect(hid).toContain(`id="${tableId(s)}-filter-1" class="sdvt-filter" data-sdv-filter="pf"`); // ids stay dense
});
test("A49: the tiers missing-level warning reads the source rows, not the page", () => {
  const s = defineTable<Standing>()
    .columns((c) => [c.text("team"), c.text("division")])
    .tiers(["West", "East", "North"], "division", [], { colors: ["#ff0000", "#00ff00", "#0000ff"] })
    .build();
  const msgs: string[] = [];
  setWarningHandler((m) => msgs.push(m));
  try {
    renderHTML(createTable(s, rows, { pageSize: 3 })); // page 1: KC LAC DEN, all West
  } finally {
    setWarningHandler(() => {});
  }
  expect(msgs).toEqual(['tier(s) North are not in "division", so they get no rows; it holds West, East']);
});

test("Task 10 (A48): an interactive table is a selectable grid with ONE tab stop; a static table is not", () => {
  expect(renderHTML(spec, rows)).not.toMatch(
    /role="grid"|tabindex|aria-selected|sdvt-col-current"|aria-current/,
  );
  const t = createTable(spec, many, { pageSize: 10 });
  t.setPage(1);
  t.setCursor(3, "wins");
  t.setSelection(new Set(["12"])); // HOU, the third row of page 2 (no rowKey: ids are source indices)
  const html = renderHTML(t, { fonts: false });
  expect(html).toContain('<table role="grid" aria-multiselectable="true">');
  expect(html.match(/ tabindex="0"/g)?.length).toBe(1);
  expect(html.match(/ tabindex="-1"/g)?.length).toBe(9);
  expect(html).toContain('data-row="3" tabindex="0" aria-selected="false"');
  expect(html).toContain(
    '<tr class="sdvt-row sdvt-selected" data-row="2" tabindex="-1" aria-selected="true"',
  );
  expect(html.match(/aria-selected="true"/g)?.length).toBe(1);
  expect(html).toMatch(/<th scope="col" class="[^"]*\bsdvt-col-current" data-col="wins"/);
  expect(html.match(/sdvt-col-current"/g)?.length).toBe(1);
  // fix 1 (I2): the column cursor is exposed to assistive tech, on the same header
  expect(html).toMatch(
    /<th scope="col" class="[^"]*\bsdvt-col-current" data-col="wins" data-kind="int" aria-current="true"/,
  );
  expect(html.match(/aria-current="true"/g)?.length).toBe(1);
});
