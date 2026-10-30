import { expect, test } from "vitest";
import { lacrosseField } from "../../src/lacrosse/field.js";
import { SportyError } from "../../src/surface.js";
test("NCAAM: yards, 39 polygons in R order (no goal fan), contrasting centre marker #ffcb05, bbox = half dims + apron", () => {
  const s = lacrosseField("ncaam");
  expect(s.units).toBe("yd");
  expect(s.bbox).toEqual([-60, -35, 60, 35]);
  const polys = s.features.filter((f) => f.kind === "polygon");
  // fan-less: no goal_fan polygons (sportyR goal-fan early return); no zero-thickness lines (sportyR 2.4.1)
  expect(polys).toHaveLength(39);
  expect(polys.slice(0, 5).map((p) => p.name)).toEqual([
    "field_apron",
    "field_apron",
    "defensive_zone",
    "offensive_zone", // NCAAM has no neutral zone: zero length, no area (sportyR 2.4.1)
    "sideline",
  ]);
  expect(polys.find((p) => p.name === "face_off_marker")!.fill).toBe("#ffcb05"); // first face_off_marker = the centre one
  expect(polys.find((p) => p.name === "goal_arc")).toBeUndefined(); // no thickness (#64): no area, so not drawn (2.4.1)
  expect(polys.filter((p) => p.name === "goal_circle")[0]!.points).toHaveLength(2 * (2 * 200 + 5));
});
test("NCAAW: metres, 60 polygons (4 hash-mark separations × 4); hash marks rotated by −sep/(fan+circle) rad", () => {
  const s = lacrosseField("ncaaw");
  expect(s.units).toBe("m");
  expect(s.features).toHaveLength(60);
  expect(s.bbox).toEqual([-59, -34, 59, 34]);
  expect(s.features.filter((f) => f.name === "goal_fan_hash_mark")).toHaveLength(16); // 4 separations × 4 copies
});
test("NLL (Review Focus 4): oval field, boards stroked, zero-thickness lines left out; feet", () => {
  const s = lacrosseField("nll");
  expect(s.units).toBe("ft");
  expect(s.bbox).toEqual([-105, -48, 105, 48]); // y covers the benches and penalty boxes (sportyR #63)
  const polys = s.features.filter((f) => f.kind === "polygon");
  expect(polys).toHaveLength(49); // no goal fan; no zero-thickness lines (sportyR 2.4.1)
  expect(polys[0]!.points).toEqual([[0, 0]]); // the stroked oval apron point is still drawn
  expect(polys[2]!.points).toHaveLength(2 * 200 + 4); // oval apron point; oval defensive zone
  // NLL's sidelines and end lines have no thickness: no area and no outline, so sportyR 2.4.1 leaves them out
  expect(polys.filter((p) => p.name === "sideline" || p.name === "end_line")).toEqual([]);
  const pll = lacrosseField("pll").features.filter((f) => f.kind === "polygon");
  expect(polys.find((p) => p.name === "boards")!.stroke).toBe("#ffa500");
  expect(pll.find((p) => p.name === "boards")).toBeUndefined(); // no thickness and no stroke: not drawn (2.4.1)
  expect(polys.find((p) => p.name === "face_off_marker")!.fill).toBe("#ffffff"); // contrasting flag absent → white
  expect(polys.find((p) => p.name === "goal_circle")!.points).toHaveLength(2 * 200 + 5); // clipped (full_360 false)
});
test("PLL goal arc has the inner arc (thickness present); usam marker stays white (flag false); offense half; user colour beats the contrast rule (sportyR #65)", () => {
  expect(
    lacrosseField("pll")
      .features.filter((f) => f.kind === "polygon")
      .find((f) => f.name === "goal_arc")!.points,
  ).toHaveLength(2 * 200 + 9); // parallel lines + arc, both edges (#70)
  expect(lacrosseField("usam").features.find((f) => f.name === "face_off_marker")!.fill).toBe("#ffffff");
  expect(lacrosseField("pll", { displayRange: "offensive half field" }).bbox).toEqual([0, -36, 56, 36]);
  expect(
    lacrosseField("ncaam", { colorUpdates: { center_face_off_marker: "#123456" } }).features.find(
      (f) => f.name === "face_off_marker",
    )!.fill,
  ).toBe("#123456");
  expect(lacrosseField("world lacrosse", { units: "yd" }).bbox[2]).toBeCloseTo(105 / 3, 9);
  expect(() => lacrosseField("ncaam", { updates: { center_face_off_marker_shape: "triangle" } })).toThrow(
    SportyError,
  ); // R: add_feature errors on the 0-row frame
});
