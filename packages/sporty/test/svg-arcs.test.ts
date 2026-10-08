import { expect, test } from "vitest";
import { baseballField } from "../src/baseball/field.js";
import { basketballCourt } from "../src/basketball/court.js";
import { curlingSheet } from "../src/curling/sheet.js";
import { footballField } from "../src/football/field.js";
import { hockeyRink } from "../src/hockey/rink.js";
import { lacrosseField } from "../src/lacrosse/field.js";
import type { Point, Scene } from "../src/scene.js";
import { createCircle } from "../src/shapes.js";
import { soccerPitch } from "../src/soccer/pitch.js";
import { BASEBALL_LEAGUES } from "../src/specs/baseball.js";
import { BASKETBALL_LEAGUES } from "../src/specs/basketball.js";
import { CURLING_LEAGUES } from "../src/specs/curling.js";
import { FOOTBALL_LEAGUES } from "../src/specs/football.js";
import { HOCKEY_LEAGUES } from "../src/specs/hockey.js";
import { LACROSSE_LEAGUES } from "../src/specs/lacrosse.js";
import { SOCCER_LEAGUES } from "../src/specs/soccer.js";
import { TENNIS_LEAGUES } from "../src/specs/tennis.js";
import { VOLLEYBALL_LEAGUES } from "../src/specs/volleyball.js";
import { detectArcs, fmt, pathData, resampleArc } from "../src/svg-arcs.js";
import { toSVG } from "../src/svg.js";
import { tennisCourt } from "../src/tennis/court.js";
import { volleyballCourt } from "../src/volleyball/court.js";

// Same enumeration as parity.test.ts: 62 sport/league surfaces (the 9 `custom` leagues included; their bbox is degenerate but their paths are not).
const SURFACES: [sport: string, leagues: readonly string[], build: (league: string) => Scene][] = [
  ["basketball", BASKETBALL_LEAGUES, basketballCourt as (l: string) => Scene],
  ["hockey", HOCKEY_LEAGUES, hockeyRink as (l: string) => Scene],
  ["football", FOOTBALL_LEAGUES, footballField as (l: string) => Scene],
  ["soccer", SOCCER_LEAGUES, soccerPitch as (l: string) => Scene],
  ["tennis", TENNIS_LEAGUES, tennisCourt as (l: string) => Scene],
  ["baseball", BASEBALL_LEAGUES, baseballField as (l: string) => Scene],
  ["curling", CURLING_LEAGUES, curlingSheet as (l: string) => Scene],
  ["lacrosse", LACROSSE_LEAGUES, lacrosseField as (l: string) => Scene],
  ["volleyball", VOLLEYBALL_LEAGUES, volleyballCourt as (l: string) => Scene],
];

/** Walks absolute M/L/A path data; returns every `A` endpoint paired with the point the pen was on. */
const arcHops = (d: string): [from: string, to: string][] => {
  const hops: [string, string][] = [];
  let pen = "";
  for (const m of d.matchAll(/([MLA]) ([^MLAZ]+)/g)) {
    const nums = m[2]!.trim().split(" ");
    const to = nums.slice(-2).join(" ");
    if (m[1] === "A") hops.push([pen, to]);
    pen = to;
  }
  return hops;
};

const countA = (d: string): number => (d.match(/A /g) ?? []).length;

test("detectArcs finds one run on a sampled half circle, none on a rectangle, and re-sampling reproduces the points within 1e-6", () => {
  const half = createCircle({ center: [3, -2], start: 0.5, end: 1.5, r: 6, npoints: 50 });
  const runs = detectArcs(half);
  expect(runs).toHaveLength(1);
  expect(runs[0]).toMatchObject({ start: 0, end: 49 });
  expect(runs[0]!.cx).toBeCloseTo(3, 9);
  expect(runs[0]!.cy).toBeCloseTo(-2, 9);
  expect(runs[0]!.r).toBeCloseTo(6, 9);
  resampleArc(runs[0]!).forEach(([x, y], i) => {
    expect(x).toBeCloseTo(half[i]![0], 6);
    expect(y).toBeCloseTo(half[i]![1], 6);
  });
  expect(
    detectArcs([
      [0, 0],
      [1, 0],
      [1, 1],
      [0, 1],
      [0, 0],
    ]),
  ).toEqual([]);
  expect(detectArcs(createCircle({ r: 1, npoints: 7 }))).toEqual([]); // below minPoints
});

test("every arc detected on every NBA polygon re-samples to the original points within 1e-6; rings yield exactly two runs", () => {
  const scene = basketballCourt("nba", { arcResolution: 200 });
  let total = 0;
  for (const f of scene.features)
    if (f.kind === "polygon")
      for (const run of detectArcs(f.points)) {
        total++;
        resampleArc(run).forEach(([x, y], k) => {
          expect(x).toBeCloseTo(f.points[run.start + k]![0], 6);
          expect(y).toBeCloseTo(f.points[run.start + k]![1], 6);
        });
      }
  expect(total).toBeGreaterThan(10);
  const ring = scene.features.find((f) => f.name.startsWith("center_circle_outline"))!;
  expect(ring.kind === "polygon" && detectArcs(ring.points)).toHaveLength(2);
});

test("pathData: sampled is M/L only; svg emits A commands, splits full circles in two, and shrinks the path", () => {
  const full = createCircle({ r: 5, npoints: 100 });
  const sampled = pathData(full, "sampled", 4);
  const arcs = pathData(full, "svg", 4);
  expect(sampled).not.toContain("A");
  expect(sampled.split("L").length).toBe(100);
  expect((arcs.match(/A /g) ?? []).length).toBe(2);
  expect(arcs).toMatch(/A 5 5 0 0 1 /);
  expect(arcs.length).toBeLessThan(sampled.length / 10);
  const three = pathData(createCircle({ start: 0.5, end: 2, r: 5, npoints: 100 }), "svg", 4);
  expect((three.match(/A /g) ?? []).length).toBe(1);
  expect(three).toMatch(/A 5 5 0 1 1 /); // 1.5π > π → large-arc 1
  const cw = pathData(createCircle({ start: 2, end: 0.5, r: 5, npoints: 100 }), "svg", 4);
  expect(cw).toMatch(/A 5 5 0 1 0 /); // reversed direction → sweep 0
  const half = pathData(createCircle({ start: 0.5, end: 1.5, r: 5, npoints: 100 }), "svg", 4);
  expect(half).toMatch(/A 5 5 0 0 1 /); // exactly π → large-arc 0 (tolerance)
});

test("toSVG default output is unchanged; arcs: 'svg' is smaller and still has one path per polygon", () => {
  const tri: Scene = {
    sport: "basketball",
    league: "x",
    units: "ft",
    origin: "center",
    bbox: [0, 0, 1, 1],
    features: [
      {
        kind: "polygon",
        name: "t",
        zIndex: 0,
        fill: "#000000",
        points: [
          [0, 0],
          [1, 0],
          [1, 1],
        ],
      },
    ],
  };
  expect(toSVG(tri)).toContain('d="M 0 0 L 1 0 L 1 1 Z"'); // the merged path format, byte for byte
  const s = basketballCourt("nba");
  const a = toSVG(s);
  const b = toSVG(s, { arcs: "sampled" });
  const c = toSVG(s, { arcs: "svg" });
  expect(a).toBe(b);
  expect(c.length).toBeLessThan(a.length / 3);
  expect((c.match(/<path /g) ?? []).length).toBe((a.match(/<path /g) ?? []).length);
  expect(c).not.toContain("NaN");
});

test("C1: a 200-point full circle of small radius (FIBA net) is two A commands with distinct endpoints, never one degenerate arc", () => {
  const net = createCircle({ center: [12.65, 0], r: 0.225, npoints: 200 });
  const [run] = detectArcs(net);
  expect(Math.abs(Math.abs(run!.a1 - run!.a0) - 2 * Math.PI)).toBeLessThan(1e-12); // accumulated, not extrapolated
  const d = pathData(net, "svg", 4);
  expect(countA(d)).toBe(2);
  expect(d).not.toMatch(/A \S+ \S+ 0 1 /); // no large-arc flag on either half
  for (const [from, to] of arcHops(d)) expect(from).not.toBe(to);
  // the formatted-endpoint guard alone (span just under the 2π tolerance) must also split
  const shy = createCircle({ center: [12.65, 0], r: 0.225, start: 0, end: 2 - 1e-7, npoints: 200 });
  expect(countA(pathData(shy, "svg", 4))).toBe(2);
});

test("every surface: arcs='svg' never emits an A whose endpoint is the current point, and each closed circular run is exactly two A commands", () => {
  let surfaces = 0;
  let fullCircles = 0;
  for (const [, leagues, build] of SURFACES)
    for (const league of leagues) {
      surfaces++;
      const scene = build(league);
      const svg = toSVG(scene, { arcs: "svg" });
      for (const m of svg.matchAll(/ d="([^"]*)"/g))
        for (const [from, to] of arcHops(m[1]!)) expect(from, `${league}: ${m[1]}`).not.toBe(to);
      for (const f of scene.features) {
        if (f.kind !== "polygon") continue;
        const runs = detectArcs(f.points);
        if (runs.length === 0) continue;
        const expected = runs.reduce((acc, r) => {
          const [sx, sy] = f.points[r.start]!;
          const [ex, ey] = f.points[r.end]!;
          const closed = fmt(sx, 4) === fmt(ex, 4) && fmt(sy, 4) === fmt(ey, 4);
          if (closed) fullCircles++;
          return acc + (closed ? 2 : 1);
        }, 0);
        expect(countA(pathData(f.points, "svg", 4)), `${league} ${f.name}`).toBe(expected);
      }
    }
  expect(surfaces).toBe(62);
  expect(fullCircles).toBeGreaterThan(10);
});

test("I2: a run of more than one turn is emitted as L segments (same point count as sampled), not two wrong arcs", () => {
  const turns = createCircle({ r: 5, start: 0, end: 3, npoints: 300 }); // 3π on one circle
  const d = pathData(turns, "svg", 4);
  expect(d).not.toContain("A");
  expect(d).toBe(pathData(turns, "sampled", 4));
});

test("M1: a non-finite coordinate cannot seed or extend a run", () => {
  const pts: Point[] = createCircle({ r: 5, npoints: 40 });
  pts[20] = [Number.NaN, 1];
  const runs = detectArcs(pts);
  expect(runs.every((r) => r.end < 20 || r.start > 20)).toBe(true);
  expect(pathData(pts, "svg", 4)).not.toMatch(/A [^MLAZ]*NaN/);
  expect(detectArcs([[Number.NaN, 0], ...createCircle({ r: 5, npoints: 20 })])[0]!.start).toBe(1);
});
