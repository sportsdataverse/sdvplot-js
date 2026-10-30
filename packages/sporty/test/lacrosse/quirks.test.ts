// sportyR 2.4.0-2.4.5 lacrosse geometry fixes (sportyR PR #68, issues #60-#65; #92, #94), ported: each test failed on the pre-port code.
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

test("#62/#69/#75: a goal-fan hash mark is centred on the middle of the arc's line (10.6 - 0.101 / 2 m), at the angle it is rotated by", () => {
  for (const league of ["ncaaw", "usaw"]) {
    const marks = polys(lacrosseField(league), "goal_fan_hash_mark"); // 4 separations x 4 copies; copy 0 is unreflected
    const gx = 55 - 8.899; // goal x anchor = centre of the goal line
    const r = 10.6 - 0.101 / 2; // 10.5495
    [0, 4, 8, 12].forEach((sep, i) => {
      const [x, y] = centre(marks[4 * i]!.points);
      expect(Math.atan2(y, x - gx), `${league} sep ${sep}`).toBeCloseTo(Math.PI - sep / r, 9);
      expect(Math.hypot(x - gx, y), `${league} sep ${sep}`).toBeCloseTo(r, 9);
    });
  }
});

test("#69: the women's 8 m arc is 10.6 m from the goal-line centre, from 45-degree lines that start on the goal circle", () => {
  for (const league of ["ncaaw", "usaw"]) {
    const s = lacrosseField(league);
    const gx = 55 - 8.899;
    const fan = polys(s, "goal_fan")[0]!.points;
    expect(Math.max(...fan.map(([x, y]) => Math.hypot(x - gx, y))), league).toBeCloseTo(10.6, 9);
    expect(fan[0]![0], league).toBeCloseTo(gx, 9); // B: on the goal line extended, at the goal circle
    expect(fan[0]![1], league).toBeCloseTo(2.6, 9);
    const [cx, cy] = fan[1]!; // C: where the 45-degree line meets the arc
    expect((cy - 2.6) / (cx - gx), league).toBeCloseTo(-1, 9);
    expect(Math.hypot(cx - gx, cy), league).toBeCloseTo(10.6, 9);
    const mark = polys(s, "goal_mouth_hash_mark")[0]!.points; // goal-line-extended marks: 30.5 cm
    expect(Math.max(...mark.map((p) => p[0])) - Math.min(...mark.map((p) => p[0])), league).toBeCloseTo(
      0.305,
      9,
    );
  }
});

test("goal fan early return: a league without a fan outside the goal circle draws no goal_fan polygon", () => {
  for (const league of ["ncaam", "pll", "usam", "nll"])
    expect(polys(lacrosseField(league), "goal_fan"), league).toEqual([]);
  expect(lacrosseField("custom").features.length).toBeGreaterThan(0);
});

test("#70: the PLL two-point arc runs parallel to the sideline 13 yd out, then a 15 yd arc", () => {
  const s = lacrosseField("pll");
  const gx = 50 - 15;
  const arc = polys(s, "goal_arc")[0]!.points;
  expect(Math.max(...arc.map((p) => Math.abs(p[1])))).toBeCloseTo(13, 9);
  expect(arc[0]).toEqual([expect.closeTo(gx + 15, 9), expect.closeTo(13, 9)]);
  expect(arc[1]).toEqual([expect.closeTo(gx - Math.sqrt(15 ** 2 - 13 ** 2), 9), expect.closeTo(13, 9)]);
  const front = arc.filter(([x]) => x < gx - Math.sqrt(15 ** 2 - 13 ** 2) - 1e-9);
  expect(front.length).toBeGreaterThan(0);
  for (const [x, y] of front)
    expect([15, 15 - 0.1111]).toContainEqual(expect.closeTo(Math.hypot(x - gx, y), 9));
});

test("#72: each NLL / World Lacrosse penalty box is penalty_box_length (8 ft) inside, so the outer wall is 0.25 ft further out", () => {
  for (const league of ["nll", "world lacrosse"]) {
    const outline = polys(lacrosseField(league), "penalty_box_outline")[0]!.points;
    expect(Math.max(...outline.map((p) => p[0])), league).toBeCloseTo(4 + 8 + 2 * 0.25, 9);
  }
});

test("#63: the full display range covers the benches and penalty boxes (NLL y to 48 ft); other leagues unchanged", () => {
  expect(lacrosseField("nll").bbox).toEqual([-105, -48, 105, 48]);
  expect(lacrosseField("world lacrosse", { displayRange: "offense" }).bbox).toEqual([0, -48, 105, 48]);
  expect(lacrosseField("ncaam").bbox).toEqual([-60, -35, 60, 35]);
});

test("#64: goal_arc_line_thickness defaults to 0, so an arc without it is a zero-width ring, not a filled block (and, having no area, is not drawn: sportyR 2.4.1)", () => {
  expect(polys(lacrosseField("ncaam"), "goal_arc")).toEqual([]);
  const arc = polys(lacrosseField("ncaam", { updates: { goal_arc_line_thickness: 0.1 } }), "goal_arc")[0]!
    .points;
  expect(arc).toHaveLength(2 * 200 + 9); // a ring with the #70 corner points
});

test("#65: the contrasting centre face-off colour applies only when the user set neither it nor a matching centre line", () => {
  const marker = (o: Parameters<typeof lacrosseField>[1]) =>
    polys(lacrosseField("ncaam", o), "face_off_marker")[0]!.fill;
  expect(marker({})).toBe("#ffcb05");
  expect(marker({ colorUpdates: { center_face_off_marker: "#123456" } })).toBe("#123456");
  // recolouring only the centre line: the white marker no longer matches it, so no contrast default
  expect(marker({ colorUpdates: { center_line: "#ff0000" } })).toBe("#ffffff");
});

test("sportyR 2.4.4 (#92): rectangular zones stop at the neutral zone's edges, so the three zones tile the field", () => {
  // no league has a rectangular field with a neutral zone, so NLL is redrawn as a rectangle (R: x -100..-42.5,
  // -42.5..42.5, 42.5..100)
  const s = lacrosseField("nll", { updates: { field_shape: "rectangle" } });
  const xRange = (name: string) => {
    const xs = polys(s, name)[0]!.points.map((p) => p[0]);
    return [Math.min(...xs), Math.max(...xs)];
  };
  expect(xRange("defensive_zone")).toEqual([-100, -42.5]);
  expect(xRange("neutral_zone")).toEqual([-42.5, 42.5]);
  expect(xRange("offensive_zone")).toEqual([42.5, 100]);
});

test("sportyR 2.4.5 (#94): the contrasting centre face-off marker matches the centre line by rendered colour", () => {
  const marker = (centerLine: string) =>
    polys(lacrosseField("ncaam", { colorUpdates: { center_line: centerLine } }), "face_off_marker")[0]!.fill;
  // each hex spelling of white renders as the default #ffffff marker
  for (const white of ["#FFFFFF", "#ffffffff", "#FfFfFfFF"]) expect(marker(white), white).toBe("#ffcb05");
  // a centre line that renders differently keeps the default white marker
  expect(marker("#123456")).toBe("#ffffff");
  expect(marker("#ffffff80")).toBe("#ffffff");
});
