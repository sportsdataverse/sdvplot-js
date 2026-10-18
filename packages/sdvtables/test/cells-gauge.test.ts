// test/cells-gauge.test.ts — reactablefmtr gauge_chart as an inline-SVG half circle; expected geometry from sdvplot's
// tests/test_reactable_charts.py.
import { expect, test } from "vitest";
import { defineTable } from "../src/define.js";
import { prepare, renderHTML } from "../src/html/index.js";
import type { ColumnSpec } from "../src/spec.js";
import { STANDINGS, type Standing } from "./fixtures/standings.js";

type Row = { team: string; g: number | null };
type Opts = Partial<Omit<Extract<ColumnSpec<Row>, { kind: "gauge" }>, "kind" | "key">>;
const cellOf = (html: string, row = 0, key = "g"): string =>
  new RegExp(`data-row="${row}">.*?<td[^>]*data-col="${key}"[^>]*>(.*?)</td>`, "s").exec(html)?.[1] ?? "";
const render = (values: readonly (number | string | null)[], o: Opts = {}): string =>
  renderHTML(
    defineTable<Row>()
      .columns((c) => [c.gauge("g", o)])
      .build(),
    values.map((g) => ({ team: "LV", g }) as Row), // "DNP": a text cell in a numeric column
    { css: "none" },
  );
const attr = (svg: string, el: string, name: string, nth = 0): string =>
  [...svg.matchAll(new RegExp(`<${el}\\b[^>]*?\\b${name}="([^"]*)"`, "g"))][nth]?.[1] ?? "";

test("the arc fills its share of the scale: 0 to the column's largest absolute value", () => {
  const out = render([0.5, 1.0]);
  const svg = cellOf(out);
  // 50px wide (reactablefmtr size = 1): outer radius 25, inner 18.75; half way round ends at the top
  expect(attr(svg, "path", "d", 1)).toBe("M0,25 A25,25 0 0 1 25,0 L25,6.25 A18.75,18.75 0 0 0 6.25,25 Z");
  expect(attr(svg, "path", "fill", 0)).toBe("#EEEEEE");
  expect(attr(svg, "path", "fill", 1)).toBe("#15607A");
  expect(svg).toMatch(/class="sdvt-value"[^>]*fill="currentColor">0.5<\/text>/);
  expect(svg).toContain('role="img" aria-label="Gauge: 0.5 on a scale from 0 to 1"');
  expect(out).toContain('class="sdvt-cell sdvt-kind-gauge sdvt-center"');
  expect(cellOf(render([0.5, 1.0], { minValue: 0.5 })).match(/<path/g)).toHaveLength(1); // nothing filled at the bottom
});

test("missing and non-finite values are blank, text passes through; Infinity is never the scale's end", () => {
  const out = render([0.5, Number.POSITIVE_INFINITY, 1.0, null, Number.NaN, "DNP"]);
  expect(cellOf(out, 0)).toContain('aria-label="Gauge: 0.5 on a scale from 0 to 1"');
  for (const r of [1, 3, 4]) expect(cellOf(out, r)).toBe("");
  expect(cellOf(out, 5)).toBe("DNP");
  expect(out).not.toMatch(/NaN|Infinity/);
});

test("the absolute value fills the gauge, and the aria-label says so for a negative", () => {
  const out = render([-5, 10]);
  const neg = cellOf(out, 0);
  expect(neg).toContain('aria-label="Gauge: -5 (its absolute value, 5, is gauged) on a scale from 0 to 10"');
  expect(attr(neg, "path", "d", 1)).toBe(attr(cellOf(render([5, 10]), 0), "path", "d", 1));
  expect(cellOf(render([5, 10]), 0)).not.toContain("absolute");
});

test("bounds, numberFormat, show the ends, size 2, bold text and text colour", () => {
  const svg = cellOf(
    render([0.902, 0.905, 0.915], {
      minValue: 0.88,
      maxValue: 0.93,
      numberFormat: { digits: 3 },
      showMinMax: true,
      size: 2,
      boldText: true,
      textColor: "#333333",
    }),
    1,
  );
  expect(svg).toContain('width="100" height="74"');
  expect(svg).toMatch(/class="sdvt-min"[^>]*>0.880<\/text>/);
  expect(svg).toMatch(/class="sdvt-max"[^>]*>0.930<\/text>/);
  expect(svg).toMatch(/class="sdvt-value"[^>]*fill="#333333" font-weight="bold">0.905<\/text>/);
  expect(
    cellOf(render([0.915, 0.9], { numberFormat: { digits: 1, type: "percent", scale: 100 } })),
  ).toContain(">91.5%</text>");
});

test("several fill colours ramp over the column's range; team + league colours each row", async () => {
  expect(attr(cellOf(render([2, 10], { fill: ["#ff0000", "#0000ff"] }), 0), "path", "fill", 1)).toBe(
    "#ff0000",
  );
  expect(attr(cellOf(render([2, 6, 10], { fill: ["#ff0000", "#0000ff"] }), 1), "path", "fill", 1)).toBe(
    "#800080",
  );
  const spec = defineTable<Standing>()
    .columns((c) => [c.gauge("wins", { team: "team", league: "nfl", opacity: 0.5, maxValue: 17 })])
    .build();
  await prepare(spec);
  const out = renderHTML(spec, STANDINGS, { css: "none" });
  expect(attr(cellOf(out, 0, "wins"), "path", "fill", 1)).toBe("#e31837"); // KC red, 15 of 17
  expect(attr(cellOf(out, 3, "wins"), "path", "fill", 1)).toBe("#000000"); // LV black
  expect(cellOf(out, 0, "wins")).toContain('fill-opacity="0.5"');
});

test("build() rejects bad size, bias, opacity, fill and bounds; a lone minValue above the column throws per row", () => {
  const bad = (o: Record<string, unknown>, match: RegExp): void => {
    expect(() =>
      defineTable<Row>()
        .columns((c) => [c.gauge("g", o as Opts)])
        .build(),
    ).toThrow(match);
  };
  bad({ size: 0 }, /column "g": gauge size must be a positive finite number/);
  bad({ bias: -1 }, /bias/);
  bad({ opacity: 2 }, /opacity must be between 0 and 1/);
  bad({ fill: [] }, /fill needs at least one colour/);
  bad({ minValue: 1, maxValue: 1 }, /minValue must be below maxValue/);
  expect(() => render([1, 2], { minValue: 5 })).toThrow(/row 0: gauge minValue 5 is above/);
});

// ---- self-review follow-ups (#68)

test("mixed negatives with showMinMax: the scale is 0 to max |v|, ends printed, each negative's |v| gauged", () => {
  const out = render([-8, 4, -2], { showMinMax: true });
  const svg = cellOf(out, 2);
  expect(svg).toContain('aria-label="Gauge: -2 (its absolute value, 2, is gauged) on a scale from 0 to 8"');
  expect(svg).toMatch(/class="sdvt-min"[^>]*>0<\/text>/);
  expect(svg).toMatch(/class="sdvt-max"[^>]*>8<\/text>/);
  expect(svg).toMatch(/class="sdvt-value"[^>]*>-2<\/text>/);
  // a quarter of the way round: the same arc as +2
  expect(attr(svg, "path", "d", 1)).toBe(
    attr(cellOf(render([8, 4, 2], { showMinMax: true }), 2), "path", "d", 1),
  );
  expect(cellOf(out, 0)).toContain(
    'aria-label="Gauge: -8 (its absolute value, 8, is gauged) on a scale from 0 to 8"',
  );
});

test("a negative minValue is rejected at build() and at render, naming the option", () => {
  expect(() =>
    defineTable<Row>()
      .columns((c) => [c.gauge("g", { minValue: -10 })])
      .build(),
  ).toThrow(/column "g": gauge minValue must be at least 0/);
  const col = {
    ...defineTable<Row>()
      .columns((c) => [c.gauge("g")])
      .build().columns[0],
    minValue: -10,
  };
  const spec = { columns: [col], decorations: [], theme: { name: "sdv", density: "comfortable" } } as never;
  expect(() => renderHTML(spec, [{ team: "LV", g: 5 }], { css: "none" })).toThrow(
    /gauge minValue must be at least 0/,
  );
});

test("background, textColor and textSize are CSS values: url( and quotes are rejected, naming the option", () => {
  expect(() => render([1, 2], { background: "url(https://x)" })).toThrow(/gauge background/);
  expect(() => render([1, 2], { textColor: 'red" onload="x' })).toThrow(/gauge textColor/);
  expect(() => render([1, 2], { textSize: "url(x)" })).toThrow(/gauge textSize/);
  expect(() => render([1, 2], { fill: ['#fff" onload="x'] })).toThrow(/gauge fill/);
});
