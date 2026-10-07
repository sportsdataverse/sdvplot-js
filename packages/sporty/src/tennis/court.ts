import type { Color, Feature, Point, Scene, SurfaceOptions } from "../scene.js";
import { TENNIS_LEAGUES, TENNIS_SPECS, type TennisLeague, type TennisParamUpdates } from "../specs/tennis.js";
import {
  UnknownDisplayRangeError,
  UnknownLeagueError,
  addFeature,
  colorAt,
  convertLimits,
  displayBbox,
  mergeColors,
  mergeParams,
} from "../surface.js";
import { normalizeUnit } from "../units.js";
import * as F from "./features.js";
import {
  TENNIS_DEFAULT_COLORS,
  TENNIS_DISPLAY_RANGES,
  type TennisColorKey,
  type TennisDisplayRange,
  type TennisFeature,
} from "./types.js";

const isOneOf = <T extends string>(list: readonly T[], v: string): v is T =>
  (list as readonly string[]).includes(v);

type Side = "serve" | "receive" | "full" | "in";
const SIDE: Readonly<Record<TennisDisplayRange, Side>> = {
  full: "full",
  in_bounds_only: "in",
  "in bounds only": "in",
  serve: "serve",
  serving: "serve",
  servicehalf: "serve",
  service_half: "serve",
  "service half": "serve",
  servinghalf: "serve",
  serving_half: "serve",
  "serving half": "serve",
  receive: "receive",
  receiving: "receive",
  receivicehalf: "receive",
  receivice_half: "receive",
  "receivice half": "receive",
  receivinghalf: "receive",
  receiving_half: "receive",
  "receiving half": "receive",
  receivehalf: "receive",
  receive_half: "receive",
  "receive half": "receive",
};

/**
 * Port of sportyR `geom_tennis()`: one PolygonFeature per ggplot layer R adds, in R's layer order (23 polygons).
 * Documented divergences: an unknown `displayRange` throws (R falls back to "full"); the correctly spelled
 * `receive(-| )half` keys are accepted (R only has the `receivice*` typos); `units` also converts the anchors and display limits.
 */
export function tennisCourt(
  league: TennisLeague | (string & {}),
  opts: SurfaceOptions<TennisParamUpdates, TennisColorKey, TennisDisplayRange> = {},
): Scene {
  const key = league.toLowerCase();
  if (!isOneOf(TENNIS_LEAGUES, key))
    throw new UnknownLeagueError(
      `Unknown tennis league "${league}"; expected one of: ${TENNIS_LEAGUES.join(", ")}`,
    );
  const range = (opts.displayRange ?? "full").toLowerCase(); // R: tolower() only, no trim
  if (!isOneOf(TENNIS_DISPLAY_RANGES, range))
    throw new UnknownDisplayRangeError(
      `Unknown tennis display range "${opts.displayRange}"; expected one of: ${TENNIS_DISPLAY_RANGES.join(", ")}`,
    );
  const p = mergeParams(TENNIS_SPECS[key], opts.updates, []); // tennis has no array fields
  const colors = mergeColors(TENNIS_DEFAULT_COLORS, opts.colorUpdates);
  const col = (k: TennisColorKey): Color => colorAt(colors[k], 0);
  const from = normalizeUnit(p.court_units || "ft"); // R: court_units %or% "ft" (custom's "")
  const units = normalizeUnit(opts.units ?? from);
  const conv = units === from ? undefined : ([from, units] as const);
  const { rotation = 0, xTrans = 0, yTrans = 0 } = opts;
  const L = p.court_length;
  const S = p.singles_width;
  const D = p.doubles_width;
  const t = p.line_thickness;
  const sl = p.serviceline_distance;
  const features: Feature[] = [];
  const add = (
    name: TennisFeature,
    pts: readonly Point[],
    fill: Color,
    xAnchor: number,
    yAnchor: number,
    reflectX: boolean,
    reflectY: boolean,
    extra: { stroke?: Color } = {},
  ): void =>
    addFeature(
      features,
      name,
      pts,
      fill,
      { xAnchor, yAnchor, reflectX, reflectY, xTrans, yTrans, rotation },
      conv ? { ...extra, units: conv } : extra,
    );
  // Layers, in R's add_feature order (geom-tennis.R 286-480).
  add(
    "court_apron",
    F.courtApron({
      courtLength: L,
      courtWidth: D,
      backstopDistance: p.backstop_distance,
      sidestopDistance: p.sidestop_distance,
    }),
    col("court_apron"),
    0,
    0,
    true,
    false,
    { stroke: col("court_apron") },
  );
  add(
    "doubles_alley",
    F.doublesAlley({ courtLength: L, featureThickness: (D - S) / 2 }),
    col("doubles_alley"),
    0,
    S / 2,
    false,
    true,
  );
  add(
    "backcourt",
    F.backcourt({ courtLength: L, servicelineDistance: sl, singlesWidth: S }),
    col("backcourt"),
    sl,
    0,
    true,
    false,
  );
  const quarter = F.frontcourtHalf({ servicelineDistance: sl, singlesWidth: S });
  add("frontcourt_half", quarter, col("ad_court"), 0, 0.25 * S, false, false);
  add("frontcourt_half", quarter, col("ad_court"), -sl, -0.25 * S, false, false); // R: `-x %or% 0` parses as (-x) %or% 0
  add("frontcourt_half", quarter, col("deuce_court"), 0, -0.25 * S, false, false);
  add("frontcourt_half", quarter, col("deuce_court"), -sl, 0.25 * S, false, false);
  add("baseline", F.baseline({ courtWidth: D, featureThickness: t }), col("baseline"), L / 2, 0, true, false);
  const side = F.sideline({ courtLength: L, featureThickness: t });
  add("sideline", side, col("doubles_sideline"), 0, D / 2, false, true);
  add("sideline", side, col("singles_sideline"), 0, S / 2, false, true);
  add(
    "serviceline",
    F.serviceline({ singlesWidth: S, featureThickness: t }),
    col("serviceline"),
    sl,
    0,
    true,
    false,
  );
  add(
    "center_serviceline",
    F.centerServiceline({ centerServicelineLength: sl, featureThickness: t }),
    col("center_serviceline"),
    0,
    0,
    true,
    false,
  );
  add(
    "center_mark",
    F.centerMark({ centerMarkLength: p.center_mark_length, featureThickness: t }),
    col("center_mark"),
    L / 2,
    0,
    true,
    false,
  );
  add("net", F.net({ featureThickness: t, netLength: p.net_length }), col("net"), 0, 0, false, false);
  // Display range (geom-tennis.R 485-560) in native units (the +5 and 1.5 are NOT scaled, as in R); then converted, translated, rotated.
  // R's `%or% 20` / `%or% 10` never fire: the vendored custom spec holds 0, not NULL (measured: custom without backstop = +-44).
  const hcl = L / 2 + p.backstop_distance + 5;
  const hcw = D / 2 + p.sidestop_distance + 5;
  const kind = SIDE[range];
  const xr: readonly [number, number] =
    kind === "in"
      ? [-(L / 2 + t), L / 2 + t]
      : kind === "serve"
        ? [-hcl, 1.5]
        : kind === "receive"
          ? [-1.5, hcl]
          : [-hcl, hcl];
  const yr: readonly [number, number] = kind === "in" ? [-(D / 2 + t), D / 2 + t] : [-hcw, hcw];
  const [cx, cy] = convertLimits(xr, yr, from, units);
  const xlim = opts.xlim ?? [cx[0] + xTrans, cx[1] + xTrans];
  const ylim = opts.ylim ?? [cy[0] + yTrans, cy[1] + yTrans];
  const background = col("plot_background");
  return {
    sport: "tennis",
    league: key,
    units,
    bbox: displayBbox(xlim, ylim, rotation),
    origin: "center",
    ...(/^#[0-9a-f]{6}00$/i.test(background) ? {} : { background }),
    features,
  };
}
