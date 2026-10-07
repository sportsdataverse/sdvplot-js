import { expect, test } from "vitest";
import { lacrosseField } from "../../src/lacrosse/field.js";
import { SportyError } from "../../src/surface.js";
test("NCAAM: yards, 73 polygons in R order, contrasting centre marker #ffcb05, bbox = half dims + apron", () => {
  const s = lacrosseField("ncaam");
  expect(s.units).toBe("yd");
  expect(s.bbox).toEqual([-60, -35, 60, 35]);
  const polys = s.features.filter((f) => f.kind === "polygon");
  expect(polys).toHaveLength(73);
  expect(polys.slice(0, 5).map((p) => p.name)).toEqual([
    "field_apron",
    "field_apron",
    "defensive_zone",
    "neutral_zone",
    "offensive_zone",
  ]);
  expect(polys.find((p) => p.name === "face_off_marker")!.fill).toBe("#ffcb05"); // first face_off_marker = the centre one
  expect(polys.find((p) => p.name === "goal_arc")!.points).toHaveLength(205); // n = 200 default → 205 (NULL thickness)
  expect(polys.filter((p) => p.name === "goal_circle")[0]!.points).toHaveLength(2 * (2 * 200 + 5));
});
test("NCAAW: metres, 89 polygons (4 hash-mark separations × 4); hash marks rotated by −sep/(fan+circle) rad", () => {
  const s = lacrosseField("ncaaw");
  expect(s.units).toBe("m");
  expect(s.features).toHaveLength(89);
  expect(s.bbox).toEqual([-59, -34, 59, 34]);
  expect(s.features.filter((f) => f.name === "goal_fan_hash_mark")).toHaveLength(16); // 4 separations × 4 copies
});
test("NLL (Review Focus 4): oval field, boards stroked, hidden-by-flag features present but transparent; feet", () => {
  const s = lacrosseField("nll");
  expect(s.units).toBe("ft");
  expect(s.bbox).toEqual([-105, -47.5, 105, 47.5]);
  const polys = s.features.filter((f) => f.kind === "polygon");
  expect(polys).toHaveLength(73);
  expect(polys[0]!.points).toEqual([[0, 0]]);
  expect(polys[2]!.points).toHaveLength(2 * 200 + 4); // oval apron point; oval defensive zone
  expect(polys.filter((p) => p.name === "sideline").map((p) => p.fill)).toEqual(["#ffffff00", "#ffffff00"]);
  expect(polys.filter((p) => p.name === "end_line").map((p) => p.fill)).toEqual(["#ffffff00", "#ffffff00"]);
  const pll = lacrosseField("pll").features.filter((f) => f.kind === "polygon");
  expect(polys.find((p) => p.name === "boards")!.stroke).toBe("#ffa500");
  expect(pll.find((p) => p.name === "boards")!.stroke).toBeUndefined();
  expect(polys.find((p) => p.name === "face_off_marker")!.fill).toBe("#ffffff"); // contrasting flag absent → white
  expect(polys.find((p) => p.name === "goal_circle")!.points).toHaveLength(2 * 200 + 5); // clipped (full_360 false)
});
test("PLL goal arc has the inner arc (thickness present); usam marker stays white (flag false); offense half; user colour beats the contrast rule (documented divergence 6)", () => {
  expect(
    lacrosseField("pll")
      .features.filter((f) => f.kind === "polygon")
      .find((f) => f.name === "goal_arc")!.points,
  ).toHaveLength(2 * 200 + 5);
  expect(lacrosseField("usam").features.find((f) => f.name === "face_off_marker")!.fill).toBe("#ffffff");
  expect(lacrosseField("pll", { displayRange: "offensive half field" }).bbox).toEqual([0, -36, 56, 36]);
  expect(
    lacrosseField("ncaam", { colorUpdates: { center_face_off_marker: "#123456" } }).features.find(
      (f) => f.name === "face_off_marker",
    )!.fill,
  ).toBe("#123456"); // R: #ffcb05
  expect(lacrosseField("world lacrosse", { units: "yd" }).bbox[2]).toBeCloseTo(105 / 3, 9);
  expect(() => lacrosseField("ncaam", { updates: { center_face_off_marker_shape: "triangle" } })).toThrow(
    SportyError,
  ); // R: add_feature errors on the 0-row frame
});
