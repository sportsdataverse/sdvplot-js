import type { Color } from "../scene.js";

/** One name per sportyR `softball_*` builder (prefix dropped), as used in `PolygonFeature.name` (11). */
export const SOFTBALL_FEATURES = [
  "infield_dirt",
  "home_plate",
  "base",
  "pitchers_plate",
  "batters_box",
  "catchers_box",
  "foul_line",
  "running_lane",
  "pitchers_circle",
  "pitchers_lane",
  "coaches_box",
] as const;
export type SoftballFeature = (typeof SOFTBALL_FEATURES)[number];

/** Verbatim keys of the `switch(tolower(display_range))` in sportyR `geom_softball()` (2). */
export const SOFTBALL_DISPLAY_RANGES = ["full", "infield"] as const;
export type SoftballDisplayRange = (typeof SOFTBALL_DISPLAY_RANGES)[number];

/** The 11 argument names of `softball_features_set_colors()`, in R's declaration order. */
export const SOFTBALL_COLOR_KEYS = [
  "plot_background",
  "infield_dirt",
  "base",
  "pitchers_plate",
  "batters_box",
  "catchers_box",
  "foul_line",
  "running_lane",
  "pitchers_circle",
  "pitchers_lane",
  "coaches_box",
] as const;
export type SoftballColorKey = (typeof SOFTBALL_COLOR_KEYS)[number];

/** Defaults of `softball_features_set_colors()` (geom-softball.R 37): the background is the outfield grass, like baseball. */
export const SOFTBALL_DEFAULT_COLORS: Readonly<Record<SoftballColorKey, Color>> = {
  plot_background: "#395d33",
  infield_dirt: "#9b7653",
  base: "#ffffff",
  pitchers_plate: "#ffffff",
  batters_box: "#ffffff",
  catchers_box: "#ffffff",
  foul_line: "#ffffff",
  running_lane: "#ffffff",
  pitchers_circle: "#ffffff",
  pitchers_lane: "#ffffff",
  coaches_box: "#ffffff",
};
