import type { Point } from "../scene.js";
import { createCircle } from "../shapes.js";
import { reflectCoords } from "../transform.js";

// ponytail: these five softball_* builders are line-for-line the baseball_* ones in features-softball.R, so reuse them.
export { base, homePlate, infieldDirt, pitchersPlate, runningLane } from "../baseball/features.js";

type Arc = { npoints?: number | undefined };
const circle = (o: { center: Point; start: number; end: number; r: number } & Arc): Point[] => {
  const { npoints, ...rest } = o;
  return npoints === undefined ? createCircle(rest) : createCircle({ ...rest, npoints });
};

/** softball_batters_box: 9-point half frame (closed at half the length, unlike baseball's), mirrored over the y axis. */
export function battersBox({
  battersBoxLength = 0,
  battersBoxWidth = 0,
  battersBoxYAdj = 0,
  battersBoxThickness: t = 0,
}: {
  battersBoxLength?: number;
  battersBoxWidth?: number;
  battersBoxYAdj?: number;
  battersBoxThickness?: number;
} = {}): Point[] {
  const w = battersBoxWidth / 2;
  const l = battersBoxLength / 2;
  const half: Point[] = [
    [0, l],
    [w, l],
    [w, -l],
    [0, -l],
    [0, -l + t],
    [w - t, -l + t],
    [w - t, l - t],
    [0, l - t],
    [0, l],
  ];
  return [...half, ...reflectCoords(half, { overX: false, overY: true })].map(
    ([x, y]): Point => [x, y + battersBoxYAdj],
  );
}

/** softball_catchers_box: a 9-point rectangular frame open toward home plate, from the batter's boxes' back edge. */
export function catchersBox({
  catchersBoxDepth: depth = 0,
  catchersBoxWidth: width = 0,
  battersBoxLength = 0,
  battersBoxYAdj = 0,
  catchersBoxThickness: t = 0,
}: {
  catchersBoxDepth?: number;
  catchersBoxWidth?: number;
  battersBoxLength?: number;
  battersBoxYAdj?: number;
  catchersBoxThickness?: number;
} = {}): Point[] {
  const w = width / 2;
  const front = -battersBoxLength / 2 + battersBoxYAdj;
  const back = front - depth;
  return [
    [w, front],
    [w, back],
    [-w, back],
    [-w, front],
    [-w + t, front],
    [-w + t, back + t],
    [w - t, back + t],
    [w - t, front],
    [w, front],
  ];
}

/** softball_foul_line: 5-point strip from the nearer of the batter's box's outer edge and front edge toward the pole. */
export function foulLine({
  isLine1b = false,
  lineDistance = 0,
  battersBoxLength = 0,
  battersBoxWidth = 0,
  battersBoxYAdj = 0,
  homePlateSideToBattersBox = 0,
  homePlateEdgeLength = 0,
  foulLineThickness: t = 0,
}: {
  isLine1b?: boolean;
  lineDistance?: number;
  battersBoxLength?: number;
  battersBoxWidth?: number;
  battersBoxYAdj?: number;
  homePlateSideToBattersBox?: number;
  homePlateEdgeLength?: number;
  foulLineThickness?: number;
} = {}): Point[] {
  const start = Math.min(
    homePlateEdgeLength / 2 + homePlateSideToBattersBox + battersBoxWidth,
    battersBoxLength / 2 + battersBoxYAdj,
  );
  const a = isLine1b ? Math.PI / 4 : (3 * Math.PI) / 4;
  const ex = lineDistance * Math.cos(a);
  const ey = lineDistance * Math.sin(a);
  const sx = isLine1b ? start : -start;
  const dt = isLine1b ? -t : t;
  return [
    [sx, start],
    [ex, ey],
    [ex + dt, ey],
    [sx + dt, start],
    [sx, start],
  ];
}

/** softball_pitchers_circle: the outer circle, then the inner one (radius less the line width) traced back. */
export const pitchersCircle = ({
  pitchersCircleRadius: r = 0,
  pitchersCircleThickness: t = 0,
  npoints,
}: { pitchersCircleRadius?: number; pitchersCircleThickness?: number } & Arc = {}): Point[] => [
  ...circle({ center: [0, 0], start: 0, end: 2, r, npoints }),
  ...circle({ center: [0, 0], start: 2, end: 0, r: r - t, npoints }),
];

/**
 * softball_pitchers_lane: one side line from the pitcher's plate's end toward the inner front corner of the batter's box,
 * `pitchersLaneLength` long, relative to the plate's front edge (straight down when the two points coincide).
 */
export function pitchersLane({
  pitchersLaneLength: len = 0,
  pitchersPlateLength = 0,
  pitchersPlateFrontToHomePlate = 0,
  homePlateEdgeLength = 0,
  homePlateSideToBattersBox = 0,
  battersBoxLength = 0,
  battersBoxYAdj = 0,
  pitchersLaneThickness: t = 0,
}: {
  pitchersLaneLength?: number;
  pitchersPlateLength?: number;
  pitchersPlateFrontToHomePlate?: number;
  homePlateEdgeLength?: number;
  homePlateSideToBattersBox?: number;
  battersBoxLength?: number;
  battersBoxYAdj?: number;
  pitchersLaneThickness?: number;
} = {}): Point[] {
  const sx = pitchersPlateLength / 2;
  const dx = homePlateEdgeLength / 2 + homePlateSideToBattersBox - sx;
  const dy = battersBoxLength / 2 + battersBoxYAdj - pitchersPlateFrontToHomePlate;
  const theta = dx === 0 && dy === 0 ? -Math.PI / 2 : Math.atan2(dy, dx);
  const ex = sx + len * Math.cos(theta);
  const ey = len * Math.sin(theta);
  return [
    [sx, 0],
    [ex, ey],
    [ex - t, ey],
    [sx - t, 0],
    [sx, 0],
  ];
}

/** softball_coaches_box: a 7-point L along the first-base line (a = distance along it, d = distance outside it). */
export function coachesBox({
  baselineDistance = 0,
  coachesBoxDepth = 0,
  coachesBoxLength = 0,
  coachesBoxWidth = 0,
  coachesBoxThickness: t = 0,
}: {
  baselineDistance?: number;
  coachesBoxDepth?: number;
  coachesBoxLength?: number;
  coachesBoxWidth?: number;
  coachesBoxThickness?: number;
} = {}): Point[] {
  const aEnd = baselineDistance;
  const aStart = baselineDistance - coachesBoxLength;
  const dIn = coachesBoxDepth;
  const dOut = coachesBoxDepth + coachesBoxWidth;
  const ad: [number, number][] = [
    [aEnd, dIn],
    [aStart, dIn],
    [aStart, dOut],
    [aStart + t, dOut],
    [aStart + t, dIn + t],
    [aEnd, dIn + t],
    [aEnd, dIn],
  ];
  return ad.map(([a, d]): Point => [(a + d) / Math.SQRT2, (a - d) / Math.SQRT2]);
}
