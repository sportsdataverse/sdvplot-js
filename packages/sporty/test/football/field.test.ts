import { expect, test } from "vitest";
import { footballField } from "../../src/football/field.js";
import type { TextFeature } from "../../src/scene.js";
import { FOOTBALL_SPECS } from "../../src/specs/football.js";
import { UnknownDisplayRangeError, UnknownLeagueError } from "../../src/surface.js";

const NFL = FOOTBALL_SPECS.nfl;
const texts = (league: string, o = {}) =>
  footballField(league, o).features.filter((f): f is TextFeature => f.kind === "text");

test("NFL full field: R's display box, 428 polygons + 36 yard numbers in one draw order", () => {
  const s = footballField("NFL");
  expect(s.sport).toBe("football");
  expect(s.units).toBe("yd");
  expect(s.origin).toBe("center");
  // R: half_field_length = L/2 + endzone + boundary + field_border + minor_line + extra_apron_padding
  const hx =
    NFL.field_length / 2 +
    NFL.endzone_length +
    NFL.boundary_line_thickness +
    NFL.field_border_thickness! +
    NFL.minor_line_thickness +
    NFL.extra_apron_padding;
  const hy =
    NFL.field_width / 2 +
    NFL.boundary_line_thickness +
    NFL.restricted_area_width +
    NFL.coaching_box_width +
    NFL.team_bench_width +
    NFL.field_border_thickness! +
    NFL.team_bench_area_border_thickness +
    NFL.minor_line_thickness +
    NFL.extra_apron_padding;
  expect(s.bbox).toEqual([-hx, -hy, hx, hy].map((v) => expect.closeTo(v, 12)));
  expect(s.features.filter((f) => f.kind === "polygon")).toHaveLength(428);
  expect(s.features.every((f, i) => f.zIndex === i)).toBe(true);
  expect(s.features[0]?.name).toBe("field_apron");
  expect(s.features.at(-1)?.name).toBe("directional_arrow");
  expect(s.background).toBeUndefined();
});

test("display ranges: red zone starts 20 yd from the goal line; unknown inputs throw", () => {
  expect(footballField("nfl", { displayRange: "red zone" }).bbox[0]).toBe(NFL.field_length / 2 - 20);
  expect(footballField("nfl", { displayRange: "defensive red zone" }).bbox[2]).toBe(
    -NFL.field_length / 2 + 20,
  );
  expect(footballField("nfl", { displayRange: "in bounds only" }).bbox).toEqual(
    [-62, -28.66665, 62, 28.66665].map((v) => expect.closeTo(v, 12)),
  );
  expect(() => footballField("nfl", { displayRange: "goal line" as never })).toThrow(
    UnknownDisplayRangeError,
  );
  expect(() => footballField("xfl")).toThrow(UnknownLeagueError);
});

test("yard numbers are text features: R's labels, font, fit box, and the flipped top row", () => {
  const t = texts("nfl");
  expect(t.map((f) => f.text)).toEqual([...NFL.numbers_bottom, ...NFL.numbers_top]);
  expect(t.every((f) => f.fontFamily === NFL.number_font && f.fill === "#ffffff")).toBe(true);
  expect(t.map((f) => f.rotation)).toEqual([...Array(18).fill(0), ...Array(18).fill(180)]);
  // R's ggfittext box: number_width wide, 1.5 * number_height tall
  expect(t[0]?.fitBox).toEqual([
    expect.closeTo(NFL.number_width, 12),
    expect.closeTo(1.5 * NFL.number_height, 12),
  ]);
  // first "1" sits left of the 10 (−40) yard line; bottom row is sideline_to_bottom_of_numbers off the sideline
  const left = -40 - NFL.number_to_yard_line - NFL.minor_line_thickness / 2;
  expect(t[0]?.x).toBeCloseTo(left - NFL.number_width / 2, 12);
  expect(t[0]?.y).toBeCloseTo(
    -NFL.field_width / 2 + NFL.sideline_to_bottom_of_numbers + 0.75 * NFL.number_height,
    12,
  );
  expect(t[18]?.y).toBeCloseTo(-(t[0]?.y ?? 0), 12);
  // each number follows its transparent ggplot bounding-box polygon
  const s = footballField("nfl").features;
  const i = s.findIndex((f) => f.kind === "text");
  expect(s[i]).toEqual(t[0]);
  expect(s[i - 1]).toMatchObject({ kind: "polygon", name: "yardage_marker_box", fill: "#ffffff00" });
});

test("CFL: odd number row centres the 'C' on midfield; additional minor lines sit inside the end zone", () => {
  const t = texts("cfl");
  const c = t.find((f) => f.text === "C");
  expect(c?.x).toBeCloseTo(0, 12);
  expect(t).toHaveLength(42);
  const minor = footballField("cfl").features.filter((f) => f.name === "minor_yard_line");
  // R: 0..54 without multiples of 5 (44) + c(-5, -10, -15), each drawn 4x at the sideline and 4x at the hashes
  expect(minor).toHaveLength((44 + 3) * 8);
});

test("rotation and translation move the numbers with the field; the label angle adds the rotation", () => {
  const [a, b] = [texts("nfl")[0]!, texts("nfl", { rotation: 90, xTrans: 10, yTrans: -5 })[0]!];
  expect(b.x).toBeCloseTo(-(a.y - 5), 12);
  expect(b.y).toBeCloseTo(a.x + 10, 12);
  expect(b.rotation).toBe(90);
});
