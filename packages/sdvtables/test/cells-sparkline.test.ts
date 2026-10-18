// test/cells-sparkline.test.ts — reactablefmtr react_sparkline as inline SVG. The expected geometry is sdvplot's
// (tests/test_reactable_charts.py), so the Python and JS ports draw the same line.
import { contrast, hex6 } from "@sportsdataverse/sdvplot";
import { expect, test, vi } from "vitest";
import { defineTable } from "../src/define.js";
import { TableSpecError } from "../src/errors.js";
import { prepare, renderHTML } from "../src/html/index.js";
import type { ColumnSpec } from "../src/spec.js";
import { resolveTheme } from "../src/themes/index.js";

type Row = { team: string; s: readonly (number | null)[] | null };
type Opts = Partial<Omit<Extract<ColumnSpec<Row>, { kind: "sparkline" }>, "kind" | "key">>;
const cellOf = (html: string, row = 0): string =>
  new RegExp(`data-row="${row}">.*?<td[^>]*data-col="s"[^>]*>(.*?)</td>`, "s").exec(html)?.[1] ?? "";
const draw = (s: Row["s"] | unknown, o: Opts = {}): string =>
  cellOf(
    renderHTML(
      defineTable<Row>()
        .columns((c) => [c.sparkline("s", o)])
        .build(),
      [{ team: "LV", s: s as Row["s"] }],
      { css: "none" },
    ),
  );
const attr = (svg: string, el: string, name: string, nth = 0): string =>
  [...svg.matchAll(new RegExp(`<${el}\\b[^>]*?\\b${name}="([^"]*)"`, "g"))][nth]?.[1] ?? "";

test("the path spans reactablefmtr's margins and scales to the series", () => {
  const svg = draw([1, 3, 2]);
  // default margins (t3 r13 b2 l13) in a 100 x 22 box: x 13..87, y 3 (max) .. 20 (min)
  expect(attr(svg, "path", "d")).toBe("M13,20 L50,3 L87,11.5");
  expect(attr(svg, "path", "stroke")).toBe("slategray");
  expect(svg).toContain('width="100" height="22"');
  expect(attr(svg, "path", "stroke-linecap")).toBe("round");
});

test("an accessible image: role img, an aria-label and a <title> summarising min, max and last", () => {
  const svg = draw([4, 9.5, 2, 7]);
  const label = "Sparkline of 4 values: min 2, max 9.5, last 7";
  expect(svg).toContain('role="img"');
  expect(svg).toContain(`aria-label="${label}"`);
  expect(svg).toContain(`<title>${label}</title>`);
  expect(draw([0.0000125, 0.00002])).toContain("min 0.0000125, max 0.00002"); // small values keep their figures
});

test("gaps break the line, an isolated point is a dot (h0), and empty cells are blank", () => {
  expect(attr(draw([1, null, 3]), "path", "d")).toBe("M13,20 h0 M87,3 h0");
  expect(attr(draw([1, Number.NaN, 2, 3]), "path", "d")).toMatch(/^M13,20 h0 M/);
  expect(attr(draw([7]), "path", "d")).toMatch(/ h0$/); // a lone value draws a dot, not nothing
  for (const blank of [[], null, [null, null], [Number.NaN], "n/a", 5]) expect(draw(blank)).toBe("");
});

test("non-finite values are gaps: no NaN or Infinity reaches the SVG", () => {
  const svg = draw([1, Number.POSITIVE_INFINITY, 2, Number.NEGATIVE_INFINITY, Number.NaN]);
  expect(svg).not.toMatch(/NaN|Infinity/);
  expect(attr(svg, "path", "d")).toBe("M13,20 h0 M50,3 h0");
  expect(svg).toContain("Sparkline of 2 values: min 1, max 2, last 2");
});

test("highlightPoints by colour per name, by name (red), and all", () => {
  const circles = (svg: string): string[][] =>
    [...svg.matchAll(/<circle[^>]*cx="([^"]+)" cy="([^"]+)"[^>]*fill="([^"]+)"/g)].map((m) => m.slice(1));
  expect(circles(draw([1, 3, 2], { highlightPoints: { min: "red", max: "blue" } }))).toEqual([
    ["13", "20", "red"],
    ["50", "3", "blue"],
  ]);
  expect(circles(draw([1, 3, 2], { highlightPoints: ["first", "last"] })).map((c) => [c[0], c[2]])).toEqual([
    ["13", "red"],
    ["87", "red"],
  ]);
  const every = draw([1, 3, 2], { highlightPoints: { all: "gray", max: "blue" } });
  expect([...every.matchAll(/fill="(gray|blue)"/g)].map((m) => m[1])).toEqual(["gray", "blue", "gray"]);
  expect(attr(draw([1, 3], { highlightPoints: ["max"], pointSize: 3 }), "circle", "r")).toBe("3");
});

test("statline sits at the stat, labelled in the right margin; the aria-label notes it and the band", () => {
  const svg = draw([1, 3, 2], { statline: "mean", decimals: 1 });
  // with a statline the right margin grows to 28: x 13..72, y 4..19; the mean 2 is half way down
  expect([attr(svg, "line", "y1"), attr(svg, "line", "y2")]).toEqual(["11.5", "11.5"]);
  expect([attr(svg, "line", "x1"), attr(svg, "line", "x2")]).toEqual(["13", "72"]);
  expect(svg).toMatch(/<text class="sdvt-statline-label" x="77" y="11.5"[^>]*>2.0<\/text>/);
  expect(attr(draw([1, 3, 2], { statline: "max" }), "line", "y1")).toBe("4");
  expect(draw([1, 2], { statline: "median", bandline: "range", decimals: 1 })).toContain(
    'aria-label="Sparkline of 2 values: min 1, max 2, last 2; median line at 1.5; band over the range"',
  );
});

test("bandline covers the inner quartiles (R type 7) or the range", () => {
  const iq = draw([1, 2, 3, 4, 5], { bandline: "innerquartiles" });
  expect([attr(iq, "rect", "y"), attr(iq, "rect", "height")]).toEqual(["7.25", "8.5"]); // q1 2, q3 4; y 3..20
  const full = draw([1, 2, 3, 4, 5], { bandline: "range" });
  expect([attr(full, "rect", "y"), attr(full, "rect", "height")]).toEqual(["3", "17"]);
  expect(attr(full, "rect", "fill-opacity")).toBe("0.2");
});

test("labels grow the default height, print with decimals, and use currentColor", () => {
  const svg = draw([1, 3, 2], { labels: ["max"], decimals: 1 });
  expect(svg).toContain('height="30"'); // reactablefmtr's 22 -> 30 with labels above the points
  expect(svg).toMatch(
    /<text class="sdvt-label" x="50" y="7" text-anchor="middle" fill="currentColor"[^>]*>3.0<\/text>/,
  );
  const ends = draw([1, 3, 2], { labels: ["first", "last"] });
  expect(ends).toContain('text-anchor="end"');
  expect(ends).toContain('text-anchor="start"');
  expect(ends).toContain('height="22"');
  expect(draw([1, 3, 2], { labels: ["all"] }).match(/sdvt-label/g)).toHaveLength(3);
  expect(draw([1, 3, 2], { chartHeight: 40, chartWidth: 60, labels: ["max"] })).toContain(
    'width="60" height="40"',
  );
});

test("area under each unbroken run, and fixed bounds", () => {
  const svg = draw([1, 3], { showArea: true, minValue: 0, maxValue: 4 });
  expect(svg).toMatch(
    /class="sdvt-area" d="M13,20 L13,15.75 L87,7.25 L87,20 Z" fill="slategray" fill-opacity="0.1"/,
  );
  const gap = draw([1, 2, null, 3], { showArea: true, areaColor: "#ff0000" });
  expect(attr(gap, "path", "d").match(/Z/g)).toHaveLength(2);
  expect(attr(gap, "path", "fill")).toBe("#ff0000");
});

test("team + league colours each row's line and area (unresolved: lineColor); colorRef reads a hex column", async () => {
  const spec = defineTable<Row>()
    .columns((c) => [c.sparkline("s", { team: "team", league: "nfl", showArea: true })])
    .build();
  await prepare(spec);
  const rows: Row[] = [
    { team: "LV", s: [1, 2] },
    { team: "LAR", s: [2, 1] },
    { team: "XXX", s: [3, 3] },
  ];
  const warned = vi.spyOn(console, "warn").mockImplementation(() => undefined);
  const out = renderHTML(spec, rows, { css: "none" });
  expect(String(warned.mock.calls[0]?.[0])).toContain("'XXX'"); // one warning for the column, naming the value
  warned.mockRestore();
  expect([0, 1, 2].map((r) => attr(cellOf(out, r), "path", "stroke"))).toEqual([
    "#000000",
    "#003594",
    "slategray",
  ]);
  expect(attr(cellOf(out, 1), "path", "fill")).toBe("#003594"); // the area follows the team too
  expect(attr(cellOf(out, 2), "path", "d", 1)).toBe("M13,11.5 L87,11.5"); // a flat series sits mid-height
  type Ref = { s: number[]; c: string };
  const ref = renderHTML(
    defineTable<Ref>()
      .columns((c) => [c.sparkline("s", { colorRef: "c" })])
      .build(),
    [{ s: [1, 2], c: "#123456" }],
    { css: "none" },
  );
  expect(attr(cellOf(ref), "path", "stroke")).toBe("#123456");
});

test("a team colour is checked for 3:1 contrast against a dark theme's background", async () => {
  const spec = defineTable<Row>()
    .columns((c) => [c.sparkline("s", { team: "team", league: "nfl" })])
    .theme("fmtr-dark")
    .build();
  await prepare(spec);
  const stroke = attr(
    cellOf(renderHTML(spec, [{ team: "LV", s: [1, 2] }], { css: "none" })),
    "path",
    "stroke",
  );
  expect(stroke).not.toBe("#000000"); // the Raiders' black would vanish on the dark background
  expect(contrast(stroke, hex6(resolveTheme(spec.theme).tokens.bg))).toBeGreaterThanOrEqual(3);
});

test("build() rejects bad sizes, opacities, names and bounds, naming the option", () => {
  const bad = (o: Record<string, unknown>, match: RegExp): void => {
    expect(() =>
      defineTable<Row>()
        .columns((c) => [c.sparkline("s", o as Opts)])
        .build(),
    ).toThrow(match);
  };
  bad({ lineWidth: Number.NaN }, /lineWidth must be a positive finite number/);
  bad({ lineWidth: 0 }, /lineWidth/);
  bad({ pointSize: Number.POSITIVE_INFINITY }, /pointSize/);
  bad({ pointSize: -1 }, /pointSize/);
  bad({ chartHeight: 0 }, /chartHeight/);
  bad({ chartWidth: "100px" }, /chartWidth/);
  bad({ areaOpacity: 2 }, /areaOpacity must be between 0 and 1/);
  bad({ decimals: 1.5 }, /decimals/);
  bad({ statline: "mode" }, /statline must be one of/);
  bad({ bandline: "iqr" }, /bandline/);
  bad({ labels: ["middle"] }, /labels/);
  bad({ highlightPoints: { peak: "red" } }, /highlightPoints/);
  bad({ maxValue: "10" }, /maxValue must be a finite number/);
  bad({ minValue: 5, maxValue: 5 }, /column "s": sparkline minValue must be below maxValue/);
  bad({ minValue: 6, maxValue: 5 }, /below maxValue/);
});

test("one bound that crosses a row's data throws naming the row; colours are escaped CSS values", () => {
  expect(() => draw([1, 2], { minValue: 10 })).toThrow(/row 0: minValue\/maxValue cross the row's data/);
  expect(() => draw([1, 2], { lineColor: 'red" onload="x' })).toThrow(TableSpecError);
  expect(() => draw([1, 2], { lineColor: "url(https://x)" })).toThrow(/sparkline lineColor/);
});

test("sparkline columns are not sortable by default, left aligned, and carry the kind class", () => {
  const spec = defineTable<Row>()
    .columns((c) => [c.sparkline("s")])
    .build();
  expect(spec.columns[0]?.sortable).toBe(false);
  expect(renderHTML(spec, [{ team: "LV", s: [1, 2] }], { css: "none" })).toContain(
    'class="sdvt-cell sdvt-kind-sparkline sdvt-left"',
  );
});

// ---- self-review follow-ups (#68)

test("the exact path around a NaN gap: the point before it is a dot, the run after it a line", () => {
  // x 13, 37.67, 62.33, 87; y: 1 -> 20, 2 -> 11.5, 3 -> 3
  expect(attr(draw([1, Number.NaN, 2, 3]), "path", "d")).toBe("M13,20 h0 M62.33,11.5 L87,3");
});

test("an all-equal series (hi === lo) sits mid-height; a negative-only series scales to itself", () => {
  expect(attr(draw([5, 5, 5]), "path", "d")).toBe("M13,11.5 L50,11.5 L87,11.5");
  expect(attr(draw([0, 0]), "path", "d")).toBe("M13,11.5 L87,11.5");
  const neg = draw([-3, -1]);
  expect(attr(neg, "path", "d")).toBe("M13,20 L87,3");
  expect(neg).toContain("Sparkline of 2 values: min -3, max -1, last -1");
});

test("labels and the statline never print -0; decimals is bounded to 0..20", () => {
  const svg = draw([-0.4, 1], { labels: ["all"], statline: "min" });
  expect([...svg.matchAll(/class="sdvt-label"[^>]*>([^<]*)</g)].map((m) => m[1])).toEqual(["0", "1"]);
  expect(svg).toMatch(/class="sdvt-statline-label"[^>]*>0</);
  expect(svg).toContain("; min line at 0");
  expect(svg).not.toMatch(/>-0</); // the aria-label keeps "min -0.4": only the printed values round
  const build = (decimals: number) => () =>
    defineTable<Row>()
      .columns((c) => [c.sparkline("s", { decimals })])
      .build();
  expect(build(21)).toThrow(/column "s": sparkline decimals must be a whole number from 0 to 20/);
  expect(build(20)).not.toThrow();
});

test("numeric strings in a series are read as toNumber reads them; other text is a gap", () => {
  expect(attr(draw(["1", "3", "2"]), "path", "d")).toBe("M13,20 L50,3 L87,11.5");
  expect(attr(draw(["1", "0x10", "2"]), "path", "d")).toBe("M13,20 h0 M87,3 h0");
});

test("an explicit chartHeight is honoured with labels on; the default grows", () => {
  // a "max" label needs 14 + 10 px of margin; 26 leaves a drawable box and is below the grown default of 30
  expect(draw([1, 3, 2], { labels: ["max"], chartHeight: 26 })).toContain('height="26"');
  expect(draw([1, 3, 2], { labels: ["max"] })).toContain('height="30"');
  expect(
    defineTable<Row>()
      .columns((c) => [c.sparkline("s")])
      .build().columns[0],
  ).not.toHaveProperty("chartHeight");
});

test("statlineColor and labelSize are CSS values: url( and quotes are rejected, naming the option", () => {
  expect(() => draw([1, 2], { statline: "mean", statlineColor: "url(https://x)" })).toThrow(
    /sparkline statlineColor/,
  );
  expect(() => draw([1, 2], { labels: ["max"], labelSize: '1em"><script>' })).toThrow(/sparkline labelSize/);
});

test("a chart too small for its margins is an error, not a mirrored or missing chart", () => {
  // statline margins are l13 + r28: at 40 px wide the x axis would run backwards
  expect(() => draw([1, 2, 3], { statline: "mean", chartWidth: 40 })).toThrow(
    /leaves no room inside its margins/,
  );
  // a "max" label grows the margins to t14 + b10: at 20 px tall the y scale would flip
  expect(() => draw([1, 2, 3], { labels: ["max"], chartHeight: 20 })).toThrow(
    /sparkline chartWidth x chartHeight/,
  );
  expect(draw([1, 2, 3], { statline: "mean", chartWidth: 60 })).toContain("<svg");
});
