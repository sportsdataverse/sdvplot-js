// Plot marks for shot charts: blazing-the-nets `main` lib/charts/hexShotChart.ts and shootingSignature.ts (@31427b8)
// drawn in data space, so they sit on a sporty court at any orientation.
import * as Plot from "@observablehq/plot";
import {
  type BasketballZone,
  type BasketballZoneArea,
  FRAMES,
  type Frame,
  type FrameName,
} from "@sportsdataverse/sporty";
import { type BinShape, cellPoints } from "../bins/index.js";
import { InputError } from "../errors.js";
import { type CellVsLeague, LEAGUE_PRIOR_ATTEMPTS, shrunkDiff } from "../shots/aggregate.js";
import { type DiffScale, diffScale } from "../shots/diff.js";
import { type SignaturePoint, signatureGradient } from "../shots/signature.js";
import { stampRender } from "./link.js";

type Point = [number, number];
interface ShotFeature {
  type: "Feature";
  properties: { id: string; fill: string };
  geometry: { type: "Polygon"; coordinates: [Point[]] };
}

/** Stamp `data-sdv-id` on each feature's path, so `sdvplot/interact` can link them; silent on a mismatch. */
const stampIds = (features: readonly ShotFeature[]): Plot.RenderFunction =>
  stampRender((i) => features[i]?.properties.id ?? "");

function frameOf(f: FrameName | Frame | undefined): Frame {
  const frame = typeof f === "object" ? f : FRAMES[f ?? "nba-legacy"];
  if (frame === undefined) throw new InputError(`unknown frame "${String(f)}"`); // JS callers
  return frame;
}
/** One legacy-tenths point through a sporty frame into plot coordinates. */
function toPlot([x, y]: readonly [number, number], f: Frame): Point {
  const px = f.x({ x, y });
  const py = f.y({ x, y });
  if (px === null || py === null) throw new InputError(`frame "${f.description}" dropped point (${x}, ${y})`);
  return [px, py];
}
/** A ring through the frame, closed explicitly (GeoJSON rings repeat their first point). */
function ring(points: readonly (readonly [number, number])[], f: Frame): Point[] {
  const out = points.map((p) => toPlot(p, f));
  const first = out[0];
  if (first !== undefined) out.push([first[0], first[1]]);
  return out;
}
const polygon = (id: string, fill: string, coordinates: Point[]): ShotFeature => ({
  type: "Feature",
  properties: { id, fill },
  geometry: { type: "Polygon", coordinates: [coordinates] },
});

/** Options for `shotCells`. */
export interface ShotCellsOptions {
  /**
   * Size per cell in legacy tenths (`sizeCells(cells, …).r`) or one size for all: a hexagon's circumradius, or a
   * square's side. 0 hides a cell.
   */
  r: readonly number[] | number;
  /** The cells' shape, as binned (`binShots`, `leagueIndex`); default `"hex"`. */
  shape?: BinShape;
  /** Colour of each cell's shrunk FG% vs league; default `diffScale()`. */
  scale?: DiffScale;
  /** `shrunkDiff` prior in attempts; default 25 (`main`), 0 = the raw difference (`master`). */
  prior?: number;
  /** Legacy tenths to plot coordinates: a sporty frame name or `Frame`; default `"nba-legacy"`. */
  frame?: FrameName | Frame;
  /** Default `var(--sdv-muted, #525252)`, so near-average cells stay visible (`hexShotChart.ts:159-161`). */
  stroke?: string;
  /** Default 0.85 px. */
  strokeWidth?: number;
  /**
   * Drop the cells centred outside the plot's frame, as blazing-the-nets `main` drops those past its viewport
   * (`hexShotChart.ts:74`), so a backcourt heave is not drawn over the margin; a cell centred inside is drawn whole
   * (this is not Plot's `clip`, which cuts paths). Default true; false draws every cell.
   */
  clip?: boolean;
}

/**
 * Data-space hexagons or squares (the dual encoding: `r` from `sizeCells`, `fill` from `diffScale`) drawn as
 * `Plot.geo` through the plot's x/y scales, so they sit on a sporty court at any orientation. Fewest attempts first,
 * so busy cells stay on top (blazing-the-nets `main` `lib/charts/hexShotChart.ts:79`); `r = 0` is not drawn, nor
 * (by default, `clip`) a cell centred outside the plot's frame. Each path carries `data-sdv-id="x,y"`, the cell's
 * legacy centre. Marks paint in array order: after `...court.marks` the cells cover the court lines under them, as
 * in `main`.
 *
 * @example
 * ```ts
 * import * as Plot from "@observablehq/plot";
 * import { shotCells, surface } from "@sportsdataverse/sdvplot/plot";
 * import { cellsVsLeague, leagueIndex } from "@sportsdataverse/sdvplot/shots";
 *
 * // Brooklyn shots from the sportsdataverse-data nba_stats_shots release, 2025-26
 * const shots = [
 *   { x_legacy: -1, y_legacy: 7, shot_distance: 1, shot_value: 2, shot_result: "Made" },
 *   { x_legacy: 0, y_legacy: 0, shot_distance: 0, shot_value: 2, shot_result: "Missed" },
 *   { x_legacy: -44, y_legacy: 252, shot_distance: 26, shot_value: 3, shot_result: "Made" },
 * ];
 * // the three shots stand in for the league; the gallery's hex chart uses the 2025-26 league's index
 * const cells = cellsVsLeague(shots, leagueIndex(shots, 15));
 * const court = surface("nba", { displayRange: "defense" });
 * Plot.plot({ ...court.scales, marks: [...court.marks, shotCells(cells, { r: 15 })] });
 * ```
 */
export function shotCells(cells: readonly CellVsLeague[], o: ShotCellsOptions): Plot.Markish {
  const f = frameOf(o.frame);
  const shape = o.shape ?? "hex";
  const scale = o.scale ?? diffScale();
  const k = o.prior ?? LEAGUE_PRIOR_ATTEMPTS;
  // `colourDiff` (hexShotChart.ts:48-51): no colour without a league rate or attempts.
  const colour = (h: CellVsLeague): string =>
    scale(
      h.leagueFgPct === null || h.attempts === 0 ? null : shrunkDiff(h.makes, h.attempts, h.leagueFgPct, k),
    );
  const size = (i: number): number => (typeof o.r === "number" ? o.r : (o.r[i] ?? 0));
  // fewest attempts first (a stable sort), so busy cells stay on top (hexShotChart.ts:79)
  const order = cells
    .map((_, i) => i)
    .filter((i) => size(i) > 0)
    .sort((a, b) => (cells[a]?.attempts ?? 0) - (cells[b]?.attempts ?? 0));
  const centres: Point[] = [];
  const features = order.map((i) => {
    const h = cells[i] as CellVsLeague;
    centres.push(toPlot([h.x, h.y], f));
    const pts = cellPoints(shape, size(i)).map(([vx, vy]): Point => [h.x + vx, h.y + vy]);
    return polygon(`${h.x},${h.y}`, colour(h), ring(pts, f));
  });
  const stamp = stampIds(features);
  return Plot.geo(features, {
    fill: (d: ShotFeature) => d.properties.fill,
    stroke: o.stroke ?? "var(--sdv-muted, #525252)",
    strokeWidth: o.strokeWidth ?? 0.85,
    render(index, scales, values, dimensions, context, next) {
      const { x, y } = scales;
      const { width, height, marginTop, marginRight, marginBottom, marginLeft } = dimensions;
      // `main` keeps `h.y <= v.top` (its viewport's top edge); here the frame is the plot's, at any orientation
      const inFrame = (i: number): boolean => {
        const [cx, cy] = centres[i] as Point;
        const px: number = x?.(cx);
        const py: number = y?.(cy);
        return (
          px >= marginLeft && px <= width - marginRight && py >= marginTop && py <= height - marginBottom
        );
      };
      const kept = (o.clip ?? true) && x && y ? index.filter(inFrame) : index;
      return stamp(kept, scales, values, dimensions, context, next);
    },
  });
}

/** Options for `shotZones`. */
export interface ShotZonesOptions {
  /** Fill per zone (e.g. `diffScale()` of the zone's shrunk diff). */
  fill: (zone: BasketballZone) => string;
  /** A label per zone at its anchor, haloed so it reads over any fill (`hexShotChart.ts:83-95`); omit for none. */
  text?: (zone: BasketballZone) => string;
  /** The SAME frame as the shots (zones built with `scale: 10` are in legacy tenths); default `"nba-legacy"`. */
  frame?: FrameName | Frame;
  /** Default 0.85 (`hexShotChart.ts:110`). */
  fillOpacity?: number;
}

/**
 * sporty's zone areas (built with `scale: 10`, legacy tenths) filled per zone, plus optional haloed labels, the
 * corner strips' set vertically (blazing-the-nets `main` zones mode, `lib/charts/hexShotChart.ts:97-136`). Each
 * area's path carries `data-sdv-id` = its zone.
 *
 * Marks paint in array order, so after `...court.marks` the zone fills dim the court lines under them. `main` draws
 * its lines after the zones. Moving the court mark last would hide the zones under its floor (sporty draws lines as
 * filled polygons), so add a second `surface` after the zones instead, its `colorUpdates` setting `plot_background`,
 * `defensive_half_court`, `offensive_half_court`, `court_apron`, `two_point_range`, `painted_area`,
 * `center_circle_fill` and `free_throw_circle_fill` to `"#00000000"`: only the lines remain.
 *
 * @example
 * ```ts
 * import * as Plot from "@observablehq/plot";
 * import { basketballZones } from "@sportsdataverse/sporty";
 * import { shotZones, surface } from "@sportsdataverse/sdvplot/plot";
 *
 * const court = surface("nba", { displayRange: "defense" });
 * const zones = shotZones(basketballZones("nba", { scale: 10 }), { fill: () => "#f7f7f7", text: (z) => z });
 * Plot.plot({ ...court.scales, marks: [...court.marks, ...zones] });
 * ```
 */
export function shotZones(areas: readonly BasketballZoneArea[], o: ShotZonesOptions): Plot.Markish[] {
  const f = frameOf(o.frame);
  const features = areas.map((a) => polygon(a.zone, o.fill(a.zone), ring(a.points, f)));
  const marks: Plot.Markish[] = [
    Plot.geo(features, {
      fill: (d: ShotFeature) => d.properties.fill,
      fillOpacity: o.fillOpacity ?? 0.85,
      render: stampIds(features),
    }),
  ];
  const text = o.text;
  if (text) {
    const labels = areas.map((a) => {
      const [x, y] = toPlot(a.label, f);
      return { x, y, text: text(a.zone), vertical: a.vertical };
    });
    marks.push(
      Plot.text(labels, {
        x: "x",
        y: "y",
        text: "text",
        rotate: (d: { vertical: boolean }) => (d.vertical ? -90 : 0),
        fill: "currentColor",
        stroke: "var(--sdv-bg, white)",
        strokeWidth: 3,
        strokeLinejoin: "round",
        paintOrder: "stroke",
      }),
    );
  }
  return marks;
}

/** Options for `shootingSignature`. */
export interface ShootingSignatureOptions {
  /** Colour of `colourDiff`; default `diffScale()`. */
  fill?: DiffScale;
  /** `"monotone-x"` (default, `main`) or `"basis"` (`master` `ShootingSignature/index.js:96`). */
  curve?: "monotone-x" | "basis";
  /**
   * Ribbon half-width in y units. Default `main`'s 20 px at the busiest distance on its 190 px [0, 1] axis, never
   * under 0.75 px (`shootingSignature.ts:13-15`, `:131-132`): `max(share / maxShare * 20, 0.75) / 190`. `master`:
   * `(p) => (1 + p.share * 199) / 200` (`ShootingSignature/index.js:73-75`, `:88-90`).
   */
  halfWidth?: (p: SignaturePoint, maxShare: number) => number;
  /** The dashed league line, faint everywhere and full strength under the ribbon (`:165-181`); default true. */
  league?: boolean;
}

const SVG_NS = "http://www.w3.org/2000/svg";

/**
 * The shooting signature: a ribbon along FG% by distance, as wide as the shot share and coloured along x by the
 * shrunk FG% vs league (blazing-the-nets `main` `lib/charts/shootingSignature.ts:117-213`; `master`
 * `src/components/ShootingSignature/index.js`). Input: `signaturePoints(...)`; a null `fgPct` is a gap. The gradient
 * id is a hash of its stops and its pixel x range, so two signatures on a page, or one drawn at two widths, never
 * share one (`master`'s fixed id did, `Gradient.js:10`).
 *
 * y is not clamped: the ribbon's edges are `fgPct ± halfWidth` in y units, so near 0% or 100% they pass a [0, 1]
 * domain (`main` clamps the ribbon's centre instead, which misstates FG%). To clamp them, pass
 * `y: { domain: [0, 1], clamp: true }`.
 *
 * @example
 * ```ts
 * import * as Plot from "@observablehq/plot";
 * import { shootingSignature } from "@sportsdataverse/sdvplot/plot";
 * import { fgPctByDistance, signaturePoints, vsLeague } from "@sportsdataverse/sdvplot/shots";
 *
 * // Brooklyn shots from the sportsdataverse-data nba_stats_shots release, 2025-26
 * const shots = [
 *   { x_legacy: -1, y_legacy: 7, shot_distance: 1, shot_value: 2, shot_result: "Made" },
 *   { x_legacy: 0, y_legacy: 0, shot_distance: 0, shot_value: 2, shot_result: "Missed" },
 *   { x_legacy: -44, y_legacy: 252, shot_distance: 26, shot_value: 3, shot_result: "Made" },
 * ];
 * // the makes against all three attempts, which stand in for the league (the gallery's uses the 2025-26 league)
 * const made = fgPctByDistance(shots.filter((s) => s.shot_result === "Made"));
 * const points = signaturePoints(vsLeague(made, fgPctByDistance(shots)), { minAttempts: 1 });
 * Plot.plot({ y: { domain: [0, 1] }, marks: shootingSignature(points) });
 * ```
 */
export function shootingSignature(
  points: readonly SignaturePoint[],
  o: ShootingSignatureOptions = {},
): Plot.Markish[] {
  const curve = o.curve ?? "monotone-x";
  const { maxShare, maxFt, stops, id: gradientId } = signatureGradient(points, o.fill ?? diffScale());
  const half = o.halfWidth ?? ((p: SignaturePoint, m: number) => Math.max((p.share / m) * 20, 0.75) / 190);
  const marks: Plot.Markish[] = [];
  if (o.league ?? true) {
    const leagueLine = (strong: boolean) =>
      Plot.line(points, {
        x: "distance",
        y: (p: SignaturePoint) =>
          p.leagueFgPct === null || (strong && p.fgPct === null) ? Number.NaN : p.leagueFgPct,
        curve,
        stroke: "currentColor",
        strokeOpacity: strong ? 1 : 0.4,
        strokeDasharray: "3 3",
      });
    marks.push(leagueLine(false), leagueLine(true));
  }
  const edge = (sign: 1 | -1) => (p: SignaturePoint) =>
    p.fgPct === null ? Number.NaN : p.fgPct + sign * half(p, maxShare);
  marks.push(
    Plot.areaY(points, {
      x: "distance",
      y1: edge(-1),
      y2: edge(1),
      curve,
      stroke: "currentColor",
      strokeOpacity: 0.2,
      strokeWidth: 0.5,
      render(index, scales, values, dimensions, context, next) {
        const g = next?.(index, scales, values, dimensions, context) ?? null;
        if (g === null) return null;
        const x = scales.x as (v: number) => number;
        const [x1, x2] = [String(x(0)), String(x(maxFt))];
        const id = gradientId(x1, x2); // hashes the pixel range with the colours (signatureGradient)
        g.setAttribute("fill", `url(#${id})`); // Plot sets a constant fill on the mark's <g>
        const doc = context.document;
        const grad = doc.createElementNS(SVG_NS, "linearGradient");
        grad.setAttribute("id", id);
        grad.setAttribute("gradientUnits", "userSpaceOnUse");
        grad.setAttribute("x1", x1);
        grad.setAttribute("x2", x2);
        grad.setAttribute("y1", "0");
        grad.setAttribute("y2", "0");
        for (const [offset, colour] of stops) {
          const s = doc.createElementNS(SVG_NS, "stop");
          s.setAttribute("offset", `${offset}%`);
          s.setAttribute("stop-color", colour);
          grad.appendChild(s);
        }
        const defs = doc.createElementNS(SVG_NS, "defs");
        defs.appendChild(grad);
        g.insertBefore(defs, g.firstChild);
        return g;
      },
    }),
  );
  return marks;
}
