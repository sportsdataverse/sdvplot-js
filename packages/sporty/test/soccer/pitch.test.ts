import { expect, test } from "vitest";
import { soccerPitch } from "../../src/soccer/pitch.js";
import { UnknownDisplayRangeError, UnknownLeagueError } from "../../src/surface.js";
test("FIFA full pitch: metres, centre origin, 35 polygons in R call order, bbox = half dims + 5", () => {
  const s = soccerPitch("FIFA");
  expect(s.sport).toBe("soccer");
  expect(s.units).toBe("m");
  expect(s.origin).toBe("center");
  expect(s.background).toBeUndefined();
  expect(s.bbox).toEqual([-65, -50, 65, 50]);
  const polys = s.features.filter((f) => f.kind === "polygon");
  expect(polys).toHaveLength(35);
  expect(polys.slice(0, 3).map((p) => p.name)).toEqual(["half_pitch", "half_pitch", "pitch_apron"]); // defensive then offensive half (colour keys differ, builder is one)
  expect(polys[2]!.stroke).toBe("#195f0c"); // R passes feature_outline_color for the apron
  expect(polys.filter((p) => p.name === "penalty_box")).toHaveLength(4); // reflect_x + reflect_y
  expect(polys.at(-1)!.name).toBe("goal");
});
test("NCAA hides the touchline defensive marks: 31 polygons; MLS is in yards", () => {
  expect(soccerPitch("ncaa").features).toHaveLength(31);
  expect(soccerPitch("ncaa").bbox).toEqual([-65, -42.5, 65, 42.5]);
  expect(soccerPitch("mls").units).toBe("yd");
  expect(soccerPitch("mls").bbox).toEqual([-60, -40, 60, 40]);
});
test("display-range keys (Review Focus 3): case-insensitive like R's tolower; stray spaces and hyphens throw", () => {
  expect(soccerPitch("fifa", { displayRange: "Offensive Half Pitch" as never }).bbox).toEqual([
    0, -50, 65, 50,
  ]);
  expect(soccerPitch("fifa", { displayRange: "in_bounds_only" }).bbox).toEqual([
    -60.12, -45.12, 60.12, 45.12,
  ]);
  expect(() => soccerPitch("fifa", { displayRange: " offense " as never })).toThrow(UnknownDisplayRangeError); // R: silently "full"
  expect(() => soccerPitch("fifa", { displayRange: "offensive-half-pitch" as never })).toThrow(
    UnknownDisplayRangeError,
  );
  expect(() => soccerPitch("bundesliga")).toThrow(UnknownLeagueError);
});
test("units conversion converts the limits too (Review Focus 1 — documented divergence 1)", () => {
  const s = soccerPitch("fifa", { units: "ft" });
  expect(s.units).toBe("ft");
  expect(s.bbox[2]).toBeCloseTo(65 / 0.3048, 9);
  expect(s.bbox[3]).toBeCloseTo(50 / 0.3048, 9);
  for (const f of s.features)
    if (f.kind === "polygon")
      for (const [x, y] of f.points) {
        expect(x).toBeGreaterThanOrEqual(s.bbox[0] - 1e-9);
        expect(x).toBeLessThanOrEqual(s.bbox[2] + 1e-9);
        expect(y).toBeGreaterThanOrEqual(s.bbox[1] - 1e-9);
        expect(y).toBeLessThanOrEqual(s.bbox[3] + 1e-9);
      }
});
test("rotation rotates the bbox; xTrans moves the surface (J8); colour + param updates typed", () => {
  const r = soccerPitch("fifa", { rotation: 90 });
  expect(r.bbox).toEqual([-50, -65, 50, 65].map((v) => expect.closeTo(v, 9)));
  const t = soccerPitch("fifa", { xTrans: 65, yTrans: -50 });
  expect(t.bbox).toEqual([0, -100, 130, 0]);
  const c = soccerPitch("fifa", {
    colorUpdates: { penalty_box: "#ff0000" },
    updates: { penalty_box_length: 20 },
  });
  expect(c.features.find((f) => f.name === "penalty_box")!.fill).toBe("#ff0000");
});
