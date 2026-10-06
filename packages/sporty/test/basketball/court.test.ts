import { expect, test } from "vitest";
import { basketballCourt } from "../../src/basketball/court.js";
import { UnknownDisplayRangeError, UnknownLeagueError } from "../../src/surface.js";

test("NBA full court: bbox is the court + apron, features are polygons in R call order", () => {
  const s = basketballCourt("NBA");
  expect(s.sport).toBe("basketball");
  expect(s.units).toBe("ft");
  expect(s.origin).toBe("center");
  expect(s.bbox).toEqual([-47 - 8, -25 - 5, 47 + 8, 25 + 5]); // half court 47 + apron_endline 8; half width 25 + apron_sideline 5 (R "full")
  expect(s.features[0]?.name).toBe("half_court"); // R's first add_feature: the defensive half court
  expect(s.features).toHaveLength(106); // R: length(geom_basketball("nba")$layers)
  expect(s.features.every((f, i) => f.kind === "polygon" && f.zIndex === i)).toBe(true);
  expect(s.features.filter((f) => f.name.startsWith("center_circle_outline"))).toHaveLength(2 * 2); // NBA has two center circles, each mirrored across x
  expect(s.background).toBeUndefined(); // R plot_background default is NULL
});

test("display ranges: offense is the +x half; unknown range throws", () => {
  const o = basketballCourt("nba", { displayRange: "offense" });
  expect(o.bbox[0]).toBe(0);
  expect(o.bbox[2]).toBe(47 + 8); // R "offense" = c(0, half_court_length), half_court_length includes the apron
  expect(() => basketballCourt("nba", { displayRange: "midcourt" as never })).toThrow(
    UnknownDisplayRangeError,
  );
  expect(() => basketballCourt("xfl")).toThrow(UnknownLeagueError);
});

test("rotation rotates the bbox too (Review Focus 4); xTrans moves the surface (J8)", () => {
  const r = basketballCourt("nba", { rotation: 90 });
  expect(r.bbox[0]).toBeCloseTo(-30, 9);
  expect(r.bbox[2]).toBeCloseTo(30, 9);
  expect(r.bbox[1]).toBeCloseTo(-55, 9);
  const t = basketballCourt("nba", { xTrans: 47, yTrans: 25 });
  expect(t.bbox[0]).toBe(-8);
  expect(t.bbox[1]).toBe(-5);
});

test("color and param updates: hidden feature is #00000000; updates typed; FIBA in metres converts to ft", () => {
  const s = basketballCourt("nba", {
    colorUpdates: { three_point_line: "#13294b" },
    updates: { lane_width: 12 },
  });
  expect(s.features.find((f) => f.name.startsWith("three_point_line"))?.fill).toBe("#13294b");
  // lane_boundary_visibility = [TRUE, FALSE]: the second lane's boundary is drawn transparent, not skipped
  expect(s.features.filter((f) => f.name === "free_throw_lane_boundary").map((f) => f.fill)).toEqual([
    "#000000",
    "#000000",
    "#00000000",
    "#00000000",
  ]);
  const fiba = basketballCourt("fiba", { units: "ft" });
  expect(fiba.units).toBe("ft");
  expect(fiba.bbox[2]).toBeCloseTo((28 / 2 + 2.5) * 3.28084, 2); // FIBA JSON: court_length 28 m, court_apron_endline 2.5 m
});

test("three-point table counts R's corner column: a second corner adds a second arc (R draws 110 layers)", () => {
  expect(
    basketballCourt("nba", { updates: { basket_center_to_corner_three: [22, 21] } }).features,
  ).toHaveLength(110);
});

test("colorUpdates: an undefined or null colour keeps the default instead of throwing", () => {
  const apron = (s: ReturnType<typeof basketballCourt>) =>
    s.features.find((f) => f.name === "court_apron")?.fill;
  const base = apron(basketballCourt("nba"));
  expect(apron(basketballCourt("nba", { colorUpdates: { court_apron: undefined as never } }))).toBe(base);
  expect(apron(basketballCourt("nba", { colorUpdates: { court_apron: null as never } }))).toBe(base);
});

test("lane_space_mark: with 2 mark sets of 1 mark and colours [c1, c2], set 1 takes c1 and set 2 takes c2 (R's set[i] row bug would give set 2 NA)", () => {
  const s = basketballCourt("nba", {
    updates: {
      lane_space_mark_lengths: [[0.1667], [1]],
      lane_space_mark_separations: [[3], [3]],
      lane_space_mark_visibility: [true, true],
    },
    colorUpdates: { lane_space_mark: ["#aa0000", "#00bb00"] },
  });
  const fills = s.features.filter((f) => f.name === "lane_space_mark").map((f) => f.fill);
  expect(fills).toEqual([...Array(4).fill("#aa0000"), ...Array(4).fill("#00bb00")]); // 1 mark x 4 reflected copies per set
});
