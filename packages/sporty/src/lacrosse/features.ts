import type { Point } from "../scene.js";
import { createCircle, createRectangle, createSquare, createXShape } from "../shapes.js";
import { reflectCoords, rotateCoords } from "../transform.js";

/** Optional arc resolution; undefined falls through to createCircle's default (1000, as in R). Same helper as soccer/features.ts. */
type Arc = { npoints?: number | undefined };
type CircleOpts = { center: Point; start: number; end: number; r: number } & Arc;
const circle = ({ npoints, ...o }: CircleOpts): Point[] =>
  npoints === undefined ? createCircle(o) : createCircle({ ...o, npoints });

type Zone = {
  fieldLength?: number;
  fieldWidth?: number;
  cornerRadius?: number;
  nzoneLength?: number;
  fieldShape?: string;
} & Arc;

/** lacrosse_defensive_zone (features-lacrosse.R 19): oval → boards-shaped half (2n + 4 points), else the x <= 0 half rectangle. */
export function defensiveZone({
  fieldLength = 0,
  fieldWidth = 0,
  cornerRadius = 0,
  nzoneLength = 0,
  fieldShape = "rectangle",
  npoints,
}: Zone = {}): Point[] {
  if (fieldShape.toLowerCase() !== "oval")
    return createRectangle(-fieldLength / 2, 0, -fieldWidth / 2, fieldWidth / 2);
  const hl = fieldLength / 2;
  const hw = fieldWidth / 2;
  const cx = hl - cornerRadius;
  const cy = hw - cornerRadius;
  return [
    [-nzoneLength / 2, hw],
    ...circle({ center: [-cx, cy], start: 0.5, end: 1, r: cornerRadius, npoints }),
    [-hl, 0],
    ...circle({ center: [-cx, -cy], start: 1, end: 1.5, r: cornerRadius, npoints }),
    [-nzoneLength / 2, -hw],
    [-nzoneLength / 2, hw],
  ];
}

/** lacrosse_neutral_zone (R 100). The assembler always passes 0 (see field.ts), so R draws a zero-width rectangle. */
export function neutralZone({
  nzoneLength = 0,
  fieldWidth = 0,
}: { nzoneLength?: number; fieldWidth?: number } = {}): Point[] {
  return createRectangle(-nzoneLength / 2, nzoneLength / 2, -fieldWidth / 2, fieldWidth / 2);
}

/** lacrosse_offensive_zone (R 127): mirror image of `defensiveZone`. */
export function offensiveZone({
  fieldLength = 0,
  fieldWidth = 0,
  cornerRadius = 0,
  nzoneLength = 0,
  fieldShape = "rectangle",
  npoints,
}: Zone = {}): Point[] {
  if (fieldShape.toLowerCase() !== "oval")
    return createRectangle(0, fieldLength / 2, -fieldWidth / 2, fieldWidth / 2);
  const hl = fieldLength / 2;
  const hw = fieldWidth / 2;
  const cx = hl - cornerRadius;
  const cy = hw - cornerRadius;
  return [
    [nzoneLength / 2, hw],
    ...circle({ center: [cx, cy], start: 0.5, end: 0, r: cornerRadius, npoints }),
    [hl, 0],
    ...circle({ center: [cx, -cy], start: 0, end: -0.5, r: cornerRadius, npoints }),
    [nzoneLength / 2, -hw],
    [nzoneLength / 2, hw],
  ];
}

/** lacrosse_field_apron (R 209): 9-point half frame for a rectangle; any other shape is R's single point `(0, 0)`. */
export function fieldApron({
  fieldLength = 0,
  fieldWidth = 0,
  fieldApronThickness = 0,
  fieldShape = "rectangle",
}: {
  fieldLength?: number;
  fieldWidth?: number;
  fieldApronThickness?: number;
  fieldShape?: string;
} = {}): Point[] {
  if (fieldShape.toLowerCase() !== "rectangle") return [[0, 0]]; // ponytail: R quirk preserved for parity (1-row frame)
  const L = fieldLength / 2;
  const W = fieldWidth / 2;
  const a = fieldApronThickness;
  return [
    [0, W],
    [L, W],
    [L, -W],
    [0, -W],
    [0, -W - a],
    [L + a, -W - a],
    [L + a, W + a],
    [0, W + a],
    [0, W],
  ];
}

/** lacrosse_sideline (R 265). */
export function sideline({
  fieldLength = 0,
  lineThickness = 0,
}: { fieldLength?: number; lineThickness?: number } = {}): Point[] {
  return createRectangle(-fieldLength / 2, fieldLength / 2, 0, lineThickness);
}

/** lacrosse_end_line (R 288). */
export function endLine({
  fieldWidth = 0,
  lineThickness = 0,
}: { fieldWidth?: number; lineThickness?: number } = {}): Point[] {
  return createRectangle(0, lineThickness, -fieldWidth / 2, fieldWidth / 2);
}

/** lacrosse_boards (R 314): inner arcs out, outer arcs back (4n + 7 points), x >= 0 half. */
export function boards({
  fieldLength = 0,
  fieldWidth = 0,
  cornerRadius = 0,
  boundaryThickness = 0,
  npoints,
}: {
  fieldLength?: number;
  fieldWidth?: number;
  cornerRadius?: number;
  boundaryThickness?: number;
} & Arc = {}): Point[] {
  const hl = fieldLength / 2;
  const hw = fieldWidth / 2;
  const cx = hl - cornerRadius;
  const cy = hw - cornerRadius;
  const t = boundaryThickness;
  return [
    [0, hw],
    ...circle({ center: [cx, cy], start: 0.5, end: 0, r: cornerRadius, npoints }),
    [hl, 0],
    ...circle({ center: [cx, -cy], start: 0, end: -0.5, r: cornerRadius, npoints }),
    [0, -hw],
    [0, -hw - t],
    ...circle({ center: [cx, -cy], start: -0.5, end: 0, r: cornerRadius + t, npoints }),
    [hl + t, 0],
    ...circle({ center: [cx, cy], start: 0, end: 0.5, r: cornerRadius + t, npoints }),
    [0, hw + t],
    [0, hw],
  ];
}

/** lacrosse_center_line (R 425). */
export function centerLine({
  centerLineWidth = 0,
  lineThickness = 0,
}: { centerLineWidth?: number; lineThickness?: number } = {}): Point[] {
  return createRectangle(-lineThickness / 2, lineThickness / 2, -centerLineWidth / 2, centerLineWidth / 2);
}

/** lacrosse_wing_line (R 447). */
export function wingLine({
  wingLineLength = 0,
  lineThickness = 0,
}: { wingLineLength?: number; lineThickness?: number } = {}): Point[] {
  return createRectangle(-wingLineLength / 2, wingLineLength / 2, 0, lineThickness);
}

/** lacrosse_restraining_line (R 471). */
export function restrainingLine({
  fieldWidth = 0,
  lineThickness = 0,
}: { fieldWidth?: number; lineThickness?: number } = {}): Point[] {
  return createRectangle(-lineThickness, 0, -fieldWidth / 2, fieldWidth / 2);
}

/** lacrosse_defensive_area_line (R 497). */
export function defensiveAreaLine({
  defensiveAreaLineLength = 0,
  lineThickness = 0,
}: { defensiveAreaLineLength?: number; lineThickness?: number } = {}): Point[] {
  return createRectangle(0, defensiveAreaLineLength, 0, lineThickness);
}

/** lacrosse_goal_line (R 526): a short bar, or (full diameter) two thin arcs of the goal circle at ±0.5π (2n points). */
export function goalLine({
  goalFrameWidth = 0,
  lineThickness = 0,
  goalLineFullDiameter = false,
  goalCircleRadius = 0,
  npoints,
}: {
  goalFrameWidth?: number;
  lineThickness?: number;
  goalLineFullDiameter?: boolean;
  goalCircleRadius?: number;
} & Arc = {}): Point[] {
  if (!goalLineFullDiameter)
    return createRectangle(-lineThickness / 2, lineThickness / 2, -goalFrameWidth / 2, goalFrameWidth / 2);
  const dev = Math.asin(lineThickness / 2 / goalCircleRadius) / Math.PI;
  const r = goalCircleRadius;
  return [
    ...circle({ center: [0, 0], start: 0.5 - dev, end: 0.5 + dev, r, npoints }),
    ...circle({ center: [0, 0], start: -0.5 - dev, end: -0.5 + dev, r, npoints }),
  ];
}

/** lacrosse_referee_crease (R 570 and again, identically, at R 1148): half ring (2n + 4 points). */
export function refereeCrease({
  refereeCreaseRadius = 0,
  lineThickness = 0,
  npoints,
}: { refereeCreaseRadius?: number; lineThickness?: number } & Arc = {}): Point[] {
  const r = refereeCreaseRadius;
  const t = lineThickness;
  return [
    [r, 0],
    ...circle({ center: [0, 0], start: 0, end: 1, r, npoints }),
    [-r, 0],
    [-r + t, 0],
    ...circle({ center: [0, 0], start: 1, end: 0, r: r - t, npoints }),
    [r, 0],
  ];
}

/** lacrosse_referee_crease_fill (R 1199): a half disc; R's `line_thickness` argument is unused. */
export function refereeCreaseFill({
  refereeCreaseRadius = 0,
  npoints,
}: { refereeCreaseRadius?: number; lineThickness?: number } & Arc = {}): Point[] {
  return circle({ center: [0, 0], start: 0, end: 1, r: refereeCreaseRadius, npoints });
}

type GoalCircle = {
  goalCircleRadius?: number;
  lineThickness?: number;
  goalCircleFull360?: boolean;
  goalDepth?: number;
  goalDepthToCircle?: number;
} & Arc;

/** lacrosse_goal_circle (R 634): full-360 → two mirrored half rings with seam points; otherwise the ring clipped at goal_depth_to_circle + goal_depth. */
export function goalCircle({
  goalCircleRadius = 0,
  lineThickness = 0,
  goalCircleFull360 = true,
  goalDepth = 0,
  goalDepthToCircle = 0,
  npoints,
}: GoalCircle = {}): Point[] {
  const r = goalCircleRadius;
  const t = lineThickness;
  if (goalCircleFull360) {
    const half: Point[] = [
      [0, r],
      ...circle({ center: [0, 0], start: 0.5, end: -0.5, r, npoints }),
      [0, -r],
      [0, -r + t],
      ...circle({ center: [0, 0], start: -0.5, end: 0.5, r: r - t, npoints }),
      [0, r - t],
      [0, r],
    ];
    return [...half, ...reflectCoords(half, { overX: false, overY: true })];
  }
  const depth = goalDepthToCircle + goalDepth;
  const start = Math.acos(depth / r) / Math.PI;
  const end = 2 - start;
  return [
    [depth, 0],
    ...circle({ center: [0, 0], start, end, r, npoints }),
    [depth, 0],
    [depth - t, 0],
    ...circle({ center: [0, 0], start: 2 - start, end: 2 - end, r: r - t, npoints }),
    [depth - t, 0],
    [depth, 0],
  ];
}

/** lacrosse_goal_circle_fill (R 734): the inner disc, or its clipped arc. */
export function goalCircleFill({
  goalCircleRadius = 0,
  lineThickness = 0,
  goalCircleFull360 = true,
  goalDepth = 0,
  goalDepthToCircle = 0,
  npoints,
}: GoalCircle = {}): Point[] {
  const r = goalCircleRadius - lineThickness;
  if (goalCircleFull360) return circle({ center: [0, 0], start: 0, end: 2, r, npoints });
  const start = Math.acos((goalDepthToCircle + goalDepth) / goalCircleRadius) / Math.PI;
  const end = 2 - start;
  return circle({ center: [0, 0], start: 2 - start, end: 2 - end, r, npoints });
}

/** lacrosse_goal_arc (R 789). `lineThickness === undefined` reproduces R's un-guarded `field_params$goal_arc_line_thickness` (NULL → numeric(0) recycling): no inner arc, duplicated seam points. */
export function goalArc({
  goalArcExtension = 0,
  goalArcRadius = 0,
  lineThickness,
  npoints,
}: { goalArcExtension?: number; goalArcRadius?: number; lineThickness: number | undefined } & Arc): Point[] {
  const e = goalArcExtension;
  const r = goalArcRadius;
  const outer = circle({ center: [0, 0], start: 0.5, end: 1.5, r, npoints });
  if (lineThickness === undefined) return [[e, r], ...outer, [e, -r], [e, -r], [e, r], [e, r]]; // ponytail: R quirk preserved for parity (n + 5 points)
  const t = lineThickness;
  return [
    [e, r],
    ...outer,
    [e, -r],
    [e, -r + t],
    ...circle({ center: [0, 0], start: 1.5, end: 0.5, r: r - t, npoints }),
    [e, r - t],
    [e, r],
  ];
}

/** lacrosse_goal_fan (R 839): arcs centred at (goal_circle_radius, 0); the inner arc is inset by an angular `t/(R − t)/π` (2n + 6 points; R's sign mix kept). */
export function goalFan({
  goalFanRadius = 0,
  goalCircleRadius = 0,
  lineThickness = 0,
  npoints,
}: { goalFanRadius?: number; goalCircleRadius?: number; lineThickness?: number } & Arc = {}): Point[] {
  const c = goalCircleRadius;
  const t = lineThickness;
  const pi = Math.PI;
  const inset = t / (goalFanRadius + c - t) / pi;
  return [
    [c * Math.cos(0.5 * pi), c * Math.sin(0.5 * pi)],
    [c * Math.cos(0.5 * pi) + t * Math.cos(0.75 * pi), c * Math.sin(0.5 * pi) + t * Math.sin(0.75 * pi)],
    ...circle({ center: [c, 0], start: 0.75, end: 1.25, r: goalFanRadius + c, npoints }),
    [c * Math.cos(1.5 * pi), c * Math.sin(1.5 * pi)],
    [c * Math.cos(1.5 * pi) + t * Math.cos(1.25 * pi), c * Math.sin(1.5 * pi) - t * Math.sin(1.25 * pi)],
    ...circle({ center: [c, 0], start: 1.25 - inset, end: 0.75 + inset, r: goalFanRadius + c - t, npoints }),
    [c * Math.cos(0.5 * pi) + t * Math.cos(0.75 * pi), c * Math.sin(0.5 * pi) - t * Math.sin(0.75 * pi)],
    [c * Math.cos(0.5 * pi), c * Math.sin(0.5 * pi)],
  ];
}

/** lacrosse_goal_fan_hash_mark (R 919): a centred bar rotated by `rotationalAngle` degrees. */
export function goalFanHashMark({
  goalFanHashMarkLength = 0,
  lineThickness = 0,
  rotationalAngle = 0,
}: { goalFanHashMarkLength?: number; lineThickness?: number; rotationalAngle?: number } = {}): Point[] {
  return rotateCoords(
    createRectangle(
      -goalFanHashMarkLength / 2,
      goalFanHashMarkLength / 2,
      -lineThickness / 2,
      lineThickness / 2,
    ),
    rotationalAngle,
  );
}

/** lacrosse_goal_mouth_hash_mark (R 953). */
export function goalMouthHashMark({
  goalMouthHashMarkLength = 0,
  lineThickness = 0,
}: { goalMouthHashMarkLength?: number; lineThickness?: number } = {}): Point[] {
  return createRectangle(-goalMouthHashMarkLength, 0, -lineThickness, 0);
}

/** lacrosse_goal_mouth (R 981): semicircular ring split at ±goal_mouth_semi_circle_separation (2n + 9 points). */
export function goalMouth({
  goalMouthRadius = 0,
  lineThickness = 0,
  goalMouthSemiCircleSeparation = 0,
  npoints,
}: {
  goalMouthRadius?: number;
  lineThickness?: number;
  goalMouthSemiCircleSeparation?: number;
} & Arc = {}): Point[] {
  const r = goalMouthRadius;
  const t = lineThickness;
  const s = goalMouthSemiCircleSeparation;
  return [
    [0, s],
    [0, r],
    ...circle({ center: [0, 0], start: 0.5, end: 1.5, r, npoints }),
    [0, -r],
    [0, -s],
    [-t, -s],
    [-t, -r + t],
    ...circle({ center: [0, 0], start: 1.5, end: 0.5, r: r - t, npoints }),
    [-t, r - t],
    [-t, s],
    [0, s],
  ];
}

/** lacrosse_below_goal_marking (R 1050): a full disc. */
export function belowGoalMarking({
  belowGoalMarkingRadius = 0,
  npoints,
}: { belowGoalMarkingRadius?: number } & Arc = {}): Point[] {
  return circle({ center: [0, 0], start: 0, end: 2, r: belowGoalMarkingRadius, npoints });
}

type Goal = { goalFrameOpeningInterior?: number; goalPostThickness?: number; goalDepth?: number };

/** lacrosse_goal_frame (R 1075): 7-point frame. */
export function goalFrame({
  goalFrameOpeningInterior: o = 0,
  goalPostThickness: p = 0,
  goalDepth: d = 0,
}: Goal = {}): Point[] {
  return [
    [0, o / 2],
    [d - p, 0],
    [0, -o / 2],
    [0, -o / 2 - p],
    [d, 0],
    [0, o / 2 + p],
    [0, 0],
  ];
}

/** lacrosse_goal_net (R 1115): 4 points; the last y is the full opening, not half (R). */
export function goalNet({
  goalFrameOpeningInterior: o = 0,
  goalPostThickness: p = 0,
  goalDepth: d = 0,
}: Goal = {}): Point[] {
  return [
    [0, o / 2],
    [d - p, 0],
    [0, -o / 2],
    [0, o],
  ];
}

/** lacrosse_center_circle (R 1222): outer half arc, seam to `−r − t` (R), inner arc back (2n + 2 points). */
export function centerCircle({
  centerCircleRadius = 0,
  centerCircleThickness = 0,
  npoints,
}: { centerCircleRadius?: number; centerCircleThickness?: number } & Arc = {}): Point[] {
  const r = centerCircleRadius;
  const t = centerCircleThickness;
  return [
    ...circle({ center: [0, 0], start: 0.5, end: 1.5, r, npoints }),
    [0, -r],
    [0, -r - t],
    ...circle({ center: [0, 0], start: 1.5, end: 0.5, r: r - t, npoints }),
  ];
}

type Bench = { benchAreaOutlineThickness?: number; benchLength?: number; benchDepth?: number };

/** lacrosse_player_bench_outline (R 1271): 9 points. */
export function playerBenchOutline({
  benchAreaOutlineThickness: t = 0,
  benchLength: l = 0,
  benchDepth: d = 0,
}: Bench = {}): Point[] {
  return [
    [-t, t],
    [-t, 2 * t + d],
    [l + t, 2 * t + d],
    [l + t, t],
    [l, t],
    [l, t + d],
    [0, t + d],
    [0, t],
    [t, t],
  ];
}

/** lacrosse_player_bench_area_fill (R 1320). */
export function playerBenchAreaFill({
  benchAreaOutlineThickness: t = 0,
  benchLength: l = 0,
  benchDepth: d = 0,
}: Bench = {}): Point[] {
  return createRectangle(-l / 2, l / 2, t, t + d);
}

/** lacrosse_penalty_box_outline (R 1354): 11 points; R's `penalty_box_width` argument is unused. */
export function penaltyBoxOutline({
  penaltyBoxOutlineThickness: t = 0,
  penaltyBoxLength: l = 0,
  penaltyBoxSeparation: s = 0,
  penaltyBoxDepth: d = 0,
}: {
  penaltyBoxOutlineThickness?: number;
  penaltyBoxLength?: number;
  penaltyBoxWidth?: number;
  penaltyBoxSeparation?: number;
  penaltyBoxDepth?: number;
} = {}): Point[] {
  const h = s / 2;
  return [
    [0, -(2 * t + d)],
    [h + l + t, -(2 * t + d)],
    [h + l + t, -t],
    [h + l, -t],
    [h + l, -(t + d)],
    [h + t, -(t + d)],
    [h + t, -t],
    [h, -t],
    [h, -(t + d)],
    [0, -(t + d)],
    [0, -(2 * t + d)],
  ];
}

/** lacrosse_penalty_box_fill (R 1414). */
export function penaltyBoxFill({
  penaltyBoxOutlineThickness: t = 0,
  penaltyBoxLength: l = 0,
  penaltyBoxDepth: d = 0,
}: {
  penaltyBoxOutlineThickness?: number;
  penaltyBoxLength?: number;
  penaltyBoxDepth?: number;
} = {}): Point[] {
  return createRectangle(-l / 2, l / 2, -t, -(t + d));
}

/** lacrosse_off_field_officials_box (R 1445). */
export function offFieldOfficialsBox({
  officialsBoxThickness: t = 0,
  officialsBoxLength: l = 0,
  officialsBoxDepth: d = 0,
}: {
  officialsBoxThickness?: number;
  officialsBoxLength?: number;
  officialsBoxDepth?: number;
} = {}): Point[] {
  return createRectangle(-l / 2, l / 2, -t, -(t + d));
}

/** lacrosse_face_off_marker (R 1485): `tolower(shape)` "o" → disc, "x" → X (14 points), "square" → square (5), else empty. */
export function faceOffMarker({
  shape = "O",
  featureThickness = 0,
  sideLength = 0,
  featureRadius = 0,
  npoints,
}: {
  shape?: string;
  featureThickness?: number;
  sideLength?: number;
  featureRadius?: number;
} & Arc = {}): Point[] {
  switch (shape.toLowerCase()) {
    case "o":
      return circle({ center: [0, 0], start: 0, end: 2, r: featureRadius, npoints });
    case "x":
      return createXShape(sideLength, featureThickness, 45);
    case "square":
      return createSquare(sideLength);
    default:
      return [];
  }
}

/** lacrosse_change_area_outline (R 1527): 7 points. */
export function changeAreaOutline({
  changeAreaLength: l = 0,
  changeAreaWidth: w = 0,
  featureThickness: t = 0,
}: { changeAreaLength?: number; changeAreaWidth?: number; featureThickness?: number } = {}): Point[] {
  return [
    [l, 0],
    [l, -w],
    [0, -w],
    [0, -(w + t)],
    [l + t, -(w + t)],
    [l + t, 0],
    [l, 0],
  ];
}

/** lacrosse_change_area_fill (R 1568). */
export function changeAreaFill({
  changeAreaLength: l = 0,
  changeAreaWidth: w = 0,
}: { changeAreaLength?: number; changeAreaWidth?: number } = {}): Point[] {
  return createRectangle(0, l, -w, 0);
}
