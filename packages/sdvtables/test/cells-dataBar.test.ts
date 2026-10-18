// test/cells-dataBar.test.ts — reactablefmtr data_bars (2.1.0): width |v| / max|v|, fill / ramp / colorRef / team,
// text positions, diverging bars, marks.
import { resetWarnings, setWarningHandler } from "@sportsdataverse/sdvplot";
import { beforeEach, expect, test } from "vitest";
import { defineTable } from "../src/define.js";
import { prepare, renderHTML } from "../src/html/index.js";
import type { TableSpec } from "../src/spec.js";
import { STANDINGS, type Standing } from "./fixtures/standings.js";
beforeEach(() => {
  resetWarnings();
  setWarningHandler(() => {});
});
const cellOf = (html: string, key: string, row = 0): string =>
  new RegExp(`data-row="${row}">.*?<td[^>]*data-col="${key}"[^>]*>(.*?)</td>`, "s").exec(html)?.[1] ?? "";
const html = (spec: TableSpec<Standing>, rows: readonly Standing[] = STANDINGS): string =>
  renderHTML(spec, rows, { css: "none" });

test("defaults: #15607A bar on a #EEEEEE track, width |v| / max|v|, 18px, text inside the end in contrast ink", () => {
  const out = html(
    defineTable<Standing>()
      .columns((c) => [c.dataBar("wins")])
      .build(),
  );
  // KC 15 of max 15; LV 4 of 15
  expect(cellOf(out, "wins")).toBe(
    '<div class="sdvt-databar" style="display:flex"><div style="flex-grow:1;border-radius:0px;background:#EEEEEE"><div style="display:flex;align-items:center;flex-direction:row;width:100%"><div style="display:flex;align-items:center;flex-direction:row;justify-content:flex-end;background:#15607A;border-radius:0px;color:#ffffff;width:100%;height:18px;white-space:nowrap"><span>15</span></div></div></div></div>',
  );
  expect(cellOf(out, "wins", 3)).toContain("width:26.6667%;height:18px");
  expect(out).toContain('class="sdvt-cell sdvt-kind-dataBar sdvt-left"');
});

test("min/max scale the width; a multi-colour fill ramps over the column's range (bias as grDevices::colorRamp)", () => {
  const out = html(
    defineTable<Standing>()
      .columns((c) => [c.dataBar("wins", { minValue: 0, maxValue: 17, fill: ["#000000", "#ffffff"] })])
      .build(),
  );
  expect(cellOf(out, "wins")).toContain("width:88.2353%"); // 15 / 17
  expect(cellOf(out, "wins")).toContain("background:#ffffff"); // the column max takes the last colour
  expect(cellOf(out, "wins", 3)).toContain("background:#000000"); // LV (4) is the column min
  const biased = html(
    defineTable<Standing>()
      .columns((c) => [c.dataBar("wins", { fill: ["#000000", "#ffffff", "#ff0000"], bias: 2 })])
      .build(),
  );
  // DEN 10: normalized (10 - 4) / 11 = 0.545; stops at 0, 0.25, 1, so 0.394 of the way from white to red. R prints
  // #FF9A9A: rgb(maxColorValue = 255) truncates 154.55; the shared ramp rounds (mix), one unit apart
  expect(cellOf(biased, "wins", 2)).toContain("background:#ff9b9b");
});

test("text positions: outside-end after the bar, outside-base padded before the track, above, none (transparent), right-aligned bars", () => {
  const spec = (o: Parameters<ReturnType<typeof defineTable<Standing>>["columns"]>[0]) =>
    html(defineTable<Standing>().columns(o).build());
  const outside = spec((c) => [c.dataBar("wins", { textPosition: "outside-end" })]);
  expect(cellOf(outside, "wins")).toContain(
    'width:100%;height:18px;white-space:nowrap;margin-right:6px"></div><span>15</span>',
  );
  const base = spec((c) => [c.dataBar("wins", { textPosition: "outside-base" })]);
  expect(cellOf(base, "wins")).toContain(
    '<span style="min-width:2ch;text-align:right;font-variant-numeric:tabular-nums">15</span><div style="flex-grow:1;border-radius:0px;background:#EEEEEE;margin-left:6px">',
  );
  const above = spec((c) => [c.dataBar("wins", { textPosition: "above", roundEdges: true })]);
  expect(cellOf(above, "wins")).toMatch(/^<div class="sdvt-databar"><div style="text-align:left">15<\/div>/);
  expect(cellOf(above, "wins")).toContain("border-radius:2.5px;width:100%;height:5px");
  const none = spec((c) => [c.dataBar("wins", { textPosition: "none" })]);
  expect(cellOf(none, "wins")).toContain("color:transparent");
  const right = spec((c) => [c.dataBar("wins", { align: "right" })]);
  expect(cellOf(right, "wins")).toContain("flex-direction:row-reverse");
  expect(right).toContain('class="sdvt-cell sdvt-kind-dataBar sdvt-right"');
});

test("a column with negatives draws diverging bars around a #666666 line, fill[0] left and fill[1] right; null stays blank", () => {
  const out = html(
    defineTable<Standing>()
      .columns((c) => [c.dataBar("net_epa", { fill: ["#C84630", "#5DA271"], numberFormat: { digits: 3 } })])
      .build(),
  );
  const kc = cellOf(out, "net_epa"); // 0.063 of max |v| 0.190
  expect(kc).toContain('<div style="width:1px;background:#666666"></div>');
  expect(kc).toContain("background:#5DA271;border-radius:0px;color:#000000;width:33.1579%");
  const lv = cellOf(out, "net_epa", 3); // -0.146 on the left half
  expect(lv).toContain("flex-direction:row-reverse;justify-content:flex-end;background:#C84630");
  expect(lv).toContain("<span>-0.146</span>");
  expect(cellOf(out, "net_epa", 7)).toBe("");
  // posNeg: false keeps one-sided bars even with negatives
  const flat = html(
    defineTable<Standing>()
      .columns((c) => [c.dataBar("net_epa", { posNeg: false })])
      .build(),
  );
  expect(cellOf(flat, "net_epa", 3)).not.toContain("#666666");
});

test("gradient paints a left-to-right linear-gradient and needs two colours; colorRef paints the row's own colour", () => {
  const out = html(
    defineTable<Standing>()
      .columns((c) => [c.dataBar("wins", { fill: ["#15607A", "#FA8C00"], gradient: true })])
      .build(),
  );
  expect(cellOf(out, "wins")).toContain("background-image:linear-gradient(to right, #15607A, #FA8C00)");
  expect(() =>
    html(
      defineTable<Standing>()
        .columns((c) => [c.dataBar("wins", { gradient: true })])
        .build(),
    ),
  ).toThrow(/at least two colours/);
  const rows = STANDINGS.map((r) => ({ ...r, color: r.wins >= 10 ? "#1B7837" : "#B2182B" }));
  const ref = renderHTML(
    defineTable<(typeof rows)[number]>()
      .columns((c) => [c.dataBar("wins", { colorRef: "color" })])
      .build(),
    rows,
    { css: "none" },
  );
  expect(cellOf(ref, "wins")).toContain("background:#1B7837");
  expect(cellOf(ref, "wins", 3)).toContain("background:#B2182B");
});

test("team + league fills each bar in the team's colour and marks it with the logo; a mark without its column throws", async () => {
  const spec = defineTable<Standing>()
    .columns((c) => [c.dataBar("wins", { team: "team", league: "nfl", mark: "logo", markHeight: 24 })])
    .build();
  await prepare(spec);
  const out = html(spec);
  expect(cellOf(out, "wins")).toContain("background:#e31837"); // Kansas City red
  expect(cellOf(out, "wins")).toMatch(
    /<span style="display:inline-flex;margin:0 4px"><img class="sdvt-mark" src="https:\/\/[^"]+" alt="Kansas City Chiefs" style="height:24px" data-sdvplot-team="12"><\/span>/,
  );
  expect(() =>
    html(
      defineTable<Standing>()
        .columns((c) => [c.dataBar("wins", { mark: "logo" })])
        .build(),
    ),
  ).toThrow(/mark "logo" reads the team column/);
  expect(() =>
    html(
      defineTable<Standing>()
        .columns((c) => [c.dataBar("wins", { team: "team" })])
        .build(),
    ),
  ).toThrow(/needs a league/);
});
