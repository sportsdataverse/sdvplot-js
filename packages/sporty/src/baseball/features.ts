import { SportyError } from "../errors.js";
import type { Point } from "../scene.js";
import { createCircle, createRectangle, createSquare } from "../shapes.js";
import { reflectCoords, rotateCoords } from "../transform.js";

type Arc = { npoints?: number | undefined };
type CircleOpts = { center: Point; start: number; end: number; r: number } & Arc;
const circle = ({ npoints, ...o }: CircleOpts): Point[] =>
  npoints === undefined ? createCircle(o) : createCircle({ ...o, npoints });

/** R math-functions.R quadratic_formula: both roots (NaN when the discriminant is negative, like R's sqrt). */
export const quadraticFormula = (a: number, b: number, c: number): [number, number] => {
  const d = Math.sqrt(b * b - 4 * a * c);
  return [(-b + d) / (2 * a), (-b - d) / (2 * a)];
};

/** baseball_infield_dirt (features-baseball.R 24): infield arc (about the pitcher's plate) + home-plate circle, both clipped where they meet the foul-grass line. */
export function infieldDirt({
  homePlateCircleRadius = 0,
  foulLineToFoulGrass = 0,
  pitchersPlateDistance = 0,
  infieldArcRadius = 0,
  npoints,
}: {
  homePlateCircleRadius?: number;
  foulLineToFoulGrass?: number;
  pitchersPlateDistance?: number;
  infieldArcRadius?: number;
} & Arc = {}): Point[] {
  const hpRoots = quadraticFormula(
    2,
    2 * foulLineToFoulGrass,
    foulLineToFoulGrass ** 2 - homePlateCircleRadius ** 2,
  );
  const hpX = hpRoots.find((r) => r < 0) ?? Number.NaN; // R: roots[which(roots < 0)]
  const hpAcos = Math.acos(hpX / homePlateCircleRadius);
  const hpStart = homePlateCircleRadius === 0 || Number.isNaN(hpAcos) ? 1 : hpAcos / Math.PI;
  const inRoots = quadraticFormula(
    2,
    -2 * foulLineToFoulGrass - 2 * pitchersPlateDistance,
    foulLineToFoulGrass ** 2 +
      2 * foulLineToFoulGrass * pitchersPlateDistance +
      pitchersPlateDistance ** 2 -
      infieldArcRadius ** 2,
  );
  const inX = inRoots.find((r) => r > 0) ?? Number.NaN;
  const inAcos = Math.acos(inX / infieldArcRadius);
  const inStart = infieldArcRadius === 0 || Number.isNaN(inAcos) ? 0.25 : inAcos / Math.PI;
  return [
    ...circle({
      center: [0, pitchersPlateDistance],
      start: inStart,
      end: 1 - inStart,
      r: infieldArcRadius,
      npoints,
    }),
    ...circle({ center: [0, 0], start: hpStart, end: 3 - hpStart, r: homePlateCircleRadius, npoints }),
  ];
}

/** baseball_infield_grass (features-baseball.R 123): home arc, three base arcs, then the home arc's first point again. */
export function infieldGrass({
  homePlateCircleRadius = 0,
  foulLineToInfieldGrass = 0,
  baselineDistance = 0,
  baseAnchorToInfieldGrass = 0,
  npoints,
}: {
  homePlateCircleRadius?: number;
  foulLineToInfieldGrass?: number;
  baselineDistance?: number;
  baseAnchorToInfieldGrass?: number;
} & Arc = {}): Point[] {
  const f = foulLineToInfieldGrass;
  const hr = homePlateCircleRadius;
  const roots1b = quadraticFormula(2, 2 * f, f ** 2 - hr ** 2);
  const x1b = roots1b.find((r) => r > 0) ?? hr;
  const theta1b = hr === 0 ? 0 : Math.acos(x1b / hr) / Math.PI;
  const roots3b = quadraticFormula(2, -2 * f, f ** 2 - hr ** 2);
  // R tests `> 0` for emptiness but then filters `< 0`; transcribed literally.
  const x3b = roots3b.some((r) => r > 0) ? roots3b.find((r) => r < 0) : hr;
  const theta3b = hr === 0 ? 1 : Math.acos((x3b ?? Number.NaN) / hr) / Math.PI;
  const bl = baselineDistance;
  const fbRoots = quadraticFormula(
    2,
    2 * f - 2 * Math.SQRT2 * bl,
    f ** 2 - Math.SQRT2 * f * bl + bl ** 2 - baseAnchorToInfieldGrass ** 2,
  );
  const fbX = fbRoots.find((r) => r < bl * Math.cos(Math.PI / 4)) ?? Number.NaN;
  const fbDelta = Math.abs(fbX - bl * Math.cos(Math.PI / 4));
  const th = baseAnchorToInfieldGrass === 0 ? 0 : Math.acos(fbDelta / baseAnchorToInfieldGrass) / Math.PI;
  const r = baseAnchorToInfieldGrass;
  const home = circle({ center: [0, 0], start: theta3b, end: theta1b, r: hr, npoints });
  return [
    ...home,
    ...circle({
      center: [bl * Math.cos(Math.PI / 4), bl * Math.sin(Math.PI / 4)],
      start: 1 + th,
      end: 1 - th,
      r,
      npoints,
    }),
    ...circle({ center: [0, bl * Math.SQRT2], start: 1.5 + th, end: 1.5 - th, r, npoints }),
    ...circle({
      center: [bl * Math.cos((3 * Math.PI) / 4), bl * Math.sin((3 * Math.PI) / 4)],
      start: 1 - (1 - th),
      end: 1 - (1 + th),
      r,
      npoints,
    }),
    ...home.slice(0, 1),
  ];
}

/** baseball_pitchers_mound. */
export const pitchersMound = ({
  pitchersMoundRadius = 0,
  npoints,
}: { pitchersMoundRadius?: number } & Arc = {}): Point[] =>
  circle({ center: [0, 0], start: 0, end: 2, r: pitchersMoundRadius, npoints });

/** baseball_home_plate (R 645): 6-point pentagon with its back tip at the origin. */
export const homePlate = ({ homePlateEdgeLength: e = 0 }: { homePlateEdgeLength?: number } = {}): Point[] => [
  [0, 0],
  [e / 2, e / 2],
  [e / 2, e],
  [-e / 2, e],
  [-e / 2, e / 2],
  [0, 0],
];

/** baseball_base (features-baseball.R 682): a square rotated 45 degrees, shifted along x for 1B (left) / 3B (right) so the bag sits inside the baseline. */
export function base({
  baseSideLength = 0,
  adjustXLeft = false,
  adjustXRight = false,
}: { baseSideLength?: number; adjustXLeft?: boolean; adjustXRight?: boolean } = {}): Point[] {
  const amt = (baseSideLength * Math.SQRT2) / 2;
  const dx = (adjustXLeft ? -amt : 0) + (adjustXRight ? amt : 0);
  return rotateCoords(createSquare(baseSideLength, [0, 0]), 45).map(([x, y]): Point => [x + dx, y]);
}

/** baseball_pitchers_plate. */
export const pitchersPlate = ({
  pitchersPlateLength: l = 0,
  pitchersPlateWidth: w = 0,
}: { pitchersPlateLength?: number; pitchersPlateWidth?: number } = {}): Point[] =>
  createRectangle(-l / 2, l / 2, 0, w);

/** baseball_batters_box (R 291): 9-point half frame, mirrored over the y axis, shifted by the y adjustment. */
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
  // The 9th y is the FULL length: an R quirk kept for parity.
  const half: Point[] = [
    [0, l],
    [w, l],
    [w, -l],
    [0, -l],
    [0, -l + t],
    [w - t, -l + t],
    [w - t, l - t],
    [0, l - t],
    [0, battersBoxLength],
  ];
  return [...half, ...reflectCoords(half, { overX: false, overY: true })].map(
    ([x, y]): Point => [x, y + battersBoxYAdj],
  );
}

/** baseball_catchers_box (R 357): rectangle or trapezoid, chosen by a case-insensitive shape name. */
export function catchersBox({
  catchersBoxDepth: depth = 0,
  catchersBoxWidth: width = 0,
  battersBoxLength = 0,
  battersBoxYAdj: adj = 0,
  catchersBoxShape = "rectangle",
  catchersBoxThickness: t = 0,
  homePlateCircleRadius: hr = 0,
}: {
  catchersBoxDepth?: number;
  catchersBoxWidth?: number;
  battersBoxLength?: number;
  battersBoxYAdj?: number;
  catchersBoxShape?: string;
  catchersBoxThickness?: number;
  homePlateCircleRadius?: number;
} = {}): Point[] {
  const c = Math.cos(Math.PI / 4);
  const s = Math.sin(Math.PI / 4);
  const w = width / 2;
  const hl = battersBoxLength / 2;
  const rect = (): Point[] =>
    (
      [
        [w, -hl],
        [w, -depth],
        [-w, -depth],
        [-w, -hl],
        [-w + t, -hl],
        [-w + t, -depth + t],
        [w - t, -depth + t],
        [w - t, -hl],
        [w, -hl],
      ] as Point[]
    ).map(([x, y]): Point => [x, y + adj]);
  const trap = (): Point[] => {
    const b1y = -hl + adj;
    const b1 = 2 * (Math.abs(b1y / c) * s);
    const b2yOuter = -depth - t;
    const b2yInner = -depth;
    const b2Inner = 2 * (Math.abs(hr - t / c) * s);
    const b2Outer = 2 * (Math.abs(hr) * s);
    return [
      [b1 / 2, b1y],
      [b2Outer / 2 - t, b2yInner + t],
      [-b2Outer / 2 + t, b2yInner + t],
      [-b1 / 2, b1y],
      [-b1 / 2 - t, b1y],
      [-b2Inner / 2 - 2 * t, b2yOuter + t],
      [b2Inner / 2 + 2 * t, b2yOuter + t],
      [b1 / 2 + t, b1y],
      [b1 / 2, b1y],
    ];
  };
  switch (catchersBoxShape.toLowerCase()) {
    case "rect":
    case "rectangle":
    case "rectangular":
      return rect();
    case "trap":
    case "trapezoid":
    case "trapezoidal":
      return trap();
    default:
      throw new SportyError(`${catchersBoxShape} is not a valid shape for the catcher's box`);
  }
}

/** baseball_foul_line (R 488): 5-point strip from the batter's box corner toward the pole. */
export function foulLine({
  isLine1b = false,
  lineDistance = 0,
  battersBoxLength = 0,
  battersBoxWidth = 0,
  battersBoxYAdj = 0,
  homePlateSideToBattersBox = 0,
  foulLineThickness: t = 0,
}: {
  isLine1b?: boolean;
  lineDistance?: number;
  battersBoxLength?: number;
  battersBoxWidth?: number;
  battersBoxYAdj?: number;
  homePlateSideToBattersBox?: number;
  foulLineThickness?: number;
} = {}): Point[] {
  const cornerX = battersBoxWidth + homePlateSideToBattersBox;
  const cornerY = battersBoxLength / 2 + battersBoxYAdj;
  const start = cornerX > cornerY ? cornerY : cornerX + battersBoxYAdj / 2 + t;
  if (!isLine1b) {
    const ex = lineDistance * Math.cos((3 * Math.PI) / 4);
    const ey = lineDistance * Math.sin((3 * Math.PI) / 4);
    return [
      [-start, start],
      [ex, ey],
      [ex + t, ey],
      [-start + t, start],
      [-start, start],
    ];
  }
  const ex = lineDistance * Math.cos(Math.PI / 4);
  const ey = lineDistance * Math.sin(Math.PI / 4);
  return [
    [start, start],
    [ex, ey],
    [ex - t, ey],
    [start - t, start],
    [start, start],
  ];
}

/** baseball_running_lane (R 572): 7-point literal, every coordinate divided by the square root of 2. */
export function runningLane({
  runningLaneDepth: d = 0,
  runningLaneLength: l = 0,
  runningLaneStartDistance: s = 0,
  runningLaneThickness: t = 0,
}: {
  runningLaneDepth?: number;
  runningLaneLength?: number;
  runningLaneStartDistance?: number;
  runningLaneThickness?: number;
} = {}): Point[] {
  const q = Math.SQRT2;
  return [
    [s / q, s / q],
    [(s + d) / q, (s - d) / q],
    [(s + d + l) / q, (s - d + l) / q],
    [(s + d + l - t) / q, (s - d + l + t) / q],
    [(s + d) / q, (s - d + 2 * t) / q],
    [(s + t) / q, (s + t) / q],
    [s / q, s / q],
  ];
}
