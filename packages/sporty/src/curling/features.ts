import type { Point } from "../scene.js";
import { createCircle, createRectangle } from "../shapes.js";

/** Optional arc resolution; undefined falls through to createCircle's default (1000, as in R). Same helper as soccer/features.ts. */
type Arc = { npoints?: number | undefined };
type CircleOpts = { center: Point; start: number; end: number; r: number } & Arc;
const circle = ({ npoints, ...o }: CircleOpts): Point[] =>
  npoints === undefined ? createCircle(o) : createCircle({ ...o, npoints });

/** curling_end: the playing end beyond the hog line, hanging from (downward) or rising from (upward) y = 0; the anchor puts y = 0 on the hog line. */
export function end({
  sheetLength = 0,
  sheetWidth = 0,
  teeLineToCenter = 0,
  hogLineToTeeLine = 0,
  drawnDirection = "",
}: {
  sheetLength?: number;
  sheetWidth?: number;
  teeLineToCenter?: number;
  hogLineToTeeLine?: number;
  drawnDirection?: string;
} = {}): Point[] {
  const endLength = sheetLength / 2 - teeLineToCenter + hogLineToTeeLine;
  return drawnDirection.toLowerCase() === "upward"
    ? createRectangle(-sheetWidth / 2, sheetWidth / 2, 0, endLength)
    : createRectangle(-sheetWidth / 2, sheetWidth / 2, -endLength, 0);
}

/** curling_centre_zone: the strip between the two hog lines. */
export function centreZone({
  sheetWidth = 0,
  teeLineToCenter = 0,
  hogLineToTeeLine = 0,
}: { sheetWidth?: number; teeLineToCenter?: number; hogLineToTeeLine?: number } = {}): Point[] {
  const h = teeLineToCenter - hogLineToTeeLine;
  return createRectangle(-sheetWidth / 2, sheetWidth / 2, -h, h);
}

/** curling_sheet_apron: the only 10-point shape, the y >= 0 half of the frame (mirrored over x by the assembler). */
export function sheetApron({
  sheetLength = 0,
  sheetWidth = 0,
  apronBehindBack = 0,
  apronAlongSide = 0,
}: {
  sheetLength?: number;
  sheetWidth?: number;
  apronBehindBack?: number;
  apronAlongSide?: number;
} = {}): Point[] {
  const w = sheetWidth / 2;
  const l = sheetLength / 2;
  const ox = w + apronAlongSide;
  const oy = l + apronBehindBack;
  return [
    [0, l],
    [w, l],
    [w, 0],
    [ox, 0],
    [ox, oy],
    [-ox, oy],
    [-ox, 0],
    [-w, 0],
    [-w, l],
    [0, l],
  ];
}

/** curling_centre_line. */
export function centreLine({
  lineThickness = 0,
  teeLineToCenter = 0,
  centreLineExtension = 0,
}: { lineThickness?: number; teeLineToCenter?: number; centreLineExtension?: number } = {}): Point[] {
  const h = teeLineToCenter + centreLineExtension;
  return createRectangle(-lineThickness / 2, lineThickness / 2, -h, h);
}

/** curling_tee_line. */
export const teeLine = ({
  lineThickness = 0,
  sheetWidth = 0,
}: { lineThickness?: number; sheetWidth?: number } = {}): Point[] =>
  createRectangle(-sheetWidth / 2, sheetWidth / 2, -lineThickness / 2, lineThickness / 2);

/** curling_back_line. */
export const backLine = ({
  lineThickness = 0,
  sheetWidth = 0,
}: { lineThickness?: number; sheetWidth?: number } = {}): Point[] =>
  createRectangle(-sheetWidth / 2, sheetWidth / 2, 0, lineThickness);

/** curling_hog_line (same geometry as the back line in R). */
export const hogLine = ({
  lineThickness = 0,
  sheetWidth = 0,
}: { lineThickness?: number; sheetWidth?: number } = {}): Point[] =>
  createRectangle(-sheetWidth / 2, sheetWidth / 2, 0, lineThickness);

/** curling_hack_line. */
export const hackLine = ({
  lineThickness = 0,
  hackWidth = 0,
}: { lineThickness?: number; hackWidth?: number } = {}): Point[] =>
  createRectangle(-hackWidth / 2, hackWidth / 2, -lineThickness, 0);

/** curling_courtesy_line. */
export const courtesyLine = ({
  lineThickness = 0,
  lineLength = 0,
}: { lineThickness?: number; lineLength?: number } = {}): Point[] =>
  createRectangle(-lineLength, 0, -lineThickness, 0);

/** curling_hack_foothold. */
export const hackFoothold = ({
  footholdDepth = 0,
  footholdWidth = 0,
}: { footholdDepth?: number; footholdWidth?: number } = {}): Point[] =>
  createRectangle(0, footholdWidth, -footholdDepth, 0);

/** curling_button: a full disc. */
export const button = ({ featureRadius = 0, npoints }: { featureRadius?: number } & Arc = {}): Point[] =>
  circle({ center: [0, 0], start: 0, end: 2, r: featureRadius, npoints });

/** curling_house_ring: a filled disc; the assembler stacks the radii largest-first so each smaller ring paints over the last. */
export const houseRing = ({ featureRadius = 0, npoints }: { featureRadius?: number } & Arc = {}): Point[] =>
  circle({ center: [0, 0], start: 0, end: 2, r: featureRadius, npoints });
