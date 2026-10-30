// Feature polygons are simple closed rings: a port of sportyR 2.4.5's tests/testthat/test-feature-validity.R (sportyR
// #79/#85, #89, #90). Each fix-specific test failed on the pre-2.4.5 port.
import { describe, expect, test } from "vitest";
import * as H from "../src/hockey/features.js";
import { hockeyRink } from "../src/hockey/rink.js";
import * as X from "../src/lacrosse/features.js";
import { lacrosseField } from "../src/lacrosse/field.js";
import type { Point, PolygonFeature, Scene } from "../src/scene.js";
import { createSquare, hasArea, splitRings } from "../src/shapes.js";
import { HOCKEY_LEAGUES, HOCKEY_SPECS } from "../src/specs/hockey.js";
import { LACROSSE_LEAGUES, LACROSSE_SPECS } from "../src/specs/lacrosse.js";

const side = (a: Point, b: Point, c: Point): number =>
  (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);

/** Pairs of non-adjacent edges of a closed ring that strictly cross (R `count_crossings`). */
function countCrossings(ring: readonly Point[], tol = 1e-9): number {
  const n = ring.length - 1;
  let crossings = 0;
  for (let i = 0; i < n - 2; i++) {
    for (let j = i + 2; j < n; j++) {
      if (i === 0 && j === n - 1) continue;
      const [ai, bi, aj, bj] = [ring[i]!, ring[i + 1]!, ring[j]!, ring[j + 1]!];
      if (
        side(ai, bi, aj) * side(ai, bi, bj) < -(tol ** 2) &&
        side(aj, bj, ai) * side(aj, bj, bi) < -(tol ** 2)
      )
        crossings++;
    }
  }
  return crossings;
}

/** Vertices where a ring turns straight back along the edge it came in on (R `count_reversals`). */
function countReversals(ring: readonly Point[], tol = 1e-9): number {
  const [f, l] = [ring[0]!, ring[ring.length - 1]!];
  const closed = Math.abs(f[0] - l[0]) > tol || Math.abs(f[1] - l[1]) > tol ? [...ring, f] : ring;
  const v = closed.slice(0, -1);
  return v.filter((p, i) => {
    const prev = v[(i - 1 + v.length) % v.length]!;
    const next = v[(i + 1) % v.length]!;
    const inc = [p[0] - prev[0], p[1] - prev[1]] as const;
    const out = [next[0] - p[0], next[1] - p[1]] as const;
    const cross = inc[0] * out[1] - inc[1] * out[0];
    const dot = inc[0] * out[0] + inc[1] * out[1];
    return Math.abs(cross) <= tol * Math.hypot(...inc) * Math.hypot(...out) && dot < 0;
  }).length;
}

const area = (ring: readonly Point[]): number =>
  Math.abs(ring.slice(0, -1).reduce((s, [x, y], i) => s + x * ring[i + 1]![1] - ring[i + 1]![0] * y, 0)) / 2;
const polygons = (s: Scene): PolygonFeature[] =>
  s.features.filter((f): f is PolygonFeature => f.kind === "polygon");
const crossingRings = (s: Scene): string[] =>
  polygons(s).flatMap((f) => (splitRings(f.points).some((r) => countCrossings(r) > 0) ? [f.name] : []));
const closesOnFirst = (pts: readonly Point[]): void => {
  expect(pts[pts.length - 1]![0]).toBeCloseTo(pts[0]![0], 9);
  expect(pts[pts.length - 1]![1]).toBeCloseTo(pts[0]![1], 9);
};

test("ring checks catch crossed and retraced rings", () => {
  expect(
    countCrossings([
      [0, 0],
      [1, 1],
      [1, 0],
      [0, 1],
      [0, 0],
    ]),
  ).toBe(1);
  expect(
    countReversals([
      [0, 0],
      [2, 0],
      [1, 0],
      [1, 1],
      [0, 0],
    ]),
  ).toBe(1);
  expect(countReversals(createSquare(2))).toBe(0);
});

test("the NHL trapezoid is two simple strips from the goal line", () => {
  const df = H.goaltendersRestrictedArea({
    rinkLength: 200,
    featureThickness: 2 / 12,
    shortBaseWidth: 22,
    longBaseWidth: 28,
    xAnchor: 89,
  });
  const rings = splitRings(df);
  expect(rings.map((r) => r.length)).toEqual([5, 5]);
  expect(rings.map((r) => countCrossings(r))).toEqual([0, 0]);
  expect(rings.map((r) => countReversals(r))).toEqual([0, 0]);
});

test("the mirrored faceoff lines keep their thickness on the same side", () => {
  const s = hockeyRink("nhl", { arcResolution: 1000, colorUpdates: { faceoff_line: "#123456" } });
  expect(crossingRings(s)).toEqual([]);
  const lines = polygons(s).filter((f) => f.fill === "#123456");
  expect(lines).toHaveLength(8);
  const areas = lines.map((f) => splitRings(f.points).reduce((a, r) => a + area(r), 0));
  for (const a of areas) expect(a).toBeCloseTo(areas[0]!, 9);
  for (const f of lines) expect(splitRings(f.points).map((r) => r.length)).toEqual([7, 7]);
});

test("the NHL goal crease's inner arc meets the inner straight sides", () => {
  const df = H.goalCreaseOutline({
    featureRadius: 6,
    featureThickness: 2 / 12,
    creaseStyle: "nhl98",
    creaseLength: 4.5,
    creaseWidth: 8,
    notchDistX: 4,
    notchWidth: 0.5,
  });
  expect(splitRings(df).reduce((a, r) => a + countCrossings(r), 0)).toBe(0);
  const inner = 6 - 2 / 12;
  // exactly on the sides: rounding 4e-16 ft across them would leave a sliver a renderer's crossing test splits off
  const corners = df.filter(
    ([x, y]) => Math.abs(y) === 4 - 2 / 12 && Math.abs(Math.hypot(x, y) - inner) < 1e-9,
  );
  expect(corners).toHaveLength(2);
});

test("circle-based hockey features are simple closed rings", () => {
  const circle = H.centerFaceoffCircle({ featureRadius: 15, featureThickness: 2 / 12 });
  expect(countCrossings(circle)).toBe(0);
  expect(countReversals(circle)).toBe(0);
  expect(circle[circle.length - 1]).toEqual(circle[0]);
  const rings = splitRings(H.nodzoneFaceoffSpotRing({ featureRadius: 1, featureThickness: 2 / 12 }));
  expect(rings).toHaveLength(2);
  expect(rings.map((r) => countCrossings(r))).toEqual([0, 0]);
});

test("lacrosse goal and bench outlines (and the hockey bench) close on their first point", () => {
  const goal = { goalFrameOpeningInterior: 4.75, goalPostThickness: 1 / 24, goalDepth: 3.82 };
  for (const df of [
    X.goalFrame(goal),
    X.goalNet(goal),
    X.playerBenchOutline({ benchAreaOutlineThickness: 0.25, benchLength: 20, benchDepth: 5 }),
    H.playerBenchOutline({ featureThickness: 0.25, benchLength: 20, benchDepth: 5 }),
  ]) {
    expect(df[df.length - 1]).toEqual(df[0]);
    expect(splitRings(df)).toHaveLength(1);
    expect(countCrossings(df)).toBe(0);
    expect(countReversals(df)).toBe(0);
    expect(hasArea(df)).toBe(true);
  }
});

test("the nhl92 goal crease is its arc band and two L-marks", () => {
  const d = HOCKEY_SPECS.ohl;
  const r = d.goal_crease_radius!;
  const inner = r - d.minor_line_thickness!;
  const df = H.goalCreaseOutline({
    featureRadius: r,
    featureThickness: d.minor_line_thickness,
    creaseStyle: d.goal_crease_style,
    creaseLength: d.goal_crease_length,
    creaseWidth: d.goal_crease_width,
    notchDistX: d.goal_crease_notch_dist_x,
    notchWidth: d.goal_crease_notch_width,
  });
  const rings = splitRings(df);
  expect(rings.map((ring) => ring.length)).toEqual([2001, 7, 7]);
  for (const ring of rings) {
    closesOnFirst(ring);
    expect(countCrossings(ring)).toBe(0);
    expect(countReversals(ring)).toBe(0);
    expect(hasArea(ring)).toBe(true);
  }
  // the band is a half annulus: every point on the outer or inner arc, and its area leaves out the hole
  const [band, lower, upper] = rings as [Point[], Point[], Point[]];
  const radii = band.map(([x, y]) => Math.hypot(x, y));
  expect(radii.every((q) => Math.abs(q - r) < 1e-9 || Math.abs(q - inner) < 1e-9)).toBe(true);
  expect(area(band)).toBeCloseTo((Math.PI * (r ** 2 - inner ** 2)) / 2, 4);
  // the L-marks are mirror images and sit inside the band's hole
  expect(upper).toEqual(lower.map(([x, y]) => [x, -y]));
  expect([...lower, ...upper].every(([x, y]) => Math.hypot(x, y) < inner)).toBe(true);
});

describe.each(HOCKEY_LEAGUES.filter((l) => l !== "custom"))("hockey %s", (league) => {
  test("every feature is a simple ring", () =>
    expect(crossingRings(hockeyRink(league, { arcResolution: 1000 }))).toEqual([]));
});

test("lacrosse goal mouth stubs end on the inner arc", () => {
  for (const league of ["ncaam", "ncaaw", "usaw"] as const) {
    const d = LACROSSE_SPECS[league];
    const t = d.goal_mouth_line_thickness!;
    const df = X.goalMouth({
      goalMouthRadius: d.goal_mouth_radius!,
      lineThickness: t,
      goalMouthSemiCircleSeparation: d.goal_mouth_semi_circle_separation ?? 0,
    });
    closesOnFirst(df);
    expect(
      splitRings(df).every((ring) => countCrossings(ring) === 0),
      league,
    ).toBe(true);
    expect(hasArea(df), league).toBe(true);
    const inner = d.goal_mouth_radius! - t;
    const corners = df.filter(
      ([x, y]) => Math.abs(x + t) < 1e-9 && Math.abs(Math.hypot(x, y) - inner) < 1e-9,
    );
    expect(corners, league).toHaveLength(2);
  }
});

test("custom lacrosse goal mouths are the band and stubs' union", () => {
  // ∫ sqrt(R² - x²) dx, for the parts of the stubs inside the band's hole
  const F = (x: number, R: number): number => (x * Math.sqrt(R * R - x * x) + R * R * Math.asin(x / R)) / 2;
  const expected = (radius: number, t: number, sep: number): number => {
    const ri = radius - t;
    if (ri <= 0) return (Math.PI * radius ** 2) / 2;
    const cx = -Math.min(t, Math.sqrt(Math.max(ri ** 2 - sep ** 2, 0)));
    const stub = cx < 0 ? 2 * (F(0, ri) - F(cx, ri) - sep * -cx) : 0;
    return (Math.PI * (radius ** 2 - ri ** 2)) / 2 + stub;
  };
  const cases: Record<string, [number, number, number]> = {
    thick_band: [1, 0.6, 0.2],
    thick_band_no_separation: [1, 0.6, 0],
    separation_past_stub_edge: [14.6, 0.101, 14.4995],
    separation_past_inner_arc: [3, 0.1, 2.95],
    thicker_than_radius: [1, 1.2, 0.3],
  };
  for (const [name, [radius, t, sep]] of Object.entries(cases)) {
    const ring = X.goalMouth({
      goalMouthRadius: radius,
      lineThickness: t,
      goalMouthSemiCircleSeparation: sep,
    });
    closesOnFirst(ring);
    expect(splitRings(ring), name).toHaveLength(1);
    expect(countCrossings(ring), name).toBe(0);
    expect(countReversals(ring), name).toBe(0);
    expect(area(ring), name).toBeCloseTo(expected(radius, t, sep), 4);
  }
});

describe.each(LACROSSE_LEAGUES.filter((l) => l !== "custom"))("lacrosse %s", (league) => {
  test("every feature is a simple ring", () =>
    expect(crossingRings(lacrosseField(league, { arcResolution: 1000 }))).toEqual([]));
});

test("no surface draws a feature with no area and no stroke", () => {
  for (const s of [hockeyRink("nhl"), lacrosseField("nll")])
    expect(polygons(s).filter((f) => f.stroke === undefined && !hasArea(f.points))).toEqual([]);
});
