import { expect, test } from "vitest";
import { hockeyRink } from "../../src/hockey/rink.js";
import { HOCKEY_SPECS } from "../../src/specs/hockey.js";
import { UnknownDisplayRangeError, UnknownLeagueError } from "../../src/surface.js";

const NHL = HOCKEY_SPECS.nhl;
const bt = NHL.board_thickness;

test("NHL full rink: R's display box, 63 polygons in R layer order", () => {
  const s = hockeyRink("NHL");
  expect(s.sport).toBe("hockey");
  expect(s.units).toBe("ft");
  expect(s.origin).toBe("center");
  // R "full": half_rink_length = L/2 + 3*board_thickness + 5; half width adds max(bench_depth, penalty_box_depth)
  const hx = NHL.rink_length / 2 + 3 * bt + 5;
  const hy = NHL.rink_width / 2 + Math.max(NHL.bench_depth, NHL.penalty_box_depth) + 3 * bt + 5;
  expect(s.bbox).toEqual([-hx, -hy, hx, hy]);
  expect(s.features).toHaveLength(63);
  expect(s.features.every((f, i) => f.kind === "polygon" && f.zIndex === i)).toBe(true);
  expect(s.features[0]?.name).toBe("defensive_zone");
  expect(s.features.at(-1)?.name).toBe("boards");
  expect(s.background).toBeUndefined();
});

test("display ranges: in bounds only = rink + boards; ozone starts 5 ft inside the blue line", () => {
  expect(hockeyRink("nhl", { displayRange: "in bounds only" }).bbox).toEqual([
    -(100 + bt),
    -(42.5 + bt),
    100 + bt,
    42.5 + bt,
  ]);
  // R: (nzone_length/2 + major_line_thickness + 5) - major_line_thickness - 10
  expect(hockeyRink("nhl", { displayRange: "ozone" }).bbox[0]).toBe(NHL.nzone_length / 2 - 5);
  expect(hockeyRink("nhl", { displayRange: "attacking zone" }).bbox[0]).toBe(20);
  expect(() => hockeyRink("nhl", { displayRange: "slot" as never })).toThrow(UnknownDisplayRangeError);
  expect(() => hockeyRink("khl")).toThrow(UnknownLeagueError);
});

test("has_trapezoid gates the restricted area; heights are hints in the scene's units", () => {
  const trap = (l: string) => hockeyRink(l).features.filter((f) => f.name === "goaltenders_restricted_area");
  expect(trap("nhl")).toHaveLength(2);
  expect(trap("pwhl")).toHaveLength(0);
  const nhl = hockeyRink("nhl").features;
  expect(nhl.filter((f) => f.name === "boards").map((f) => f.kind === "polygon" && f.height)).toEqual([
    3.5, 3.5,
  ]);
  const frame = hockeyRink("iihf").features.find((f) => f.name === "goal_frame");
  expect(frame?.kind === "polygon" && frame.height).toBeCloseTo(4 * 0.3048, 12);
});

test("colour keys map to features; an unknown crease style draws R's single-point default", () => {
  const s = hockeyRink("nhl", { colorUpdates: { team_b_bench: "#123456", goal_fill: "#00ff00" } });
  expect(s.features.filter((f) => f.name === "player_bench_area_fill").map((f) => f.fill)).toEqual([
    "#ffffff",
    "#123456",
  ]);
  expect(s.features.find((f) => f.name === "goal_frame_fill")?.fill).toBe("#00ff00");
  const odd = hockeyRink("nhl", { updates: { goal_crease_style: "nhl2030" } });
  const crease = odd.features.filter((f) => f.name === "goal_crease_outline");
  expect(crease.map((f) => f.kind === "polygon" && f.points)).toEqual([[[89, 0]], [[-89, 0]]]);
});
