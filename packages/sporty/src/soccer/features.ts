import type { Point } from "../scene.js";
import { createCircle, createRectangle } from "../shapes.js";

/** Optional arc resolution; undefined falls through to createCircle's default (1000, as in R). Same helper as basketball/features.ts. */
type Arc = { npoints?: number | undefined };
type CircleOpts = { center: Point; start: number; end: number; r: number } & Arc;
const circle = ({ npoints, ...o }: CircleOpts): Point[] =>
  npoints === undefined ? createCircle(o) : createCircle({ ...o, npoints });

/** soccer_half_pitch: one half of the playing surface. */
export function halfPitch({
  pitchLength = 0,
  pitchWidth = 0,
}: { pitchLength?: number; pitchWidth?: number } = {}): Point[] {
  return createRectangle(-pitchLength / 4, pitchLength / 4, -pitchWidth / 2, pitchWidth / 2);
}

/** soccer_pitch_apron: 9-point half outline including goal_depth padding. */
export function pitchApron({
  pitchLength = 0,
  pitchWidth = 0,
  pitchApronTouchline = 0,
  pitchApronGoalLine = 0,
  goalDepth = 0,
}: {
  pitchLength?: number;
  pitchWidth?: number;
  pitchApronTouchline?: number;
  pitchApronGoalLine?: number;
  goalDepth?: number;
} = {}): Point[] {
  const L = pitchLength / 2;
  const W = pitchWidth / 2;
  const x = L + pitchApronGoalLine + goalDepth;
  const y = W + pitchApronTouchline + goalDepth;
  return [
    [0, W],
    [L, W],
    [L, -W],
    [0, -W],
    [0, -y],
    [x, -y],
    [x, y],
    [0, y],
    [0, W],
  ];
}

/** soccer_touchline (features-soccer.R 105). */
export function touchline({
  pitchLength = 0,
  featureThickness = 0,
}: { pitchLength?: number; featureThickness?: number } = {}): Point[] {
  return createRectangle(-pitchLength / 2, pitchLength / 2, -featureThickness, 0);
}

/** soccer_goal_line (R 129). */
export function goalLine({
  pitchWidth = 0,
  featureThickness = 0,
}: { pitchWidth?: number; featureThickness?: number } = {}): Point[] {
  return createRectangle(-featureThickness, 0, -pitchWidth / 2, pitchWidth / 2);
}

/** soccer_halfway_line (R 160). */
export function halfwayLine({
  pitchWidth = 0,
  featureThickness = 0,
}: { pitchWidth?: number; featureThickness?: number } = {}): Point[] {
  return createRectangle(-featureThickness / 2, featureThickness / 2, -pitchWidth / 2, pitchWidth / 2);
}

/** soccer_penalty_box (features-soccer.R 194): box outline + the penalty arc (outer arc then inner arc back), x <= 0 half, anchored at the goal line. */
export function penaltyBox({
  featureRadius = 0,
  featureThickness = 0,
  boxLength = 0,
  penaltyMarkDist = 0,
  goalWidth = 0,
  goalPostToBoxEdge = 0,
  npoints,
}: {
  featureRadius?: number;
  featureThickness?: number;
  boxLength?: number;
  penaltyMarkDist?: number;
  goalWidth?: number;
  goalPostToBoxEdge?: number;
} & Arc = {}): Point[] {
  const halfBoxWidth = goalWidth / 2 + goalPostToBoxEdge;
  const xOut = boxLength - penaltyMarkDist;
  const rInner = featureRadius - featureThickness;
  let startOuter = 0.5;
  let startInner = 0.5;
  if (featureRadius !== 0 && !(Math.abs(xOut / featureRadius) > 1 || Math.abs(xOut / rInner) > 1)) {
    startOuter = 1 - Math.acos(xOut / featureRadius) / Math.PI;
    startInner = 1 - Math.acos(xOut / rInner) / Math.PI;
  }
  return [
    [-featureThickness, halfBoxWidth],
    [-boxLength, halfBoxWidth],
    ...circle({ center: [-penaltyMarkDist, 0], start: startOuter, end: 1, r: featureRadius, npoints }),
    ...circle({ center: [-penaltyMarkDist, 0], start: 1, end: startInner, r: rInner, npoints }),
    [-boxLength, 0],
    [-(boxLength - featureThickness), 0],
    [-(boxLength - featureThickness), halfBoxWidth - featureThickness],
    [-featureThickness, halfBoxWidth - featureThickness],
    [-featureThickness, halfBoxWidth],
  ];
}

/** soccer_goal_box (R 272). */
export function goalBox({
  featureThickness: t = 0,
  boxLength: b = 0,
  goalWidth = 0,
  goalPostToBoxEdge = 0,
}: {
  featureThickness?: number;
  boxLength?: number;
  goalWidth?: number;
  goalPostToBoxEdge?: number;
} = {}): Point[] {
  const h = goalWidth / 2 + goalPostToBoxEdge;
  return [
    [-t, h],
    [-b, h],
    [-b, -h],
    [-t, -h],
    [-t, -(h - t)],
    [-(b - t), -(h - t)],
    [-(b - t), h - t],
    [-t, h - t],
    [-t, h],
  ];
}

/** soccer_corner_arc: quarter ring from pi to 1.5pi and back. */
export function cornerArc({
  featureRadius = 0,
  featureThickness = 0,
  npoints,
}: { featureRadius?: number; featureThickness?: number } & Arc = {}): Point[] {
  return [
    ...circle({ center: [0, 0], start: 1, end: 1.5, r: featureRadius, npoints }),
    ...circle({ center: [0, 0], start: 1.5, end: 1, r: featureRadius - featureThickness, npoints }),
  ];
}

/** soccer_center_circle: ring, outer 0.5 -> 1.5, inner back. */
export function centerCircle({
  featureRadius = 0,
  featureThickness = 0,
  npoints,
}: { featureRadius?: number; featureThickness?: number } & Arc = {}): Point[] {
  return [
    ...circle({ center: [0, 0], start: 0.5, end: 1.5, r: featureRadius, npoints }),
    ...circle({ center: [0, 0], start: 1.5, end: 0.5, r: featureRadius - featureThickness, npoints }),
  ];
}

/** soccer_center_mark (R 389): a full disc. */
export function centerMark({ featureRadius = 0, npoints }: { featureRadius?: number } & Arc = {}): Point[] {
  return circle({ center: [0, 0], start: 0, end: 2, r: featureRadius, npoints });
}

/** soccer_penalty_mark (R 410): a full disc. */
export function penaltyMark({ featureRadius = 0, npoints }: { featureRadius?: number } & Arc = {}): Point[] {
  return circle({ center: [0, 0], start: 0, end: 2, r: featureRadius, npoints });
}

/** soccer_corner_defensive_marks (features-soccer.R 445): a short tick perpendicular to the touchline or to the goal line; empty when neither flag is set (R returns a 0-row frame). */
export function cornerDefensiveMarks({
  featureThickness = 0,
  isTouchline = false,
  isGoalLine = false,
  depth = 0,
  separationFromLine = 0,
}: {
  featureThickness?: number;
  isTouchline?: boolean;
  isGoalLine?: boolean;
  depth?: number;
  separationFromLine?: number;
} = {}): Point[] {
  if (isTouchline)
    return createRectangle(
      -featureThickness / 2,
      featureThickness / 2,
      separationFromLine,
      separationFromLine + depth,
    );
  if (isGoalLine)
    return createRectangle(
      separationFromLine,
      separationFromLine + depth,
      -featureThickness / 2,
      featureThickness / 2,
    );
  return [];
}

/** soccer_goal: 9-point goal frame. */
export function goal({
  featureThickness: t = 0,
  goalWidth: w = 0,
  goalDepth: d = 0,
}: { featureThickness?: number; goalWidth?: number; goalDepth?: number } = {}): Point[] {
  return [
    [0, w / 2 + t],
    [d + t, w / 2 + t],
    [d + t, -(w / 2 + t)],
    [0, -(w / 2 + t)],
    [0, -w / 2],
    [d, -w / 2],
    [d, w / 2],
    [0, w / 2],
    [0, w / 2 + t],
  ];
}
