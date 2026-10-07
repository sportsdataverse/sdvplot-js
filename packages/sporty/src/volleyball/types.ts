import type { Color } from "../scene.js";

/** One name per sportyR `volleyball_*` builder (prefix dropped), as used in `PolygonFeature.name` (10). */
export const VOLLEYBALL_FEATURES = [
  "free_zone",
  "front_zone",
  "backcourt",
  "court_apron",
  "service_zone_mark",
  "attack_line",
  "substitution_zone_dash",
  "center_line",
  "end_line",
  "sideline",
] as const;
export type VolleyballFeature = (typeof VOLLEYBALL_FEATURES)[number];

/** Verbatim keys of the `switch(tolower(display_range))` in sportyR `geom_volleyball()` (13). */
export const VOLLEYBALL_DISPLAY_RANGES = [
  "full",
  "in_bounds_only",
  "in bounds only",
  "offense",
  "offence",
  "offensivehalfcourt",
  "offensive_half_court",
  "offensive half court",
  "defense",
  "defence",
  "defensivehalfcourt",
  "defensive_half_court",
  "defensive half court",
] as const;
export type VolleyballDisplayRange = (typeof VOLLEYBALL_DISPLAY_RANGES)[number];

/** The 12 argument names of `volleyball_features_set_colors()` (colour keys are NOT feature names). */
export const VOLLEYBALL_COLOR_KEYS = [
  "plot_background",
  "free_zone",
  "front_zone",
  "defensive_backcourt",
  "offensive_backcourt",
  "court_apron",
  "end_line",
  "sideline",
  "attack_line",
  "center_line",
  "service_zone_mark",
  "substitution_zone",
] as const;
export type VolleyballColorKey = (typeof VOLLEYBALL_COLOR_KEYS)[number];

/** Defaults of `volleyball_features_set_colors()` (R's plot_background default is NULL; transparent here). */
export const VOLLEYBALL_DEFAULT_COLORS: Readonly<Record<VolleyballColorKey, Color>> = {
  plot_background: "#ffffff00",
  free_zone: "#d2ab6f",
  front_zone: "#d2ab6f",
  defensive_backcourt: "#d2ab6f",
  offensive_backcourt: "#d2ab6f",
  court_apron: "#d2ab6f",
  end_line: "#000000",
  sideline: "#000000",
  attack_line: "#000000",
  center_line: "#000000",
  service_zone_mark: "#000000",
  substitution_zone: "#000000",
};
