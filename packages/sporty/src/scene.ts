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
