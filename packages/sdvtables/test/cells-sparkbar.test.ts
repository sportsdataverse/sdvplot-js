// test/cells-sparkbar.test.ts — reactablefmtr react_sparkbar as inline SVG; expected geometry from sdvplot's
// tests/test_reactable_charts.py, so the two ports draw the same bars.
import { expect, test } from "vitest";
import { defineTable } from "../src/define.js";
import { prepare, renderHTML } from "../src/html/index.js";
import type { ColumnSpec } from "../src/spec.js";

type Row = { team: string; s: readonly (number | null)[] | null };
type Opts = Partial<Omit<Extract<ColumnSpec<Row>, { kind: "sparkbar" }>, "kind" | "key">>;
const cellOf = (html: string, row = 0): string =>
  new RegExp(`data-row="${row}">.*?<td[^>]*data-col="s"[^>]*>(.*?)</td>`, "s").exec(html)?.[1] ?? "";
const draw = (s: Row["s"], o: Opts = {}): string =>
  cellOf(
    renderHTML(
      defineTable<Row>()
        .columns((c) => [c.sparkbar("s", o)])
        .build(),
      [{ team: "LAR", s }],
      { css: "none" },
    ),
  );
const bars = (svg: string): string[][] =>
  [...svg.matchAll(/<rect class="sdvt-bar" x="([^"]+)" y="([^"]+)" width="([^"]+)" height="([^"]+)"/g)].map(
    (m) => m.slice(1),
  );

test("bars stand on zero: positives rise from it, negatives hang below it", () => {
  const svg = draw([2, -1]);
  // margins t3 r13 b0 l13: x 13..87, y 3..22; zero sits at y 15.67, two thirds of the way down from 2 to -1
  expect(bars(svg)).toEqual([
    ["16.7", "3", "29.6", "12.67"],
    ["53.7", "15.67", "29.6", "6.33"],
  ]);
  expect(svg).toContain('aria-label="Bar chart of 2 values: min -1, max 2, last -1"');
  expect(svg).toContain('role="img"');
  expect(bars(draw([5, 10]))[0]?.[3]).toBe("9.5"); // the smaller bar still shows (dataui drew it 0 tall)
});

test("highlightBars, labels above the bars in currentColor, statline", () => {
  const svg = draw([1, 4, 2], {
    highlightBars: { max: "gold", first: "black" },
    labels: ["max"],
    statline: "mean",
  });
  expect([...svg.matchAll(/class="sdvt-bar"[^>]*fill="([^"]+)"/g)].map((m) => m[1])).toEqual([
    "black",
    "gold",
    "slategray",
  ]);
  expect(svg).toMatch(/class="sdvt-label"[^>]*fill="currentColor"[^>]*>4<\/text>/);
  expect(svg).toContain('class="sdvt-statline"');
  expect(draw([1, 2], { labels: ["max"], statline: "mean", bandline: "range", decimals: 1 })).toContain(
    'aria-label="Bar chart of 2 values: min 1, max 2, last 2; mean line at 1.5; band over the range"',
  );
});

test("gaps leave an empty slot; all-missing, empty and non-array cells are blank; no NaN or Infinity in the SVG", () => {
  expect(draw([1, null, 2]).match(/class="sdvt-bar"/g)).toHaveLength(2);
  expect(draw([null, null])).toBe("");
  expect(draw([])).toBe("");
  expect(draw(null)).toBe("");
  const svg = draw([1, Number.NEGATIVE_INFINITY, 2, Number.NaN]);
  expect(svg).not.toMatch(/NaN|Infinity/);
  expect(svg.match(/class="sdvt-bar"/g)).toHaveLength(2);
});

test("team + league fill per row (contrast-checked), fillOpacity; colorRef wins over team", async () => {
  const spec = defineTable<Row>()
    .columns((c) => [c.sparkbar("s", { team: "team", league: "nfl", which: "secondary", fillOpacity: 0.5 })])
    .build();
  await prepare(spec);
  const svg = cellOf(renderHTML(spec, [{ team: "LAR", s: [1, 2, 3] }], { css: "none" }));
  // the Rams' secondary gold (#ffd100 in this index) is under 3:1 on white, so the bars take their primary navy
  expect(
    new Set([...svg.matchAll(/class="sdvt-bar"[^>]*fill="([^"]+)" fill-opacity="0.5"/g)].map((m) => m[1])),
  ).toEqual(new Set(["#003594"]));
  const dark = defineTable<Row>()
    .columns((c) => [c.sparkbar("s", { team: "team", league: "nfl", which: "secondary" })])
    .theme("fmtr-dark")
    .build();
  expect(cellOf(renderHTML(dark, [{ team: "LAR", s: [1, 2] }], { css: "none" }))).toContain('fill="#ffd100"'); // gold reads on dark
  type Ref = { team: string; s: number[]; c: string };
  const ref = defineTable<Ref>()
    .columns((c) => [c.sparkbar("s", { colorRef: "c", team: "team", league: "nfl" })])
    .build();
  await prepare(ref);
  expect(cellOf(renderHTML(ref, [{ team: "LAR", s: [1, 2], c: "#00ff00" }], { css: "none" }))).toContain(
    'fill="#00ff00"',
  );
});

test("bounds: fixed minValue/maxValue, min >= max rejected at build(), one crossing bound rejected per row", () => {
  const fixed = bars(draw([1, 2], { minValue: 0, maxValue: 4 }));
  expect(fixed[1]?.[1]).toBe("12.5"); // 2 of 4, half way down y 3..22
  expect(() =>
    defineTable<Row>()
      .columns((c) => [c.sparkbar("s", { minValue: 1, maxValue: 0 })])
      .build(),
  ).toThrow(/column "s": sparkbar minValue must be below maxValue/);
  expect(() =>
    defineTable<Row>()
      .columns((c) => [c.sparkbar("s", { fillOpacity: 1.5 })])
      .build(),
  ).toThrow(/fillOpacity must be between 0 and 1/);
  expect(() => draw([-5, -2], { minValue: 1 })).toThrow(/row 0: minValue\/maxValue cross/);
});

test("a hand-written spec that skips build() is still checked before its numbers reach the SVG", () => {
  const col = {
    ...defineTable<Row>()
      .columns((c) => [c.sparkbar("s")])
      .build().columns[0],
    chartWidth: '1" onload="x',
  };
  const spec = { columns: [col], decorations: [], theme: { name: "sdv", density: "comfortable" } } as never;
  expect(() => renderHTML(spec, [{ team: "LAR", s: [1, 2] }], { css: "none" })).toThrow(/chartWidth/);
});
