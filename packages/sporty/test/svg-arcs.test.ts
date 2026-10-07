import { expect, test } from "vitest";
import { basketballCourt } from "../src/basketball/court.js";
import type { Scene } from "../src/scene.js";
import { createCircle } from "../src/shapes.js";
import { detectArcs, pathData, resampleArc } from "../src/svg-arcs.js";
import { toSVG } from "../src/svg.js";

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
