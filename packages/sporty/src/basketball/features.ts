import type { Point } from "../scene.js";
import { createCircle, createRectangle } from "../shapes.js";

/** Optional arc resolution; undefined falls through to createCircle's default (1000, as in R). */
type Arc = { npoints?: number | undefined };

// R: `if (is.na(asin(v))) 0 else asin(v) / pi`
const asinOverPi = (v: number): number => {
  const a = Math.asin(v);
  return Number.isNaN(a) ? 0 : a / Math.PI;
};

type CircleOpts = { center: Point; start: number; end: number; r: number } & Arc;
const circle = ({ npoints, ...o }: CircleOpts): Point[] =>
  npoints === undefined ? createCircle(o) : createCircle({ ...o, npoints });

export function halfCourt({
  courtLength = 0,
  courtWidth = 0,
}: { courtLength?: number; courtWidth?: number } = {}): Point[] {
  return createRectangle(-courtLength / 4, courtLength / 4, -courtWidth / 2, courtWidth / 2);
}

export function twoPointRange({
  basketCenterToBaseline = 0,
  basketCenterToCornerThree = 0,
  lineThickness = 0,
  twoPointRangeRadius = 0,
  npoints,
}: {
  basketCenterToBaseline?: number;
  basketCenterToCornerThree?: number;
  lineThickness?: number;
  twoPointRangeRadius?: number;
} & Arc = {}): Point[] {
  const startY = basketCenterToCornerThree - lineThickness;
  const angle = asinOverPi(startY / twoPointRangeRadius);
  return [
    [basketCenterToBaseline, startY],
    ...circle({ center: [0, 0], start: 1 - angle, end: 1 + angle, r: twoPointRangeRadius, npoints }),
    [basketCenterToBaseline, -startY],
    [basketCenterToBaseline, startY],
  ];
}

export function centerCircleFill({
  centerCircleRadius = 0,
  lineThickness = 0,
  npoints,
}: { centerCircleRadius?: number; lineThickness?: number } & Arc = {}): Point[] {
  return circle({ center: [0, 0], start: 0, end: 2, r: centerCircleRadius - lineThickness, npoints });
}

export function paintedArea({
  laneLength = 0,
  laneWidth = 0,
  paintMargin = 0,
  lineThickness = 0,
}: { laneLength?: number; laneWidth?: number; paintMargin?: number; lineThickness?: number } = {}): Point[] {
  return createRectangle(
    paintMargin,
    laneLength - lineThickness - paintMargin,
    -laneWidth / 2 + lineThickness + paintMargin,
    laneWidth / 2 - lineThickness - paintMargin,
  );
}

export function freeThrowCircleFill({
  freeThrowCircleRadius = 0,
  lineThickness = 0,
  npoints,
}: { freeThrowCircleRadius?: number; lineThickness?: number } & Arc = {}): Point[] {
  return circle({ center: [0, 0], start: 0.5, end: 1.5, r: freeThrowCircleRadius - lineThickness, npoints });
}

export function courtApron({
  courtLength = 0,
  courtWidth = 0,
  courtApronEndline = 0,
  courtApronSideline = 0,
  courtApronToBoundary = 0,
  lineThickness = 0,
}: {
  courtLength?: number;
  courtWidth?: number;
  courtApronEndline?: number;
  courtApronSideline?: number;
  courtApronToBoundary?: number;
  lineThickness?: number;
} = {}): Point[] {
  const outerX = courtLength / 2 + courtApronEndline;
  const innerX = courtLength / 2 + lineThickness + courtApronToBoundary;
  const outerY = courtWidth / 2 + courtApronSideline;
  const innerY = courtWidth / 2 + lineThickness + courtApronToBoundary;
  return [
    [0, outerY],
    [outerX, outerY],
    [outerX, -courtWidth / 2 - courtApronSideline],
    [0, -courtWidth / 2 - courtApronSideline],
    [0, -innerY],
    [innerX, -innerY],
    [innerX, innerY],
    [0, innerY],
    [0, outerY],
  ];
}

export function endline({
  courtWidth = 0,
  lineThickness = 0,
}: { courtWidth?: number; lineThickness?: number } = {}): Point[] {
  return createRectangle(0, lineThickness, -courtWidth / 2 - lineThickness, courtWidth / 2 + lineThickness);
}

export function sideline({
  courtLength = 0,
  lineThickness = 0,
}: { courtLength?: number; lineThickness?: number } = {}): Point[] {
  return createRectangle(-courtLength / 2 - lineThickness, courtLength / 2 + lineThickness, 0, lineThickness);
}

export function centerCircleOutline({
  centerCircleRadius = 0,
  lineThickness = 0,
  npoints,
}: { centerCircleRadius?: number; lineThickness?: number } & Arc = {}): Point[] {
  return [
    ...circle({ center: [0, 0], start: 0.5, end: 1.5, r: centerCircleRadius, npoints }), // outer edge
    ...circle({ center: [0, 0], start: 1.5, end: 0.5, r: centerCircleRadius - lineThickness, npoints }), // inner edge, reversed
  ];
}

export function divisionLine({
  courtWidth = 0,
  lineThickness = 0,
  divisionLineExtension = 0,
}: { courtWidth?: number; lineThickness?: number; divisionLineExtension?: number } = {}): Point[] {
  // R quirk: with an extension both y bounds shift down by extension + thickness (not symmetric).
  return divisionLineExtension > 0
    ? createRectangle(
        -lineThickness / 2,
        lineThickness / 2,
        -courtWidth / 2 - divisionLineExtension - lineThickness,
        courtWidth / 2 - divisionLineExtension - lineThickness,
      )
    : createRectangle(-lineThickness / 2, lineThickness / 2, -courtWidth / 2, courtWidth / 2);
}

export function threePointLine({
  basketCenterToBaseline = 0,
  basketCenterToCornerThree = 0,
  lineThickness = 0,
  threePointLineRadius = 0,
  npoints,
}: {
  basketCenterToBaseline?: number;
  basketCenterToCornerThree?: number;
  lineThickness?: number;
  threePointLineRadius?: number;
} & Arc = {}): Point[] {
  const startYOuter = basketCenterToCornerThree;
  const startYInner = startYOuter - lineThickness;
  const rOuter = threePointLineRadius;
  const rInner = rOuter - lineThickness;
  const angleOuter = asinOverPi(startYOuter / rOuter);
  const angleInner = asinOverPi(startYInner / rInner);
  return [
    [basketCenterToBaseline, startYOuter],
    ...circle({ center: [0, 0], start: 1 - angleOuter, end: 1 + angleOuter, r: rOuter, npoints }),
    [basketCenterToBaseline, -startYOuter],
    [basketCenterToBaseline, -startYInner],
    ...circle({ center: [0, 0], start: 1 + angleInner, end: 1 - angleInner, r: rInner, npoints }),
    [basketCenterToBaseline, startYInner],
    [basketCenterToBaseline, startYOuter],
  ];
}

export function freeThrowLaneBoundary({
  laneLength = 0,
  laneWidth = 0,
  lineThickness = 0,
}: { laneLength?: number; laneWidth?: number; lineThickness?: number } = {}): Point[] {
  return [
    [0, laneWidth / 2],
    [-laneLength, laneWidth / 2],
    [-laneLength, -laneWidth / 2],
    [0, -laneWidth / 2],
    [0, -laneWidth / 2 + lineThickness],
    [-laneLength + lineThickness, -laneWidth / 2 + lineThickness],
    [-laneLength + lineThickness, laneWidth / 2 - lineThickness],
    [0, laneWidth / 2 - lineThickness],
    [0, laneWidth / 2],
  ];
}

export function freeThrowCircle({
  overhang = 0,
  freeThrowCircleRadius = 0,
  lineThickness = 0,
  npoints,
}: { overhang?: number; freeThrowCircleRadius?: number; lineThickness?: number } & Arc = {}): Point[] {
  // R: `if (!is.na(x)) theta <- x else 0` — only NaN (0/0) is NA; ±Inf passes through.
  const t = overhang / freeThrowCircleRadius / Math.PI;
  const theta = Number.isNaN(t) ? 0 : t;
  const startAngle = 0.5 - theta;
  const endAngle = 1.5 + theta;
  return [
    ...circle({ center: [0, 0], start: startAngle, end: endAngle, r: freeThrowCircleRadius, npoints }),
    ...circle({
      center: [0, 0],
      start: endAngle,
      end: startAngle,
      r: freeThrowCircleRadius - lineThickness,
      npoints,
    }),
  ];
}

export function freeThrowCircleDash({
  featureRadius = 0,
  lineThickness = 0,
  startAngle = 0,
  endAngle = 0,
  npoints,
}: {
  featureRadius?: number;
  lineThickness?: number;
  startAngle?: number;
  endAngle?: number;
} & Arc = {}): Point[] {
  return [
    ...circle({ center: [0, 0], start: startAngle, end: endAngle, r: featureRadius, npoints }),
    ...circle({
      center: [0, 0],
      start: endAngle,
      end: startAngle,
      r: featureRadius - lineThickness,
      npoints,
    }),
  ];
}

export function laneSpaceMark({
  featureThickness = 0,
  markDepth = 0,
}: { featureThickness?: number; markDepth?: number } = {}): Point[] {
  return createRectangle(-featureThickness, 0, 0, markDepth);
}

export function inboundingLine({
  lineThickness = 0,
  inPlayExt = 0,
  outOfBoundsExt = 0,
  drawnDirection = "",
}: {
  lineThickness?: number;
  inPlayExt?: number;
  outOfBoundsExt?: number;
  drawnDirection?: string;
} = {}): Point[] {
  return drawnDirection.toLowerCase() === "top_down"
    ? createRectangle(-lineThickness, 0, -inPlayExt, outOfBoundsExt + lineThickness)
    : createRectangle(-lineThickness, 0, -(outOfBoundsExt + lineThickness), inPlayExt);
}

export function substitutionLine({
  lineThickness = 0,
  substitutionLineWidth = 0,
  drawnDirection = "",
}: { lineThickness?: number; substitutionLineWidth?: number; drawnDirection?: string } = {}): Point[] {
  // R quirk: x_min = 0 > x_max = -line_thickness (reversed bounds), kept as is.
  return drawnDirection.toLowerCase() === "bottom_up"
    ? createRectangle(0, -lineThickness, 0, substitutionLineWidth + lineThickness)
    : createRectangle(0, -lineThickness, -(substitutionLineWidth + lineThickness), 0);
}

export function teamBenchLine({
  lineThickness = 0,
  extension = 0,
  drawnDirection = "",
}: { lineThickness?: number; extension?: number; drawnDirection?: string } = {}): Point[] {
  // R quirk: bottom_up draws toward +x, otherwise toward -x.
  return drawnDirection.toLowerCase() === "bottom_up"
    ? createRectangle(0, lineThickness, 0, extension)
    : createRectangle(0, -lineThickness, -extension, 0);
}

export function restrictedArc({
  featureRadius = 0,
  lineThickness = 0,
  backboardToCenterOfBasket = 0,
  npoints,
}: {
  featureRadius?: number;
  lineThickness?: number;
  backboardToCenterOfBasket?: number;
} & Arc = {}): Point[] {
  const c: Point = [-backboardToCenterOfBasket, 0];
  return [
    [0, featureRadius],
    ...circle({ center: c, start: 0.5, end: 1.5, r: featureRadius, npoints }),
    [0, -featureRadius],
    [0, -(featureRadius + lineThickness)],
    ...circle({ center: c, start: 1.5, end: 0.5, r: featureRadius + lineThickness, npoints }),
    [0, featureRadius + lineThickness],
    [0, featureRadius],
  ];
}

export function lowerDefensiveBoxMark({
  drawnDirection = "",
  extension = 0,
  lineThickness = 0,
}: { drawnDirection?: string; extension?: number; lineThickness?: number } = {}): Point[] {
  const d = drawnDirection.toLowerCase();
  if (d === "left_to_right") return createRectangle(-extension, 0, 0, lineThickness);
  // R quirk: y_min = extension > y_max = 0 (reversed bounds).
  if (d === "top_down") return createRectangle(-lineThickness, 0, extension, 0);
  // R: neither branch assigns, so `return(lower_defensive_box_mark_df)` errors "object not found".
  throw new Error(`lowerDefensiveBoxMark: unsupported drawnDirection "${drawnDirection}"`);
}

export function backboard({
  backboardWidth = 0,
  backboardThickness = 0,
}: { backboardWidth?: number; backboardThickness?: number } = {}): Point[] {
  return createRectangle(0, backboardThickness, -backboardWidth / 2, backboardWidth / 2);
}

export function basketRing({
  basketRingConnectorWidth = 0,
  backboardFaceToRingCent = 0,
  basketRingInnerRadius = 0,
  basketRingThickness = 0,
  npoints,
}: {
  basketRingConnectorWidth?: number;
  backboardFaceToRingCent?: number;
  basketRingInnerRadius?: number;
  basketRingThickness?: number;
} & Arc = {}): Point[] {
  const rOuter = basketRingInnerRadius + basketRingThickness;
  const startAngle = asinOverPi(basketRingConnectorWidth / 2 / rOuter);
  const endAngle = 2 - startAngle;
  const joinX = -backboardFaceToRingCent + rOuter * Math.cos(startAngle * Math.PI);
  const h = basketRingConnectorWidth / 2;
  return [
    [0, h],
    [joinX, h],
    ...circle({
      center: [-backboardFaceToRingCent, 0],
      start: startAngle,
      end: endAngle,
      r: rOuter,
      npoints,
    }),
    [joinX, -h],
    [0, -h],
    [0, h],
  ];
}

export function net({
  basketRingInnerRadius = 0,
  npoints,
}: { basketRingInnerRadius?: number } & Arc = {}): Point[] {
  return circle({ center: [0, 0], start: 0, end: 2, r: basketRingInnerRadius, npoints });
}
