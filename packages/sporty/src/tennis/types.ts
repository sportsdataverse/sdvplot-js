import type { Color } from "../scene.js";

/** One name per sportyR `tennis_*` builder (prefix dropped), as used in `PolygonFeature.name` (10). */
export const TENNIS_FEATURES = [
  "court_apron",
  "doubles_alley",
  "backcourt",
  "frontcourt_half",
  "baseline",
  "sideline",
  "serviceline",
  "center_serviceline",
  "center_mark",
  "net",
] as const;
export type TennisFeature = (typeof TENNIS_FEATURES)[number];

/** Keys of the `switch(tolower(display_range))` in sportyR `geom_tennis()` (R's 19, incl. the `receivice*` typos) plus the 3 correct spellings (documented divergence 4). */
export const TENNIS_DISPLAY_RANGES = [
  "full",
  "in_bounds_only",
  "in bounds only",
  "serve",
  "serving",
  "servicehalf",
  "service_half",
  "service half",
  "servinghalf",
  "serving_half",
  "serving half",
  "receive",
  "receiving",
  "receivicehalf",
  "receivice_half",
  "receivice half",
  "receivinghalf",
  "receiving_half",
  "receiving half",
  "receivehalf",
  "receive_half",
  "receive half",
] as const;
export type TennisDisplayRange = (typeof TENNIS_DISPLAY_RANGES)[number];

/** The 13 argument names of `tennis_features_set_colors()`, in R's declaration order. */
export const TENNIS_COLOR_KEYS = [
  "plot_background",
  "baseline",
  "singles_sideline",
  "doubles_sideline",
  "serviceline",
  "center_serviceline",
  "center_mark",
  "ad_court",
  "deuce_court",
  "backcourt",
  "doubles_alley",
  "court_apron",
  "net",
] as const;
export type TennisColorKey = (typeof TENNIS_COLOR_KEYS)[number];

/** Defaults of `tennis_features_set_colors()` (R's plot_background default is NULL; transparent here). */
export const TENNIS_DEFAULT_COLORS: Readonly<Record<TennisColorKey, Color>> = {
  plot_background: "#ffffff00",
  baseline: "#ffffff",
  singles_sideline: "#ffffff",
  doubles_sideline: "#ffffff",
  serviceline: "#ffffff",
  center_serviceline: "#ffffff",
  center_mark: "#ffffff",
  ad_court: "#395d33",
  deuce_court: "#395d33",
  backcourt: "#395d33",
  doubles_alley: "#395d33",
  court_apron: "#395d33",
  net: "#d3d3d3",
};
