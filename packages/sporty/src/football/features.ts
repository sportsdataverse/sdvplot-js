import type { Point } from "../scene.js";
import { createRectangle } from "../shapes.js";

// No football feature has an arc, so no builder takes `npoints`.

/** R `data.frame(x = c(...), y = c(...))`. */
const zip = (xs: readonly number[], ys: readonly number[]): Point[] =>
  xs.map((x, i): Point => [x, ys[i] ?? 0]);

const isRectangular = (benchShape: string): boolean =>
  ["rectangle", "rectangular"].includes(benchShape.toLowerCase());

/**
 * R's bench-corner x for the apron/border outlines. Rectangular benches with equal sides divide by zero, so
 * `m = Inf` and the corner falls back to `x1` (JS and R agree on Infinity here).
 */
function outerCornerX(
  benchShape: string,
  startingDepth: number,
  thickness: number,
  teamBenchLengthFieldSide: number,
  teamBenchLengthBackSide: number,
  teamBenchWidth: number,
  teamBenchAreaBorderThickness: number,
): number {
  if (!isRectangular(benchShape))
    return teamBenchLengthBackSide / 2 + teamBenchAreaBorderThickness + thickness / 2;
  const m = teamBenchWidth / (teamBenchLengthBackSide / 2 - teamBenchLengthFieldSide / 2);
  const y2 = startingDepth + thickness;
  const y1 = startingDepth - teamBenchWidth - teamBenchAreaBorderThickness;
  const x1 = teamBenchLengthFieldSide / 2 + teamBenchAreaBorderThickness + thickness;
  return (y2 - y1) / m + x1;
}

type BenchOpts = {
  fieldLength?: number;
  fieldWidth?: number;
  endzoneLength?: number;
  restrictedAreaLength?: number;
  restrictedAreaWidth?: number;
  coachingBoxLength?: number;
  coachingBoxWidth?: number;
  teamBenchLengthFieldSide?: number;
  teamBenchLengthBackSide?: number;
  teamBenchWidth?: number;
  teamBenchAreaBorderThickness?: number;
  benchShape?: string;
};

// Surface base features -------------------------------------------------------------------------

/** Quarter-length half-field rectangle (R anchors it at ±L/4). */
export function halfField({
  fieldLength = 0,
  fieldWidth = 0,
}: { fieldLength?: number; fieldWidth?: number } = {}): Point[] {
  return createRectangle(-fieldLength / 4, fieldLength / 4, -fieldWidth / 2, fieldWidth / 2);
}

export function endzone({
  fieldWidth = 0,
  endzoneLength = 0,
}: { fieldWidth?: number; endzoneLength?: number } = {}): Point[] {
  return createRectangle(-endzoneLength / 2, endzoneLength / 2, -fieldWidth / 2, fieldWidth / 2);
}

/** R quirk kept: the "restricted area (top)" vertex uses field_border_thickness, not restricted_area_width. */
export function fieldApron({
  fieldLength = 0,
  fieldWidth = 0,
  endzoneLength = 0,
  boundaryThickness = 0,
  fieldBorderThickness = 0,
  restrictedAreaLength = 0,
  restrictedAreaWidth = 0,
  coachingBoxLength = 0,
  coachingBoxWidth = 0,
  teamBenchLengthFieldSide = 0,
  teamBenchLengthBackSide = 0,
  teamBenchWidth = 0,
  teamBenchAreaBorderThickness = 0,
  extraApronPadding = 0,
  benchShape = "",
}: BenchOpts & {
  boundaryThickness?: number;
  fieldBorderThickness?: number;
  extraApronPadding?: number;
} = {}): Point[] {
  const fbt = fieldBorderThickness;
  const tb = teamBenchAreaBorderThickness;
  const extX = fieldLength / 2 + endzoneLength + boundaryThickness + fbt + extraApronPadding;
  const depth =
    fieldWidth / 2 + boundaryThickness + restrictedAreaWidth + coachingBoxWidth + teamBenchWidth + tb + fbt;
  const extY = depth + extraApronPadding;
  const outer = outerCornerX(
    benchShape,
    depth,
    fbt,
    teamBenchLengthFieldSide,
    teamBenchLengthBackSide,
    teamBenchWidth,
    tb,
  );
  const benchX = teamBenchLengthFieldSide / 2 + tb + fbt;
  const coachX = coachingBoxLength / 2 + tb + fbt;
  const restrictedX = restrictedAreaLength / 2 + tb + fbt;
  const edgeX = fieldLength / 2 + endzoneLength + boundaryThickness + fbt;
  const benchY = fieldWidth / 2 + boundaryThickness + restrictedAreaWidth + coachingBoxWidth;
  const coachY = fieldWidth / 2 + boundaryThickness + restrictedAreaWidth;
  const edgeY = fieldWidth / 2 + boundaryThickness + fbt;
  return zip(
    [
      0,
      outer,
      benchX,
      coachX,
      restrictedX,
      edgeX,
      edgeX,
      restrictedX,
      coachX,
      benchX,
      outer,
      0,
      0,
      extX,
      extX,
      0,
      0,
    ],
    [
      depth,
      depth,
      benchY,
      coachY,
      edgeY,
      edgeY,
      -edgeY,
      -edgeY,
      -coachY,
      -benchY,
      -depth,
      -depth,
      -extY,
      -extY,
      extY,
      extY,
      depth,
    ],
  );
}

// Surface boundaries ----------------------------------------------------------------------------

export function endLine({
  featureThickness = 0,
  fieldWidth = 0,
}: { featureThickness?: number; fieldWidth?: number } = {}): Point[] {
  return createRectangle(
    0,
    featureThickness,
    -(fieldWidth / 2 + featureThickness),
    fieldWidth / 2 + featureThickness,
  );
}

export function sideline({
  featureThickness = 0,
  fieldLength = 0,
  endzoneLength = 0,
}: { featureThickness?: number; fieldLength?: number; endzoneLength?: number } = {}): Point[] {
  return createRectangle(
    -(fieldLength / 2 + endzoneLength),
    fieldLength / 2 + endzoneLength,
    0,
    featureThickness,
  );
}

export function fieldBorder({
  fieldLength = 0,
  fieldWidth = 0,
  featureThickness = 0,
  endzoneLength = 0,
  boundaryLineThickness = 0,
  restrictedAreaLength = 0,
  restrictedAreaWidth = 0,
  coachingBoxLength = 0,
  coachingBoxWidth = 0,
  teamBenchLengthFieldSide = 0,
  teamBenchLengthBackSide = 0,
  teamBenchWidth = 0,
  teamBenchAreaBorderThickness = 0,
  surroundsTeamBenchArea = false,
  benchShape = "",
}: BenchOpts & {
  featureThickness?: number;
  boundaryLineThickness?: number;
  surroundsTeamBenchArea?: boolean;
} = {}): Point[] {
  const t = featureThickness;
  const tb = teamBenchAreaBorderThickness;
  const blt = boundaryLineThickness;
  const raX = restrictedAreaLength / 2 + tb;
  const edgeX = fieldLength / 2 + endzoneLength + blt;
  const edgeY = fieldWidth / 2 + blt;
  if (!surroundsTeamBenchArea) {
    return zip(
      [raX, edgeX, edgeX, raX, raX, edgeX + t, edgeX + t, raX, raX],
      [edgeY, edgeY, -edgeY, -edgeY, -(edgeY + t), -(edgeY + t), edgeY + t, edgeY + t, edgeY],
    );
  }
  const depth = fieldWidth / 2 + blt + restrictedAreaWidth + coachingBoxWidth + teamBenchWidth + tb;
  const outer = outerCornerX(
    benchShape,
    depth,
    t,
    teamBenchLengthFieldSide,
    teamBenchLengthBackSide,
    teamBenchWidth,
    tb,
  );
  const backX = teamBenchLengthBackSide / 2 + tb;
  const benchX = teamBenchLengthFieldSide / 2 + tb;
  const coachX = coachingBoxLength / 2 + tb;
  const benchY = depth - teamBenchWidth - tb;
  return zip(
    [
      0,
      backX,
      benchX,
      coachX,
      raX,
      edgeX,
      edgeX,
      raX,
      coachX,
      benchX,
      backX,
      0,
      0,
      outer,
      benchX + t,
      coachX + t,
      raX + t,
      edgeX + t,
      edgeX + t,
      raX + t,
      coachX + t,
      benchX + t,
      outer,
      0,
      0,
    ],
    [
      depth,
      depth,
      benchY,
      benchY,
      edgeY,
      edgeY,
      -fieldWidth / 2 - blt,
      -fieldWidth / 2 - blt,
      -depth + teamBenchWidth + tb,
      -depth + teamBenchWidth + tb,
      -depth,
      -depth,
      -depth - t,
      -depth - t,
      -depth + teamBenchWidth + tb,
      -depth + teamBenchWidth + tb + coachingBoxWidth,
      -fieldWidth / 2 - blt - t,
      -fieldWidth / 2 - blt - t,
      edgeY + t,
      edgeY + t,
      depth - teamBenchWidth - tb - coachingBoxWidth,
      depth - teamBenchWidth - tb,
      depth + t,
      depth + t,
      depth,
    ],
  );
}

export function fieldBorderOutline({
  fieldLength = 0,
  fieldWidth = 0,
  featureThickness = 0,
  endzoneLength = 0,
  boundaryLineThickness = 0,
  restrictedAreaLength = 0,
  restrictedAreaWidth = 0,
  coachingBoxLength = 0,
  coachingBoxWidth = 0,
  teamBenchLengthFieldSide = 0,
  teamBenchLengthBackSide = 0,
  teamBenchWidth = 0,
  teamBenchAreaBorderThickness = 0,
  fieldBorderThickness = 0,
  surroundsTeamBenchArea = true,
  benchShape = "",
}: BenchOpts & {
  featureThickness?: number;
  boundaryLineThickness?: number;
  fieldBorderThickness?: number;
  surroundsTeamBenchArea?: boolean;
} = {}): Point[] {
  const t = featureThickness;
  const tb = teamBenchAreaBorderThickness;
  const blt = boundaryLineThickness;
  const fbt = fieldBorderThickness;
  if (!surroundsTeamBenchArea) {
    const raX = restrictedAreaLength / 2 + tb;
    const edgeX = fieldLength / 2 + endzoneLength + blt + fbt;
    const edgeY = fieldWidth / 2 + blt + fbt;
    return zip(
      [raX, edgeX, edgeX, raX, raX, edgeX + t, edgeX + t, raX, raX],
      [edgeY, edgeY, -edgeY, -edgeY, -(edgeY + t), -(edgeY + t), edgeY + t, edgeY + t, edgeY],
    );
  }
  const depth = fieldWidth / 2 + blt + restrictedAreaWidth + coachingBoxWidth + teamBenchWidth + tb + fbt;
  const outer = outerCornerX(
    benchShape,
    depth,
    fbt,
    teamBenchLengthFieldSide,
    teamBenchLengthBackSide,
    teamBenchWidth,
    tb,
  );
  const benchX = teamBenchLengthFieldSide / 2 + tb + fbt;
  const coachX = coachingBoxLength / 2 + tb + fbt;
  const raX = restrictedAreaLength / 2 + tb + fbt;
  const edgeX = fieldLength / 2 + endzoneLength + blt + fbt;
  const outerEdgeX = fieldLength / 2 + blt + endzoneLength + fbt + t;
  const benchY = fieldWidth / 2 + blt + restrictedAreaWidth + coachingBoxWidth;
  const coachY = fieldWidth / 2 + blt + restrictedAreaWidth;
  const edgeY = fieldWidth / 2 + blt + fbt;
  const outY = depth + t;
  return zip(
    [
      0,
      outer,
      benchX,
      coachX,
      raX,
      edgeX,
      edgeX,
      raX,
      coachX,
      benchX,
      outer,
      0,
      0,
      outer + t,
      benchX + t,
      coachX + t,
      raX + t,
      outerEdgeX,
      outerEdgeX,
      raX + t,
      coachX + t,
      benchX + t,
      outer + t,
      0,
      0,
    ],
    [
      depth,
      depth,
      benchY,
      coachY,
      edgeY,
      edgeY,
      -edgeY,
      -edgeY,
      -coachY,
      -benchY,
      -depth,
      -depth,
      -outY,
      -outY,
      -benchY,
      -coachY,
      -(edgeY + t),
      -(edgeY + t),
      edgeY + t,
      edgeY + t,
      coachY,
      benchY,
      outY,
      outY,
      depth,
    ],
  );
}

export const redZoneBorder = ({ featureThickness = 0 }: { featureThickness?: number } = {}): Point[] =>
  createRectangle(0, 20, 0, featureThickness);

export const redZoneBorderOutline = ({ featureThickness = 0 }: { featureThickness?: number } = {}): Point[] =>
  createRectangle(0, 20, 0, featureThickness);

// Surface lines ---------------------------------------------------------------------------------

export const goalLine = ({
  fieldWidth = 0,
  featureThickness = 0,
}: { fieldWidth?: number; featureThickness?: number } = {}): Point[] =>
  createRectangle(0, featureThickness, -fieldWidth / 2, fieldWidth / 2);

export function majorYardLine({
  fieldWidth = 0,
  featureThickness = 0,
  distToSideline = 0,
  crossHashLength = 0,
  crossHashSeparation = 0,
}: {
  fieldWidth?: number;
  featureThickness?: number;
  distToSideline?: number;
  crossHashLength?: number;
  crossHashSeparation?: number;
} = {}): Point[] {
  const h = featureThickness / 2;
  const o = featureThickness / 2 + crossHashLength;
  const s = crossHashSeparation / 2;
  const st = crossHashSeparation / 2 + featureThickness;
  const top = fieldWidth / 2 - distToSideline;
  return zip(
    [-h, -h, -o, -o, -h, -h, -o, -o, -h, -h, h, h, o, o, h, h, o, o, h, h, -h],
    [-top, -st, -st, -s, -s, s, s, st, st, top, top, st, st, s, s, -s, -s, -st, -st, -top, -top],
  );
}

export const minorYardLine = ({
  yardLineHeight = 0,
  featureThickness = 0,
}: { yardLineHeight?: number; featureThickness?: number } = {}): Point[] =>
  createRectangle(-featureThickness / 2, featureThickness / 2, 0, yardLineHeight);

export const tryMark = ({
  tryMarkWidth = 0,
  featureThickness = 0,
}: { tryMarkWidth?: number; featureThickness?: number } = {}): Point[] =>
  createRectangle(-featureThickness / 2, featureThickness / 2, -tryMarkWidth / 2, tryMarkWidth / 2);

export const coachingBoxLine = ({
  coachingBoxLineLength = 0,
  featureThickness = 0,
}: { coachingBoxLineLength?: number; featureThickness?: number } = {}): Point[] =>
  createRectangle(-coachingBoxLineLength / 2, coachingBoxLineLength / 2, 0, featureThickness);

// Surface features ------------------------------------------------------------------------------

export const directionalArrow = ({
  arrowBase = 0,
  arrowLength = 0,
}: { arrowBase?: number; arrowLength?: number } = {}): Point[] =>
  zip([0, arrowLength, 0, 0], [arrowBase / 2, 0, -arrowBase / 2, arrowBase / 2]);

export const restrictedArea = ({
  restrictedAreaLength = 0,
  featureThickness = 0,
}: { restrictedAreaLength?: number; featureThickness?: number } = {}): Point[] =>
  createRectangle(-restrictedAreaLength / 2, restrictedAreaLength / 2, 0, featureThickness);

export const coachingBox = ({
  coachingBoxLength = 0,
  featureThickness = 0,
}: { coachingBoxLength?: number; featureThickness?: number } = {}): Point[] =>
  createRectangle(-coachingBoxLength / 2, coachingBoxLength / 2, 0, featureThickness);

export const teamBenchArea = ({
  teamBenchLengthFieldSide = 0,
  teamBenchLengthBackSide = 0,
  teamBenchWidth = 0,
}: {
  teamBenchLengthFieldSide?: number;
  teamBenchLengthBackSide?: number;
  teamBenchWidth?: number;
} = {}): Point[] =>
  zip(
    [
      -teamBenchLengthFieldSide / 2,
      teamBenchLengthFieldSide / 2,
      teamBenchLengthBackSide / 2,
      -teamBenchLengthBackSide / 2,
      -teamBenchLengthFieldSide / 2,
    ],
    [0, 0, teamBenchWidth, teamBenchWidth, 0],
  );

export function teamBenchAreaOutline({
  restrictedAreaLength = 0,
  restrictedAreaWidth = 0,
  coachingBoxLength = 0,
  coachingBoxWidth = 0,
  teamBenchLengthFieldSide = 0,
  teamBenchLengthBackSide = 0,
  teamBenchWidth = 0,
  featureThickness = 0,
}: BenchOpts & { featureThickness?: number } = {}): Point[] {
  const t = featureThickness;
  const [ra, cb, fs, bs] = [
    restrictedAreaLength / 2,
    coachingBoxLength / 2,
    teamBenchLengthFieldSide / 2,
    teamBenchLengthBackSide / 2,
  ];
  const cbY = restrictedAreaWidth + coachingBoxWidth;
  const backY = restrictedAreaWidth + coachingBoxWidth + teamBenchWidth;
  return zip(
    [
      -ra,
      -cb,
      -fs,
      -bs,
      bs,
      fs,
      cb,
      ra,
      ra + t,
      cb + t,
      fs + t,
      bs + t,
      -(bs + t),
      -(fs + t),
      -(cb + t),
      -(ra + t),
      -ra,
    ],
    [
      0,
      restrictedAreaWidth,
      cbY,
      backY,
      backY,
      cbY,
      restrictedAreaWidth,
      0,
      0,
      restrictedAreaWidth,
      cbY,
      backY + t,
      backY + t,
      cbY,
      restrictedAreaWidth,
      0,
      0,
    ],
  );
}
