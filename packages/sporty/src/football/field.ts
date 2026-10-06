import type { Color, Feature, Point, Scene, SurfaceOptions } from "../scene.js";
import { createRectangle } from "../shapes.js";
import {
  FOOTBALL_LEAGUES,
  FOOTBALL_SPECS,
  type FootballLeague,
  type FootballParamUpdates,
  type FootballParams,
} from "../specs/football.js";
import {
  UnknownDisplayRangeError,
  UnknownLeagueError,
  addFeature,
  addText,
  arcResolution,
  colorAt,
  convertLimits,
  displayBbox,
  frame,
  mergeColors,
  mergeParams,
} from "../surface.js";
import { rotateCoords } from "../transform.js";
import { convertPoints, normalizeUnit } from "../units.js";
import * as F from "./features.js";
import {
  FOOTBALL_DEFAULT_COLORS,
  FOOTBALL_DISPLAY_RANGES,
  type FootballColorKey,
  type FootballDisplayRange,
  type FootballFeature,
} from "./types.js";

const ARRAY_FIELDS: readonly (keyof FootballParams)[] = [
  "additional_minor_yard_lines",
  "numbers_bottom",
  "numbers_top",
];

const isOneOf = <T extends string>(list: readonly T[], v: string): v is T =>
  (list as readonly string[]).includes(v);

/** R `seq(from, to, by)` (and `from:to`) for by > 0; R errors when to < from (custom's zeros), we return []. */
const seq = (from: number, to: number, by = 1): number[] =>
  Array.from({ length: Math.max(0, Math.floor((to - from) / by + 1e-10) + 1) }, (_, i) => from + i * by);

/** `display_range` keys with spaces/underscores removed, then R's synonyms folded together. */
type RangeGroup = "full" | "inboundsonly" | "offense" | "defense" | "redzone" | "dredzone";
const RANGE_SYNONYMS: Readonly<Record<string, RangeGroup>> = {
  offence: "offense",
  offensivehalffield: "offense",
  defence: "defense",
  defensivehalffield: "defense",
  oredzone: "redzone",
  offensiveredzone: "redzone",
  defensiveredzone: "dredzone",
};

/**
 * Port of sportyR `geom_football()`: one PolygonFeature per ggplot polygon layer and one TextFeature per
 * `ggfittext::geom_fit_text` layer, in R's layer order. Divergences: an unknown `displayRange` throws (R falls
 * back to "full"); `units` also converts the anchors and display limits (R converts only the feature points);
 * custom's all-zero defaults give empty yard-line sets (R errors in `seq()`).
 */
export function footballField(
  league: FootballLeague | (string & {}),
  opts: SurfaceOptions<FootballParamUpdates, FootballColorKey, FootballDisplayRange> = {},
): Scene {
  const key = league.toLowerCase();
  if (!isOneOf(FOOTBALL_LEAGUES, key)) {
    throw new UnknownLeagueError(
      `Unknown football league "${league}"; expected one of: ${FOOTBALL_LEAGUES.join(", ")}`,
    );
  }
  const range = (opts.displayRange ?? "full").toLowerCase();
  if (!isOneOf(FOOTBALL_DISPLAY_RANGES, range)) {
    throw new UnknownDisplayRangeError(
      `Unknown football display range "${opts.displayRange}"; expected one of: ${FOOTBALL_DISPLAY_RANGES.join(", ")}`,
    );
  }

  const p = mergeParams(FOOTBALL_SPECS[key], opts.updates, ARRAY_FIELDS);
  const colors = mergeColors(FOOTBALL_DEFAULT_COLORS, opts.colorUpdates);
  const col = (k: FootballColorKey): Color => colorAt(colors[k], 0);
  arcResolution(opts.arcResolution); // validated for a uniform API; the field draws no arcs
  const from = normalizeUnit(p.field_units || "ft"); // custom's "" (R's `%or% "ft"` only catches NULL)
  const units = normalizeUnit(opts.units ?? from);
  const conv = units === from ? undefined : ([from, units] as const);
  const { rotation = 0, xTrans = 0, yTrans = 0 } = opts;

  const L = p.field_length;
  const W = p.field_width;
  const ez = p.endzone_length;
  const blt = p.boundary_line_thickness;
  const fbt = p.field_border_thickness ?? 0;
  const minor = p.minor_line_thickness;
  const raw = p.restricted_area_width;
  const cbw = p.coaching_box_width;
  const fs = p.team_bench_length_field_side;
  const tbw = p.team_bench_width;
  const tb = p.team_bench_area_border_thickness;
  const benchShape = p.bench_shape ?? "rectangle";
  const ntyl = p.number_to_yard_line;
  const nw = p.number_width;
  const nh = p.number_height;
  const stbn = p.sideline_to_bottom_of_numbers;
  const ald = p.arrow_line_dist;
  const myd = p.major_yard_line_distance;

  // Yard-line sets (geom-football.R 256-303): minor lines drop multiples of the major distance but keep negatives (CFL extras).
  const majorLines = seq(0, L / 2 - 1, myd);
  const minorLines = [...seq(0, L / 2 - 1), ...(p.additional_minor_yard_lines ?? [])].filter(
    (v) => v % (myd ?? 1) !== 0 || v < 0,
  );
  const arrowLines = seq(1, L / 2).filter((v) => v % ald === 0 && v !== L / 2);
  let markedLines = seq(1, L - 1)
    .filter((v) => v % ald === 0)
    .flatMap((v) => [v - L / 2, v - L / 2]);
  if (!markedLines.includes(0)) markedLines = [0, ...markedLines].sort((a, b) => a - b);

  // Yard numbers (R 305-427): an odd-length row centres its middle number on its line (dist_to_line 0).
  const dists = (n: number): number[] => {
    if (n % 2 === 0) return Array<number>(n).fill(ntyl);
    const half = Array<number>(n / 2 - 0.5).fill(ntyl);
    return [...half, 0, ...half];
  };
  const row = (numbers: readonly string[], markerRotation: number, top: boolean) =>
    numbers.length === 0
      ? []
      : frame({
          marking: numbers,
          markerRotation: [markerRotation],
          top: [top],
          line: markedLines,
          dist: dists(numbers.length),
        });
  const marked = [...row(p.numbers_bottom, 0, false), ...row(p.numbers_top, 180, true)];
  const boxes: { marking: string; markerRotation: number; rect: Point[] }[] = [];
  let lineSide: "left" | "center" | "right" = "left"; // carries over from the bottom row into the top row, as in R
  for (const m of marked) {
    if (m.dist === 0) lineSide = "center";
    let x0: number;
    let x1: number;
    if (lineSide === "left") {
      x0 = m.line - ntyl - minor / 2 - nw;
      x1 = m.line - ntyl - minor / 2;
      lineSide = "right";
    } else if (lineSide === "center") {
      x0 = m.line - nw / 2;
      x1 = m.line + nw / 2;
      lineSide = "left";
    } else {
      x0 = m.line + ntyl + minor / 2;
      x1 = m.line + ntyl + minor / 2 + nw;
      lineSide = "left";
    }
    const [y0, y1] = m.top
      ? [W / 2 - stbn, W / 2 - stbn - 1.5 * nh]
      : [-W / 2 + stbn, -W / 2 + stbn + 1.5 * nh];
    const rect = createRectangle(x0, x1, y0, y1);
    boxes.push({
      marking: m.marking,
      markerRotation: m.markerRotation,
      rect: conv ? convertPoints(rect, ...conv) : rect,
    });
  }

  const features: Feature[] = [];
  const add = (
    name: FootballFeature,
    pts: readonly Point[],
    fill: Color,
    xAnchor: number,
    yAnchor: number,
    reflectX: boolean,
    reflectY: boolean,
    stroke?: Color,
  ): void =>
    addFeature(
      features,
      name,
      pts,
      fill,
      { xAnchor, yAnchor, reflectX, reflectY, xTrans, yTrans, rotation },
      { ...(stroke === undefined ? {} : { stroke }), ...(conv ? { units: conv } : {}) },
    );

  const bench = {
    restrictedAreaLength: fs,
    restrictedAreaWidth: raw,
    coachingBoxLength: fs,
    coachingBoxWidth: cbw,
    teamBenchLengthFieldSide: fs,
    teamBenchLengthBackSide: p.team_bench_length_back_side,
    teamBenchWidth: tbw,
    teamBenchAreaBorderThickness: tb,
  };
  const border = {
    ...bench,
    fieldLength: L,
    fieldWidth: W,
    endzoneLength: ez,
    boundaryLineThickness: blt,
    surroundsTeamBenchArea: p.field_border_behind_bench ?? true,
    benchShape,
  };
  const sideY = W / 2 + blt;
  const halfField = F.halfField({ fieldLength: L, fieldWidth: W });
  const endzone = F.endzone({ fieldWidth: W, endzoneLength: ez });
  const minorLine = F.minorYardLine({ yardLineHeight: p.minor_yard_line_height, featureThickness: minor });

  // Layers, in R's add_feature order (R 675-1078); every call R makes with an outline passes it.
  add(
    "field_apron",
    F.fieldApron({
      ...border,
      boundaryThickness: blt,
      fieldBorderThickness: fbt,
      extraApronPadding: p.extra_apron_padding,
    }),
    col("field_apron"),
    0,
    0,
    true,
    false,
    col("field_apron"),
  );
  add(
    "field_border",
    F.fieldBorder({ ...border, featureThickness: fbt }),
    col("field_border"),
    0,
    0,
    true,
    false,
    col("field_border"),
  );
  add(
    "field_border_outline",
    F.fieldBorderOutline({ ...border, featureThickness: minor, fieldBorderThickness: fbt }),
    col("field_border_outline"),
    0,
    0,
    true,
    false,
    col("field_border_outline"),
  );
  add("half_field", halfField, col("defensive_half"), -0.25 * L, 0, false, false);
  add("half_field", halfField, col("offensive_half"), 0.25 * L, 0, false, false);
  add(
    "restricted_area",
    F.restrictedArea({ restrictedAreaLength: fs, featureThickness: raw }),
    col("restricted_area"),
    0,
    sideY,
    false,
    true,
    col("restricted_area"),
  );
  add(
    "coaching_box",
    F.coachingBox({ coachingBoxLength: fs, featureThickness: cbw }),
    col("coaching_box"),
    0,
    sideY + raw,
    false,
    true,
    col("coaching_box"),
  );
  add(
    "team_bench_area",
    F.teamBenchArea(bench),
    col("team_bench_area"),
    0,
    sideY + raw + cbw,
    false,
    true,
    col("team_bench_area"),
  );
  add(
    "coaching_box_line",
    F.coachingBoxLine({ coachingBoxLineLength: fs, featureThickness: minor }),
    col("coaching_box_line"),
    0,
    sideY + raw + cbw,
    false,
    true,
    col("coaching_box_line"),
  );
  add(
    "team_bench_area_outline",
    F.teamBenchAreaOutline({ ...bench, featureThickness: tb }),
    col("team_bench_area_outline"),
    0,
    sideY,
    false,
    true,
    col("team_bench_area_outline"),
  );
  add(
    "red_zone_border",
    F.redZoneBorder({ featureThickness: fbt }),
    col("red_zone_border"),
    L / 2 - 20,
    sideY,
    true,
    true,
    col("red_zone_border"),
  );
  add(
    "red_zone_border_outline",
    F.redZoneBorderOutline({ featureThickness: minor }),
    col("red_zone_border_outline"),
    L / 2 - 20,
    sideY + fbt,
    true,
    true,
    col("red_zone_border_outline"),
  );
  add(
    "sideline",
    F.sideline({ featureThickness: blt, fieldLength: L, endzoneLength: ez }),
    col("sideline"),
    0,
    W / 2,
    false,
    true,
    col("sideline"),
  );
  add(
    "end_line",
    F.endLine({ featureThickness: blt, fieldWidth: W }),
    col("end_line"),
    L / 2 + ez,
    0,
    true,
    false,
    col("end_line"),
  );
  add("endzone", endzone, col("defensive_endzone"), -(L / 2) - ez / 2, 0, false, false);
  add("endzone", endzone, col("offensive_endzone"), L / 2 + ez / 2, 0, false, false);
  const majorLine = F.majorYardLine({
    fieldWidth: W,
    featureThickness: minor,
    distToSideline: p.sideline_to_major_yard_line,
    crossHashLength: p.inbound_cross_hashmark_length,
    crossHashSeparation: p.inbound_cross_hashmark_separation,
  });
  for (const yl of majorLines) add("major_yard_line", majorLine, col("major_yard_line"), yl, 0, true, false);
  const outerY = W / 2 - p.sideline_to_outer_yard_line - p.minor_yard_line_height;
  for (const yl of minorLines)
    add("minor_yard_line", minorLine, col("minor_yard_line"), L / 2 - yl, outerY, true, true);
  for (const yl of minorLines)
    add(
      "minor_yard_line",
      minorLine,
      col("minor_yard_line"),
      L / 2 - yl,
      p.inbound_hashmark_separation / 2,
      true,
      true,
    );
  add(
    "goal_line",
    F.goalLine({ fieldWidth: W, featureThickness: p.goal_line_thickness }),
    col("goal_line"),
    L / 2,
    0,
    true,
    false,
  );
  add(
    "try_mark",
    F.tryMark({ tryMarkWidth: p.try_mark_width ?? 0, featureThickness: minor }),
    col("try_mark"),
    L / 2 - (p.try_mark_distance ?? 0),
    0,
    true,
    false,
  );
  // Yard numbers (R 1007-1057): R places them directly — shift, rotate, take the bounding box — then draws that
  // box as a transparent polygon (shifted a second time: R quirk kept) and fits the label into the same box.
  for (const b of boxes) {
    const placed = rotateCoords(
      b.rect.map(([x, y]): Point => [x + xTrans, y + yTrans]),
      rotation,
    );
    const xs = placed.map((q) => q[0]);
    const ys = placed.map((q) => q[1]);
    const [bx0, bx1, by0, by1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
    addFeature(features, "yardage_marker_box", createRectangle(bx0, bx1, by0, by1), "#ffffff00", {
      xAnchor: 0,
      yAnchor: 0,
      xTrans,
      yTrans,
    });
    const [[ux0, uy0], , [ux1, uy1]] = b.rect as [Point, Point, Point];
    addText(features, "yardage_marker", {
      fill: col("yardage_marker"),
      x: (bx0 + bx1) / 2,
      y: (by0 + by1) / 2,
      text: b.marking,
      fontFamily: p.number_font,
      // R's box before rotation: number_width × 1.5·number_height (ggfittext grow + fullheight fills it)
      fitBox: [Math.abs(ux1 - ux0), Math.abs(uy1 - uy0)],
      rotation: rotation + b.markerRotation,
    });
  }
  const arrow = F.directionalArrow({ arrowBase: p.arrow_base, arrowLength: p.arrow_length });
  const arrowY = W / 2 - stbn - nh + p.top_number_to_arrow;
  for (const al of arrowLines)
    add(
      "directional_arrow",
      arrow,
      col("directional_arrow"),
      L / 2 - al + p.yard_line_to_arrow,
      arrowY,
      true,
      true,
    );

  // Display range (R 1080-1303), in the spec's units; then converted, translated, rotated.
  const pad = p.extra_apron_padding ?? 5;
  const hfl = L / 2 + ez + blt + fbt + minor + pad;
  const hfw = W / 2 + blt + raw + cbw + tbw + fbt + tb + minor + pad;
  const fullY = [-hfw, hfw] as const;
  const ranges: Record<RangeGroup, readonly [readonly [number, number], readonly [number, number]]> = {
    full: [[-hfl, hfl], fullY],
    inboundsonly: [
      [-(L / 2 + ez + blt), L / 2 + ez + blt],
      [-(W / 2 + blt), W / 2 + blt],
    ],
    offense: [[0, hfl], fullY],
    defense: [[-hfl, 0], fullY],
    redzone: [[L / 2 - 20, hfl], fullY],
    dredzone: [[-hfl, -(L / 2) + 20], fullY],
  };
  const squashed = range.replace(/[ _]/g, "");
  const [rx, ry] = ranges[RANGE_SYNONYMS[squashed] ?? (squashed as RangeGroup)];
  const [cx, cy] = convertLimits(rx, ry, from, units);
  const xlim = opts.xlim ?? [cx[0] + xTrans, cx[1] + xTrans];
  const ylim = opts.ylim ?? [cy[0] + yTrans, cy[1] + yTrans];

  // R: plot_background NULL = none; our transparent default stands in for NULL.
  const background = col("plot_background");
  return {
    sport: "football",
    league: key,
    units,
    bbox: displayBbox(xlim, ylim, rotation),
    origin: "center",
    ...(/^#[0-9a-f]{6}00$/i.test(background) ? {} : { background }),
    features,
  };
}
