// @vitest-environment node
import { expect, test } from "vitest";
import columns from "../../../../fixtures/shots/nba-2026-bkn-2000-columns.json" with { type: "json" };
import ORACLE from "../../../../fixtures/shots/oracle.json" with { type: "json" };
import pkg from "../../package.json" with { type: "json" };
import { hexagonPath, hexbin } from "../../src/shots/index.js";

/** The 2000 real BKN shot locations, legacy tenths. */
const POINTS = columns.x_legacy.map((x, i) => ({ x, y: columns.y_legacy[i] as number }));

test("the ./shots subpath is exported", () => {
  expect(pkg.exports["./shots"]).toEqual({ types: "./dist/shots.d.ts", import: "./dist/shots.js" });
});
test("hexbin: d3-hexbin's lattice on the real shots: main's 1 ft hexes, same centres, counts and order", () => {
  const bins = hexbin(POINTS, { radius: 10, x: (p) => p.x, y: (p) => p.y });
  expect(bins.map((b) => [b.x, b.y, b.length])).toEqual(ORACLE.main.hex10.map((h) => [h.x, h.y, h.attempts]));
  expect(bins.some((b) => Object.is(b.x, -0) || Object.is(b.y, -0))).toBe(false); // aggregate.ts:101 folds -0
  expect(() => hexbin(POINTS, { radius: 0, x: (p) => p.x, y: (p) => p.y })).toThrow(/radius/);
});
test("hexbin skips a NaN coordinate, as d3-hexbin does (hexbin.js:27-28)", () => {
  expect(
    hexbin([{ x: Number.NaN, y: 0 }, ...POINTS.slice(0, 1)], { radius: 10, x: (p) => p.x, y: (p) => p.y }),
  ).toHaveLength(1);
});
test("hexagonPath is byte-identical to d3-hexbin's hexagon(r)", () => {
  for (const { r, d } of ORACLE.main.hexagon) expect(hexagonPath(r)).toBe(d);
});
