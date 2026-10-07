import type { Color, Feature, Point, Scene, SurfaceOptions } from "../scene.js";
import { SOCCER_LEAGUES, SOCCER_SPECS, type SoccerLeague, type SoccerParamUpdates } from "../specs/soccer.js";
import {
  UnknownDisplayRangeError,
  UnknownLeagueError,
  addFeature,
  arcResolution,
  colorAt,
  convertLimits,
  displayBbox,
  mergeColors,
  mergeParams,
} from "../surface.js";
import { normalizeUnit } from "../units.js";
import * as F from "./features.js";
import {
  SOCCER_DEFAULT_COLORS,
  SOCCER_DISPLAY_RANGES,
  type SoccerColorKey,
  type SoccerDisplayRange,
  type SoccerFeature,
} from "./types.js";

const isOneOf = <T extends string>(list: readonly T[], v: string): v is T =>
  (list as readonly string[]).includes(v);

/**
 * Port of sportyR `geom_soccer()`: one PolygonFeature per ggplot layer R adds, in R's layer order.
 * Documented divergences: an unknown `displayRange` throws (R falls back to "full"); `units` also converts the anchors and display limits.
 */
export function soccerPitch(
  league: SoccerLeague | (string & {}),
  opts: SurfaceOptions<SoccerParamUpdates, SoccerColorKey, SoccerDisplayRange> = {},
): Scene {
  const key = league.toLowerCase();
  if (!isOneOf(SOCCER_LEAGUES, key))
    throw new UnknownLeagueError(
      `Unknown soccer league "${league}"; expected one of: ${SOCCER_LEAGUES.join(", ")}`,
    );
  const range = (opts.displayRange ?? "full").toLowerCase(); // R: tolower() only — no trim
  if (!isOneOf(SOCCER_DISPLAY_RANGES, range))
    throw new UnknownDisplayRangeError(
      `Unknown soccer display range "${opts.displayRange}"; expected one of: ${SOCCER_DISPLAY_RANGES.join(", ")}`,
    );
  const p = mergeParams(SOCCER_SPECS[key], opts.updates, []); // soccer has no array fields
  const colors = mergeColors(SOCCER_DEFAULT_COLORS, opts.colorUpdates);
  const col = (k: SoccerColorKey): Color => colorAt(colors[k], 0);
  const npoints = arcResolution(opts.arcResolution);
  const from = normalizeUnit(p.pitch_units || "ft"); // R: pitch_units %or% "ft" (custom's "")
  const units = normalizeUnit(opts.units ?? from);
  const conv = units === from ? undefined : ([from, units] as const);
  const { rotation = 0, xTrans = 0, yTrans = 0 } = opts;
  const L = p.pitch_length;
  const W = p.pitch_width;
  const t = p.line_thickness;
  const features: Feature[] = [];
  const add = (
    name: SoccerFeature,
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
  // Layers, in R's add_feature order (geom-soccer.R 326-545).
  const half = F.halfPitch({ pitchLength: L, pitchWidth: W });
  add("half_pitch", half, col("defensive_half_pitch"), -0.25 * L, 0, false, false);
  add("half_pitch", half, col("offensive_half_pitch"), 0.25 * L, 0, false, false);
  add(
    "pitch_apron",
    F.pitchApron({
      pitchLength: L,
      pitchWidth: W,
      pitchApronTouchline: p.pitch_apron_touchline,
      pitchApronGoalLine: p.pitch_apron_goal_line,
      goalDepth: p.goal_depth,
    }),
    col("pitch_apron"),
    0,
    0,
    true,
    false,
    { stroke: col("pitch_apron") },
  );
  add(
    "touchline",
    F.touchline({ pitchLength: L, featureThickness: t }),
    col("touchline"),
    0,
    W / 2,
    false,
    true,
  );
  add(
    "goal_line",
    F.goalLine({ pitchWidth: W, featureThickness: t }),
    col("goal_line"),
    L / 2,
    0,
    true,
    false,
  );
  add(
    "corner_arc",
    F.cornerArc({ featureRadius: p.corner_arc_radius, featureThickness: t, npoints }),
    col("corner_arc"),
    L / 2 - t / 2,
    W / 2 - t / 2,
    true,
    true,
  );
  add(
    "halfway_line",
    F.halfwayLine({ pitchWidth: W, featureThickness: t }),
    col("halfway_line"),
    0,
    0,
    false,
    false,
  );
  add(
    "penalty_box",
    F.penaltyBox({
      featureRadius: p.penalty_circle_radius,
      featureThickness: t,
      boxLength: p.penalty_box_length,
      penaltyMarkDist: p.penalty_mark_dist,
      goalWidth: p.goal_width,
      goalPostToBoxEdge: p.interior_of_goal_post_to_penalty_box,
      npoints,
    }),
    col("penalty_box"),
    L / 2,
    0,
    true,
    true,
  );
  add(
    "goal_box",
    F.goalBox({
      featureThickness: t,
      boxLength: p.goal_box_length,
      goalWidth: p.goal_width,
      goalPostToBoxEdge: p.interior_of_goal_post_to_goal_box,
    }),
    col("goal_box"),
    L / 2,
    0,
    true,
    false,
  );
  add(
    "center_circle",
    F.centerCircle({ featureRadius: p.center_circle_radius, featureThickness: t, npoints }),
    col("center_circle"),
    0,
    0,
    true,
    false,
  );
  add(
    "penalty_mark",
    F.penaltyMark({ featureRadius: p.penalty_mark_radius, npoints }),
    col("penalty_mark"),
    L / 2 - p.penalty_mark_dist,
    0,
    true,
    false,
  );
  add(
    "center_mark",
    F.centerMark({ featureRadius: p.center_mark_radius, npoints }),
    col("center_mark"),
    0,
    0,
    true,
    false,
  );
  const mark = {
    featureThickness: t,
    depth: p.defensive_mark_depth,
    separationFromLine: p.defensive_mark_separation_from_line ?? 0,
  };
  if (p.touchline_defensive_mark_visible)
    add(
      "corner_defensive_marks",
      F.cornerDefensiveMarks({ ...mark, isTouchline: true }),
      col("corner_defensive_mark"),
      L / 2 - p.defensive_mark_distance,
      W / 2,
      true,
      true,
    );
  if (p.goal_line_defensive_mark_visible)
    add(
      "corner_defensive_marks",
      F.cornerDefensiveMarks({ ...mark, isGoalLine: true }),
      col("corner_defensive_mark"),
      L / 2,
      W / 2 - p.defensive_mark_distance,
      true,
      true,
    );
  add(
    "goal",
    F.goal({ featureThickness: t, goalWidth: p.goal_width, goalDepth: p.goal_depth }),
    col("goal"),
    L / 2 - t,
    0,
    true,
    false,
  );
  // Display range (geom-soccer.R 547-677) in native units (the +5 is NOT scaled — R); then converted (documented divergence 1), translated, rotated.
  const hpl = L / 2 + 5;
  const hpw = W / 2 + 5;
  const inX = [-(L / 2 + t), L / 2 + t] as const;
  const off = [0, hpl] as const;
  const def = [-hpl, 0] as const;
  const X: Readonly<Record<SoccerDisplayRange, readonly [number, number]>> = {
    full: [-hpl, hpl],
    in_bounds_only: inX,
    "in bounds only": inX,
    offense: off,
    offence: off,
    offensivehalfpitch: off,
    offensive_half_pitch: off,
    "offensive half pitch": off,
    defense: def,
    defence: def,
    defensivehalfpitch: def,
    defensive_half_pitch: def,
    "defensive half pitch": def,
  };
  const inBounds = range === "in_bounds_only" || range === "in bounds only"; // every other key keeps y = ±hpw
  const [cx, cy] = convertLimits(X[range], inBounds ? [-(W / 2 + t), W / 2 + t] : [-hpw, hpw], from, units);
  const xlim = opts.xlim ?? [cx[0] + xTrans, cx[1] + xTrans];
  const ylim = opts.ylim ?? [cy[0] + yTrans, cy[1] + yTrans];
  const background = col("plot_background"); // R: NULL = none; transparent stands in
  return {
    sport: "soccer",
    league: key,
    units,
    bbox: displayBbox(xlim, ylim, rotation),
    origin: "center",
    ...(/^#[0-9a-f]{6}00$/i.test(background) ? {} : { background }),
    features,
  };
}
