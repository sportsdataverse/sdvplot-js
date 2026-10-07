import type { Point } from "../scene.js";
import { createRectangle } from "../shapes.js";

/** 9-point half frame: court edge, then the outer edge `padEnd`/`padSide` beyond it, back to the start. */
function frame(courtLength: number, courtWidth: number, padEnd: number, padSide: number): Point[] {
  const L = courtLength / 2;
  const W = courtWidth / 2;
  return [
    [0, W],
    [L, W],
    [L, -W],
    [0, -W],
    [0, -W - padSide],
    [L + padEnd, -W - padSide],
    [L + padEnd, W + padSide],
    [0, W + padSide],
    [0, W],
  ];
}

/** volleyball_free_zone: half frame padded by the free zone. */
export function freeZone({
  courtLength = 0,
  courtWidth = 0,
  freeZoneEndLine = 0,
  freeZoneSideline = 0,
}: {
  courtLength?: number;
  courtWidth?: number;
  freeZoneEndLine?: number;
  freeZoneSideline?: number;
} = {}): Point[] {
  return frame(courtLength, courtWidth, freeZoneEndLine, freeZoneSideline);
}

/** volleyball_court_apron: half frame padded by the apron. */
export function courtApron({
  courtLength = 0,
  courtWidth = 0,
  courtApronEndLine = 0,
  courtApronSideline = 0,
}: {
  courtLength?: number;
  courtWidth?: number;
  courtApronEndLine?: number;
  courtApronSideline?: number;
} = {}): Point[] {
  return frame(courtLength, courtWidth, courtApronEndLine, courtApronSideline);
}

/** volleyball_front_zone: centre line to attack line. */
export function frontZone({
  attackLineEdgeToCenterLine = 0,
  courtWidth = 0,
}: { attackLineEdgeToCenterLine?: number; courtWidth?: number } = {}): Point[] {
  return createRectangle(0, attackLineEdgeToCenterLine, -courtWidth / 2, courtWidth / 2);
}

/** volleyball_backcourt: centred on its own midpoint (the anchor supplies the offset). */
export function backcourt({
  attackLineEdgeToCenterLine = 0,
  courtLength = 0,
  courtWidth = 0,
}: { attackLineEdgeToCenterLine?: number; courtLength?: number; courtWidth?: number } = {}): Point[] {
  const len = courtLength / 2 - attackLineEdgeToCenterLine;
  return createRectangle(-len / 2, len / 2, -courtWidth / 2, courtWidth / 2);
}

/** volleyball_end_line. */
export function endLine({
  courtWidth = 0,
  lineThickness = 0,
}: { courtWidth?: number; lineThickness?: number } = {}): Point[] {
  return createRectangle(-lineThickness, 0, -courtWidth / 2, courtWidth / 2);
}

/** volleyball_sideline. */
export function sideline({
  courtLength = 0,
  lineThickness = 0,
}: { courtLength?: number; lineThickness?: number } = {}): Point[] {
  return createRectangle(-courtLength / 2, courtLength / 2, -lineThickness, 0);
}

/** volleyball_attack_line. */
export function attackLine({
  courtWidth = 0,
  lineThickness = 0,
}: { courtWidth?: number; lineThickness?: number } = {}): Point[] {
  return createRectangle(-lineThickness, 0, -courtWidth / 2, courtWidth / 2);
}

/** volleyball_center_line. */
export function centerLine({
  courtWidth = 0,
  lineThickness = 0,
}: { courtWidth?: number; lineThickness?: number } = {}): Point[] {
  return createRectangle(-lineThickness / 2, lineThickness / 2, -courtWidth / 2, courtWidth / 2);
}

/** volleyball_service_zone_mark. */
export function serviceZoneMark({
  serviceZoneMarkLength = 0,
  lineThickness = 0,
}: { serviceZoneMarkLength?: number; lineThickness?: number } = {}): Point[] {
  return createRectangle(0, serviceZoneMarkLength, -lineThickness, 0);
}

/** volleyball_substitution_zone_dash: one dash of the dashed extension of the attack line beyond the sideline. */
export function substitutionZoneDash({
  dashLength = 0,
  lineThickness = 0,
}: { dashLength?: number; lineThickness?: number } = {}): Point[] {
  return createRectangle(-lineThickness, 0, 0, dashLength);
}
