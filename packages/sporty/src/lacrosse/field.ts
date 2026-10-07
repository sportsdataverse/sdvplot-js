import type { Color, Feature, Point, Scene, SurfaceOptions } from "../scene.js";
import {
  LACROSSE_LEAGUES,
  LACROSSE_SPECS,
  type LacrosseLeague,
  type LacrosseParamUpdates,
} from "../specs/lacrosse.js";
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
  LACROSSE_DEFAULT_COLORS,
  LACROSSE_DISPLAY_RANGES,
  type LacrosseColorKey,
  type LacrosseDisplayRange,
  type LacrosseFeature,
} from "./types.js";

const isOneOf = <T extends string>(list: readonly T[], v: string): v is T =>
  (list as readonly string[]).includes(v);

// R reads five keys that no league's JSON has, so `%or% 0` always yields 0 (preserved for parity; absent from LacrosseParams).
const NZONE_LENGTH = 0; // geom-lacrosse.R 323/330/338: `nzone_length` (the JSON key is `neutral_zone_length`)
const BOARD_THICKNESS = 0; // R 819/836: `board_thickness` (the JSON key is `boards_thickness`)
const CENTER_FACE_OFF_MARKER_RADIUS = 0; // R 535
const CORNER_FACE_OFF_MARKER_BAR_WIDTH = 0; // R 541
const CORNER_FACE_OFF_MARKER_BAR_LENGTH = 0; // R 542

/**
 * Port of sportyR `geom_lacrosse()`: one PolygonFeature per ggplot layer R adds, in R's layer order.
 * Documented divergences: an unknown `displayRange` throws (R falls back to "full"); `units` also converts the anchors and
 * display limits; a user's `center_face_off_marker` colour wins over the contrasting `#ffcb05` (R overwrites it).
 */
export function lacrosseField(
  league: LacrosseLeague | (string & {}),
  opts: SurfaceOptions<LacrosseParamUpdates, LacrosseColorKey, LacrosseDisplayRange> = {},
): Scene {
  const key = league.toLowerCase();
  if (!isOneOf(LACROSSE_LEAGUES, key))
    throw new UnknownLeagueError(
      `Unknown lacrosse league "${league}"; expected one of: ${LACROSSE_LEAGUES.join(", ")}`,
    );
  const range = (opts.displayRange ?? "full").toLowerCase(); // R: tolower() only — no trim
  if (!isOneOf(LACROSSE_DISPLAY_RANGES, range))
    throw new UnknownDisplayRangeError(
      `Unknown lacrosse display range "${opts.displayRange}"; expected one of: ${LACROSSE_DISPLAY_RANGES.join(", ")}`,
    );
  const p = mergeParams(LACROSSE_SPECS[key], opts.updates, ["goal_fan_hash_mark_separation_from_center"]);
  // Colour pre-step (geom-lacrosse.R 296-311): R compares the DEFAULTS (always equal) and then overwrites even a user's
  // value; here the user's value wins (documented divergence 6).
  const contrast =
    (p.center_face_off_marker_color_contrasting ?? false) &&
    LACROSSE_DEFAULT_COLORS.center_face_off_marker === LACROSSE_DEFAULT_COLORS.center_line;
  const colors = mergeColors(
    LACROSSE_DEFAULT_COLORS,
    contrast && opts.colorUpdates?.center_face_off_marker === undefined
      ? { ...opts.colorUpdates, center_face_off_marker: "#ffcb05" }
      : opts.colorUpdates,
  );
  const col = (k: LacrosseColorKey): Color => colorAt(colors[k], 0);
  const npoints = arcResolution(opts.arcResolution);
  const from = normalizeUnit(p.field_units || "ft"); // R: field_units %or% "ft" (custom's "")
  const units = normalizeUnit(opts.units ?? from);
  const conv = units === from ? undefined : ([from, units] as const);
  const { rotation = 0, xTrans = 0, yTrans = 0 } = opts;
  const L = p.field_length;
  const W = p.field_width;
  const gx = L / 2 - p.goal_line_center_to_end_line; // every goal feature's x anchor
  const features: Feature[] = [];
  const add = (
    name: LacrosseFeature,
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
  const stroked = (k: LacrosseColorKey): { stroke: Color } => ({ stroke: col(k) });
  // Layers, in R's add_feature order (geom-lacrosse.R 616-1199).
  const zone = {
    fieldLength: L,
    fieldWidth: W,
    cornerRadius: p.corner_radius ?? 0,
    nzoneLength: NZONE_LENGTH,
    fieldShape: p.field_shape,
    npoints,
  };
  add(
    "field_apron",
    F.fieldApron({
      fieldLength: L,
      fieldWidth: W,
      fieldApronThickness: p.field_apron_thickness,
      fieldShape: p.field_shape,
    }),
    col("field_apron"),
    0,
    0,
    true,
    false,
    stroked("field_apron"),
  );
  add(
    "defensive_zone",
    F.defensiveZone(zone),
    col("defensive_zone"),
    0,
    0,
    false,
    false,
    stroked("defensive_zone"),
  );
  add(
    "neutral_zone",
    F.neutralZone({ nzoneLength: NZONE_LENGTH, fieldWidth: W }),
    col("neutral_zone"),
    0,
    0,
    false,
    false,
  );
  add(
    "offensive_zone",
    F.offensiveZone(zone),
    col("offensive_zone"),
    0,
    0,
    false,
    false,
    stroked("offensive_zone"),
  );
  const crease = {
    refereeCreaseRadius: p.referee_crease_radius ?? 0,
    lineThickness: p.referee_crease_thickness ?? 0,
    npoints,
  };
  add("referee_crease_fill", F.refereeCreaseFill(crease), col("referee_crease_fill"), 0, -W / 2, true, false);
  const boundary = p.boundary_thickness ?? 0;
  add(
    "sideline",
    F.sideline({ fieldLength: L, lineThickness: boundary }),
    (p.has_sidelines ?? true) ? col("sideline") : "#ffffff00",
    0,
    W / 2,
    false,
    true,
  );
  add(
    "end_line",
    F.endLine({ fieldWidth: W, lineThickness: boundary }),
    (p.has_endlines ?? true) ? col("end_line") : "#ffffff00",
    L / 2,
    0,
    true,
    false,
  );
  const changeAreaLength =
    (p.bench_separation ?? 0) / 2 + (p.bench_length ?? 0) + (p.change_area_extension ?? 0);
  const changeAreaWidth = p.change_area_width ?? 0;
  add(
    "change_area_outline",
    F.changeAreaOutline({
      changeAreaLength,
      changeAreaWidth,
      featureThickness: p.change_area_outline_thickness ?? 0,
    }),
    col("change_area_outline"),
    0,
    W / 2,
    true,
    false,
    stroked("change_area_outline"),
  );
  add(
    "change_area_fill",
    F.changeAreaFill({ changeAreaLength, changeAreaWidth }),
    col("change_area_fill"),
    0,
    W / 2,
    true,
    false,
    stroked("change_area_fill"),
  );
  add(
    "center_line",
    F.centerLine({ centerLineWidth: p.center_line_width, lineThickness: p.center_line_thickness }),
    col("center_line"),
    0,
    0,
    true,
    false,
  );
  const bench = {
    benchAreaOutlineThickness: p.boards_thickness ?? 0,
    benchLength: p.bench_length ?? 0,
    benchDepth: p.bench_depth ?? 0,
  };
  const benchX = (p.bench_separation ?? 0) / 2 + (p.bench_length ?? 0) / 2;
  const benchFill = F.playerBenchAreaFill(bench);
  add("player_bench_area_fill", benchFill, col("team_a_bench"), -benchX, W / 2, false, false);
  add("player_bench_area_fill", benchFill, col("team_b_bench"), benchX, W / 2, false, false);
  add(
    "player_bench_outline",
    F.playerBenchOutline(bench),
    col("boards"),
    (p.bench_separation ?? 0) / 2,
    W / 2,
    true,
    false,
  );
  const penaltyBox = {
    penaltyBoxOutlineThickness: p.boards_thickness ?? 0,
    penaltyBoxLength: p.penalty_box_length ?? 0,
    penaltyBoxDepth: p.penalty_box_depth ?? 0,
  };
  const penaltyX = (p.penalty_box_separation ?? 0) / 2 + BOARD_THICKNESS + (p.penalty_box_length ?? 0) / 2;
  const penaltyFill = F.penaltyBoxFill(penaltyBox);
  add("penalty_box_fill", penaltyFill, col("team_a_penalty_box"), -penaltyX, -W / 2, false, false);
  add("penalty_box_fill", penaltyFill, col("team_b_penalty_box"), penaltyX, -W / 2, false, false);
  add(
    "penalty_box_outline",
    F.penaltyBoxOutline({ ...penaltyBox, penaltyBoxSeparation: p.penalty_box_separation ?? 0 }),
    col("boards"),
    0,
    -(W / 2),
    true,
    false,
  );
  add(
    "off_field_officials_box",
    F.offFieldOfficialsBox({
      officialsBoxThickness: p.boards_thickness ?? 0,
      officialsBoxLength: p.penalty_box_separation ?? 0,
      officialsBoxDepth: p.penalty_box_depth ?? 0,
    }),
    col("off_field_officials_box"),
    0,
    -(W / 2),
    false,
    false,
  );
  add(
    "boards",
    F.boards({
      fieldLength: L,
      fieldWidth: W,
      cornerRadius: p.corner_radius ?? 0,
      boundaryThickness: p.boards_thickness ?? 0,
      npoints,
    }),
    col("boards"),
    0,
    0,
    true,
    false,
    { stroke: (p.has_boards ?? false) ? col("boards") : "#ffffff00" },
  );
  add(
    "wing_line",
    F.wingLine({ wingLineLength: p.wing_line_length ?? 0, lineThickness: p.wing_line_thickness ?? 0 }),
    col("wing_line"),
    0,
    W / 2 - (p.wing_line_center_to_sideline ?? 0),
    false,
    true,
  );
  add(
    "restraining_line",
    F.restrainingLine({ fieldWidth: W, lineThickness: p.restraining_line_thickness ?? 0 }),
    col("restraining_line"),
    p.restraining_line_outer_edge_to_center ?? 0,
    0,
    true,
    false,
  );
  add(
    "defensive_area_line",
    F.defensiveAreaLine({
      defensiveAreaLineLength: p.defensive_area_line_length ?? 0,
      lineThickness: p.defensive_area_line_thickness ?? 0,
    }),
    col("defensive_area_line"),
    L / 2 - (p.defensive_area_line_length ?? 0),
    W / 2 - (p.defensive_area_line_center_to_sideline ?? 0),
    true,
    true,
  );
  add("referee_crease", F.refereeCrease(crease), col("referee_crease"), 0, -W / 2, true, false);
  add(
    "center_circle",
    F.centerCircle({
      centerCircleRadius: p.center_circle_radius ?? 0,
      centerCircleThickness: p.center_circle_thickness ?? 0,
      npoints,
    }),
    col("center_circle"),
    0,
    0,
    true,
    false,
  );
  const goalCircle = {
    goalCircleRadius: p.goal_circle_radius,
    lineThickness: p.goal_circle_thickness,
    goalCircleFull360: p.goal_circle_full_360,
    goalDepth: p.goal_depth,
    goalDepthToCircle: p.goal_depth_to_circle ?? 0,
    npoints,
  };
  add("goal_circle_fill", F.goalCircleFill(goalCircle), col("goal_circle_fill"), gx, 0, true, true);
  add("goal_circle", F.goalCircle(goalCircle), col("goal_circle"), gx, 0, true, true);
  add(
    "goal_arc",
    F.goalArc({
      goalArcExtension: p.goal_arc_extension ?? 0,
      goalArcRadius: p.goal_arc_radius ?? 0,
      lineThickness: p.goal_arc_line_thickness, // R: no %or% — undefined reproduces its NULL recycling
      npoints,
    }),
    col("goal_arc"),
    gx,
    0,
    true,
    false,
  );
  add(
    "goal_fan",
    F.goalFan({
      goalFanRadius: p.goal_fan_radius ?? 0,
      goalCircleRadius: p.goal_circle_radius,
      lineThickness: p.goal_fan_line_thickness ?? 0,
      npoints,
    }),
    col("goal_fan"),
    gx,
    0,
    true,
    false,
  );
  for (const sep of p.goal_fan_hash_mark_separation_from_center ?? []) {
    const thetaBuild = sep / ((p.goal_fan_radius ?? 1) + p.goal_circle_radius); // radians (features-list site, R 576)
    const thetaPlace = sep / (p.goal_fan_radius ?? 1) / Math.PI; // units of π (placement site, R 1042) — R uses two formulas; both preserved
    const R = (p.goal_fan_radius ?? 0) + p.goal_circle_radius;
    const mark = F.goalFanHashMark({
      goalFanHashMarkLength: p.goal_fan_hash_mark_length ?? 0,
      lineThickness: p.goal_fan_hash_mark_line_thickness ?? 0,
      rotationalAngle: (-thetaBuild * 180) / Math.PI,
    });
    add(
      "goal_fan_hash_mark",
      mark,
      col("goal_fan_hash_mark"),
      gx + p.goal_circle_radius + R * Math.cos((1 - thetaPlace) * Math.PI),
      R * Math.sin((1 - thetaPlace) * Math.PI),
      true,
      true,
    );
  }
  add(
    "goal_mouth",
    F.goalMouth({
      goalMouthRadius: p.goal_mouth_radius ?? 0,
      lineThickness: p.goal_mouth_line_thickness ?? 0,
      goalMouthSemiCircleSeparation: p.goal_mouth_semi_circle_separation ?? 0,
      npoints,
    }),
    col("goal_mouth"),
    gx,
    0,
    true,
    false,
  );
  add(
    "goal_mouth_hash_mark",
    F.goalMouthHashMark({
      goalMouthHashMarkLength: p.goal_mouth_hash_mark_length ?? 0,
      lineThickness: p.goal_mouth_hash_mark_line_thickness ?? 0,
    }),
    col("goal_mouth_hash_mark"),
    gx,
    p.goal_fan_radius ?? 0,
    true,
    true,
  );
  add(
    "below_goal_marking",
    F.belowGoalMarking({ belowGoalMarkingRadius: p.below_goal_marking_radius ?? 0, npoints }),
    col("below_goal_marking"),
    gx + (p.below_goal_marking_to_goal_line ?? 0),
    (p.goal_fan_radius ?? 0) / 2,
    true,
    true,
  );
  const goal = {
    goalFrameOpeningInterior: p.goal_frame_opening_interior,
    goalPostThickness: p.goal_post_thickness,
    goalDepth: p.goal_depth,
  };
  add("goal_net", F.goalNet(goal), col("goal_net"), gx, 0, true, false);
  add("goal_frame", F.goalFrame(goal), col("goal_frame"), gx, 0, true, false);
  add(
    "goal_line",
    F.goalLine({
      goalFrameWidth: p.goal_frame_width,
      lineThickness: p.goal_line_thickness,
      goalLineFullDiameter: Boolean(p.goal_line_full_diameter),
      goalCircleRadius: p.goal_circle_radius,
      npoints,
    }),
    col("goal_line"),
    gx,
    0,
    true,
    false,
  );
  add(
    "face_off_marker",
    F.faceOffMarker({
      shape: p.center_face_off_marker_shape ?? "O",
      featureThickness: p.center_face_off_marker_side_width ?? 0,
      sideLength: p.center_face_off_marker_side_length ?? 0,
      featureRadius: CENTER_FACE_OFF_MARKER_RADIUS,
      npoints,
    }),
    col("center_face_off_marker"),
    0,
    0,
    false,
    false,
  );
  add(
    "face_off_marker",
    F.faceOffMarker({
      shape: p.corner_face_off_marker_shape ?? "O",
      featureThickness: CORNER_FACE_OFF_MARKER_BAR_WIDTH,
      sideLength: CORNER_FACE_OFF_MARKER_BAR_LENGTH,
      featureRadius: p.corner_face_off_marker_radius ?? 0,
      npoints,
    }),
    col("corner_face_off_marker"),
    (p.restraining_line_outer_edge_to_center ?? 0) + (p.corner_face_off_marker_to_attack_line_outer ?? 0) / 2,
    W / 2 - (p.corner_face_off_marker_to_boards ?? 0),
    true,
    true,
  );
  // Display range (geom-lacrosse.R 1202-1308) in native units; then converted (documented divergence 1), translated, rotated.
  const hfl = L / 2 + p.field_apron_thickness;
  const hfw = W / 2 + p.field_apron_thickness;
  const boards = p.boards_thickness ?? 0;
  const inX = [-(L / 2 + boards), L / 2 + boards] as const;
  const off = [0, hfl] as const;
  const def = [-hfl, 0] as const;
  const X: Readonly<Record<LacrosseDisplayRange, readonly [number, number]>> = {
    full: [-hfl, hfl],
    in_bounds_only: inX,
    "in bounds only": inX,
    offense: off,
    offence: off,
    offensivehalffield: off,
    offensive_half_field: off,
    "offensive half field": off,
    defense: def,
    defence: def,
    defensivehalffield: def,
    defensive_half_field: def,
    "defensive half field": def,
  };
  const inBounds = range === "in_bounds_only" || range === "in bounds only"; // every other key keeps y = ±hfw
  const [cx, cy] = convertLimits(
    X[range],
    inBounds ? [-(W / 2 + boards), W / 2 + boards] : [-hfw, hfw],
    from,
    units,
  );
  const xlim = opts.xlim ?? [cx[0] + xTrans, cx[1] + xTrans];
  const ylim = opts.ylim ?? [cy[0] + yTrans, cy[1] + yTrans];
  const background = col("plot_background"); // R: NULL = none; transparent stands in
  return {
    sport: "lacrosse",
    league: key,
    units,
    bbox: displayBbox(xlim, ylim, rotation),
    origin: "center",
    ...(/^#[0-9a-f]{6}00$/i.test(background) ? {} : { background }),
    features,
  };
}
