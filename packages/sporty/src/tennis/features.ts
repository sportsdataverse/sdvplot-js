import type { Point } from "../scene.js";
import { createRectangle } from "../shapes.js";

/** tennis_frontcourt_half: one quarter of the service area (ad or deuce side of one half), x 0..serviceline. */
export const frontcourtHalf = ({
  servicelineDistance = 0,
  singlesWidth = 0,
}: { servicelineDistance?: number; singlesWidth?: number } = {}): Point[] =>
  createRectangle(0, servicelineDistance, -singlesWidth / 4, singlesWidth / 4);

/** tennis_backcourt: baseline-to-serviceline strip of one half. */
export const backcourt = ({
  courtLength = 0,
  servicelineDistance = 0,
  singlesWidth = 0,
}: { courtLength?: number; servicelineDistance?: number; singlesWidth?: number } = {}): Point[] =>
  createRectangle(0, courtLength / 2 - servicelineDistance, -singlesWidth / 2, singlesWidth / 2);

/** tennis_doubles_alley: one doubles alley strip along the full length. */
export const doublesAlley = ({
  courtLength = 0,
  featureThickness = 0,
}: { courtLength?: number; featureThickness?: number } = {}): Point[] =>
  createRectangle(-courtLength / 2, courtLength / 2, 0, featureThickness);

/** tennis_baseline: baseline, drawn inward of the anchor. */
export const baseline = ({
  courtWidth = 0,
  featureThickness = 0,
}: { courtWidth?: number; featureThickness?: number } = {}): Point[] =>
  createRectangle(-featureThickness, 0, -courtWidth / 2, courtWidth / 2);

/** tennis_sideline: sideline along the full length, drawn inward of the anchor. */
export const sideline = ({
  courtLength = 0,
  featureThickness = 0,
}: { courtLength?: number; featureThickness?: number } = {}): Point[] =>
  createRectangle(-courtLength / 2, courtLength / 2, -featureThickness, 0);

/** tennis_court_apron: 9-point half frame — inner court edge then the backstop/sidestop outer edge back to the start. */
export function courtApron({
  courtLength = 0,
  courtWidth = 0,
  backstopDistance = 0,
  sidestopDistance = 0,
}: {
  courtLength?: number;
  courtWidth?: number;
  backstopDistance?: number;
  sidestopDistance?: number;
} = {}): Point[] {
  const L = courtLength / 2;
  const W = courtWidth / 2;
  return [
    [0, W],
    [L, W],
    [L, -W],
    [0, -W],
    [0, -(W + sidestopDistance)],
    [L + backstopDistance, -(W + sidestopDistance)],
    [L + backstopDistance, W + sidestopDistance],
    [0, W + sidestopDistance],
    [0, W],
  ];
}

/** tennis_serviceline: the line across the court at the service distance. */
export const serviceline = ({
  singlesWidth = 0,
  featureThickness = 0,
}: { singlesWidth?: number; featureThickness?: number } = {}): Point[] =>
  createRectangle(-featureThickness, 0, -singlesWidth / 2, singlesWidth / 2);

/** tennis_center_serviceline: line splitting the service boxes. */
export const centerServiceline = ({
  centerServicelineLength = 0,
  featureThickness = 0,
}: { centerServicelineLength?: number; featureThickness?: number } = {}): Point[] =>
  createRectangle(0, centerServicelineLength, -featureThickness / 2, featureThickness / 2);

/** tennis_center_mark: tick at the baseline centre. */
export const centerMark = ({
  centerMarkLength = 0,
  featureThickness = 0,
}: { centerMarkLength?: number; featureThickness?: number } = {}): Point[] =>
  createRectangle(-centerMarkLength, 0, -featureThickness / 2, featureThickness / 2);

/** tennis_net: thin rectangle along y at x = 0. */
export const net = ({
  featureThickness = 0,
  netLength = 0,
}: { featureThickness?: number; netLength?: number } = {}): Point[] =>
  createRectangle(-featureThickness / 2, featureThickness / 2, -netLength / 2, netLength / 2);
