import type { Color, Feature, Point, Scene, SurfaceOptions, Units } from "../scene.js";
import { asArray } from "../specs/_normalize.js";
import {
  BASKETBALL_LEAGUES,
  BASKETBALL_SPECS,
  type BasketballLeague,
  type BasketballParamUpdates,
  type BasketballParams,
} from "../specs/basketball.js";
import {
  UnknownDisplayRangeError,
  UnknownLeagueError,
  addFeature,
  colorAt,
  convertLimits,
  displayBbox,
  frame,
  mergeColors,
  mergeParams,
  orVec,
} from "../surface.js";
import { convertUnits } from "../units.js";
import * as F from "./features.js";
import {
  BASKETBALL_DEFAULT_COLORS,
  BASKETBALL_DISPLAY_RANGES,
  type BasketballColorKey,
  type BasketballDisplayRange,
  type BasketballFeature,
} from "./types.js";

const HIDDEN = "#00000000";
const NBA = BASKETBALL_SPECS.nba;
const ARRAY_FIELDS = (Object.keys(NBA) as (keyof BasketballParams)[]).filter((k) => Array.isArray(NBA[k]));

const isOneOf = <T extends string>(list: readonly T[], v: string): v is T =>
  (list as readonly string[]).includes(v);

/** `display_range` keys with spaces/underscores removed, then R's synonyms folded together. */
type RangeGroup =
  | "full"
  | "inboundsonly"
  | "offense"
  | "defense"
  | "offensivekey"
  | "defensivekey"
  | "offensivepaint"
  | "defensivepaint";
const RANGE_SYNONYMS: Readonly<Record<string, RangeGroup>> = {
  offence: "offense",
  offensivehalfcourt: "offense",
  defence: "defense",
  defensivehalfcourt: "defense",
  attackingkey: "offensivekey",
  defendingkey: "defensivekey",
  attackingpaint: "offensivepaint",
  offensivelane: "offensivepaint",
  attackinglane: "offensivepaint",
  defendingpaint: "defensivepaint",
  defensivelane: "defensivepaint",
  defendinglane: "defensivepaint",
};

/**
 * Port of sportyR `geom_basketball()`: one PolygonFeature per ggplot layer R adds, in R's layer order.
 * Divergences: an unknown `displayRange` throws (R falls back to "full"); `units` also converts the
 * anchors and display limits (R converts only the feature points, so its non-native plots are broken).
 */
export function basketballCourt(
  league: BasketballLeague | (string & {}),
  opts: SurfaceOptions<BasketballParamUpdates, BasketballColorKey, BasketballDisplayRange> = {},
): Scene {
  const key = league.toLowerCase();
  if (!isOneOf(BASKETBALL_LEAGUES, key)) {
    throw new UnknownLeagueError(
      `Unknown basketball league "${league}"; expected one of: ${BASKETBALL_LEAGUES.join(", ")}`,
    );
  }
  const range = (opts.displayRange ?? "full").toLowerCase();
  if (!isOneOf(BASKETBALL_DISPLAY_RANGES, range)) {
    throw new UnknownDisplayRangeError(
      `Unknown basketball display range "${opts.displayRange}"; expected one of: ${BASKETBALL_DISPLAY_RANGES.join(", ")}`,
    );
  }

  const p = mergeParams(BASKETBALL_SPECS[key], opts.updates, ARRAY_FIELDS);
  const colors = mergeColors(BASKETBALL_DEFAULT_COLORS, opts.colorUpdates);
  const col = (k: BasketballColorKey): Color => colorAt(colors[k], 0);
  const npoints = opts.arcResolution ?? 200;
  const from: Units = p.court_units || "ft"; // custom's "" (R would error converting from "")
  const units = opts.units ?? from;
  const conv = units === from ? undefined : ([from, units] as const);
  const { rotation = 0, xTrans = 0, yTrans = 0 } = opts;

  const L = p.court_length;
  const W = p.court_width;
  const lt = p.line_thickness;
  const bcb = p.basket_center_to_baseline;
  const bfb = p.backboard_face_to_baseline;
  const ftR = p.free_throw_circle_radius;

  const features: Feature[] = [];
  const add = (
    name: BasketballFeature,
    pts: readonly Point[],
    fill: Color,
    xAnchor: number,
    yAnchor: number,
    reflectX: boolean,
    reflectY: boolean,
    extra: { stroke?: Color; elevation?: number; height?: number } = {},
  ): void =>
    addFeature(
      features,
      name,
      pts,
      fill,
      { xAnchor, yAnchor, reflectX, reflectY, xTrans, yTrans, rotation },
      conv ? { ...extra, units: conv } : extra,
    );

  // Multi-instance tables (R 382-515). Colours are bound to rows BEFORE sorting, so they travel with them.
  const centerCircles = frame({
    radius: orVec(p.center_circle_radius, 0),
    outline: asArray(colors.center_circle_outline),
    fill: asArray(colors.center_circle_fill),
  }).sort((a, b) => b.radius - a.radius);

  const threePointArcs = frame({
    radius: orVec(p.basket_center_to_three_point_arc, 0),
    corner: orVec(p.basket_center_to_corner_three, 0), // unused for drawing; R counts it in nrow()
    line: asArray(colors.three_point_line),
    twoPointRange: asArray(colors.two_point_range),
  }).sort((a, b) => b.radius - a.radius);

  const laneLength = orVec(p.lane_length, 0);
  const allHidden = laneLength.map(() => false);
  const lanes = frame({
    length: laneLength,
    width: orVec(p.lane_width, 0),
    paintMargin: orVec(p.paint_margin, 0),
    boundaryColor: asArray(colors.lane_boundary),
    paintedArea: asArray(colors.painted_area),
    boundaryVisible: p.lane_boundary_visibility.length > 0 ? p.lane_boundary_visibility : allHidden,
    paintedVisible: p.painted_area_visibility.length > 0 ? p.painted_area_visibility : allHidden,
  }).sort((a, b) => b.length - a.length || b.width - a.width);

  // Lane space mark sets stay in the spec's (unsorted) order.
  const lsmColors = asArray(colors.lane_space_mark);
  const nSets = p.lane_space_mark_lengths.length;
  const markSets = p.lane_space_mark_lengths.map((lengths, i) => {
    // R ifelse() with a scalar test keeps one element: set i gets colour i only when there are several sets.
    const color = (nSets > 1 && lsmColors.length > i ? lsmColors[i] : lsmColors[0]) ?? HIDDEN;
    return lengths.map((length, j) => ({
      yAnchor: (p.lane_width[i] ?? Number.NaN) / 2,
      length,
      width: p.lane_space_mark_widths[i] ?? Number.NaN,
      separation: p.lane_space_mark_separations[i]?.[j] ?? Number.NaN,
      color,
      visible: p.lane_space_mark_visibility[i] === true,
    }));
  });

  const overhang = p.free_throw_circle_overhang ?? 0;
  const overhangEndTheta = ftR !== 0 ? 0.5 - overhang / ftR / Math.PI : 0.5;

  const benchTop = p.bench_side.toLowerCase() === "top";
  const bench = benchTop ? 1 : -1;
  const benchDirection = benchTop ? "bottom_up" : "top_down";
  const inboundingLines = frame({
    toBaseline: orVec(p.inbounding_line_to_baseline, 0),
    inPlayExt: orVec(p.inbounding_line_in_play_ext, 0),
    outOfBoundsExt: orVec(p.inbounding_line_out_of_bounds_ext, 0),
    symmetric: orVec(p.symmetric_inbounding_line, false),
    anchorSide: orVec(p.inbounding_line_anchor_side, 1).map((s) => (benchTop ? s : -1 * s)),
  });

  // Layers, in R's add_feature order (R 799-1237).
  const halfCourt = F.halfCourt({ courtLength: L, courtWidth: W });
  add("half_court", halfCourt, col("defensive_half_court"), -0.25 * L, 0, false, false);
  add("half_court", halfCourt, col("offensive_half_court"), 0.25 * L, 0, false, false);
  add(
    "court_apron",
    F.courtApron({
      courtLength: L,
      courtWidth: W,
      courtApronEndline: p.court_apron_endline,
      courtApronSideline: p.court_apron_sideline,
      courtApronToBoundary: p.court_apron_to_boundary,
      lineThickness: lt,
    }),
    col("court_apron"),
    0,
    0,
    true,
    false,
    { stroke: col("court_apron") },
  );

  centerCircles.forEach((c, i) => {
    // R passes `line_thickness[i] %or% 0`: only the largest circle's fill is inset by the line thickness.
    const fill = F.centerCircleFill({
      centerCircleRadius: c.radius,
      lineThickness: i === 0 ? lt : 0,
      npoints,
    });
    add("center_circle_fill", fill, c.fill, 0, 0, true, false);
    const outline = F.centerCircleOutline({ centerCircleRadius: c.radius, lineThickness: lt, npoints });
    add("center_circle_outline", outline, c.outline, 0, 0, true, false);
  });

  threePointArcs.forEach((arc, i) => {
    // R builds arc i from the UNSORTED spec vectors but colours it from the sorted row i.
    const radius = p.basket_center_to_three_point_arc[i] ?? 0;
    const shape = {
      basketCenterToBaseline: bcb,
      basketCenterToCornerThree: p.basket_center_to_corner_three[i] ?? 0,
      lineThickness: lt,
      npoints,
    };
    add(
      "two_point_range",
      F.twoPointRange({ ...shape, twoPointRangeRadius: radius }),
      arc.twoPointRange,
      L / 2 - bcb,
      0,
      true,
      false,
    );
    add(
      "three_point_line",
      F.threePointLine({ ...shape, threePointLineRadius: radius }),
      arc.line,
      L / 2 - bcb,
      0,
      true,
      false,
    );
  });

  const ftX = L / 2 - bfb - p.free_throw_line_to_backboard;
  add(
    "free_throw_circle_fill",
    F.freeThrowCircleFill({ freeThrowCircleRadius: ftR, lineThickness: lt, npoints }),
    col("free_throw_circle_fill"),
    ftX,
    0,
    true,
    false,
  );
  add(
    "free_throw_circle",
    F.freeThrowCircle({ freeThrowCircleRadius: ftR, lineThickness: lt, npoints }),
    col("free_throw_circle_outline"),
    ftX + lt / 2,
    0,
    true,
    false,
  );

  for (const lane of lanes) {
    const shape = { laneLength: lane.length, laneWidth: lane.width, lineThickness: lt };
    const paintFill = lane.paintedVisible === true ? lane.paintedArea : HIDDEN;
    add(
      "painted_area",
      F.paintedArea({ ...shape, paintMargin: lane.paintMargin }),
      paintFill,
      L / 2 - lane.length + lt,
      0,
      true,
      false,
    );
    const boundaryFill = lane.boundaryVisible === true ? lane.boundaryColor : HIDDEN;
    add("free_throw_lane_boundary", F.freeThrowLaneBoundary(shape), boundaryFill, L / 2, 0, true, false);
  }

  const nDashes = p.n_free_throw_circle_dashes ?? 0;
  if (nDashes > 0) {
    const dash = (startAngle: number, endAngle: number): Point[] =>
      F.freeThrowCircleDash({ featureRadius: ftR, lineThickness: lt, startAngle, endAngle, npoints });
    add(
      "free_throw_circle_dash",
      dash(0.5, overhangEndTheta),
      col("free_throw_circle_dash"),
      ftX,
      0,
      true,
      true,
    );
    const thetaDashes = ftR !== 0 ? (p.free_throw_dash_length ?? 0) / ftR / Math.PI : 0;
    const thetaSpaces = ftR !== 0 ? (p.free_throw_dash_spacing ?? 0) / ftR / Math.PI : 0;
    let start = ftR !== 0 ? 0.5 - overhang / ftR / Math.PI - thetaSpaces : 0.5 - thetaSpaces;
    for (let d = 1; d <= nDashes; d++) {
      // R quirk kept: each dash spans theta_spaces, not theta_dashes.
      add(
        "free_throw_circle_dash",
        dash(start, start - thetaSpaces),
        col("free_throw_circle_dash"),
        ftX + lt / 2,
        0,
        true,
        false,
      );
      start = start - thetaDashes - thetaSpaces;
    }
  }

  // R loops over the (sorted) lanes but picks mark set i by spec order.
  lanes.forEach((_, i) => {
    const set = markSets[i] ?? [];
    let x = L / 2 - bfb;
    for (const m of set) {
      x = x - m.separation;
      // R reads the colour from row i of the set (`lane_space_mark_set[i, "color"]`), NA if the set is shorter.
      const fill = m.visible ? (set[i]?.color ?? HIDDEN) : HIDDEN;
      add(
        "lane_space_mark",
        F.laneSpaceMark({ featureThickness: m.length, markDepth: m.width }),
        fill,
        x,
        m.yAnchor,
        true,
        true,
      );
    }
  });

  const boxShape = { extension: p.lower_defensive_box_mark_extension ?? 0, lineThickness: lt };
  add(
    "lower_defensive_box_mark",
    F.lowerDefensiveBoxMark({ ...boxShape, drawnDirection: "left_to_right" }),
    col("baseline_lower_defensive_box"),
    L / 2,
    (p.baseline_lower_defensive_box_marks_int_sep ?? 0) / 2,
    true,
    true,
  );
  add(
    "lower_defensive_box_mark",
    F.lowerDefensiveBoxMark({ ...boxShape, drawnDirection: "top_down" }),
    (p.lane_lower_defensive_box_marks_visibility ?? false) === true
      ? col("lane_lower_defensive_box")
      : HIDDEN,
    L / 2 - (p.baseline_to_lane_lower_defensive_box_marks ?? 0),
    (p.lane_lower_defensive_box_marks_int_sep ?? 0) / 2,
    true,
    true,
  );

  add("endline", F.endline({ courtWidth: W, lineThickness: lt }), col("endline"), L / 2, 0, true, false);
  add("sideline", F.sideline({ courtLength: L, lineThickness: lt }), col("sideline"), 0, W / 2, false, true);

  for (const line of inboundingLines) {
    const shape = F.inboundingLine({
      lineThickness: lt,
      inPlayExt: line.inPlayExt,
      outOfBoundsExt: line.outOfBoundsExt,
      drawnDirection: line.anchorSide < 1 ? "bottom_up" : "top_down",
    });
    add(
      "inbounding_line",
      shape,
      col("inbounding_line"),
      L / 2 - line.toBaseline,
      (W / 2) * line.anchorSide,
      true,
      line.symmetric,
    );
  }

  add(
    "substitution_line",
    F.substitutionLine({
      lineThickness: lt,
      substitutionLineWidth: p.substitution_line_width ?? 0,
      drawnDirection: benchDirection,
    }),
    col("substitution_line"),
    (p.substitution_line_ext_sep ?? 0) / 2,
    (bench * W) / 2,
    true,
    false,
  );
  add(
    "team_bench_line",
    F.teamBenchLine({
      lineThickness: lt,
      extension: p.team_bench_line_ext ?? 0,
      drawnDirection: benchDirection,
    }),
    col("team_bench_line"),
    L / 2,
    bench * (W / 2 + lt),
    true,
    false,
  );
  add(
    "division_line",
    F.divisionLine({
      courtWidth: W,
      lineThickness: lt,
      divisionLineExtension: p.division_line_extension ?? 0,
    }),
    col("division_line"),
    0,
    0,
    false,
    true,
  );

  const hint = (ft: number): number => convertUnits(ft, "ft", units);
  add(
    "restricted_arc",
    F.restrictedArc({
      featureRadius: p.restricted_arc_radius ?? 0,
      lineThickness: lt,
      backboardToCenterOfBasket: bcb - bfb,
      npoints,
    }),
    col("restricted_arc"),
    L / 2 - bfb,
    0,
    true,
    false,
  );
  add(
    "basket_ring",
    F.basketRing({
      basketRingConnectorWidth: p.basket_ring_connector_width,
      backboardFaceToRingCent: bcb - bfb,
      basketRingInnerRadius: p.basket_ring_inner_radius,
      basketRingThickness: p.basket_ring_thickness,
      npoints,
    }),
    col("basket_ring"),
    L / 2 - bfb,
    0,
    true,
    false,
    { elevation: hint(10) },
  );
  add(
    "net",
    F.net({ basketRingInnerRadius: p.basket_ring_inner_radius, npoints }),
    col("net"),
    L / 2 - bcb,
    0,
    true,
    false,
    { elevation: hint(10 - 1.5) },
  );
  add(
    "backboard",
    F.backboard({ backboardWidth: p.backboard_width, backboardThickness: p.backboard_thickness }),
    col("backboard"),
    L / 2 - bfb,
    0,
    true,
    false,
    { height: hint(3.5) },
  );

  // Display range (R 1240-1652), in the spec's units; then converted, translated, rotated.
  const hcl = L / 2 + p.court_apron_endline;
  const hcw = W / 2 + p.court_apron_sideline;
  const keyX = L / 2 - bcb - Math.max(...p.basket_center_to_three_point_arc) - 3;
  const paintX = L / 2 - Math.max(...p.lane_length) - ftR;
  const laneHalf = Math.max(...p.lane_width) / 2;
  const fullY = [-hcw, hcw] as const;
  const paintY = [-laneHalf - 1.5, laneHalf + 1.5] as const;
  const ranges: Record<RangeGroup, readonly [readonly [number, number], readonly [number, number]]> = {
    full: [[-hcl, hcl], fullY],
    inboundsonly: [
      [-(L / 2 + lt), L / 2 + lt],
      [-(W / 2 + lt), W / 2 + lt],
    ],
    offense: [[0, hcl], fullY],
    defense: [[-hcl, 0], fullY],
    offensivekey: [[keyX, hcl], fullY],
    defensivekey: [[-hcl, -keyX], fullY],
    offensivepaint: [[paintX, hcl], paintY],
    defensivepaint: [[-hcl, -paintX], paintY],
  };
  const squashed = range.replace(/[ _]/g, "");
  const [rx, ry] = ranges[RANGE_SYNONYMS[squashed] ?? (squashed as RangeGroup)];
  const [cx, cy] = convertLimits(rx, ry, from, units);
  const xlim = opts.xlim ?? [cx[0] + xTrans, cx[1] + xTrans];
  const ylim = opts.ylim ?? [cy[0] + yTrans, cy[1] + yTrans];

  // R: plot_background NULL = none; our transparent default stands in for NULL.
  const background = col("plot_background");
  return {
    sport: "basketball",
    league: key,
    units,
    bbox: displayBbox(xlim, ylim, rotation),
    origin: "center",
    ...(/^#[0-9a-f]{6}00$/i.test(background) ? {} : { background }),
    features,
  };
}
