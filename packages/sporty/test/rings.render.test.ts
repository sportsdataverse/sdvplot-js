// A feature holding several closed rings (sportyR 2.4.1/2.4.3 draw each `group` as its own polygon) is filled ring by
// ring, as sub-paths, in every renderer: one joined path would also fill what the joins enclose (the nhl92 crease's
// triangle), and opposite windings would cancel where rings overlap. Each test failed with the single joined path.
import { describe, expect, test } from "vitest";
import { drawScene } from "../src/canvas.js";
import { hockeyRink } from "../src/hockey/rink.js";
import { sceneToGeoJSON } from "../src/plot.js";
import type { Point, PolygonFeature, Scene } from "../src/scene.js";
import { createSquare, fillRings } from "../src/shapes.js";
import { pathData } from "../src/svg-arcs.js";

const napi = await import("@napi-rs/canvas").catch(() => undefined);
const crease = (s: Scene): PolygonFeature =>
  s.features.find((f): f is PolygonFeature => f.kind === "polygon" && f.name === "goal_crease_outline")!;
const scene = (points: Point[]): Scene => ({
  sport: "hockey",
  league: "test",
  units: "ft",
  bbox: [-10, -10, 10, 10],
  origin: "center",
  features: [{ kind: "polygon", name: "f", zIndex: 0, fill: "#ff0000", points }],
});
// two 4 ft squares overlapping on x in [-1, 1], the second wound the other way (as a reflection is)
const strips: Point[] = [...createSquare(4, [-1, 0]), ...createSquare(4, [1, 0]).reverse()];
// a ring with a ring inside it, both wound the same way
const holed: Point[] = [...createSquare(12), ...createSquare(4)];

test("fillRings winds rings by nesting: separate or overlapping rings alike, a ring inside another the other way", () => {
  const area = (r: readonly Point[]) =>
    r.reduce((s, [x, y], i) => s + x * r[(i + 1) % r.length]![1] - r[(i + 1) % r.length]![0] * y, 0);
  expect(fillRings(strips).map((r) => Math.sign(area(r)))).toEqual([1, 1]);
  expect(fillRings(holed).map((r) => Math.sign(area(r)))).toEqual([1, -1]);
});

test("the OHL (nhl92) crease is three sub-paths in SVG and three GeoJSON rings", () => {
  const ohl = hockeyRink("ohl");
  expect(pathData(crease(ohl).points, "sampled", 4).match(/M/g)).toHaveLength(3);
  expect(pathData(crease(ohl).points, "svg", 4).match(/M/g)).toHaveLength(3);
  const geo = sceneToGeoJSON(ohl).features.find((f) => f.properties.name === "goal_crease_outline")!;
  expect(geo.geometry.coordinates).toHaveLength(3);
});

describe.skipIf(napi === undefined)("drawScene fills each ring once", () => {
  const draw = (s: Scene, width: number) => {
    const ctx = napi!.createCanvas(width, width).getContext("2d");
    const { scale } = drawScene(ctx, s, { width, background: "#ffffff" });
    const [x0, , , y1] = s.bbox;
    return (x: number, y: number) =>
      [...ctx.getImageData(Math.round((x - x0) * scale), Math.round((y1 - y) * scale), 1, 1).data].slice(
        0,
        3,
      );
  };

  test("the OHL crease's inside shows the crease fill, not the outline's red", () => {
    const ohl = hockeyRink("ohl");
    const px = draw(ohl, 4000);
    const hex = (c: string) => [1, 3, 5].map((i) => Number.parseInt(c.slice(i, i + 2), 16));
    const fill = ohl.features.find((f) => f.name === "goal_crease_fill")!.fill;
    // 3.5 ft out from the goal line on the crease's centre: inside the band's hole, clear of both L-marks, and inside
    // the triangle a joined path encloses (band end (89, 6) to the L-marks' outer corners (84.83, -4) and (84.83, 4))
    expect(px(89 - 3.5, 0)).toEqual(hex(fill));
  });

  test("overlapping rings wound opposite ways fill their overlap; a ring inside another is a hole", () => {
    expect(draw(scene(strips), 400)(0, 0)).toEqual([255, 0, 0]);
    const holedPx = draw(scene(holed), 400);
    expect(holedPx(0, 0)).toEqual([255, 255, 255]);
    expect(holedPx(4, 4)).toEqual([255, 0, 0]);
  });
});
