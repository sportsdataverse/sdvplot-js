import type { Color } from "../scene.js";

/** One name per sportyR `curling_*` builder (prefix dropped), as used in `PolygonFeature.name` (12). */
export const CURLING_FEATURES = [
  "sheet_apron",
  "end",
  "centre_zone",
  "house_ring",
  "button",
  "tee_line",
  "back_line",
  "hog_line",
  "centre_line",
  "hack_line",
  "courtesy_line",
  "hack_foothold",
] as const;
export type CurlingFeature = (typeof CURLING_FEATURES)[number];

/** Verbatim keys of the `switch(tolower(display_range))` in sportyR `geom_curling()` (4). */
export const CURLING_DISPLAY_RANGES = ["full", "in_bounds_only", "in bounds only", "house"] as const;
export type CurlingDisplayRange = (typeof CURLING_DISPLAY_RANGES)[number];

/** The 14 argument names of `curling_features_set_colors()`, in R's declaration order (colour keys are NOT feature names). */
export const CURLING_COLOR_KEYS = [
  "plot_background",
  "end_1",
  "centre_zone",
  "end_2",
  "sheet_apron",
  "centre_line",
  "tee_line",
  "back_line",
  "hog_line",
  "hack_line",
  "courtesy_line",
  "hack",
  "button",
  "house_rings",
] as const;
export type CurlingColorKey = (typeof CURLING_COLOR_KEYS)[number];

/** Defaults of `curling_features_set_colors()` (R's plot_background default is NULL; transparent here). `house_rings` is a vector, recycled by `colorAt`. */
export const CURLING_DEFAULT_COLORS: Readonly<Record<CurlingColorKey, Color | readonly Color[]>> = {
  plot_background: "#ffffff00",
  end_1: "#ffffff",
  centre_zone: "#ffffff",
  end_2: "#ffffff",
  sheet_apron: "#0033a0",
  centre_line: "#000000",
  tee_line: "#000000",
  back_line: "#000000",
  hog_line: "#c8102e",
  hack_line: "#000000",
  courtesy_line: "#000000",
  hack: "#000000",
  button: "#ffffff",
  house_rings: ["#c8102e", "#ffffff", "#0033a0"],
};
