import type { Color, Feature, Point, Scene, SurfaceOptions } from "../scene.js";
import {
  VOLLEYBALL_LEAGUES,
  VOLLEYBALL_SPECS,
  type VolleyballLeague,
  type VolleyballParamUpdates,
} from "../specs/volleyball.js";
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
  VOLLEYBALL_DEFAULT_COLORS,
  VOLLEYBALL_DISPLAY_RANGES,
  type VolleyballColorKey,
  type VolleyballDisplayRange,
  type VolleyballFeature,
} from "./types.js";

const isOneOf = <T extends string>(list: readonly T[], v: string): v is T =>
  (list as readonly string[]).includes(v);

/**
 * Port of sportyR `geom_volleyball()`: one PolygonFeature per ggplot layer R adds, in R's layer order.
 * Documented divergences: an unknown `displayRange` throws (R falls back to "full"); `units` also converts the anchors and display limits.
 * Preserved R quirk: the substitution-zone loop repeats `substitution_zone_rep_pattern` times (0 gives none).
 */
export function volleyballCourt(
  league: VolleyballLeague | (string & {}),
  opts: SurfaceOptions<VolleyballParamUpdates, VolleyballColorKey, VolleyballDisplayRange> = {},
): Scene {
  const key = league.toLowerCase();
  if (!isOneOf(VOLLEYBALL_LEAGUES, key))
    throw new UnknownLeagueError(
      `Unknown volleyball league "${league}"; expected one of: ${VOLLEYBALL_LEAGUES.join(", ")}`,
    );
  const range = (opts.displayRange ?? "full").toLowerCase();
  if (!isOneOf(VOLLEYBALL_DISPLAY_RANGES, range))
    throw new UnknownDisplayRangeError(
      `Unknown volleyball display range "${opts.displayRange}"; expected one of: ${VOLLEYBALL_DISPLAY_RANGES.join(", ")}`,
    );
  const p = mergeParams(VOLLEYBALL_SPECS[key], opts.updates, []);
  const colors = mergeColors(VOLLEYBALL_DEFAULT_COLORS, opts.colorUpdates);
  const col = (k: VolleyballColorKey): Color => colorAt(colors[k], 0);
  const from = normalizeUnit(p.court_units);
  const units = normalizeUnit(opts.units ?? from);
  const conv = units === from ? undefined : ([from, units] as const);
  const { rotation = 0, xTrans = 0, yTrans = 0 } = opts;
  const L = p.court_length;
  const W = p.court_width;
  const t = p.line_thickness;
  const a = p.attack_line_edge_to_center_line;
  const features: Feature[] = [];
  const add = (
    name: VolleyballFeature,
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
  // Layers, in R's add_feature order (geom-volleyball.R 243-491).
  const fz = col("free_zone");
  add(
    "free_zone",
    F.freeZone({
      courtLength: L,
      courtWidth: W,
      freeZoneEndLine: p.free_zone_end_line,
      freeZoneSideline: p.free_zone_sideline,
    }),
    fz,
    0,
    0,
    true,
    false,
    { stroke: fz },
  );
  const fr = col("front_zone");
  add("front_zone", F.frontZone({ attackLineEdgeToCenterLine: a, courtWidth: W }), fr, 0, 0, true, false, {
    stroke: fr,
  });
  const back = F.backcourt({ attackLineEdgeToCenterLine: a, courtLength: L, courtWidth: W });
  const mid = a + (L / 2 - a) / 2;
  add("backcourt", back, col("defensive_backcourt"), -mid, 0, false, false);
  add("backcourt", back, col("offensive_backcourt"), mid, 0, false, false);
  const ap = col("court_apron");
  add(
    "court_apron",
    F.courtApron({
      courtLength: L,
      courtWidth: W,
      courtApronEndLine: p.court_apron_end_line,
      courtApronSideline: p.court_apron_sideline,
    }),
    ap,
    0,
    0,
    true,
    false,
    { stroke: ap },
  );
  add(
    "service_zone_mark",
    F.serviceZoneMark({ serviceZoneMarkLength: p.service_zone_mark_length, lineThickness: t }),
    col("service_zone_mark"),
    L / 2 + p.service_zone_mark_to_end_line,
    W / 2,
    true,
    true,
  );
  add(
    "attack_line",
    F.attackLine({ courtWidth: W, lineThickness: t }),
    col("attack_line"),
    a,
    0,
    true,
    false,
  );
  // R looks the dash up as `court_features$substitution_zone` (`$` partial match resolves to the dash builder).
  let yk = W / 2 + p.substitution_zone_dash_breaks;
  const dash = F.substitutionZoneDash({ dashLength: p.substitution_zone_dash_length, lineThickness: t });
  for (let i = 0; i < p.substitution_zone_rep_pattern; i++) {
    add("substitution_zone_dash", dash, col("substitution_zone"), a, yk, true, true);
    yk += p.substitution_zone_dash_breaks + p.substitution_zone_dash_length;
  }
  add(
    "center_line",
    F.centerLine({ courtWidth: W, lineThickness: t }),
    col("center_line"),
    0,
    0,
    false,
    false,
  );
  add("end_line", F.endLine({ courtWidth: W, lineThickness: t }), col("end_line"), L / 2, 0, true, false);
  add("sideline", F.sideline({ courtLength: L, lineThickness: t }), col("sideline"), 0, W / 2, false, true);
  // Display range (geom-volleyball.R 493-620): the free zone is the padding (no +5).
  const hcl = L / 2 + p.free_zone_end_line;
  const hcw = W / 2 + p.free_zone_sideline;
  const inX = [-(L / 2 + t), L / 2 + t] as const;
  const off = [0, hcl] as const;
  const def = [-hcl, 0] as const;
  const X: Readonly<Record<VolleyballDisplayRange, readonly [number, number]>> = {
    full: [-hcl, hcl],
    in_bounds_only: inX,
    "in bounds only": inX,
    offense: off,
    offence: off,
    offensivehalfcourt: off,
    offensive_half_court: off,
    "offensive half court": off,
    defense: def,
    defence: def,
    defensivehalfcourt: def,
    defensive_half_court: def,
    "defensive half court": def,
  };
  const inBounds = range === "in_bounds_only" || range === "in bounds only";
  const [cx, cy] = convertLimits(X[range], inBounds ? [-(W / 2 + t), W / 2 + t] : [-hcw, hcw], from, units);
  const xlim = opts.xlim ?? [cx[0] + xTrans, cx[1] + xTrans];
  const ylim = opts.ylim ?? [cy[0] + yTrans, cy[1] + yTrans];
  const background = col("plot_background");
  return {
    sport: "volleyball",
    league: key,
    units,
    bbox: displayBbox(xlim, ylim, rotation),
    origin: "center",
    ...(/^#[0-9a-f]{6}00$/i.test(background) ? {} : { background }),
    features,
  };
}
