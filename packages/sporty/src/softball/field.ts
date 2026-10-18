import type { Color, Feature, Point, Scene, SurfaceOptions } from "../scene.js";
import {
  SOFTBALL_LEAGUES,
  SOFTBALL_SPECS,
  type SoftballLeague,
  type SoftballParamUpdates,
} from "../specs/softball.js";
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
  SOFTBALL_DEFAULT_COLORS,
  SOFTBALL_DISPLAY_RANGES,
  type SoftballColorKey,
  type SoftballDisplayRange,
  type SoftballFeature,
} from "./types.js";

const isOneOf = <T extends string>(list: readonly T[], v: string): v is T =>
  (list as readonly string[]).includes(v);

/**
 * Port of sportyR `geom_softball()` (2.3.0): origin = back tip of home plate, +y toward centre field. `units` converts the
 * points, anchors and display limits, as R does for softball. Divergence: an unknown `displayRange` throws (R falls back to
 * "full").
 */
export function softballField(
  league: SoftballLeague | (string & {}),
  opts: SurfaceOptions<SoftballParamUpdates, SoftballColorKey, SoftballDisplayRange> = {},
): Scene {
  const key = league.toLowerCase();
  if (!isOneOf(SOFTBALL_LEAGUES, key))
    throw new UnknownLeagueError(
      `Unknown softball league "${league}"; expected one of: ${SOFTBALL_LEAGUES.join(", ")}`,
    );
  const range = (opts.displayRange ?? "full").toLowerCase();
  if (!isOneOf(SOFTBALL_DISPLAY_RANGES, range))
    throw new UnknownDisplayRangeError(
      `Unknown softball display range "${opts.displayRange}"; expected one of: ${SOFTBALL_DISPLAY_RANGES.join(", ")}`,
    );
  const p = mergeParams(SOFTBALL_SPECS[key], opts.updates, []); // softball has no array fields
  const colors = mergeColors(SOFTBALL_DEFAULT_COLORS, opts.colorUpdates);
  const col = (k: SoftballColorKey): Color => colorAt(colors[k], 0);
  const npoints = arcResolution(opts.arcResolution);
  const from = normalizeUnit(p.field_units || "ft");
  const units = normalizeUnit(opts.units ?? from);
  const conv = units === from ? undefined : ([from, units] as const);
  const { rotation = 0, xTrans = 0, yTrans = 0 } = opts;
  const features: Feature[] = [];
  const add = (
    name: SoftballFeature,
    pts: readonly Point[],
    fill: Color,
    xAnchor: number,
    yAnchor: number,
    reflectX = false,
  ): void =>
    addFeature(
      features,
      name,
      pts,
      fill,
      { xAnchor, yAnchor, reflectX, reflectY: false, xTrans, yTrans, rotation },
      conv ? { units: conv } : {},
    );
  const bl = p.baseline_distance;
  const ppf = p.pitchers_plate_front_to_home_plate;
  const box = {
    battersBoxLength: p.batters_box_length,
    battersBoxWidth: p.batters_box_width,
    battersBoxYAdj: p.batters_box_y_adj,
  };
  const foul = {
    ...box,
    homePlateSideToBattersBox: p.home_plate_side_to_batters_box,
    homePlateEdgeLength: p.home_plate_edge_length,
    foulLineThickness: p.line_width,
  };
  // Layers, in R's add_feature order (geom-softball.R 351-591).
  add(
    "infield_dirt",
    F.infieldDirt({
      homePlateCircleRadius: p.home_plate_circle_radius,
      foulLineToFoulGrass: p.foul_line_to_foul_grass,
      pitchersPlateDistance: ppf,
      infieldArcRadius: p.infield_arc_radius,
      npoints,
    }),
    col("infield_dirt"),
    0,
    0,
  );
  add("home_plate", F.homePlate({ homePlateEdgeLength: p.home_plate_edge_length }), col("base"), 0, 0);
  add(
    "base",
    F.base({ baseSideLength: p.base_side_length, adjustXLeft: true }),
    col("base"),
    bl * Math.cos(Math.PI / 4),
    bl * Math.sin(Math.PI / 4),
  ); // first base
  add("base", F.base({ baseSideLength: p.base_side_length }), col("base"), 0, bl * Math.SQRT2); // second base
  add(
    "base",
    F.base({ baseSideLength: p.base_side_length, adjustXRight: true }),
    col("base"),
    bl * Math.cos((3 * Math.PI) / 4),
    bl * Math.sin((3 * Math.PI) / 4),
  ); // third base
  add(
    "pitchers_plate",
    F.pitchersPlate({
      pitchersPlateLength: p.pitchers_plate_length,
      pitchersPlateWidth: p.pitchers_plate_width,
    }),
    col("pitchers_plate"),
    0,
    ppf,
  );
  add(
    "batters_box",
    F.battersBox({ ...box, battersBoxThickness: p.line_width }),
    col("batters_box"),
    p.home_plate_edge_length / 2 + p.home_plate_side_to_batters_box + p.batters_box_width / 2,
    0,
    true,
  );
  add(
    "catchers_box",
    F.catchersBox({
      catchersBoxDepth: p.catchers_box_depth,
      catchersBoxWidth: p.catchers_box_width,
      battersBoxLength: p.batters_box_length,
      battersBoxYAdj: p.batters_box_y_adj,
      catchersBoxThickness: p.line_width,
    }),
    col("catchers_box"),
    0,
    0,
  );
  add(
    "foul_line",
    F.foulLine({ ...foul, isLine1b: true, lineDistance: p.right_field_distance }),
    col("foul_line"),
    0,
    0,
  );
  add("foul_line", F.foulLine({ ...foul, lineDistance: p.left_field_distance }), col("foul_line"), 0, 0);
  add(
    "running_lane",
    F.runningLane({
      runningLaneDepth: p.running_lane_depth,
      runningLaneLength: p.running_lane_length,
      runningLaneStartDistance: p.running_lane_start_distance,
      runningLaneThickness: p.line_width,
    }),
    col("running_lane"),
    0,
    0,
  );
  add(
    "pitchers_circle",
    F.pitchersCircle({
      pitchersCircleRadius: p.pitchers_circle_radius,
      pitchersCircleThickness: p.line_width,
      npoints,
    }),
    col("pitchers_circle"),
    0,
    ppf,
  );
  add(
    "pitchers_lane",
    F.pitchersLane({
      pitchersLaneLength: p.pitchers_lane_length,
      pitchersPlateLength: p.pitchers_plate_length,
      pitchersPlateFrontToHomePlate: ppf,
      homePlateEdgeLength: p.home_plate_edge_length,
      homePlateSideToBattersBox: p.home_plate_side_to_batters_box,
      battersBoxLength: p.batters_box_length,
      battersBoxYAdj: p.batters_box_y_adj,
      pitchersLaneThickness: p.line_width,
    }),
    col("pitchers_lane"),
    0,
    ppf,
    true,
  );
  add(
    "coaches_box",
    F.coachesBox({
      baselineDistance: bl,
      coachesBoxDepth: p.coaches_box_depth,
      coachesBoxLength: p.coaches_box_length,
      coachesBoxWidth: p.coaches_box_width,
      coachesBoxThickness: p.line_width,
    }),
    col("coaches_box"),
    0,
    0,
    true,
  );
  // Display range (geom-softball.R 594-646): the 5-unit padding is in the field's native units, converted with the field.
  const pad = 5;
  const full = range === "full";
  const xr: readonly [number, number] = full
    ? [p.left_field_distance * Math.cos((3 * Math.PI) / 4), p.right_field_distance * Math.cos(Math.PI / 4)]
    : [-p.infield_arc_radius - pad, p.infield_arc_radius + pad];
  const yr: readonly [number, number] = full
    ? [-p.backstop_radius - pad, p.center_field_distance + pad]
    : [-p.home_plate_circle_radius - pad, ppf + p.infield_arc_radius + pad];
  const [cx, cy] = convertLimits(xr, yr, from, units);
  const xlim = opts.xlim ?? [cx[0] + xTrans, cx[1] + xTrans];
  const ylim = opts.ylim ?? [cy[0] + yTrans, cy[1] + yTrans];
  const background = col("plot_background"); // #395d33 unless hidden by the user
  return {
    sport: "softball",
    league: key,
    units,
    bbox: displayBbox(xlim, ylim, rotation),
    origin: "home_plate",
    ...(/^#[0-9a-f]{6}00$/i.test(background) ? {} : { background }),
    features,
  };
}
