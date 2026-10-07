import type { Color, Feature, Point, Scene, SurfaceOptions } from "../scene.js";
import {
  BASEBALL_LEAGUES,
  BASEBALL_SPECS,
  type BaseballLeague,
  type BaseballParamUpdates,
} from "../specs/baseball.js";
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
  BASEBALL_DEFAULT_COLORS,
  BASEBALL_DISPLAY_RANGES,
  type BaseballColorKey,
  type BaseballDisplayRange,
  type BaseballFeature,
} from "./types.js";

const isOneOf = <T extends string>(list: readonly T[], v: string): v is T =>
  (list as readonly string[]).includes(v);

/** Port of sportyR `geom_baseball()`: origin = back tip of home plate, +y toward centre field; same divergences as `soccerPitch`. */
export function baseballField(
  league: BaseballLeague | (string & {}),
  opts: SurfaceOptions<BaseballParamUpdates, BaseballColorKey, BaseballDisplayRange> = {},
): Scene {
  const key = league.toLowerCase();
  if (!isOneOf(BASEBALL_LEAGUES, key))
    throw new UnknownLeagueError(
      `Unknown baseball league "${league}"; expected one of: ${BASEBALL_LEAGUES.join(", ")}`,
    );
  const range = (opts.displayRange ?? "full").toLowerCase();
  if (!isOneOf(BASEBALL_DISPLAY_RANGES, range))
    throw new UnknownDisplayRangeError(
      `Unknown baseball display range "${opts.displayRange}"; expected one of: ${BASEBALL_DISPLAY_RANGES.join(", ")}`,
    );
  const p = mergeParams(BASEBALL_SPECS[key], opts.updates, []); // baseball has no array fields
  const colors = mergeColors(BASEBALL_DEFAULT_COLORS, opts.colorUpdates);
  const col = (k: BaseballColorKey): Color => colorAt(colors[k], 0);
  const npoints = arcResolution(opts.arcResolution);
  const from = normalizeUnit(p.field_units || "ft");
  const units = normalizeUnit(opts.units ?? from);
  const conv = units === from ? undefined : ([from, units] as const);
  const { rotation = 0, xTrans = 0, yTrans = 0 } = opts;
  const features: Feature[] = [];
  const add = (
    name: BaseballFeature,
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
  const box = {
    battersBoxLength: p.batters_box_length,
    battersBoxWidth: p.batters_box_width,
    battersBoxYAdj: p.batters_box_y_adj,
  };
  const foul = {
    ...box,
    homePlateSideToBattersBox: p.home_plate_side_to_batters_box,
    foulLineThickness: p.line_width,
  };
  // Layers, in R's add_feature order (geom-baseball.R 300-470); base_side_length is passed without %or% in R (every generated league has it).
  add(
    "infield_dirt",
    F.infieldDirt({
      homePlateCircleRadius: p.home_plate_circle_radius,
      foulLineToFoulGrass: p.foul_line_to_foul_grass,
      pitchersPlateDistance: p.pitchers_plate_front_to_home_plate,
      infieldArcRadius: p.infield_arc_radius,
      npoints,
    }),
    col("infield_dirt"),
    0,
    0,
  );
  add(
    "infield_grass",
    F.infieldGrass({
      homePlateCircleRadius: p.home_plate_circle_radius,
      foulLineToInfieldGrass: p.foul_line_to_infield_grass,
      baselineDistance: bl,
      baseAnchorToInfieldGrass: p.base_anchor_to_infield_grass_radius,
      npoints,
    }),
    col("infield_grass"),
    0,
    0,
  );
  add(
    "pitchers_mound",
    F.pitchersMound({ pitchersMoundRadius: p.pitchers_mound_radius, npoints }),
    col("pitchers_mound"),
    0,
    p.pitchers_mound_center_to_home_plate,
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
    p.pitchers_plate_front_to_home_plate,
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
      catchersBoxWidth: p.catchers_box_width ?? 0,
      battersBoxLength: p.batters_box_length,
      battersBoxYAdj: p.batters_box_y_adj,
      catchersBoxShape: p.catchers_box_shape ?? "rectangle",
      catchersBoxThickness: p.line_width,
      homePlateCircleRadius: p.home_plate_circle_radius,
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
      runningLaneDepth: p.running_lane_depth ?? 0,
      runningLaneLength: p.running_lane_length ?? 0,
      runningLaneStartDistance: p.running_lane_start_distance ?? 0,
      runningLaneThickness: p.line_width,
    }),
    col("running_lane"),
    0,
    0,
  );
  // Display range (geom-baseball.R 490-541): the +5 / -5 paddings are native feet (R).
  const full = range === "full";
  const xr: readonly [number, number] = full
    ? [p.left_field_distance * Math.cos((3 * Math.PI) / 4), p.right_field_distance * Math.cos(Math.PI / 4)]
    : [-p.infield_arc_radius - 5, p.infield_arc_radius + 5];
  const yr: readonly [number, number] = full
    ? [-p.backstop_radius - 5, p.center_field_distance + 5]
    : [-p.home_plate_circle_radius - 5, p.pitchers_plate_front_to_home_plate + p.infield_arc_radius + 5];
  const [cx, cy] = convertLimits(xr, yr, from, units);
  const xlim = opts.xlim ?? [cx[0] + xTrans, cx[1] + xTrans];
  const ylim = opts.ylim ?? [cy[0] + yTrans, cy[1] + yTrans];
  const background = col("plot_background"); // #395d33 unless hidden by the user
  return {
    sport: "baseball",
    league: key,
    units,
    bbox: displayBbox(xlim, ylim, rotation),
    origin: "home_plate",
    ...(/^#[0-9a-f]{6}00$/i.test(background) ? {} : { background }),
    features,
  };
}
