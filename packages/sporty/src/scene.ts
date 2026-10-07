export type Point = readonly [x: number, y: number];
export type Polygon = readonly Point[];
/** "#rrggbb" | "#rrggbbaa"; "#00000000" hides a feature. */
export type Color = string;
export type Units = "ft" | "m" | "yd" | "in" | "cm" | "mm";
export type Sport =
  | "baseball"
  | "basketball"
  | "curling"
  | "football"
  | "hockey"
  | "lacrosse"
  | "soccer"
  | "tennis"
  | "volleyball";
export interface PolygonFeature {
  kind: "polygon";
  name: string;
  zIndex: number;
  fill: Color;
  stroke?: Color;
  points: Polygon;
  elevation?: number;
  height?: number;
}
export interface TextFeature {
  kind: "text";
  name: string;
  zIndex: number;
  fill: Color;
  x: number;
  y: number;
  text: string;
  fontFamily: string;
  /** Unrotated box in the text's own frame (`[width, height]` before `rotation`); equals R's ggfittext box at 0/90/180/270°. */
  fitBox: readonly [w: number, h: number];
  rotation: number;
}
export type Feature = PolygonFeature | TextFeature;
export interface Scene {
  sport: Sport;
  league: string;
  units: Units;
  bbox: readonly [x0: number, y0: number, x1: number, y1: number];
  origin: "center" | "home_plate";
  /** R `plot_background` (baseball `#395d33`); renderers paint it behind every feature. */
  background?: Color;
  features: readonly Feature[];
}
export interface SurfaceOptions<U, C extends string, D extends string> {
  updates?: U;
  colorUpdates?: Partial<Record<C, Color | readonly Color[]>>;
  rotation?: number;
  xTrans?: number;
  yTrans?: number;
  units?: Units;
  displayRange?: D;
  xlim?: readonly [number, number];
  ylim?: readonly [number, number];
  arcResolution?: number;
}

/** `#rrggbb00`-style colors (alpha 00) hide a feature. */
export const hidden = (c: Color): boolean => c.length === 9 && c.endsWith("00");

/** Mirrors toSVG's polygon skips: no points, a non-finite point, or a hidden fill with no stroke. */
export function isVisiblePolygon(f: PolygonFeature): boolean {
  if (f.points.length === 0 || f.points.some(([x, y]) => !Number.isFinite(x) || !Number.isFinite(y)))
    return false;
  return !(hidden(f.fill) && f.stroke === undefined);
}

/** Mirrors toSVG's text skips: a non-finite anchor or a hidden fill. */
export function isVisibleText(f: TextFeature): boolean {
  return Number.isFinite(f.x) && Number.isFinite(f.y) && !hidden(f.fill);
}
