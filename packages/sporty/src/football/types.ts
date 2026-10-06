import type { Color } from "../scene.js";

/**
 * One name per sportyR `football_*` builder (prefix dropped), plus the two yard-number layers `geom_football()`
 * draws itself: `yardage_marker` (TextFeature) and `yardage_marker_box` (its transparent ggplot bounding box).
 */
export const FOOTBALL_FEATURES = [
  "half_field",
  "endzone",
  "field_apron",
  "end_line",
  "sideline",
  "field_border",
  "field_border_outline",
  "red_zone_border",
  "red_zone_border_outline",
  "goal_line",
  "major_yard_line",
  "minor_yard_line",
  "try_mark",
  "coaching_box_line",
  "directional_arrow",
  "restricted_area",
  "coaching_box",
  "team_bench_area",
  "team_bench_area_outline",
  "yardage_marker",
  "yardage_marker_box",
] as const;
export type FootballFeature = (typeof FOOTBALL_FEATURES)[number];

/** Verbatim keys of the `switch(tolower(display_range))` in sportyR `geom_football()` (xlims and ylims share them; 22). */
export const FOOTBALL_DISPLAY_RANGES = [
  "full",
  "in_bounds_only",
  "in bounds only",
  "offense",
  "offence",
  "offensivehalffield",
  "offensive_half_field",
  "offensive half field",
  "defense",
  "defence",
  "defensivehalffield",
  "defensive_half_field",
  "defensive half field",
  "redzone",
  "red_zone",
  "red zone",
  "oredzone",
  "offensive_red_zone",
  "offensive red zone",
  "dredzone",
  "defensive_red_zone",
  "defensive red zone",
] as const;
export type FootballDisplayRange = (typeof FOOTBALL_DISPLAY_RANGES)[number];

/** The 23 argument names of `football_features_set_colors()`, in R's declaration order. */
export const FOOTBALL_COLOR_KEYS = [
  "plot_background",
  "field_apron",
  "offensive_half",
  "defensive_half",
  "offensive_endzone",
  "defensive_endzone",
  "end_line",
  "sideline",
  "field_border",
  "field_border_outline",
  "red_zone_border",
  "red_zone_border_outline",
  "major_yard_line",
  "goal_line",
  "minor_yard_line",
  "directional_arrow",
  "try_mark",
  "yardage_marker",
  "restricted_area",
  "coaching_box",
  "team_bench_area",
  "team_bench_area_outline",
  "coaching_box_line",
] as const;
export type FootballColorKey = (typeof FOOTBALL_COLOR_KEYS)[number];

const GRASS = "#196f0c";
const WHITE = "#ffffff";

/** Defaults of `football_features_set_colors()` (R's plot_background default is NULL; transparent here). */
export const FOOTBALL_DEFAULT_COLORS: Readonly<Record<FootballColorKey, Color>> = {
  plot_background: "#ffffff00",
  field_apron: GRASS,
  offensive_half: GRASS,
  defensive_half: GRASS,
  offensive_endzone: GRASS,
  defensive_endzone: GRASS,
  end_line: WHITE,
  sideline: WHITE,
  field_border: GRASS,
  field_border_outline: "#ffffff00",
  red_zone_border: "#196f0c00",
  red_zone_border_outline: "#ffffff00",
  major_yard_line: WHITE,
  goal_line: WHITE,
  minor_yard_line: WHITE,
  directional_arrow: WHITE,
  try_mark: WHITE,
  yardage_marker: WHITE,
  restricted_area: WHITE,
  coaching_box: WHITE,
  team_bench_area: GRASS,
  team_bench_area_outline: WHITE,
  coaching_box_line: "#ffcb05",
};
