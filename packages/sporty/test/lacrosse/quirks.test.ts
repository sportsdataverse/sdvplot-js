// sportyR 2.3.0 geometry fixes (sportyR PR #68, issues #60-#65), ported: each test failed on the pre-port code.
import { expect, test } from "vitest";
import { lacrosseField } from "../../src/lacrosse/field.js";
import type { Point } from "../../src/scene.js";

const polys = (s: ReturnType<typeof lacrosseField>, name: string) =>
  s.features.filter((f) => f.kind === "polygon" && f.name === name) as {
    points: readonly Point[];
    fill: string;
  }[];
/** Mean of a closed rectangle's four corners (its closing point repeats the first). */
const centre = (pts: readonly Point[]): Point => {
  const c = pts.slice(0, 4);
  return [c.reduce((a, p) => a + p[0], 0) / 4, c.reduce((a, p) => a + p[1], 0) / 4];
};

test("#60: NLL / World Lacrosse neutral zone reads neutral_zone_length (85 ft), not the absent nzone_length", () => {
  for (const league of ["nll", "world lacrosse"]) {
    const xs = polys(lacrosseField(league), "neutral_zone")[0]!.points.map((p) => p[0]);
    expect(Math.max(...xs), league).toBe(42.5);
    expect(Math.min(...xs), league).toBe(-42.5);
  }
});

test("#61: penalty box fills are offset by boards_thickness (0.25 ft), not the absent board_thickness", () => {
  const [a, b] = polys(lacrosseField("nll"), "penalty_box_fill");
  expect(centre(a!.points)[0]).toBeCloseTo(-(4 + 0.25 + 4), 9);
  expect(centre(b!.points)[0]).toBeCloseTo(4 + 0.25 + 4, 9);
});

test("#62: a goal-fan hash mark is placed at the angle it is rotated by, sep / (fan + circle radius)", () => {
  const s = lacrosseField("ncaaw");
  const marks = polys(s, "goal_fan_hash_mark"); // 4 separations x 4 copies; copy 0 is unreflected
  const fanCentre = 55 - 8.899 + 2.6; // goal x anchor + goal_circle_radius
  [0, 4, 8, 12].forEach((sep, i) => {
    const [x, y] = centre(marks[4 * i]!.points);
    expect(Math.atan2(y, x - fanCentre), `sep ${sep}`).toBeCloseTo(Math.PI - sep / (10.6 + 2.6), 9);
  });
});

test("#63: the full display range covers the benches and penalty boxes (NLL y to 48 ft); other leagues unchanged", () => {
  expect(lacrosseField("nll").bbox).toEqual([-105, -48, 105, 48]);
  expect(lacrosseField("world lacrosse", { displayRange: "offense" }).bbox).toEqual([0, -48, 105, 48]);
  expect(lacrosseField("ncaam").bbox).toEqual([-60, -35, 60, 35]);
});

test("#64: goal_arc_line_thickness defaults to 0, so an arc without it is a ring, not a filled block", () => {
  const arc = polys(lacrosseField("ncaam"), "goal_arc")[0]!.points;
  expect(arc).toHaveLength(2 * 200 + 5);
});

test("#65: the contrasting centre face-off colour applies only when the user set neither it nor a matching centre line", () => {
  const marker = (o: Parameters<typeof lacrosseField>[1]) =>
    polys(lacrosseField("ncaam", o), "face_off_marker")[0]!.fill;
  expect(marker({})).toBe("#ffcb05");
  expect(marker({ colorUpdates: { center_face_off_marker: "#123456" } })).toBe("#123456");
  // recolouring only the centre line: the white marker no longer matches it, so no contrast default
  expect(marker({ colorUpdates: { center_line: "#ff0000" } })).toBe("#ffffff");
});
