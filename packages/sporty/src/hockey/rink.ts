import type { Color, Feature, Point, Scene, SurfaceOptions, Units } from "../scene.js";
import { HOCKEY_LEAGUES, HOCKEY_SPECS, type HockeyLeague, type HockeyParamUpdates } from "../specs/hockey.js";
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
import { convertUnits } from "../units.js";
import * as F from "./features.js";
import {
  HOCKEY_DEFAULT_COLORS,
  HOCKEY_DISPLAY_RANGES,
  type HockeyColorKey,
  type HockeyDisplayRange,
  type HockeyFeature,
} from "./types.js";

const isOneOf = <T extends string>(list: readonly T[], v: string): v is T =>
  (list as readonly string[]).includes(v);

/** `display_range` keys with spaces/underscores removed, then R's synonyms folded together. */
type RangeGroup = "full" | "inboundsonly" | "offense" | "defense" | "nzone" | "ozone" | "dzone";
const RANGE_SYNONYMS: Readonly<Record<string, RangeGroup>> = {
  offence: "offense",
  defence: "defense",
  neutral: "nzone",
  neutralzone: "nzone",
  offensivezone: "ozone",
  attackingzone: "ozone",
  defensivezone: "dzone",
  defendingzone: "dzone",
};

/**
 * Port of sportyR `geom_hockey()`: one PolygonFeature per ggplot layer R adds, in R's layer order.
 * Divergences: an unknown `displayRange` throws (R falls back to "full"); `units` also converts the
 * anchors and display limits (R converts only the feature points, so its non-native plots are broken).
 */
export function hockeyRink(
  league: HockeyLeague | (string & {}),
  opts: SurfaceOptions<HockeyParamUpdates, HockeyColorKey, HockeyDisplayRange> = {},
): Scene {
  const key = league.toLowerCase();
  if (!isOneOf(HOCKEY_LEAGUES, key)) {
    throw new UnknownLeagueError(
      `Unknown hockey league "${league}"; expected one of: ${HOCKEY_LEAGUES.join(", ")}`,
    );
  }
  const range = (opts.displayRange ?? "full").toLowerCase();
  if (!isOneOf(HOCKEY_DISPLAY_RANGES, range)) {
    throw new UnknownDisplayRangeError(
      `Unknown hockey display range "${opts.displayRange}"; expected one of: ${HOCKEY_DISPLAY_RANGES.join(", ")}`,
    );
  }

  // Every hockey param is a scalar: no array fields, so no multi-instance tables (unlike basketball).
  const p = mergeParams(HOCKEY_SPECS[key], opts.updates, []);
  const colors = mergeColors(HOCKEY_DEFAULT_COLORS, opts.colorUpdates);
  const col = (k: HockeyColorKey): Color => colorAt(colors[k], 0);
  const npoints = opts.arcResolution ?? 200;
  const from: Units = p.rink_units || "ft"; // custom's "" (R would error converting from "")
  const units = opts.units ?? from;
  const conv = units === from ? undefined : ([from, units] as const);
  const { rotation = 0, xTrans = 0, yTrans = 0 } = opts;
  const hint = (ft: number): number => convertUnits(ft, "ft", units);

  const L = p.rink_length;
  const W = p.rink_width;
  const bt = p.board_thickness;
  const minor = p.minor_line_thickness;
  const major = p.major_line_thickness;
  const goalX = L / 2 - p.goal_line_to_boards;
  const odzoneX = L / 2 - p.odzone_faceoff_spot_to_boards;
  const nzoneSpotX = p.nzone_length / 2 - p.nzone_faceoff_spot_to_zone_line;
  const spotY = p.noncenter_faceoff_spot_y;

  const features: Feature[] = [];
  const add = (
    name: HockeyFeature,
    pts: readonly Point[],
    fill: Color,
    xAnchor: number,
    yAnchor: number,
    reflectX: boolean,
    reflectY: boolean,
    extra: { height?: number } = {},
  ): void =>
    addFeature(
      features,
      name,
      pts,
      fill,
      { xAnchor, yAnchor, reflectX, reflectY, xTrans, yTrans, rotation },
      conv ? { ...extra, units: conv } : extra,
    );

  const zone = {
    rinkLength: L,
    rinkWidth: W,
    featureRadius: p.corner_radius,
    nzoneLength: p.nzone_length,
    npoints,
  };
  const crease = {
    featureRadius: p.goal_crease_radius,
    featureThickness: minor,
    creaseStyle: p.goal_crease_style,
    creaseLength: p.goal_crease_length,
    creaseWidth: p.goal_crease_width,
    notchDistX: p.goal_crease_notch_dist_x,
    notchWidth: p.goal_crease_notch_width,
    npoints,
  };
  const goal = {
    featureRadius: p.goal_radius,
    goalMouthWidth: p.goal_mouth_width,
    goalBackWidth: p.goal_back_width,
    goalDepth: p.goal_depth,
    goalPostDiameter: p.goal_post_diameter,
    npoints,
  };
  const lines = {
    featureThickness: minor,
    faceoffLineDistY: p.faceoff_line_dist_y,
    faceoffLineWidth: p.faceoff_line_width,
  };
  const ring = F.nodzoneFaceoffSpotRing({
    featureRadius: p.noncenter_faceoff_spot_radius,
    featureThickness: minor,
    npoints,
  });
  const stripe = F.nodzoneFaceoffSpotStripe({
    featureRadius: p.noncenter_faceoff_spot_radius,
    featureThickness: minor,
    gapWidth: p.noncenter_faceoff_spot_gap_width,
    npoints,
  });
  const bench = { featureThickness: bt, benchLength: p.bench_length, benchDepth: p.bench_depth };
  const benchX = p.bench_separation / 2 + p.bench_length / 2;
  const boxX = p.penalty_box_separation / 2 + bt + p.penalty_box_length / 2;
  const boxFill = F.penaltyBoxFill({
    featureThickness: bt,
    penaltyBoxLength: p.penalty_box_length,
    penaltyBoxDepth: p.penalty_box_depth,
  });

  // Layers, in R's add_feature order (geom-hockey.R 468-892).
  add("defensive_zone", F.defensiveZone(zone), col("dzone_ice"), 0, 0, false, false);
  add(
    "neutral_zone",
    F.neutralZone({ rinkWidth: W, featureThickness: p.nzone_length }),
    col("nzone_ice"),
    0,
    0,
    false,
    false,
  );
  add("offensive_zone", F.offensiveZone(zone), col("ozone_ice"), 0, 0, false, false);
  add(
    "center_line",
    F.centerLine({
      featureThickness: major,
      rinkWidth: W,
      centerFaceoffSpotGap: p.center_faceoff_spot_gap ?? 0,
    }),
    col("center_line"),
    0,
    0,
    false,
    true,
  );
  add(
    "zone_line",
    F.zoneLine({ rinkWidth: W, featureThickness: major }),
    col("zone_line"),
    p.nzone_length / 2,
    0,
    true,
    false,
  );
  if (p.has_trapezoid) {
    add(
      "goaltenders_restricted_area",
      F.goaltendersRestrictedArea({
        rinkLength: L,
        featureThickness: minor,
        shortBaseWidth: p.short_base_width,
        longBaseWidth: p.long_base_width,
        xAnchor: goalX,
      }),
      col("restricted_trapezoid"),
      goalX,
      0,
      true,
      false,
    );
  }
  add("goal_crease_fill", F.goalCreaseFill(crease), col("goal_crease_fill"), goalX, 0, true, false);
  add("goal_crease_outline", F.goalCreaseOutline(crease), col("goal_crease_outline"), goalX, 0, true, false);
  add(
    "goal_line",
    F.goalLine({
      rinkLength: L,
      rinkWidth: W,
      featureRadius: p.corner_radius,
      featureThickness: minor,
      xAnchor: goalX,
      npoints,
    }),
    col("goal_line"),
    goalX,
    0,
    true,
    false,
  );
  add("goal_frame_fill", F.goalFrameFill(goal), col("goal_fill"), goalX, 0, true, false);
  add("goal_frame", F.goalFrame(goal), col("goal_frame"), goalX, 0, true, false, { height: hint(4) });
  add(
    "odzone_faceoff_circle",
    F.odzoneFaceoffCircle({
      featureRadius: p.faceoff_circle_radius,
      featureThickness: minor,
      hashmarkWidth: p.hashmark_width,
      hashmarkExtSpacing: p.hashmark_ext_spacing,
      npoints,
    }),
    col("odzone_faceoff_circle"),
    odzoneX,
    spotY,
    true,
    true,
  );
  add("nodzone_faceoff_spot_stripe", stripe, col("faceoff_spot_stripe"), odzoneX, spotY, true, true);
  add("nodzone_faceoff_spot_ring", ring, col("faceoff_spot_ring"), odzoneX, spotY, true, true);
  add(
    "odzone_faceoff_lines",
    F.odzoneFaceoffLines({
      ...lines,
      faceoffLineDistX: p.faceoff_line_dist_x,
      faceoffLineLength: p.faceoff_line_length,
    }),
    col("faceoff_line"),
    odzoneX,
    spotY,
    true,
    true,
  );
  add(
    "odzone_faceoff_lines",
    F.odzoneFaceoffLines({
      ...lines,
      faceoffLineDistX: -1 * p.faceoff_line_dist_x,
      faceoffLineLength: -1 * p.faceoff_line_length,
    }),
    col("faceoff_line"),
    odzoneX,
    spotY,
    true,
    true,
  );
  add("nodzone_faceoff_spot_stripe", stripe, col("faceoff_spot_stripe"), nzoneSpotX, spotY, true, true);
  add("nodzone_faceoff_spot_ring", ring, col("faceoff_spot_ring"), nzoneSpotX, spotY, true, true);
  add(
    "center_faceoff_circle",
    F.centerFaceoffCircle({ featureRadius: p.faceoff_circle_radius, featureThickness: minor, npoints }),
    col("center_faceoff_circle"),
    0,
    0,
    true,
    false,
  );
  add(
    "referee_crease",
    F.refereeCrease({ featureRadius: p.referee_crease_radius, featureThickness: minor, npoints }),
    col("referee_crease"),
    0,
    -W / 2,
    false,
    false,
  );
  add(
    "center_faceoff_spot",
    F.centerFaceoffSpot({ featureRadius: p.center_faceoff_spot_radius, npoints }),
    col("center_faceoff_spot"),
    0,
    0,
    true,
    false,
  );
  const benchFill = F.playerBenchAreaFill(bench);
  add("player_bench_area_fill", benchFill, col("team_a_bench"), -benchX, W / 2, false, false);
  add("player_bench_area_fill", benchFill, col("team_b_bench"), benchX, W / 2, false, false);
  add(
    "player_bench_outline",
    F.playerBenchOutline(bench),
    col("boards"),
    p.bench_separation / 2,
    W / 2,
    true,
    false,
  );
  add("penalty_box_fill", boxFill, col("team_a_penalty_box"), -boxX, -W / 2, false, false);
  add("penalty_box_fill", boxFill, col("team_b_penalty_box"), boxX, -W / 2, false, false);
  add(
    "penalty_box_outline",
    F.penaltyBoxOutline({
      featureThickness: bt,
      penaltyBoxLength: p.penalty_box_length,
      penaltyBoxDepth: p.penalty_box_depth,
      penaltyBoxSeparation: p.penalty_box_separation,
    }),
    col("boards"),
    0,
    -(W / 2),
    true,
    false,
  );
  add(
    "off_ice_officials_box",
    F.offIceOfficialsBox({
      featureThickness: bt,
      officialsBoxLength: p.penalty_box_separation,
      officialsBoxDepth: p.penalty_box_depth,
    }),
    col("off_ice_officials_box"),
    0,
    -(W / 2),
    false,
    false,
  );
  add(
    "boards",
    F.boards({ rinkLength: L, rinkWidth: W, featureRadius: p.corner_radius, featureThickness: bt, npoints }),
    col("boards"),
    0,
    0,
    true,
    false,
    { height: hint(3.5) },
  );

  // Display range (R 894-1090), in the spec's units; then converted, translated, rotated.
  const hrl = L / 2 + 3 * bt + 5;
  const hrw = W / 2 + Math.max(p.bench_depth, p.penalty_box_depth) + 3 * bt + 5;
  const hnz = p.nzone_length / 2 + major + 5;
  const fullY = [-hrw, hrw] as const;
  const ranges: Record<RangeGroup, readonly [readonly [number, number], readonly [number, number]]> = {
    full: [[-hrl, hrl], fullY],
    inboundsonly: [
      [-(L / 2 + bt), L / 2 + bt],
      [-(W / 2 + bt), W / 2 + bt],
    ],
    offense: [[0, hrl], fullY],
    defense: [[-hrl, 0], fullY],
    nzone: [[-hnz, hnz], fullY],
    ozone: [[hnz - major - 10, hrl], fullY],
    dzone: [[-hrl, -hnz + major + 10], fullY],
  };
  const squashed = range.replace(/[ _]/g, "");
  const [rx, ry] = ranges[RANGE_SYNONYMS[squashed] ?? (squashed as RangeGroup)];
  const [cx, cy] = convertLimits(rx, ry, from, units);
  const xlim = opts.xlim ?? [cx[0] + xTrans, cx[1] + xTrans];
  const ylim = opts.ylim ?? [cy[0] + yTrans, cy[1] + yTrans];

  // R: plot_background NULL = none; our transparent default stands in for NULL.
  const background = col("plot_background");
  return {
    sport: "hockey",
    league: key,
    units,
    bbox: displayBbox(xlim, ylim, rotation),
    origin: "center",
    ...(/^#[0-9a-f]{6}00$/i.test(background) ? {} : { background }),
    features,
  };
}
