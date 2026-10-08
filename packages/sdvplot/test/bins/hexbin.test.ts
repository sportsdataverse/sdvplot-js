// @vitest-environment node
import { expect, test } from "vitest";
import columns from "../../../../fixtures/shots/nba-2026-bkn-2000-columns.json" with { type: "json" };
import ORACLE from "../../../../fixtures/shots/oracle.json" with { type: "json" };
import pkg from "../../package.json" with { type: "json" };
import * as bins from "../../src/bins/index.js";
import { hexagonPath, hexbin } from "../../src/bins/index.js";
import * as shots from "../../src/shots/index.js";

/** The 2000 real BKN shot locations, legacy tenths. */
const POINTS = columns.x_legacy.map((x, i) => ({ x, y: columns.y_legacy[i] as number }));

test("the ./bins and ./shots subpaths are exported, and shots re-exports every binner", () => {
  expect(pkg.exports["./bins"]).toEqual({ types: "./dist/bins.d.ts", import: "./dist/bins.js" });
  expect(pkg.exports["./shots"]).toEqual({ types: "./dist/shots.d.ts", import: "./dist/shots.js" });
  for (const [name, fn] of Object.entries(bins)) expect(shots).toHaveProperty(name, fn);
});
test("hexbin: d3-hexbin's lattice on the real shots: main's 1 ft hexes, same centres, counts and order", () => {
  const bins = hexbin(POINTS, { radius: 10, x: (p) => p.x, y: (p) => p.y });
  expect(bins.map((b) => [b.x, b.y, b.length])).toEqual(ORACLE.main.hex10.map((h) => [h.x, h.y, h.attempts]));
  expect(bins.some((b) => Object.is(b.x, -0) || Object.is(b.y, -0))).toBe(false); // aggregate.ts:101 folds -0
  expect(() => hexbin(POINTS, { radius: 0, x: (p) => p.x, y: (p) => p.y })).toThrow(/radius/);
});
test("hexbin: exact ties go where d3-hexbin 0.2.2 sends them (edges of the radius-10 lattice)", () => {
  // The real shots never sit on a tie at radius 10 (integer tenths vs dx = 10√3), so the tie rules are pinned on
  // the lattice's own edge points: x = k·dx/4 and y = k·dy/2 are exact in floating point, so every one is a TRUE
  // tie. Expected centres are d3-hexbin 0.2.2's own output for these points (unpkg src/hexbin.js, sha256 4baa277b…),
  // -0 folded to 0. Vertical edges test Math.round(px) (ties up); slanted-edge midpoints test Math.round(py) and the
  // strict `>` of the Voronoi step (hexbin.js:33-34, :43).
  const dx = 10 * 2 * Math.sin(Math.PI / 3);
  const dy = 15;
  const ties: [number, number][] = [
    [dx / 2, 0],
    [-dx / 2, 0],
    [0, dy],
    [0, -dy],
    [dx / 4, dy / 2],
    [-dx / 4, dy / 2],
    [dx / 4, -dy / 2],
    [-dx / 4, -dy / 2],
    [(3 * dx) / 4, dy / 2],
    [(-3 * dx) / 4, dy / 2],
    [(3 * dx) / 4, -dy / 2],
    [(-3 * dx) / 4, -dy / 2],
  ];
  const D3_HEXBIN_0_2_2: [number, number][] = [
    [17.32050807568877, 0],
    [0, 0],
    [8.660254037844386, 15],
    [8.660254037844386, -15],
    [8.660254037844386, 15],
    [-8.660254037844386, 15],
    [0, 0],
    [0, 0],
    [8.660254037844386, 15],
    [-8.660254037844386, 15],
    [17.32050807568877, 0],
    [-17.32050807568877, 0],
  ];
  const got = hexbin(ties, { radius: 10, x: (p) => p[0], y: (p) => p[1] });
  expect(ties.map((p) => got.find((b) => b.includes(p))).map((b) => [b?.x, b?.y])).toEqual(D3_HEXBIN_0_2_2);
  // d3-hexbin's bin order and counts for the same input
  expect(got.map((b) => [b.x, b.y, b.length])).toEqual([
    [17.32050807568877, 0, 2],
    [0, 0, 3],
    [8.660254037844386, 15, 3],
    [8.660254037844386, -15, 1],
    [-8.660254037844386, 15, 2],
    [-17.32050807568877, 0, 1],
  ]);
});
test("hexbin skips a NaN coordinate, as d3-hexbin does (hexbin.js:27-28)", () => {
  expect(
    hexbin([{ x: Number.NaN, y: 0 }, ...POINTS.slice(0, 1)], { radius: 10, x: (p) => p.x, y: (p) => p.y }),
  ).toHaveLength(1);
});
test("hexagonPath is byte-identical to d3-hexbin's hexagon(r)", () => {
  for (const { r, d } of ORACLE.main.hexagon) expect(hexagonPath(r)).toBe(d);
});
