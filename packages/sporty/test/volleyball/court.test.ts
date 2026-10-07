import { expect, test } from "vitest";
import { volleyballCourt } from "../../src/volleyball/court.js";

test("FIVB: metres, 39 polygons, 20 substitution-zone dashes at the R y-ladder", () => {
  const s = volleyballCourt("fivb");
  expect(s.units).toBe("m");
  expect(s.bbox).toEqual([-15.5, -9.5, 15.5, 9.5]);
  const polys = s.features.filter((f) => f.kind === "polygon");
  expect(polys).toHaveLength(39);
  const dashes = polys.filter((p) => p.name === "substitution_zone_dash");
  expect(dashes).toHaveLength(20);
  const ys = dashes.filter((d) => d.points[0]![0] > 0 && d.points[0]![1] > 0).map((d) => d.points[0]![1]);
  expect(ys).toEqual([4.7, 5.05, 5.4, 5.75, 6.1].map((v) => expect.closeTo(v, 9)));
  expect(polys[4]!.name).toBe("backcourt");
  expect(polys[4]!.fill).toBe("#d2ab6f");
  expect(polys[0]!.stroke).toBe("#d2ab6f");
});
test("NCAA free zone is smaller; offense half; rep pattern 0 gives no dashes; colour key is substitution_zone", () => {
  expect(volleyballCourt("ncaa").bbox).toEqual([-13.5, -7.5, 13.5, 7.5]);
  expect(volleyballCourt("ncaa", { displayRange: "offensive half court" }).bbox).toEqual([
    0, -7.5, 13.5, 7.5,
  ]);
  expect(volleyballCourt("ncaa", { updates: { substitution_zone_rep_pattern: 0 } }).features).toHaveLength(
    19,
  );
  expect(
    volleyballCourt("ncaa", { colorUpdates: { substitution_zone: "#ff0000" } }).features.filter(
      (f) => f.fill === "#ff0000",
    ),
  ).toHaveLength(20);
});
