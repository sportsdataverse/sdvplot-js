// @vitest-environment jsdom
import * as Plot from "@observablehq/plot";
import { expect, test } from "vitest";
import { basketballCourt, footballField } from "../src/index.js";
import { isVisiblePolygon, sceneToGeoJSON, surfaceMark, surfaceScales } from "../src/plot.js";
import type { PolygonFeature, TextFeature } from "../src/scene.js";

const court = basketballCourt("nba");
const visible = court.features.filter(
  (f): f is PolygonFeature => f.kind === "polygon" && isVisiblePolygon(f),
);
const field = footballField("nfl");
const texts = field.features.filter((f): f is TextFeature => f.kind === "text");

test("sceneToGeoJSON emits one closed Polygon per visible polygon feature, in zIndex order", () => {
  const fc = sceneToGeoJSON(court);
  expect(fc.features).toHaveLength(visible.length);
  const z = fc.features.map((f) => f.properties.zIndex);
  expect(z).toEqual([...z].sort((a, b) => a - b));
  const ring = fc.features[0]!.geometry.coordinates[0]!;
  expect(ring[0]).toEqual(ring[ring.length - 1]);
});

test("sceneToGeoJSON skips hidden-unstroked and non-finite polygons like toSVG", () => {
  const base = { kind: "polygon", name: "p", zIndex: 0 } as const;
  const sq = [
    [0, 0],
    [1, 0],
    [1, 1],
  ] as const;
  const fc = sceneToGeoJSON({
    ...court,
    features: [
      { ...base, fill: "#ff000000", points: sq },
      { ...base, fill: "#ff000000", stroke: "#000000", points: sq },
      {
        ...base,
        fill: "#ff0000",
        points: [
          [0, 0],
          [Number.NaN, 1],
        ],
      },
      { ...base, fill: "#ff0000", points: [] },
      { ...base, fill: "#ff0000", points: sq },
    ],
  });
  expect(fc.features).toHaveLength(2);
});

test("surfaceScales locks the domains to the bbox with a 1:1 aspect and no axes", () => {
  const s = surfaceScales(court);
  expect(s.x.domain).toEqual([court.bbox[0], court.bbox[2]]);
  expect(s.y.domain).toEqual([court.bbox[1], court.bbox[3]]);
  expect(s.aspectRatio).toBe(1);
  expect(s.x.axis).toBeNull();
});

test("Plot.plot draws every visible polygon as a <path> through the x/y scales (no projection)", () => {
  const svg = Plot.plot({ ...surfaceScales(court), width: 940, marks: surfaceMark(court) });
  const paths = svg.querySelectorAll("path[fill]");
  expect(paths.length).toBe(visible.length);
  const d = paths[0]!.getAttribute("d") ?? "";
  expect(d).toMatch(/^M/);
  expect(d).not.toMatch(/NaN/);
  expect(paths[0]!.getAttribute("fill")).toBe(visible[0]!.fill);
});

test("a scene background is painted first; none is added without one", () => {
  const bg = basketballCourt("nba", { colorUpdates: { plot_background: "#123456" } });
  expect(bg.background).toBe("#123456");
  const svg = Plot.plot({ ...surfaceScales(bg), width: 940, marks: surfaceMark(bg) });
  const geos = svg.querySelectorAll("g[aria-label=geo]");
  expect(geos).toHaveLength(2);
  expect(geos[0]!.getAttribute("fill")).toBe("#123456"); // constant fill lands on the <g>
  expect(geos[0]!.querySelectorAll("path")).toHaveLength(1);

  expect(court.background).toBeUndefined();
  const plain = Plot.plot({ ...surfaceScales(court), width: 940, marks: surfaceMark(court) });
  expect(plain.querySelectorAll("g[aria-label=geo]")).toHaveLength(1);
  expect(plain.querySelectorAll("path[fill]").length).toBe(visible.length);
});

test("text features become <text> elements", () => {
  const svg = Plot.plot({ ...surfaceScales(field), marks: surfaceMark(field) });
  expect(svg.querySelectorAll("text").length).toBe(texts.filter((t) => !t.fill.endsWith("00")).length);
});

test("text font size is derived from fitBox height through the y scale", () => {
  const svg = Plot.plot({ ...surfaceScales(field), width: 940, marks: surfaceMark(field) });
  const y = svg.scale("y")!.apply as (v: number) => number;
  const h = texts[0]!.fitBox[1] / 1.5;
  const expected = Math.abs(y(h) - y(0));
  const sizes = Array.from(svg.querySelectorAll("text")).map((t) =>
    Number.parseFloat(t.getAttribute("font-size") ?? "NaN"),
  );
  expect(sizes.length).toBeGreaterThan(0);
  for (const s of sizes) {
    expect(s).toBeGreaterThan(expected * 0.9);
    expect(s).toBeLessThan(expected * 1.1);
  }
  expect(new Set(sizes).size).toBe(1);
  const forced = Plot.plot({ ...surfaceScales(field), marks: surfaceMark(field, { textFontSize: 7 }) });
  expect(forced.querySelector("text")?.getAttribute("font-size")).toBe("7");
});

test("rotation matches toSVG: sporty CCW-positive becomes the negated angle", () => {
  const rotated = texts.find((t) => t.rotation !== 0)!;
  expect(rotated).toBeDefined();
  const svg = Plot.plot({ ...surfaceScales(field), width: 940, marks: surfaceMark(field) });
  const want = -rotated.rotation;
  const found = Array.from(svg.querySelectorAll("text")).some((t) => {
    const m = /rotate\((-?[\d.]+)/.exec(t.getAttribute("transform") ?? "");
    return m !== null && Math.abs(Number(m[1]) - want) < 1e-6;
  });
  expect(found).toBe(true);
});
