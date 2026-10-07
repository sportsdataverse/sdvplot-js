import type { Color } from "../scene.js";

/** One name per sportyR `baseball_*` builder (prefix dropped), as used in `PolygonFeature.name` (10). */
export const BASEBALL_FEATURES = [
  "infield_dirt",
  "infield_grass",
  "pitchers_mound",
  "home_plate",
  "base",
  "pitchers_plate",
  "batters_box",
  "catchers_box",
  "foul_line",
  "running_lane",
] as const;
export type BaseballFeature = (typeof BASEBALL_FEATURES)[number];

/** Verbatim keys of the `switch(tolower(display_range))` in sportyR `geom_baseball()` (2). */
export const BASEBALL_DISPLAY_RANGES = ["full", "infield"] as const;
export type BaseballDisplayRange = (typeof BASEBALL_DISPLAY_RANGES)[number];

/** The 10 argument names of `baseball_features_set_colors()`, in R's declaration order. */
export const BASEBALL_COLOR_KEYS = [
  "plot_background",
  "infield_dirt",
  "infield_grass",
  "pitchers_mound",
  "base",
  "pitchers_plate",
  "batters_box",
  "catchers_box",
  "foul_line",
  "running_lane",
] as const;
export type BaseballColorKey = (typeof BASEBALL_COLOR_KEYS)[number];

/** Defaults of `baseball_features_set_colors()` — the only sport whose plot_background default is a colour (geom-baseball.R 35). */
export const BASEBALL_DEFAULT_COLORS: Readonly<Record<BaseballColorKey, Color>> = {
  plot_background: "#395d33",
  infield_dirt: "#9b7653",
  infield_grass: "#395d33",
  pitchers_mound: "#9b7653",
  base: "#ffffff",
  pitchers_plate: "#ffffff",
  batters_box: "#ffffff",
  catchers_box: "#ffffff",
  foul_line: "#ffffff",
  running_lane: "#ffffff",
};
