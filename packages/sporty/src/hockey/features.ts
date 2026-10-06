import type { Point } from "../scene.js";
import { createCircle, createRectangle } from "../shapes.js";
import { reflectCoords } from "../transform.js";

/** Optional arc resolution; undefined falls through to createCircle's default (1000, as in R). */
type Arc = { npoints?: number | undefined };

type CircleOpts = { center: Point; start: number; end: number; r: number } & Arc;
const circle = ({ npoints, ...o }: CircleOpts): Point[] =>
  npoints === undefined ? createCircle(o) : createCircle({ ...o, npoints });

/** R `data.frame(x = c(...), y = c(...))`. */
const zip = (xs: readonly number[], ys: readonly number[]): Point[] =>
  xs.map((x, i): Point => [x, ys[i] ?? 0]);

type ZoneOpts = {
  rinkLength?: number;
  rinkWidth?: number;
  featureRadius?: number;
  nzoneLength?: number;
} & Arc;

// Surface base features -------------------------------------------------------------------------

export function defensiveZone({
  rinkLength = 0,
  rinkWidth = 0,
  featureRadius = 0,
  nzoneLength = 0,
  npoints,
}: ZoneOpts = {}): Point[] {
  const halfLength = rinkLength / 2;
  const halfWidth = rinkWidth / 2;
  const cx = halfLength - featureRadius;
  const cy = halfWidth - featureRadius;
  return [
    [-nzoneLength / 2, halfWidth],
    ...circle({ center: [-cx, cy], start: 0.5, end: 1, r: featureRadius, npoints }),
    [-halfLength, 0],
    ...circle({ center: [-cx, -cy], start: 1, end: 1.5, r: featureRadius, npoints }),
    [-nzoneLength / 2, -halfWidth],
    [-nzoneLength / 2, halfWidth],
  ];
}

export function neutralZone({
  rinkWidth = 0,
  featureThickness = 0,
}: { rinkWidth?: number; featureThickness?: number } = {}): Point[] {
  return createRectangle(-featureThickness / 2, featureThickness / 2, -rinkWidth / 2, rinkWidth / 2);
}

export function offensiveZone({
  rinkLength = 0,
  rinkWidth = 0,
  featureRadius = 0,
  nzoneLength = 0,
  npoints,
}: ZoneOpts = {}): Point[] {
  const halfLength = rinkLength / 2;
  const halfWidth = rinkWidth / 2;
  const cx = halfLength - featureRadius;
  const cy = halfWidth - featureRadius;
  return [
    [nzoneLength / 2, halfWidth],
    ...circle({ center: [cx, cy], start: 0.5, end: 0, r: featureRadius, npoints }),
    [halfLength, 0],
    ...circle({ center: [cx, -cy], start: 0, end: -0.5, r: featureRadius, npoints }),
    [nzoneLength / 2, -halfWidth],
    [nzoneLength / 2, halfWidth],
  ];
}

// Surface boundaries ----------------------------------------------------------------------------

export function boards({
  rinkLength = 0,
  rinkWidth = 0,
  featureRadius = 0,
  featureThickness = 0,
  npoints,
}: {
  rinkLength?: number;
  rinkWidth?: number;
  featureRadius?: number;
  featureThickness?: number;
} & Arc = {}): Point[] {
  const halfLength = rinkLength / 2;
  const halfWidth = rinkWidth / 2;
  const cx = halfLength - featureRadius;
  const cy = halfWidth - featureRadius;
  const outer = featureRadius + featureThickness;
  return [
    [0, halfWidth],
    ...circle({ center: [cx, cy], start: 0.5, end: 0, r: featureRadius, npoints }),
    [halfLength, 0],
    ...circle({ center: [cx, -cy], start: 0, end: -0.5, r: featureRadius, npoints }),
    [0, -halfWidth],
    [0, -halfWidth - featureThickness],
    ...circle({ center: [cx, -cy], start: -0.5, end: 0, r: outer, npoints }),
    [halfLength + featureThickness, 0],
    ...circle({ center: [cx, cy], start: 0, end: 0.5, r: outer, npoints }),
    [0, halfWidth + featureThickness],
    [0, halfWidth],
  ];
}

// Surface lines ---------------------------------------------------------------------------------

export function centerLine({
  featureThickness = 0,
  rinkWidth = 0,
  centerFaceoffSpotGap = 0,
}: { featureThickness?: number; rinkWidth?: number; centerFaceoffSpotGap?: number } = {}): Point[] {
  return createRectangle(
    -featureThickness / 2,
    featureThickness / 2,
    centerFaceoffSpotGap / 2,
    rinkWidth / 2,
  );
}

export function refereeCrease({
  featureRadius = 0,
  featureThickness = 0,
  npoints,
}: { featureRadius?: number; featureThickness?: number } & Arc = {}): Point[] {
  return [
    [featureRadius, 0],
    ...circle({ center: [0, 0], start: 0, end: 1, r: featureRadius, npoints }),
    [-featureRadius, 0],
    [-featureRadius + featureThickness, 0],
    ...circle({ center: [0, 0], start: 1, end: 0, r: featureRadius - featureThickness, npoints }),
    [featureRadius, 0],
  ];
}

export function zoneLine({
  rinkWidth = 0,
  featureThickness = 0,
}: { rinkWidth?: number; featureThickness?: number } = {}): Point[] {
  return createRectangle(0, featureThickness, -rinkWidth / 2, rinkWidth / 2);
}

/** Absolute value of `xAnchor` forces the right-hand (TV) side, as in R; the shape is re-anchored at x = 0. */
export function goalLine({
  rinkLength = 0,
  rinkWidth = 0,
  featureRadius = 0,
  featureThickness = 0,
  xAnchor = 0,
  npoints,
}: {
  rinkLength?: number;
  rinkWidth?: number;
  featureRadius?: number;
  featureThickness?: number;
  xAnchor?: number;
} & Arc = {}): Point[] {
  const halfLength = rinkLength / 2;
  const halfWidth = rinkWidth / 2;
  const cx = halfLength - featureRadius;
  const cy = halfWidth - featureRadius;
  const maxX = Math.abs(xAnchor) + featureThickness / 2;
  if (maxX <= cx) {
    return createRectangle(-featureThickness / 2, featureThickness / 2, -halfWidth, halfWidth);
  }
  const baseX = Math.abs(xAnchor) - cx;
  const startX = baseX - featureThickness / 2;
  const endX = baseX + featureThickness / 2;
  // R quirk kept: no guard on asin(), so |x| > r yields NaN points just as R does.
  const thetaStart = Math.asin(startX / featureRadius) / Math.PI;
  const thetaEnd = Math.asin(endX / featureRadius) / Math.PI;
  return [
    ...circle({ center: [cx, cy], start: 0.5 - thetaStart, end: 0.5 - thetaEnd, r: featureRadius, npoints }),
    ...circle({
      center: [cx, -cy],
      start: -0.5 + thetaEnd,
      end: -0.5 + thetaStart,
      r: featureRadius,
      npoints,
    }),
  ].map(([x, y]): Point => [x - Math.abs(xAnchor), y]);
}

export function goaltendersRestrictedArea({
  rinkLength = 0,
  featureThickness = 0,
  shortBaseWidth = 0,
  longBaseWidth = 0,
  xAnchor = 0,
}: {
  rinkLength?: number;
  featureThickness?: number;
  shortBaseWidth?: number;
  longBaseWidth?: number;
  xAnchor?: number;
} = {}): Point[] {
  const hs = shortBaseWidth / 2;
  const hl = longBaseWidth / 2;
  const ax = Math.abs(xAnchor);
  const t = featureThickness;
  const xs = [
    ax,
    rinkLength / 2,
    rinkLength / 2,
    ax - t / 2,
    ax - t / 2,
    rinkLength / 2,
    rinkLength / 2,
    ax,
    ax,
  ];
  const ys = [hs, hl, hl - t, hs - t, -hs + t, -hl + t, -hl, -hs, hs];
  return zip(
    xs.map((x) => x - ax),
    ys,
  );
}

export function odzoneFaceoffLines({
  featureThickness = 0,
  faceoffLineDistX = 0,
  faceoffLineDistY = 0,
  faceoffLineLength = 0,
  faceoffLineWidth = 0,
}: {
  featureThickness?: number;
  faceoffLineDistX?: number;
  faceoffLineDistY?: number;
  faceoffLineLength?: number;
  faceoffLineWidth?: number;
} = {}): Point[] {
  const dx = faceoffLineDistX;
  const dy = faceoffLineDistY;
  const t = featureThickness;
  const half = zip(
    [dx, dx + faceoffLineLength, dx + faceoffLineLength, dx + t, dx + t, dx, dx],
    [dy, dy, dy + t, dy + t, dy + faceoffLineWidth, dy + faceoffLineWidth, dy],
  );
  return [...half, ...reflectCoords(half, { overX: true, overY: false })];
}

// Surface features ------------------------------------------------------------------------------

export function centerFaceoffSpot({
  featureRadius = 0,
  npoints,
}: { featureRadius?: number } & Arc = {}): Point[] {
  return circle({ center: [0, 0], start: 0, end: 2, r: featureRadius, npoints });
}

type CreaseOpts = {
  featureRadius?: number;
  featureThickness?: number;
  creaseStyle?: string;
  creaseLength?: number;
  creaseWidth?: number;
  notchDistX?: number;
  notchWidth?: number;
} & Arc;

/** R: theta = acos(half_width / r) / pi, or 0 when r is 0 or |half_width / r| > 1. */
const creaseTheta = (featureRadius: number, halfCreaseWidth: number): number =>
  featureRadius === 0 || Math.abs(halfCreaseWidth / featureRadius) > 1
    ? 0
    : Math.acos(halfCreaseWidth / featureRadius) / Math.PI;

/** Styles `nhl98` / `ushl1` / `nhl92` (case-insensitive); any other style is R's switch default, a single (0, 0) point. */
export function goalCreaseOutline({
  featureRadius = 0,
  featureThickness = 0,
  creaseStyle = "",
  creaseLength = 0,
  creaseWidth = 0,
  notchDistX = 0,
  notchWidth = 0,
  npoints,
}: CreaseOpts = {}): Point[] {
  const hw = creaseWidth / 2;
  const theta = creaseTheta(featureRadius, hw);
  const t = featureThickness;
  const nx = notchDistX;
  const r = featureRadius;
  const ri = featureRadius - featureThickness;
  const arc = (start: number, end: number, rr: number): Point[] =>
    circle({ center: [0, 0], start, end, r: rr, npoints });
  switch (creaseStyle.toLowerCase()) {
    case "nhl98":
      return [
        ...zip([0, -creaseLength], [hw, hw]),
        ...arc(0.5 + theta, 1.5 - theta, r),
        ...zip(
          [-creaseLength, 0, 0, -nx, -nx, -(nx + t), -(nx + t), -creaseLength],
          [-hw, -hw, -hw + t, -hw + t, -hw + t + notchWidth, -hw + t + notchWidth, -hw + t, -hw + t],
        ),
        ...arc(1.5 - theta, 0.5 + theta, ri),
        ...zip(
          [-creaseLength, -(nx + t), -(nx + t), -nx, -nx, 0, 0],
          [hw - t, hw - t, hw - t - notchWidth, hw - t - notchWidth, hw - t, hw - t, hw],
        ),
      ];
    case "ushl1":
      return [
        ...arc(0.5, 1.5, r),
        ...arc(1.5, 1.5 - theta, ri),
        ...zip(
          [-nx - t, 0, 0, -nx, -nx, -nx - t, -nx - t],
          [-hw, -hw, -hw + t, -hw + t, -hw + t + notchWidth, -hw + t + notchWidth, -hw],
        ),
        ...arc(1.5 - theta, 0.5 + theta, ri),
        ...zip(
          [-nx - t, -nx - t, -nx, -nx, 0, 0, -nx - t],
          [hw, hw - t - notchWidth, hw - t - notchWidth, hw - t, hw - t, hw, hw],
        ),
        ...arc(0.5 + theta, 0.5, ri),
        ...zip([0, 0], [r - t, r]),
      ];
    case "nhl92":
      return [
        ...arc(0.5, 1.5, r),
        ...arc(1.5, 1.5 - theta, ri),
        ...zip(
          [-nx, -nx + notchWidth, -nx + notchWidth, -nx, -nx, -nx - t, -nx - t, -nx],
          [-hw, -hw, -hw + t, -hw + t, -hw + t + notchWidth, -hw + t + notchWidth, -hw, -hw],
        ),
        ...arc(1.5 - theta, 0.5 + theta, ri),
        ...zip(
          [-nx, -nx + notchWidth, -nx + notchWidth, -nx, -nx, -nx - t, -nx - t, -nx],
          [hw, hw, hw - t, hw - t, hw - t - notchWidth, hw - t - notchWidth, hw, hw],
        ),
        ...arc(0.5 + theta, 0.5, ri),
        ...zip([0, 0], [r - t, r]),
      ];
    default:
      return [[0, 0]];
  }
}

/** Same style switch as `goalCreaseOutline`; `creaseLength` is used by `ushl1` only. */
export function goalCreaseFill({
  featureRadius = 0,
  featureThickness = 0,
  creaseStyle = "",
  creaseLength = 0,
  creaseWidth = 0,
  notchDistX = 0,
  notchWidth = 0,
  npoints,
}: CreaseOpts = {}): Point[] {
  const hw = creaseWidth / 2;
  const theta = creaseTheta(featureRadius, hw);
  const t = featureThickness;
  const nx = notchDistX;
  const ri = featureRadius - featureThickness;
  const arc = (start: number, end: number): Point[] => circle({ center: [0, 0], start, end, r: ri, npoints });
  switch (creaseStyle.toLowerCase()) {
    case "nhl98":
      return [
        ...zip(
          [0, -nx, -nx, -(nx + t), -(nx + t)],
          [hw - t, hw - t, hw - t - notchWidth, hw - t - notchWidth, hw - t],
        ),
        ...arc(0.5 + theta, 1.5 - theta),
        ...zip(
          [-(nx + t), -(nx + t), -nx, -nx, 0, 0],
          [-hw + t, -hw + t + notchWidth, -hw + t + notchWidth, -hw + t, -hw + t, hw - t],
        ),
      ];
    case "ushl1":
      return [
        ...zip([0, -creaseLength], [hw, hw]),
        ...arc(0.5 + theta, 1.5 - theta),
        ...zip([-creaseLength, 0], [-hw, -hw]),
      ];
    case "nhl92":
      return arc(0.5, 1.5);
    default:
      return [[0, 0]];
  }
}

export function centerFaceoffCircle({
  featureRadius = 0,
  featureThickness = 0,
  npoints,
}: { featureRadius?: number; featureThickness?: number } & Arc = {}): Point[] {
  return [
    ...circle({ center: [0, 0], start: 0.5, end: 1.5, r: featureRadius, npoints }),
    [0, -featureRadius],
    [0, -featureRadius - featureThickness],
    ...circle({ center: [0, 0], start: 1.5, end: 0.5, r: featureRadius - featureThickness, npoints }),
  ];
}

export function odzoneFaceoffCircle({
  featureRadius = 0,
  featureThickness = 0,
  hashmarkWidth = 0,
  hashmarkExtSpacing = 0,
  npoints,
}: {
  featureRadius?: number;
  featureThickness?: number;
  hashmarkWidth?: number;
  hashmarkExtSpacing?: number;
} & Arc = {}): Point[] {
  const ext = hashmarkExtSpacing / 2;
  const int = ext - featureThickness;
  const guard = featureRadius === 0 || Math.abs(ext / featureRadius) > 1;
  const theta1 = guard ? 0 : Math.asin(ext / featureRadius) / Math.PI;
  const theta2 = guard ? 0 : Math.asin(int / featureRadius) / Math.PI;
  const r = featureRadius;
  const arc = (start: number, end: number, rr: number): Point[] =>
    circle({ center: [0, 0], start, end, r: rr, npoints });
  const half: Point[] = [
    [0, r],
    ...arc(0.5, 0.5 + theta2, r),
    [-int, r + hashmarkWidth],
    [-ext, r + hashmarkWidth],
    ...arc(0.5 + theta1, 1.5 - theta1, r),
    [-ext, -r - hashmarkWidth],
    [-int, -r - hashmarkWidth],
    ...arc(1.5 - theta2, 1.5, r),
    [0, -r + featureThickness],
    ...arc(1.5, 0.5, r - featureThickness),
    [0, r],
  ];
  return [...half, ...reflectCoords(half, { overX: false, overY: true })];
}

export function nodzoneFaceoffSpotRing({
  featureRadius = 0,
  featureThickness = 0,
  npoints,
}: { featureRadius?: number; featureThickness?: number } & Arc = {}): Point[] {
  const half: Point[] = [
    ...circle({ center: [0, 0], start: 0.5, end: 1.5, r: featureRadius, npoints }),
    [0, -featureRadius + featureThickness],
    ...circle({ center: [0, 0], start: 1.5, end: 0.5, r: featureRadius - featureThickness, npoints }),
    [0, featureRadius - featureThickness],
    [0, featureRadius],
  ];
  return [...half, ...reflectCoords(half, { overX: false, overY: true })];
}

export function nodzoneFaceoffSpotStripe({
  featureRadius = 0,
  featureThickness = 0,
  gapWidth = 0,
  npoints,
}: { featureRadius?: number; featureThickness?: number; gapWidth?: number } & Arc = {}): Point[] {
  const inner = featureRadius - featureThickness;
  const stripe = inner - gapWidth;
  const theta = featureRadius === 0 || Math.abs(stripe / inner) > 1 ? 0 : Math.asin(stripe / inner) / Math.PI;
  return [
    ...circle({ center: [0, 0], start: 0.5 - theta, end: 0.5 + theta, r: inner, npoints }),
    ...circle({ center: [0, 0], start: 1.5 - theta, end: 1.5 + theta, r: inner, npoints }),
  ];
}

type GoalOpts = {
  featureRadius?: number;
  goalMouthWidth?: number;
  goalBackWidth?: number;
  goalDepth?: number;
  goalPostDiameter?: number;
} & Arc;

export function goalFrame({
  featureRadius = 0,
  goalMouthWidth = 0,
  goalBackWidth = 0,
  goalDepth = 0,
  goalPostDiameter = 0,
  npoints,
}: GoalOpts = {}): Point[] {
  const hm = goalMouthWidth / 2;
  const cx = goalDepth - featureRadius - goalPostDiameter;
  const cy = goalBackWidth / 2 - featureRadius + goalPostDiameter / 2;
  const ri = featureRadius - goalPostDiameter;
  return [
    [0, hm + goalPostDiameter],
    ...circle({ center: [cx, cy], start: 0.65, end: 0, r: featureRadius, npoints }),
    ...circle({ center: [cx, -cy], start: 0, end: -0.65, r: featureRadius, npoints }),
    [0, -(hm + goalPostDiameter)],
    [0, -hm],
    ...circle({ center: [cx, -cy], start: -0.65, end: 0, r: ri, npoints }),
    ...circle({ center: [cx, cy], start: 0, end: 0.65, r: ri, npoints }),
    [0, hm],
    [0, hm + goalPostDiameter],
  ];
}

export function goalFrameFill({
  featureRadius = 0,
  goalMouthWidth = 0,
  goalBackWidth = 0,
  goalDepth = 0,
  goalPostDiameter = 0,
  npoints,
}: GoalOpts = {}): Point[] {
  const hm = goalMouthWidth / 2;
  const cx = goalDepth - featureRadius - goalPostDiameter;
  const cy = goalBackWidth / 2 - featureRadius + goalPostDiameter / 2;
  const ri = featureRadius - goalPostDiameter;
  return [
    [0, -hm],
    ...circle({ center: [cx, -cy], start: -0.65, end: 0, r: ri, npoints }),
    ...circle({ center: [cx, cy], start: 0, end: 0.65, r: ri, npoints }),
    [0, hm],
  ];
}

type BoxOpts = { featureThickness?: number; benchLength?: number; benchDepth?: number };

export function playerBenchOutline({
  featureThickness = 0,
  benchLength = 0,
  benchDepth = 0,
}: BoxOpts = {}): Point[] {
  const t = featureThickness;
  return zip(
    [-t, -t, benchLength + t, benchLength + t, benchLength, benchLength, 0, 0, t],
    [t, 2 * t + benchDepth, 2 * t + benchDepth, t, t, t + benchDepth, t + benchDepth, t, t],
  );
}

export function playerBenchAreaFill({
  featureThickness = 0,
  benchLength = 0,
  benchDepth = 0,
}: BoxOpts = {}): Point[] {
  return createRectangle(-benchLength / 2, benchLength / 2, featureThickness, featureThickness + benchDepth);
}

export function penaltyBoxOutline({
  featureThickness = 0,
  penaltyBoxLength = 0,
  penaltyBoxSeparation = 0,
  penaltyBoxDepth = 0,
}: {
  featureThickness?: number;
  penaltyBoxLength?: number;
  penaltyBoxSeparation?: number;
  penaltyBoxDepth?: number;
} = {}): Point[] {
  const t = featureThickness;
  const s = penaltyBoxSeparation / 2;
  const d = penaltyBoxDepth;
  return zip(
    [
      0,
      s + penaltyBoxLength + t,
      s + penaltyBoxLength + t,
      s + penaltyBoxLength,
      s + penaltyBoxLength,
      s + t,
      s + t,
      s,
      s,
      0,
      0,
    ],
    [-(2 * t + d), -(2 * t + d), -t, -t, -(t + d), -(t + d), -t, -t, -(t + d), -(t + d), -(2 * t + d)],
  );
}

/** R quirk kept: y_min > y_max, so the rectangle is traced clockwise. */
export function penaltyBoxFill({
  featureThickness = 0,
  penaltyBoxLength = 0,
  penaltyBoxDepth = 0,
}: { featureThickness?: number; penaltyBoxLength?: number; penaltyBoxDepth?: number } = {}): Point[] {
  return createRectangle(
    -penaltyBoxLength / 2,
    penaltyBoxLength / 2,
    -featureThickness,
    -(featureThickness + penaltyBoxDepth),
  );
}

export function offIceOfficialsBox({
  featureThickness = 0,
  officialsBoxLength = 0,
  officialsBoxDepth = 0,
}: { featureThickness?: number; officialsBoxLength?: number; officialsBoxDepth?: number } = {}): Point[] {
  return createRectangle(
    -officialsBoxLength / 2,
    officialsBoxLength / 2,
    -featureThickness,
    -(featureThickness + officialsBoxDepth),
  );
}
