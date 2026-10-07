import type { Color } from "../scene.js";

/** One name per sportyR `soccer_*` builder (prefix dropped), as used in `PolygonFeature.name` (13). */
export const SOCCER_FEATURES = [
  "half_pitch",
  "pitch_apron",
  "touchline",
  "goal_line",
  "corner_arc",
  "halfway_line",
  "penalty_box",
  "goal_box",
  "center_circle",
  "penalty_mark",
  "center_mark",
  "corner_defensive_marks",
  "goal",
] as const;
export type SoccerFeature = (typeof SOCCER_FEATURES)[number];

/** Verbatim keys of the `switch(tolower(display_range))` in sportyR `geom_soccer()` (13). */
export const SOCCER_DISPLAY_RANGES = [
  "full",
  "in_bounds_only",
  "in bounds only",
  "offense",
  "offence",
  "offensivehalfpitch",
  "offensive_half_pitch",
  "offensive half pitch",
  "defense",
  "defence",
  "defensivehalfpitch",
  "defensive_half_pitch",
  "defensive half pitch",
] as const;
export type SoccerDisplayRange = (typeof SOCCER_DISPLAY_RANGES)[number];

/** The 15 argument names of `soccer_features_set_colors()`, in R's declaration order (colour keys are NOT feature names). */
export const SOCCER_COLOR_KEYS = [
  "plot_background",
  "offensive_half_pitch",
  "defensive_half_pitch",
  "pitch_apron",
  "touchline",
  "goal_line",
  "corner_arc",
  "halfway_line",
  "center_circle",
  "center_mark",
  "penalty_box",
  "goal_box",
  "penalty_mark",
  "corner_defensive_mark",
  "goal",
] as const;
export type SoccerColorKey = (typeof SOCCER_COLOR_KEYS)[number];

/** Defaults of `soccer_features_set_colors()` (R's plot_background default is NULL; transparent here). */
export const SOCCER_DEFAULT_COLORS: Readonly<Record<SoccerColorKey, Color>> = {
  plot_background: "#ffffff00",
  offensive_half_pitch: "#195f0c",
  defensive_half_pitch: "#195f0c",
  pitch_apron: "#195f0c",
  touchline: "#ffffff",
  goal_line: "#ffffff",
  corner_arc: "#ffffff",
  halfway_line: "#ffffff",
  center_circle: "#ffffff",
  center_mark: "#ffffff",
  penalty_box: "#ffffff",
  goal_box: "#ffffff",
  penalty_mark: "#ffffff",
  corner_defensive_mark: "#ffffff",
  goal: "#ffffff",
};
