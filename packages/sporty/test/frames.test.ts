import { readFileSync } from "node:fs";
import { expect, test } from "vitest";
import { type Frame, frameBottomLeft, toSurfaceFrame } from "../src/frames.js";
import { HOCKEY_SPECS } from "../src/specs/hockey.js";

// Real PWHL game 42 (2024-03-02): every shot/goal/faceoff/hit with its canvas x/y (fixtures/hockeytech/README.md).
const pwhl42 = JSON.parse(
  readFileSync(new URL("../../../fixtures/hockeytech/pwhl_pbp_42_coords.json", import.meta.url), "utf8"),
) as { event: string; x: number; y: number }[];

test("nba-legacy: (x=0,y=0) is the hoop at (−41.75, 0); nulls pass through (Review Focus 5)", () => {
  const out = toSurfaceFrame(
    [
      { x_legacy: 0, y_legacy: 0 },
      { x_legacy: null, y_legacy: 50 },
    ],
    {
      from: "nba-legacy",
      x: "x_legacy",
      y: "y_legacy",
    },
  );
  expect(out[0]!.surface_x).toBeCloseTo(-41.75, 12);
  expect(out[0]!.surface_y).toBe(0);
  expect(out[1]!.surface_x).toBeCloseTo(-36.75, 12);
  expect(out[1]!.surface_y).toBeNull();
  expect(Number.isNaN(out[1]!.surface_y as number)).toBe(false);
});

test("nba-legacy defaults to x_legacy/y_legacy columns; numeric strings coerce, junk is null", () => {
  const out = toSurfaceFrame(
    [
      { x_legacy: "-224", y_legacy: " 39 " },
      { x_legacy: "", y_legacy: "abc" },
    ],
    { from: "nba-legacy" },
  );
  expect(out[0]!.surface_y).toBeCloseTo(-22.4, 12);
  expect(out[0]!.surface_x).toBeCloseTo(-41.75 + 3.9, 12);
  expect(out[1]).toMatchObject({ surface_x: null, surface_y: null });
});

test("bottom-left(200,85): (100, 42.5) is centre ice", () => {
  expect(toSurfaceFrame([{ x: 100, y: 42.5 }], { from: frameBottomLeft(200, 85) })[0]).toMatchObject({
    surface_x: 0,
    surface_y: 0,
  });
});

test("hockeytech, real PWHL game 42: the 8 centre-ice faceoffs at (300,150) map to (0,0)", () => {
  const centre = pwhl42.filter((e) => e.event === "faceoff" && e.x === 300 && e.y === 150);
  expect(centre).toHaveLength(8);
  for (const r of toSurfaceFrame(centre, { from: "hockeytech" })) {
    expect(r).toMatchObject({ surface_x: 0, surface_y: 0 });
  }
});

test("hockeytech, real PWHL game 42: all 139 events, extremes included, land inside the PWHL rink", () => {
  const { rink_length, rink_width, corner_radius } = HOCKEY_SPECS.pwhl;
  const hx = rink_length / 2;
  const hy = rink_width / 2;
  // Inside the boards: the rectangle with its corners rounded at corner_radius.
  const inside = (x: number, y: number): boolean =>
    Math.abs(x) <= hx &&
    Math.abs(y) <= hy &&
    Math.hypot(
      Math.max(Math.abs(x) - (hx - corner_radius), 0),
      Math.max(Math.abs(y) - (hy - corner_radius), 0),
    ) <= corner_radius;
  const out = toSurfaceFrame(pwhl42, { from: "hockeytech" });
  expect(out).toHaveLength(139);
  for (const r of out) expect(inside(r.surface_x!, r.surface_y!), JSON.stringify(r)).toBe(true);
  // The observed extremes: x 9..589, y 3..297 (all four are hits along the boards).
  const xs = pwhl42.map((e) => e.x);
  const ys = pwhl42.map((e) => e.y);
  expect([Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)]).toEqual([9, 589, 3, 297]);
  const ext = toSurfaceFrame(
    [
      { x: 9, y: 75 },
      { x: 589, y: 213 },
      { x: 507, y: 3 },
      { x: 105, y: 297 },
    ],
    { from: "hockeytech" },
  );
  expect(ext[0]!.surface_x).toBeCloseTo(-97, 12);
  expect(ext[1]!.surface_x).toBeCloseTo(96.333333333333, 9);
  expect(ext[2]!.surface_y).toBeCloseTo(41.65, 12);
  expect(ext[3]!.surface_y).toBeCloseTo(-41.65, 12);
});

test('the 850x400 "hockeytech-a" frame is gone: a type error, and a throw at runtime', () => {
  // @ts-expect-error -- no HockeyTech feed ships an 850x400 canvas; "hockeytech" is the only HockeyTech frame
  expect(() => toSurfaceFrame([{ x: 425, y: 200 }], { from: "hockeytech-a" })).toThrow(TypeError);
});

test("hockeytech: centre (300,150) -> (0,0); right edge (600,150) -> (100,0); top-left (0,0) -> (-100, 42.5)", () => {
  const out = toSurfaceFrame(
    [
      { x: 300, y: 150 },
      { x: 600, y: 150 },
      { x: 0, y: 0 },
    ],
    { from: "hockeytech" },
  );
  expect(out[0]).toMatchObject({ surface_x: 0, surface_y: 0 });
  expect(out[1]).toMatchObject({ surface_x: 100, surface_y: 0 });
  expect(out[2]!.surface_x).toBeCloseTo(-100, 12);
  expect(out[2]!.surface_y).toBeCloseTo(42.5, 12);
});

test("espn-football-0-100: yardline 25 -> surface_x -25; y passes through", () => {
  const out = toSurfaceFrame(
    [
      { x: 25, y: 10 },
      { x: null, y: 3 },
    ],
    { from: "espn-football-0-100" },
  );
  expect(out[0]).toMatchObject({ surface_x: -25, surface_y: 10 });
  expect(out[1]).toMatchObject({ surface_x: null, surface_y: 3 });
});

test("custom Frame receives the {x, y} view of the chosen columns", () => {
  const f: Frame = { x: (r) => (r.x as number) * 2, y: (r) => (r.y as number) + 1, description: "test" };
  const out = toSurfaceFrame([{ px: 3, py: 4, keep: "me" }], { from: f, x: "px", y: "py" });
  expect(out[0]).toMatchObject({ surface_x: 6, surface_y: 5, keep: "me" });
});

test("out renames output columns; input rows are not mutated", () => {
  const rows = [{ x: 300, y: 150 }];
  const out = toSurfaceFrame(rows, { from: "hockeytech", out: { x: "sx" } });
  expect(out[0]).toMatchObject({ sx: 0, surface_y: 0 });
  expect(out[0]).not.toHaveProperty("surface_x");
  expect(out).not.toBe(rows);
  expect(out[0]).not.toBe(rows[0]);
  expect(rows[0]).toEqual({ x: 300, y: 150 });
});
