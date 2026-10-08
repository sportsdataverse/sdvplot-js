import { UnknownLeagueError } from "../errors.js";
import type { Point, Polygon } from "../scene.js";
import { BASKETBALL_LEAGUES, BASKETBALL_SPECS, type BasketballLeague } from "../specs/basketball.js";
import { arcResolution } from "../surface.js";

/**
 * The six stats.nba.com shot zones, in blazing-the-nets `main` order (`lib/data/aggregate.ts:242-249`).
 * Above-the-break threes are not split left/centre/right.
 */
export const BASKETBALL_ZONES = [
  "restricted_area",
  "paint",
  "mid_range",
  "corner_3_left",
  "corner_3_right",
  "above_break_3",
] as const;
export type BasketballZone = (typeof BASKETBALL_ZONES)[number];
/** Display names (blazing-the-nets `main` `lib/charts/hexShotChart.ts:35-42`). */
export const BASKETBALL_ZONE_LABELS: Readonly<Record<BasketballZone, string>> = {
  restricted_area: "Restricted area",
  paint: "Paint (non-RA)",
  mid_range: "Mid-range",
  corner_3_left: "Left corner 3",
  corner_3_right: "Right corner 3",
  above_break_3: "Above-the-break 3",
};

/** Basket-centred zone frame: `x` across the court (negative = left of a hoop-at-the-bottom chart), `y` toward half court. */
export interface ZoneOptions {
  /** Default `"nba"`; case-insensitive, any basketball league sporty draws. */
  league?: BasketballLeague | (string & {});
  /** Input units per spec unit: 1 = the league's own units (ft for nba), 10 = stats.nba.com legacy tenths. Default 1. */
  scale?: number;
}

interface Geometry {
  restricted: number;
  laneHalf: number;
  freeThrow: number;
  cornerX: number;
  arc: number;
  breakY: number;
  halfWidth: number;
  baseline: number;
  halfCourt: number;
}

/** The zone lines from the league's own spec (the parameters `basketballCourt` draws and the R oracle checks). */
function geometry(league: string, scale: number): Geometry {
  const key = league.toLowerCase();
  if (!(BASKETBALL_LEAGUES as readonly string[]).includes(key)) {
    throw new UnknownLeagueError(
      `Unknown basketball league "${league}"; expected one of: ${BASKETBALL_LEAGUES.join(", ")}`,
    );
  }
  const p = BASKETBALL_SPECS[key as BasketballLeague];
  const arc = (p.basket_center_to_three_point_arc[0] ?? 0) * scale;
  const cornerX = (p.basket_center_to_corner_three[0] ?? 0) * scale;
  return {
    restricted: (p.restricted_arc_radius ?? 0) * scale, // main court.ts:18 (40 tenths)
    laneHalf: ((p.lane_width[0] ?? 0) / 2) * scale, // court.ts:15 (80): the painted (first) lane
    freeThrow: ((p.lane_length[0] ?? 0) - p.basket_center_to_baseline) * scale, // court.ts:16 (137.5)
    cornerX, // court.ts:19 (220)
    arc, // court.ts:20 (237.5)
    breakY: Math.sqrt(Math.max(0, arc ** 2 - cornerX ** 2)), // court.ts:24 (~89.48)
    halfWidth: (p.court_width / 2) * scale, // court.ts:9 (250)
    baseline: -p.basket_center_to_baseline * scale, // court.ts:10 (-52.5)
    halfCourt: (p.court_length / 2 - p.basket_center_to_baseline) * scale, // court.ts:11 (417.5)
  };
}

/**
 * The zone a shot falls in. A three is a corner three at or below the corner break, split by the sign of x;
 * a two is in the restricted area within its radius, then the painted lane up to the free-throw line, else
 * mid-range. Two or three comes from `shotValue` (the scorer's call), never the coordinates (blazing-the-nets
 * `main` `lib/data/aggregate.ts:253-267`).
 *
 * @example
 * ```ts
 * import { BASKETBALL_ZONES, basketballZoneOf } from "@sportsdataverse/sporty";
 *
 * BASKETBALL_ZONES.indexOf(basketballZoneOf(-224, 20, 3, { scale: 10 })); // a legacy-frame left corner three
 * ```
 */
export function basketballZoneOf(
  x: number,
  y: number,
  shotValue: number,
  o: ZoneOptions = {},
): BasketballZone {
  const g = geometry(o.league ?? "nba", o.scale ?? 1);
  if (shotValue === 3) {
    if (y <= g.breakY) return x < 0 ? "corner_3_left" : "corner_3_right";
    return "above_break_3";
  }
  if (Math.hypot(x, y) <= g.restricted) return "restricted_area";
  if (Math.abs(x) <= g.laneHalf && y <= g.freeThrow) return "paint";
  return "mid_range";
}

export interface BasketballZoneArea {
  readonly zone: BasketballZone;
  /** One closed ring in the zone frame. `paint` is a keyhole around the restricted area (fill it nonzero or evenodd). */
  readonly points: Polygon;
  /** Label anchor in the zone frame. */
  readonly label: Point;
  /** The corner strips are narrow: set their label vertically. */
  readonly vertical: boolean;
}

/**
 * The six zones as fillable rings, cut at depth `top` (default the half-court line). Rings and labels are
 * basket-centred, like `basketballZoneOf`'s input: the hoop at the origin, `y` toward half court, in the league's
 * units times `scale`. They are not in a surface frame, so map every point through the SAME frame as the shots
 * before drawing. For stats.nba.com legacy shots in the hoop-at-the-bottom chart, build them with `scale: 10` and
 * map each point `[x, y]` through `FRAMES["nba-legacy-vertical"]` (`f.x({ x, y })`, `f.y({ x, y })`), which
 * gives `[x / 10, y / 10 - 41.75]`: feet, with the hoop moved to (0, -41.75). Unmapped, the zones miss the shots
 * by that hoop offset.
 * Port of blazing-the-nets `main` `lib/data/court.ts:141-175`.
 *
 * @example
 * ```ts
 * import { BASKETBALL_ZONE_LABELS, basketballZones } from "@sportsdataverse/sporty";
 *
 * basketballZones("nba", { scale: 10, top: 350 }).map((z) => BASKETBALL_ZONE_LABELS[z.zone]);
 * ```
 */
export function basketballZones(
  league: BasketballLeague | (string & {}) = "nba",
  o: Omit<ZoneOptions, "league"> & { top?: number; arcResolution?: number } = {},
): readonly BasketballZoneArea[] {
  const g = geometry(league, o.scale ?? 1);
  const top = o.top ?? g.halfCourt;
  const n = arcResolution(o.arcResolution);
  const arc = (r: number, from: number, to: number): Point[] =>
    Array.from({ length: n + 1 }, (_, i): Point => {
      const a = from + ((to - from) * i) / n;
      return [r * Math.cos(a), r * Math.sin(a)];
    });
  const corner = Math.atan2(g.breakY, g.cornerX);
  const { halfWidth: w, baseline: base, laneHalf: lane, freeThrow: ft, cornerX: cx, breakY: b } = g;
  // Restricted area: a full circle, counter-clockwise from its bottom (0, -r), so the paint can bridge to it.
  const rim = arc(g.restricted, -Math.PI / 2, (3 * Math.PI) / 2);
  const lanePts: Point[] = [
    [-lane, base],
    [-lane, ft],
    [lane, ft],
    [lane, base],
  ];
  // Keyhole (court.ts:170 cuts the same hole with evenodd): the lane clockwise, in along x = 0 to the circle's
  // bottom, round it counter-clockwise, back out. Opposite windings, so nonzero and evenodd both leave the hole.
  const paint: Point[] = [...lanePts, [0, base], ...rim, [0, base]];
  const insideThree: Point[] = [[-cx, base], ...arc(g.arc, Math.PI - corner, corner), [cx, base]];
  // Mid-range = inside the arc minus the lane; the lane touches the baseline, so the difference is one ring.
  const midRange: Point[] = [...insideThree, [lane, base], [lane, ft], [-lane, ft], [-lane, base]];
  const cornerStrip = (s: number): Point[] => [
    [s * w, base],
    [s * w, b],
    [s * cx, b],
    [s * cx, base],
  ];
  const aboveBreak: Point[] = [[-w, b], [-w, top], [w, top], [w, b], ...arc(g.arc, corner, Math.PI - corner)];
  // Label anchors come from the same lines, so they sit inside their zone in any league's units: the restricted
  // area's at a fifth of its radius (main court.ts:169 puts it at 8 tenths, the same for nba), the others midway
  // across their zone (main's hard-coded tenths, 95/185/285 and corner y 20, are within 0.7 ft of these for nba);
  // above the break, no further past the arc than the arc is past the free-throw line.
  const r = g.restricted;
  const labelX = (w + cx) / 2;
  const cornerY = (base + b) / 2;
  const breakLabel = (g.arc + Math.min(top, 2 * g.arc - ft)) / 2;
  return [
    { zone: "restricted_area", points: rim, label: [0, r / 5], vertical: false },
    { zone: "paint", points: paint, label: [0, (r + ft) / 2], vertical: false },
    { zone: "mid_range", points: midRange, label: [0, (ft + g.arc) / 2], vertical: false },
    { zone: "corner_3_left", points: cornerStrip(-1), label: [-labelX, cornerY], vertical: true },
    { zone: "corner_3_right", points: cornerStrip(1), label: [labelX, cornerY], vertical: true },
    { zone: "above_break_3", points: aboveBreak, label: [0, breakLabel], vertical: false },
  ];
}
