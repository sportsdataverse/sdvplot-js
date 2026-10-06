import type { Color } from "../scene.js";

/** One name per sportyR `hockey_*` builder (prefix dropped), as used in `PolygonFeature.name`. */
export const HOCKEY_FEATURES = [
  "defensive_zone",
  "neutral_zone",
  "offensive_zone",
  "boards",
  "center_line",
  "referee_crease",
  "zone_line",
  "goal_line",
  "goaltenders_restricted_area",
  "odzone_faceoff_lines",
  "center_faceoff_spot",
  "goal_crease_outline",
  "goal_crease_fill",
  "center_faceoff_circle",
  "odzone_faceoff_circle",
  "nodzone_faceoff_spot_ring",
  "nodzone_faceoff_spot_stripe",
  "goal_frame",
  "goal_frame_fill",
  "player_bench_outline",
  "player_bench_area_fill",
  "penalty_box_outline",
  "penalty_box_fill",
  "off_ice_officials_box",
] as const;
export type HockeyFeature = (typeof HOCKEY_FEATURES)[number];

/** Verbatim keys of the `switch(tolower(display_range))` in sportyR `geom_hockey()` (xlims and ylims share them; 21). */
export const HOCKEY_DISPLAY_RANGES = [
  "full",
  "in_bounds_only",
  "in bounds only",
  "offense",
  "offence",
  "defense",
  "defence",
  "nzone",
  "neutral",
  "neutral_zone",
  "neutral zone",
  "ozone",
  "offensive_zone",
  "offensive zone",
  "attacking_zone",
  "attacking zone",
  "dzone",
  "defensive_zone",
  "defensive zone",
  "defending_zone",
  "defending zone",
] as const;
export type HockeyDisplayRange = (typeof HOCKEY_DISPLAY_RANGES)[number];

const RED = "#c8102e";
const BLUE = "#0033a0";
const ICE = "#ffffff";

/** The 25 argument names of `hockey_features_set_colors()`, in R's declaration order. */
export const HOCKEY_COLOR_KEYS = [
  "plot_background",
  "boards",
  "ozone_ice",
  "nzone_ice",
  "dzone_ice",
  "center_line",
  "zone_line",
  "goal_line",
  "restricted_trapezoid",
  "goal_crease_outline",
  "goal_crease_fill",
  "referee_crease",
  "center_faceoff_spot",
  "faceoff_spot_ring",
  "faceoff_spot_stripe",
  "center_faceoff_circle",
  "odzone_faceoff_circle",
  "faceoff_line",
  "goal_frame",
  "goal_fill",
  "team_a_bench",
  "team_b_bench",
  "team_a_penalty_box",
  "team_b_penalty_box",
  "off_ice_officials_box",
] as const;
export type HockeyColorKey = (typeof HOCKEY_COLOR_KEYS)[number];

/** Defaults of `hockey_features_set_colors()` (R's plot_background default is NULL; transparent here). */
export const HOCKEY_DEFAULT_COLORS: Readonly<Record<HockeyColorKey, Color>> = {
  plot_background: "#ffffff00",
  boards: "#000000",
  ozone_ice: ICE,
  nzone_ice: ICE,
  dzone_ice: ICE,
  center_line: RED,
  zone_line: BLUE,
  goal_line: RED,
  restricted_trapezoid: RED,
  goal_crease_outline: RED,
  goal_crease_fill: "#41b6e6",
  referee_crease: RED,
  center_faceoff_spot: BLUE,
  faceoff_spot_ring: RED,
  faceoff_spot_stripe: RED,
  center_faceoff_circle: BLUE,
  odzone_faceoff_circle: RED,
  faceoff_line: RED,
  goal_frame: RED,
  goal_fill: "#a5acaf4d",
  team_a_bench: ICE,
  team_b_bench: ICE,
  team_a_penalty_box: ICE,
  team_b_penalty_box: ICE,
  off_ice_officials_box: "#a5acaf",
};
