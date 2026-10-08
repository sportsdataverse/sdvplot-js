// @vitest-environment node
import { expect, test } from "vitest";
import columns from "../../../../fixtures/shots/nba-2026-bkn-2000-columns.json" with { type: "json" };
import { hexagonPoints } from "../../src/bins/hexbin.js";
import {
  type Binner,
  type BinnerOptions,
  binner,
  cellPath,
  cellPoints,
  hexagonPath,
  hexbin,
  squarePath,
  squarebin,
} from "../../src/bins/index.js";
import { squarePoints } from "../../src/bins/squarebin.js";
import { InputError } from "../../src/errors.js";

/** The 2000 real BKN shot locations, legacy tenths (integers, so a side of 10 puts real shots ON cell edges). */
const POINTS = columns.x_legacy.map((x, i) => ({ x, y: columns.y_legacy[i] as number }));
type P = (typeof POINTS)[number];
const X = (p: P): number => p.x;
const Y = (p: P): number => p.y;
const EQ15 = 15 * Math.sqrt(1.5 * Math.sqrt(3)); // the equal-area side for a radius-15 hexagon
/** Shoelace area of a polygon. */
const area = (pts: readonly (readonly [number, number])[]): number =>
  Math.abs(
    pts.reduce((s, [x, y], i) => {
      const [x2, y2] = pts[(i + 1) % pts.length] as readonly [number, number];
      return s + x * y2 - x2 * y;
    }, 0),
  ) / 2;

test("squarebin on the real shots: all 2000 counted once, each inside its half-open cell", () => {
  for (const [side, cells] of [
    [10, 641],
    [15, 395],
    [EQ15, 214],
  ] as const) {
    const bins = squarebin(POINTS, { side, x: X, y: Y });
    expect(bins).toHaveLength(cells);
    expect(bins.reduce((n, b) => n + b.length, 0)).toBe(2000);
    expect(new Set(bins.flat())).toHaveProperty("size", 2000);
    const h = side / 2;
    const outside = bins.flatMap((b) =>
      b.filter((p) => !(p.x >= b.x - h && p.x < b.x + h && p.y >= b.y - h && p.y < b.y + h)),
    );
    expect(outside).toEqual([]);
  }
});
test("centres sit on the lattice (i·side, j·side), are distinct, never -0, and bins come in first-seen order", () => {
  const side = 15;
  const bins = squarebin(POINTS, { side, x: X, y: Y });
  for (const b of bins) {
    expect(Number.isInteger(b.x / side) && Number.isInteger(b.y / side)).toBe(true);
    expect(Object.is(b.x, -0) || Object.is(b.y, -0)).toBe(false);
  }
  expect(new Set(bins.map((b) => `${b.x},${b.y}`)).size).toBe(bins.length);
  const firstSeen = bins.map((b) => POINTS.indexOf(b[0] as P));
  expect(firstSeen).toEqual([...firstSeen].sort((a, b) => a - b));
  expect(squarebin(POINTS, { side, x: X, y: Y })).toEqual(bins); // deterministic
});
test("the edge rule: a shot exactly on a cell edge goes to the higher cell (Math.round, as d3-hexbin rounds)", () => {
  const bins = squarebin(POINTS, { side: 10, x: X, y: Y });
  const onX = bins.flatMap((b) => b.filter((p) => ((p.x % 10) + 10) % 10 === 5).map((p) => b.x - p.x));
  const onY = bins.flatMap((b) => b.filter((p) => ((p.y % 10) + 10) % 10 === 5).map((p) => b.y - p.y));
  expect([onX.length, onY.length]).toEqual([204, 202]); // real shots on a vertical / horizontal edge
  expect(new Set([...onX, ...onY])).toEqual(new Set([5])); // each centre is half a side ABOVE the shot
  const rim = bins.find((b) => b.x === 0 && b.y === 0);
  expect(rim).toHaveLength(76); // [-5, 5) x [-5, 5): x = -5 is in, x = 5 is the next cell's
});
test("empty input gives []; a NaN coordinate is skipped; a non-positive side throws", () => {
  expect(squarebin([], { side: 10, x: X, y: Y })).toEqual([]);
  expect(binner({ shape: "square", side: 10 }).bins([], { x: X, y: Y })).toEqual([]);
  expect(squarebin([{ x: Number.NaN, y: 0 }, ...POINTS.slice(0, 1)], { side: 10, x: X, y: Y })).toHaveLength(
    1,
  );
  expect(() => squarebin(POINTS, { side: 0, x: X, y: Y })).toThrow(/side/);
  expect(() => binner({ radius: -1 })).toThrow(/radius/);
});
test("binner validation names the option the caller passed; non-finite sizes and unknown shapes throw InputError", () => {
  const bad =
    (o: unknown): (() => Binner) =>
    () =>
      binner(o as BinnerOptions);
  expect(bad({ shape: "square", radius: -1, equalArea: true })).toThrow(/^binner radius must be .*, got -1$/);
  for (const v of [Number.POSITIVE_INFINITY, Number.NaN, 0]) {
    expect(bad({ radius: v })).toThrow(InputError);
    expect(bad({ radius: v })).toThrow(/^binner radius /);
    expect(bad({ shape: "hex", radius: v })).toThrow(/^binner radius /);
    expect(bad({ shape: "square", side: v })).toThrow(/^binner side /);
    expect(bad({ shape: "square", radius: v, equalArea: true })).toThrow(/^binner radius /);
  }
  expect(bad({ shape: "circle", radius: 10 })).toThrow(InputError);
  expect(bad({ shape: "circle", radius: 10 })).toThrow(
    /^binner shape must be "hex" or "square", got circle$/,
  );
  expect(bad({ shape: "square", radius: 10 })).toThrow(
    /^binner square needs side, or radius with equalArea: true/,
  );
});
test("squarePath is a relative path for the translate-per-bin drawing; cellPath / cellPoints switch by shape", () => {
  expect(squarePath(15)).toBe("m-7.5,-7.5h15v15h-15z");
  expect(squarePoints(15)).toEqual([
    [-7.5, -7.5],
    [7.5, -7.5],
    [7.5, 7.5],
    [-7.5, 7.5],
  ]);
  expect(cellPath("hex", 15)).toBe(hexagonPath(15));
  expect(cellPath("square", 15)).toBe(squarePath(15));
  expect(cellPoints("hex", 15)).toEqual(hexagonPoints(15));
  expect(cellPoints("square", 15)).toEqual(squarePoints(15));
});
test("equal area: side = r·√(3√3/2), the area of the drawn hexagon", () => {
  for (const r of [10, 15]) {
    const b = binner({ shape: "square", radius: r, equalArea: true });
    expect(b.size).toBeCloseTo(r * Math.sqrt((3 * Math.sqrt(3)) / 2), 12);
    expect(area(squarePoints(b.size))).toBeCloseTo(area(hexagonPoints(r)), 9);
    expect(area(hexagonPoints(r))).toBeCloseTo(((3 * Math.sqrt(3)) / 2) * r * r, 9);
    expect(b.lattice).toEqual({ shape: "square", side: b.size });
  }
  expect(binner({ shape: "square", radius: 15, equalArea: true }).size).toBeCloseTo(24.1778, 4);
});
test("binner: { radius } is exactly Task 3's hexbin, { shape: 'square' } exactly squarebin", () => {
  for (const radius of [10, 15]) {
    const want = hexbin(POINTS, { radius, x: X, y: Y });
    for (const h of [binner({ radius }), binner({ shape: "hex", radius })]) {
      const got = h.bins(POINTS, { x: X, y: Y });
      expect(got.map((b) => [b.x, b.y, ...b])).toEqual(want.map((b) => [b.x, b.y, ...b]));
      expect([h.shape, h.size, h.lattice, h.cell()]).toEqual([
        "hex",
        radius,
        { radius },
        hexagonPath(radius),
      ]);
    }
  }
  const s = binner({ shape: "square", side: 15 });
  const got = s.bins(POINTS, { x: X, y: Y });
  expect(got.map((b) => [b.x, b.y, ...b])).toEqual(
    squarebin(POINTS, { side: 15, x: X, y: Y }).map((b) => [b.x, b.y, ...b]),
  );
  expect([s.shape, s.size, s.cell(), s.cell(4)]).toEqual(["square", 15, squarePath(15), squarePath(4)]);
  // equal-area squares vs hexagons at main's two radii: 378 vs 374 cells at r = 10, 214 vs 211 at r = 15
  const n = (r: number, sq: boolean): number =>
    binner(sq ? { shape: "square", radius: r, equalArea: true } : { radius: r }).bins(POINTS, { x: X, y: Y })
      .length;
  expect([n(10, true), n(10, false), n(15, true), n(15, false)]).toEqual([378, 374, 214, 211]);
});
