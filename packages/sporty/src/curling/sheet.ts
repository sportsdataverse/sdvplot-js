import type { Color, Feature, Point, Scene, SurfaceOptions } from "../scene.js";
import {
  CURLING_LEAGUES,
  CURLING_SPECS,
  type CurlingLeague,
  type CurlingParamUpdates,
} from "../specs/curling.js";
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
  CURLING_DEFAULT_COLORS,
  CURLING_DISPLAY_RANGES,
  type CurlingColorKey,
  type CurlingDisplayRange,
  type CurlingFeature,
} from "./types.js";

const isOneOf = <T extends string>(list: readonly T[], v: string): v is T =>
  (list as readonly string[]).includes(v);

/**
 * Port of sportyR `geom_curling()`: one PolygonFeature per ggplot layer R adds, in R's layer order. The sheet is vertical
 * (`sheet_width` spans x, `sheet_length` spans y).
 * Documented divergences: an unknown `displayRange` throws (R falls back to "full"); `units` also converts the anchors and
 * display limits; a house-ring colour vector shorter than the ring count recycles (R yields NA).
 */
export function curlingSheet(
  league: CurlingLeague | (string & {}),
  opts: SurfaceOptions<CurlingParamUpdates, CurlingColorKey, CurlingDisplayRange> = {},
): Scene {
  const key = league.toLowerCase();
  if (!isOneOf(CURLING_LEAGUES, key))
    throw new UnknownLeagueError(
      `Unknown curling league "${league}"; expected one of: ${CURLING_LEAGUES.join(", ")}`,
    );
  const range = (opts.displayRange ?? "full").toLowerCase(); // R: tolower() only — no trim
  if (!isOneOf(CURLING_DISPLAY_RANGES, range))
    throw new UnknownDisplayRangeError(
      `Unknown curling display range "${opts.displayRange}"; expected one of: ${CURLING_DISPLAY_RANGES.join(", ")}`,
    );
  const p = mergeParams(CURLING_SPECS[key], opts.updates, ["house_ring_radii"]);
  const colors = mergeColors(CURLING_DEFAULT_COLORS, opts.colorUpdates);
  const col = (k: CurlingColorKey): Color => colorAt(colors[k], 0);
  const npoints = arcResolution(opts.arcResolution);
  const from = normalizeUnit(p.sheet_units || "ft"); // R: sheet_units %or% "ft" (custom's "")
  const units = normalizeUnit(opts.units ?? from);
  const conv = units === from ? undefined : ([from, units] as const);
  const { rotation = 0, xTrans = 0, yTrans = 0 } = opts;
  const L = p.sheet_length;
  const W = p.sheet_width;
  const tee = p.tee_line_to_center;
  const hog = p.hog_line_to_tee_line;
  const features: Feature[] = [];
  const add = (
    name: CurlingFeature,
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
  // Layers, in R's add_feature order (geom-curling.R 296-470).
  add(
    "sheet_apron",
    F.sheetApron({
      sheetLength: L,
      sheetWidth: W,
      apronBehindBack: p.apron_behind_back,
      apronAlongSide: p.apron_along_side,
    }),
    col("sheet_apron"),
    0,
    0,
    false,
    true,
    { stroke: col("sheet_apron") },
  );
  const endOpts = { sheetLength: L, sheetWidth: W, teeLineToCenter: tee, hogLineToTeeLine: hog };
  add("end", F.end({ ...endOpts, drawnDirection: "downward" }), col("end_1"), 0, -tee + hog, false, false);
  add(
    "centre_zone",
    F.centreZone({ sheetWidth: W, teeLineToCenter: tee, hogLineToTeeLine: hog }),
    col("centre_zone"),
    0,
    0,
    false,
    false,
  );
  add("end", F.end({ ...endOpts, drawnDirection: "upward" }), col("end_2"), 0, tee - hog, false, false);
  const radii = [...p.house_ring_radii].sort((a, b) => b - a); // R: house_ring_radii[rev(order(house_ring_radii))]
  radii.forEach((r, i) =>
    add(
      "house_ring",
      F.houseRing({ featureRadius: r, npoints }),
      colorAt(colors.house_rings, i),
      0,
      tee,
      false,
      true,
    ),
  );
  add("button", F.button({ featureRadius: p.button_radius, npoints }), col("button"), 0, tee, false, true);
  add(
    "tee_line",
    F.teeLine({ lineThickness: p.tee_line_thickness, sheetWidth: W }),
    col("tee_line"),
    0,
    tee,
    false,
    true,
  );
  add(
    "back_line",
    F.backLine({ lineThickness: p.back_line_thickness, sheetWidth: W }),
    col("back_line"),
    0,
    tee + p.back_line_to_tee_line,
    false,
    true,
  );
  add(
    "hog_line",
    F.hogLine({ lineThickness: p.hog_line_thickness, sheetWidth: W }),
    col("hog_line"),
    0,
    tee - hog,
    false,
    true,
  );
  add(
    "centre_line",
    F.centreLine({
      lineThickness: p.centre_line_thickness,
      teeLineToCenter: tee,
      centreLineExtension: p.centre_line_extension,
    }),
    col("centre_line"),
    0,
    0,
    false,
    false,
  );
  add(
    "hack_line",
    F.hackLine({
      lineThickness: p.hack_line_thickness,
      hackWidth: 2 * p.hack_foothold_width + p.hack_foothold_gap,
    }),
    col("hack_line"),
    0,
    tee + p.centre_line_extension,
    false,
    true,
  );
  add(
    "courtesy_line",
    F.courtesyLine({ lineThickness: p.courtesy_line_thickness, lineLength: p.courtesy_line_length }),
    col("courtesy_line"),
    W / 2,
    tee - hog - p.courtesy_line_to_hog_line,
    true,
    true,
  );
  add(
    "hack_foothold",
    F.hackFoothold({ footholdDepth: p.hack_foothold_depth, footholdWidth: p.hack_foothold_width }),
    col("hack"),
    p.hack_foothold_gap,
    tee + p.centre_line_extension,
    true,
    true,
  );
  // Display range (geom-curling.R 511-600) in native units (the +5 is NOT scaled — R); then converted (documented divergence 1), translated, rotated.
  const hsl = L / 2 + p.apron_behind_back + 5;
  const hsw = W / 2 + p.apron_along_side + 5;
  const endLength = tee - hog - p.courtesy_line_to_hog_line;
  const inBounds = range === "in_bounds_only" || range === "in bounds only";
  const [cx, cy] = convertLimits(
    inBounds ? [-(W / 2 + 0.5), W / 2 + 0.5] : [-hsw, hsw],
    inBounds ? [-(L / 2 + 0.5), L / 2 + 0.5] : range === "house" ? [endLength, hsl] : [-hsl, hsl],
    from,
    units,
  );
  const xlim = opts.xlim ?? [cx[0] + xTrans, cx[1] + xTrans];
  const ylim = opts.ylim ?? [cy[0] + yTrans, cy[1] + yTrans];
  const background = col("plot_background"); // R: NULL = none; transparent stands in
  return {
    sport: "curling",
    league: key,
    units,
    bbox: displayBbox(xlim, ylim, rotation),
    origin: "center",
    ...(/^#[0-9a-f]{6}00$/i.test(background) ? {} : { background }),
    features,
  };
}
