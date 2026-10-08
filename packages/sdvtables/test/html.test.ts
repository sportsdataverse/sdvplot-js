// test/html.test.ts
import { preloadAll, setWarningHandler } from "@sportsdataverse/sdvplot";
import { beforeAll, expect, test } from "vitest";
import { defineTable } from "../src/define.js";
import { TableSpecError } from "../src/errors.js";
import { fontsLink, renderHTML, styleSheet } from "../src/html/index.js";
import { THEME_NAMES, resolveTheme } from "../src/themes/index.js";
import { STANDINGS, type Standing } from "./fixtures/standings.js";
beforeAll(async () => {
  setWarningHandler(() => {});
  await preloadAll();
});
const base = defineTable<Standing>().columns((c) => [
  c.text("team"),
  c.text("qb", { label: "Quarterback", align: "left" }),
]);
test("skeleton: wrapper id, scoped style once, caption, th scope, data hooks, escaping (Review Focus 1); no empty tfoot", () => {
  const html = renderHTML(
    base.title("AFC <West>").subtitle("Through week 18").build(),
    STANDINGS.slice(0, 2),
  );
  expect(html).toMatch(
    /^<link rel="stylesheet" href="https:\/\/fonts\.googleapis\.com\/css2\?family=Chivo:wght@500;800&amp;family=Lato:wght@400;700&amp;display=swap">\n<div class="sdvt sdvt-theme-sdv sdvt-t-[0-9a-f]{8}" id="sdvt-[0-9a-f]{8}" data-sdvt-theme="sdv" data-sdvt-density="comfortable"><style>/,
  );
  expect(html.match(/<style>/g)?.length).toBe(1);
  expect(html).toContain(
    '<caption><span class="sdvt-title">AFC &lt;West&gt;</span><span class="sdvt-subtitle">Through week 18</span></caption>',
  );
  expect(html).toContain(
    '<th scope="col" class="sdvt-label sdvt-left" data-col="team" data-kind="text">Team</th>',
  );
  expect(html).toContain(
    '<th scope="col" class="sdvt-label sdvt-left" data-col="qb" data-kind="text">Quarterback</th>',
  );
  expect(html).toContain(
    '<tr class="sdvt-row" data-row="0"><td class="sdvt-cell sdvt-kind-text sdvt-left" data-col="team">KC</td>',
  );
  expect(html).not.toContain("<caption></caption>");
  expect(html).not.toContain("<tfoot>");
  expect(renderHTML(base.sourceNote("Source: nflverse").build(), STANDINGS.slice(0, 1))).toContain(
    '<tfoot><tr><td colspan="2">Source: nflverse</td></tr></tfoot>',
  );
  const bad = renderHTML(base.build(), [
    { ...STANDINGS[0]!, qb: `<img src=x onerror=alert(1)> O'Neal & "Shaq"` },
  ]);
  expect(bad).toContain("&lt;img src=x onerror=alert(1)&gt; O&#x27;Neal &amp; &quot;Shaq&quot;");
  expect(bad).not.toContain("<img src=x");
});
test("deterministic: same inputs → identical string; JSON round-trip of the spec renders the same", () => {
  const spec = base.theme("terminal", { density: "compact" }).build();
  expect(renderHTML(spec, STANDINGS)).toBe(renderHTML(spec, STANDINGS));
  expect(renderHTML(JSON.parse(JSON.stringify(spec)), STANDINGS)).toBe(renderHTML(spec, STANDINGS));
});
test("empty rows render header + empty tbody (Review Focus 4): six themes with last-row/odd-even rules × 0, 1 and 8 rows", () => {
  for (const name of ["sdv", "midnight", "kenpom", "gtutils", "pl", "tier"])
    for (const rows of [[], STANDINGS.slice(0, 1), STANDINGS]) {
      const html = renderHTML(base.theme(name).title("x").build(), rows);
      expect(html).toContain("<tbody>");
      expect((html.match(/<tr class="sdvt-row"/g) ?? []).length).toBe(rows.length);
    }
});
test("missing key is TableSpecError before any HTML (Review Focus 5); css:'none' omits style and fonts; styleSheet() is keyed by theme + density + options", () => {
  expect(() => renderHTML(base.build(), [{ team: "KC" } as unknown as Standing])).toThrow(TableSpecError);
  expect(() => renderHTML(base.build(), [{ team: "KC" } as unknown as Standing])).toThrow(/column "qb"/);
  const bare = renderHTML(base.build(), STANDINGS, { css: "none", fonts: false });
  expect(bare.startsWith("<div class=")).toBe(true);
  expect(bare).not.toContain("<style>");
  expect(styleSheet(base.theme("midnight").build())).toContain("--sdvt-bg:#0C0D10;");
  const kc = styleSheet(base.theme("sdvTeam", { options: { league: "nfl", team: "KC" } }).build());
  const buf = styleSheet(base.theme("sdvTeam", { options: { league: "nfl", team: "BUF" } }).build());
  expect(kc.slice(0, kc.indexOf("{"))).not.toBe(buf.slice(0, buf.indexOf("{"))); // two teams on one page do not share a selector
});
test("groupBy emits rowgroup headers in first-appearance order", () => {
  const html = renderHTML(base.groupBy("division").build(), STANDINGS);
  expect(html).toContain(
    '<tr class="sdvt-group-row"><th scope="rowgroup" colspan="2" class="sdvt-group">West</th></tr>',
  );
  expect(html.indexOf("West")).toBeLessThan(html.indexOf("East"));
});
test("hostile id/align/kind from a JSON spec cannot inject; bad id throws", () => {
  const spec = JSON.parse(JSON.stringify(base.build()));
  spec.columns[0].align = 'left" onmouseover="alert(1)';
  spec.columns[0].kind = 'text" onmouseover="alert(2)';
  const html = renderHTML(spec, []);
  expect(html).not.toContain('" onmouseover="');
  expect(() =>
    renderHTML({ ...base.build(), id: "x</style><img src=x onerror=alert(1)>" }, STANDINGS),
  ).toThrow(TableSpecError);
  expect(() => renderHTML({ ...base.build(), id: "standings.2024" }, STANDINGS)).toThrow(/standings\.2024/);
});
test("groupBy gathers non-contiguous groups: one header per group, original data-row indices kept", () => {
  const html = renderHTML(base.groupBy("division").build(), [STANDINGS[0]!, STANDINGS[4]!, STANDINGS[1]!]);
  expect((html.match(/sdvt-group-row/g) ?? []).length).toBe(2);
  expect((html.match(/<tr class="sdvt-row"/g) ?? []).length).toBe(3);
  expect(html.indexOf('data-row="2"')).toBeLessThan(html.indexOf('data-row="1"'));
});
test("styleSheet carries theme rules; css:none drops the shared sheet but renders", () => {
  const spec = base.theme("kenpom").build();
  expect(styleSheet(spec)).toContain("nth-child");
  const html = renderHTML(spec, STANDINGS, { css: "none" });
  expect(html).not.toContain(".sdvt-t-");
  expect(html).toContain("<tbody>");
  expect(renderHTML(spec, STANDINGS)).toContain("nth-child");
});
// spec §7: one HTML snapshot per theme (file snapshot: test/__snapshots__/html.test.ts.snap, committed). A later task that
// changes these snapshots must say why in its commit message.
test.each([...THEME_NAMES])("theme %s: HTML snapshot (spec §7)", (name) => {
  const themed =
    name === "sdvTeam" ? base.theme(name, { options: { league: "nfl", team: "KC" } }) : base.theme(name);
  expect(
    renderHTML(
      themed.title("AFC").subtitle("2024").groupBy("division").sourceNote("Source: nflverse").build(),
      STANDINGS.slice(3, 6),
    ),
  ).toMatchSnapshot();
});
test("row striping (I-1): almanac/ncaa/savant mark every second DISPLAYED data row, counted across groups; group headers never; kenpom keeps its own banding", () => {
  // great_tables _utils_render_html.py:696-702: j % 2 == 1 over the body rows in display order, group heading rows not counted
  const rows = [STANDINGS[0]!, STANDINGS[1]!, STANDINGS[2]!, STANDINGS[4]!, STANDINGS[5]!]; // West 3, East 2
  for (const name of ["almanac", "ncaa", "savant"]) {
    const html = renderHTML(base.theme(name).groupBy("division").build(), rows);
    const trs = [...html.matchAll(/<tr class="([^"]*)"/g)].map((m) => m[1] ?? "");
    expect(trs, name).toEqual([
      "sdvt-group-row",
      "sdvt-row",
      "sdvt-row sdvt-stripe",
      "sdvt-row",
      "sdvt-group-row",
      "sdvt-row sdvt-stripe", // BUF: 4th displayed data row, first of its group
      "sdvt-row",
    ]);
    expect(styleSheet(base.theme(name).build())).toContain(
      "tr.sdvt-stripe td.sdvt-cell{background-color:var(--sdvt-stripe)}",
    );
  }
  const marked = /class="[^"]*sdvt-stripe/; // the class on a row, not the base sheet's rule
  expect(renderHTML(base.theme("almanac", { options: { stripe: "none" } }).build(), rows)).not.toMatch(
    marked,
  );
  expect(renderHTML(base.theme("kenpom").groupBy("division").build(), rows)).not.toMatch(marked);
});
test("athletic: the dotted top rule is on the first body row too (_themes.py:1371, important on loc.body())", () => {
  expect(styleSheet(base.theme("athletic").build())).toContain(
    "tbody tr:first-child td.sdvt-cell{border-top:1.5px dotted black}",
  );
});
test("fonts (I-4/A100): css:'none' keeps the Google Fonts <link>; fonts:false drops it; fontsLink is exported from ./html", () => {
  const spec = base.theme("athletic").build();
  const html = renderHTML(spec, STANDINGS, { css: "none" });
  expect(html.startsWith(`${fontsLink(resolveTheme(spec.theme).fonts)}\n<div`)).toBe(true);
  expect(html).toContain(
    '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Spline+Sans+Mono',
  );
  expect(renderHTML(spec, STANDINGS, { css: "none", fonts: false })).not.toContain("<link");
});
