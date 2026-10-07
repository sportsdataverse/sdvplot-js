import { resetWarnings, setWarningHandler } from "@sportsdataverse/sdvplot";
import { beforeEach, expect, test } from "vitest";
import { defineTable } from "../src/define.js";
import { renderHTML } from "../src/html/index.js";
import { STANDINGS, type Standing } from "./fixtures/standings.js";
const warnings: string[] = [];
beforeEach(() => {
  warnings.length = 0;
  resetWarnings();
  setWarningHandler((m) => warnings.push(m));
});
const T = defineTable<Standing>().columns((c) => [c.text("team"), c.num("wins")]);
const tr = (html: string, i: number): string =>
  new RegExp(`<tr class="sdvt-row[^"]*" data-row="${i}"[^>]*>`).exec(html)?.[0] ?? "";
test("groupStripes shades every other group's body rows (start 2 = second group); the group header stays unshaded (Python _cells.py:421)", () => {
  const html = renderHTML(T.groupBy("division").groupStripes().build(), STANDINGS, { css: "none" });
  expect(tr(html, 0)).not.toContain("sdvt-gstripe");
  expect(tr(html, 4)).toContain("sdvt-gstripe");
  expect(html).toContain(
    '<tr class="sdvt-group-row"><th scope="rowgroup" colspan="2" class="sdvt-group">East</th></tr>',
  );
  expect(renderHTML(T.groupBy("division").groupStripes({ color: "#eee" }).build(), STANDINGS)).toContain(
    "tr.sdvt-gstripe td{background-color:#eee}",
  ); // css rule emitted, scoped
});
test("rowAccent keyed to a column, palette by level (sorted), hide removes the column; unmapped → naColor 'transparent' = no bar", () => {
  const withDivision = defineTable<Standing>().columns((c) => [
    c.text("team"),
    c.num("wins"),
    c.text("division"),
  ]);
  const html = renderHTML(
    withDivision.rowAccent("division", { palette: ["#111111", "#222222"] }).build(),
    STANDINGS,
    {
      css: "none",
    },
  );
  expect(tr(html, 0)).toContain('style="border-left:4px solid #222222"');
  expect(tr(html, 4)).toContain('style="border-left:4px solid #111111"'); // East < West by code point
  expect(html).not.toContain('data-col="division"');
  expect(
    renderHTML(
      withDivision.rowAccent("division", { palette: ["#111111", "#222222"], hide: false }).build(),
      STANDINGS,
      {
        css: "none",
      },
    ),
  ).toContain('data-col="division"');
  const named = renderHTML(
    T.rowAccent("team", { palette: { KC: "#e31837" }, hide: false, side: "right" }).build(),
    STANDINGS.slice(0, 2),
    { css: "none" },
  );
  expect(tr(named, 0)).toContain("border-right:4px solid #e31837");
  expect(tr(named, 1)).not.toContain("border-right"); // _layout.py:1150-1152
});
test("boldRows by positions and by predicate; spotlight dims the rest with auto ink", () => {
  const html = renderHTML(
    T.boldRows({ key: "wins", op: ">=", value: 13 }, { highlightColor: "#ffffe0" }).build(),
    STANDINGS,
    { css: "none" },
  );
  expect(tr(html, 0)).toContain('style="font-weight:bold"');
  expect(html).toMatch(
    /data-row="0" style="font-weight:bold"><td [^>]*style="color:black;background-color:#ffffe0"/,
  ); // fills live on the cells
  expect(tr(html, 1)).not.toContain("font-weight");
  const spot = renderHTML(T.spotlight([0], { accentColor: "#e31837" }).build(), STANDINGS.slice(0, 2), {
    css: "none",
  });
  // dim = secondaryOn(#ffffff, onColor(#ffffff) = #000000): first blend clearing 4.5:1 → #737373 (_layout.py:1040)
  expect(tr(spot, 0)).toContain("font-weight:bold");
  expect(tr(spot, 0)).toContain("box-shadow:inset 4px 0 0 #e31837");
  expect(tr(spot, 1)).toContain("color:#737373");
  const none = renderHTML(
    T.spotlight({ key: "team", op: "==", value: "ZZZ" }).build(),
    STANDINGS.slice(0, 2),
    {
      css: "none",
    },
  );
  expect(tr(none, 1)).not.toContain("style=");
  expect(warnings.some((w) => w.includes("matched no rows"))).toBe(true);
});
test("colorResults column fills the row by exact W/L; cutline after 3 rows with an uppercase label; borderGrid rules", () => {
  const html = renderHTML(
    defineTable<Standing>()
      .columns((c) => [c.text("team"), c.colorResults("result_last")])
      .build(),
    STANDINGS.slice(0, 4),
    { css: "none" },
  );
  expect(html.match(/<td [^>]*style="background-color:#C84630;color:white"/g)).toHaveLength(6); // rows 0-2 are L, two cells each
  expect(html.match(/<td [^>]*style="background-color:#5DA271;color:white"/g)).toHaveLength(2);
  expect(html).toMatch(/data-col="result_last"[^>]*>L<\/td>/);
  const cut = renderHTML(T.cutline(3, { label: ["Playoff line"] }).build(), STANDINGS);
  // after = 3 rows above the line (_cells.py:840): the rule is the top border of 0-based row 3, and the "below" label sits on that row
  expect(tr(cut, 3)).toContain("sdvt-cut-0-0");
  expect(cut).toContain("tr.sdvt-cut-0-0 td{border-top:2px dashed #A6081A}");
  const uri = /data:image\/svg\+xml;charset=utf-8,([^"]+)/.exec(cut)?.[1] ?? "";
  expect(decodeURIComponent(uri)).toBe(
    '<svg xmlns="http://www.w3.org/2000/svg" width="104" height="13"><text x="0" y="9.5" font-family="Helvetica,Arial,sans-serif" font-size="9" font-weight="700" letter-spacing="1.1" fill="#A6081A">PLAYOFF LINE</text></svg>',
  ); // width = 12 × (9 × 0.8 + 1.1) + 4 = 103.6 → 104
  const grid = renderHTML(T.borderGrid({ color: "#333", weight: 1, includeLabels: true }).build(), STANDINGS);
  expect(grid).toContain("td.sdvt-cell:not(:last-child){border-right:1px solid #333}");
  expect(grid).toContain("th.sdvt-label:not(:last-child){border-right:1px solid #333}");
});

test("fills survive a striped group: every td of a colorResults row carries the fill inline", () => {
  const t = defineTable<Standing>().columns((c) => [c.text("team"), c.colorResults("result_last")]);
  const html = renderHTML(t.groupBy("division").groupStripes({ start: 1 }).build(), STANDINGS, {
    css: "none",
  });
  const row3 = /data-row="3"[^>]*>(.*?)<\/tr>/.exec(html)?.[1] ?? ""; // LV, W, in a striped group
  expect(row3.match(/<td [^>]*style="background-color:#5DA271;color:white"/g)).toHaveLength(2);
  expect(tr(html, 3)).toContain("sdvt-gstripe");
});
test("two cutlines keep their own colour and label", () => {
  const html = renderHTML(
    T.cutline(2, { color: "#ff0000", label: ["Playoffs"] })
      .cutline(5, { color: "#0000ff", label: ["Relegation"] })
      .build(),
    STANDINGS,
  );
  expect(tr(html, 2)).toContain("sdvt-cut-0-0");
  expect(tr(html, 5)).toContain("sdvt-cut-1-0");
  expect(html).toContain("tr.sdvt-cut-0-0 td{border-top:2px dashed #ff0000}");
  expect(html).toContain("tr.sdvt-cut-1-0 td{border-top:2px dashed #0000ff}");
  const labels = [
    ...html.matchAll(
      /tr\.sdvt-cut-(\d)-0-label\{background-image:url\("data:image\/svg\+xml;charset=utf-8,([^"]+)"/g,
    ),
  ].map((m) => decodeURIComponent(m[2] ?? ""));
  expect(labels).toHaveLength(2);
  expect(labels[0]).toContain("PLAYOFFS");
  expect(labels[1]).toContain("RELEGATION");
});
test("hostile JSON-parsed style fields throw instead of reaching the attribute", () => {
  const evil = JSON.parse('"x\\" onmouseover=\\"alert(1)"') as never;
  expect(() => renderHTML(T.rowAccent("team", { side: evil }).build(), STANDINGS)).toThrow(/side/);
  expect(() =>
    renderHTML(T.borderBars("top", ["#000"], { img: "a.png", imgAlign: evil }).build(), STANDINGS),
  ).toThrow(/imgAlign/);
  expect(() => renderHTML(T.borderBars("top", ["#000"], { barHeight: evil }).build(), STANDINGS)).toThrow(
    /barHeight/,
  );
});
