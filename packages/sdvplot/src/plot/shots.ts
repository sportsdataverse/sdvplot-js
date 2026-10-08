// Plot marks for shot charts: blazing-the-nets `main` lib/charts/hexShotChart.ts and shootingSignature.ts (@31427b8)
// drawn in data space, so they sit on a sporty court at any orientation.
import * as Plot from "@observablehq/plot";
import {
  BASKETBALL_ZONE_LABELS,
  type BasketballZone,
  type BasketballZoneArea,
  FRAMES,
  type Frame,
  type FrameName,
} from "@sportsdataverse/sporty";
import { type BinShape, cellPoints } from "../bins/index.js";
import { InputError } from "../errors.js";
import { type CellVsLeague, LEAGUE_PRIOR_ATTEMPTS, type Split, shrunkDiff } from "../shots/aggregate.js";
import { type DiffScale, diffScale } from "../shots/diff.js";
import { type SignaturePoint, signatureGradient } from "../shots/signature.js";
import { compose } from "./marks.js";

type Point = [number, number];
type Polygon = { type: "Polygon"; coordinates: [Point[]] };

/** Stamp `data-sdv-id` on each drawn path (one path per index entry), so `sdvplot/interact` can link them. */
const stampIds =
  (id: (i: number) => string): Plot.RenderFunction =>
  (index, scales, values, dimensions, context, next) => {
    const g = next?.(index, scales, values, dimensions, context) ?? null;
    if (g === null) return null;
    const paths = g.querySelectorAll("path");
    if (paths.length !== index.length) return g; // never mislabel
    index.forEach((i, k) => paths[k]?.setAttribute("data-sdv-id", id(i)));
    return g;
  };

/** A caller's `tip: true` gains sdvplot's default formats; a tip options object keeps its own. */
function withFormat(
  tip: NonNullable<Plot.MarkOptions["tip"]>,
  format: Record<string, string | boolean>,
): NonNullable<Plot.MarkOptions["tip"]> {
  if (tip === false) return tip;
  if (tip === true || typeof tip === "string") return { ...(tip === true ? {} : { pointer: tip }), format };
  return { format, ...tip };
}

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
const polygon = (coordinates: Point[]): Polygon => ({ type: "Polygon", coordinates: [coordinates] });

/** Plot's geo options sdvplot does not own pass through (tip, title, href, fx, fy, filter, className, clip, …). */
export type GeoPassThrough = Omit<Plot.GeoOptions, "geometry" | "fill" | "r" | "x" | "y">;

/** Options for `shotCells`. */
export interface ShotCellsOptions extends GeoPassThrough {
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
  stroke?: Plot.ChannelValueSpec;
  /** Default 0.85 px. */
  strokeWidth?: Plot.ChannelValueSpec;
  /**
   * Drop the cells centred outside the plot's frame, as blazing-the-nets `main` drops those past its viewport
   * (`hexShotChart.ts:74`); a cell centred inside is drawn whole. Not Plot's `clip` (which cuts paths, and passes
   * through). Default true. Was `clip` before Phase 11.
   */
  dropOutside?: boolean;
}

/**
 * Data-space hexagons or squares (the dual encoding: `r` from `sizeCells`, `fill` from `diffScale`) drawn as
 * `Plot.geo` through the plot's x/y scales, so they sit on a sporty court at any orientation. Fewest attempts first,
 * so busy cells stay on top (blazing-the-nets `main` `lib/charts/hexShotChart.ts:79`); `r = 0` is not drawn, nor
 * (by default, `dropOutside`) a cell centred outside the plot's frame. Each path carries `data-sdv-id="x,y"`, the cell's
 * legacy centre. Marks paint in array order: after `...court.marks` the cells cover the court lines under them, as
 * in `main`.
 * `tip: true` shows attempts, FG%, league FG% and the shrunk difference (formats `.1%`, `+.1%`); every other
 * `Plot.geo` option passes through, and the cells are the mark's data, so `fx`/`fy`, `filter`, `sort` (replacing the
 * default order) and `title` read the caller's fields.
 *
 * @example
 * ```ts
 * import * as Plot from "@observablehq/plot";
 * import { shotCells, surface } from "@sportsdataverse/sdvplot/plot";
 *
 * const court = surface("nba", { displayRange: "defense" });
 * const rim = { x: 0, y: 0, attempts: 9, makes: 6, fgPct: 6 / 9, meanDistance: 1, zone: "restricted_area" as const, leagueFgPct: 0.62 };
 * Plot.plot({ ...court.scales, marks: [...court.marks, shotCells([rim], { r: 15 })] });
 * ```
 */
export function shotCells(cells: readonly CellVsLeague[], o: ShotCellsOptions): Plot.Markish {
  const {
    r,
    shape = "hex",
    scale = diffScale(),
    prior = LEAGUE_PRIOR_ATTEMPTS,
    frame,
    dropOutside = true,
    stroke = "var(--sdv-muted, #525252)",
    strokeWidth = 0.85,
    sort = (a: CellVsLeague, b: CellVsLeague) => a.attempts - b.attempts,
    tip,
    channels,
    initializer,
    render,
    ...pass
  } = o;
  const f = frameOf(frame);
  const diff = (h: CellVsLeague): number | null =>
    h.leagueFgPct === null || h.attempts === 0 ? null : shrunkDiff(h.makes, h.attempts, h.leagueFgPct, prior);
  const size = (i: number): number => (typeof r === "number" ? r : (r[i] ?? 0));
  const centre = (h: CellVsLeague): Point => toPlot([h.x, h.y], f);
  // ponytail: pixel filter in an initializer (not render), so a tip never points at a dropped cell
  const inFrame: Plot.InitializerFunction = (data, facets, _channels, scales, dimensions) => {
    const { x, y } = scales;
    if (!dropOutside || !x || !y) return { data, facets };
    const { width, height, marginTop, marginRight, marginBottom, marginLeft } = dimensions;
    const keep = (i: number): boolean => {
      const [cx, cy] = centre(data[i] as CellVsLeague);
      const px: number = x(cx);
      const py: number = y(cy);
      return px >= marginLeft && px <= width - marginRight && py >= marginTop && py <= height - marginBottom;
    };
    return { data, facets: facets.map((I) => I.filter(keep)) };
  };
  const geo: Plot.GeoOptions = {
    ...pass,
    // r = 0 gives a null geometry, which Plot drops (the default `defined` filter)
    geometry: (h: CellVsLeague, i: number) =>
      size(i) > 0
        ? polygon(
            ring(
              cellPoints(shape, size(i)).map(([vx, vy]) => [h.x + vx, h.y + vy]),
              f,
            ),
          )
        : null,
    fill: (h: CellVsLeague) => scale(diff(h)),
    stroke,
    strokeWidth,
    sort: sort as NonNullable<Plot.MarkOptions["sort"]>,
    ...(tip === undefined || tip === null
      ? {}
      : {
          tip: withFormat(tip, { attempts: true, fgPct: ".1%", leagueFgPct: ".1%", diff: "+.1%" }),
          x: (h: CellVsLeague) => centre(h)[0],
          y: (h: CellVsLeague) => centre(h)[1],
        }),
    channels: {
      attempts: { value: "attempts", label: "Attempts" },
      fgPct: { value: "fgPct", label: "FG%" },
      leagueFgPct: { value: "leagueFgPct", label: "League FG%" },
      diff: { value: diff, label: "vs league (shrunk)" },
      ...channels,
    },
    render: compose(
      render,
      stampIds((i) => `${cells[i]?.x},${cells[i]?.y}`),
    ),
  };
  // An explicit initializer makes Plot ignore sort/filter/reverse; Plot.initializer folds them in first, then the
  // frame filter, then the caller's own initializer.
  const framed = Plot.initializer(geo, inFrame);
  return Plot.geo(
    cells as CellVsLeague[],
    initializer === undefined ? framed : Plot.initializer(framed, initializer),
  );
}

/** Options for `shotZones`. */
export interface ShotZonesOptions extends GeoPassThrough {
  /** Fill per zone (e.g. `diffScale()` of the zone's shrunk diff). */
  fill: (zone: BasketballZone) => string;
  /** A label per zone at its anchor, haloed so it reads over any fill (`hexShotChart.ts:83-95`); omit for none. */
  text?: (zone: BasketballZone) => string;
  /** The SAME frame as the shots (zones built with `scale: 10` are in legacy tenths); default `"nba-legacy"`. */
  frame?: FrameName | Frame;
  /** Default 0.85 (`hexShotChart.ts:110`). */
  fillOpacity?: Plot.ChannelValueSpec;
  /** Per-zone makes and attempts (`statsByZone(shots)`): with `tip`, each zone shows them. */
  stats?: Readonly<Record<BasketballZone, Split>>;
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
 * The areas are the mark's data and each path is named by its zone; `tip: true` shows the zone and, with `stats`
 * (`statsByZone(shots)`), its makes/attempts and FG%. Every other `Plot.geo` option passes through.
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
  const { fill, text, frame, stats, fillOpacity = 0.85, tip, channels, render, ...pass } = o;
  const f = frameOf(frame);
  const marks: Plot.Markish[] = [
    Plot.geo(areas as BasketballZoneArea[], {
      ariaLabel: (a: BasketballZoneArea) => BASKETBALL_ZONE_LABELS[a.zone], // each path names its zone
      ...pass,
      geometry: (a: BasketballZoneArea) => polygon(ring(a.points, f)),
      fill: (a: BasketballZoneArea) => fill(a.zone),
      fillOpacity,
      ...(tip === undefined || tip === null
        ? {}
        : { tip: withFormat(tip, { zone: true, made: true, fgPct: ".1%" }) }),
      channels: {
        zone: { value: (a: BasketballZoneArea) => BASKETBALL_ZONE_LABELS[a.zone], label: "Zone" },
        ...(stats === undefined
          ? {}
          : {
              made: {
                value: (a: BasketballZoneArea) => `${stats[a.zone].makes}/${stats[a.zone].attempts}`,
                label: "Made",
              },
              fgPct: { value: (a: BasketballZoneArea) => stats[a.zone].fgPct, label: "FG%" },
            }),
        ...channels,
      },
      render: compose(
        render,
        stampIds((i) => areas[i]?.zone ?? ""),
      ),
    }),
  ];
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
        ariaHidden: "true", // the zone paths carry the names; the labels repeat them
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
  /** A tip that follows the pointer along x: distance, FG%, league FG% and shot share (`Plot.tip` + `Plot.pointerX`). */
  tip?: boolean | Plot.TipOptions;
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
 * `tip` adds a `Plot.tip` that follows the pointer along x (`Plot.pointerX`): distance, FG%, league FG% and share.
 *
 * @example
 * ```ts
 * import * as Plot from "@observablehq/plot";
 * import { shootingSignature } from "@sportsdataverse/sdvplot/plot";
 *
 * const points = [0, 0.25, 0.5].map((distance) => ({ distance, fgPct: 0.6, leagueFgPct: 0.55, share: 0.1, colourDiff: 0.02 }));
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
  if (o.tip) {
    const own = o.tip === true ? {} : o.tip;
    marks.push(
      Plot.tip(
        points,
        Plot.pointerX({
          x: { value: "distance", label: "Distance" },
          y: { value: (p: SignaturePoint) => p.fgPct ?? Number.NaN, label: "FG%" },
          channels: {
            leagueFgPct: { value: "leagueFgPct", label: "League FG%" },
            share: { value: "share", label: "Share of shots" },
          },
          format: { x: (d: number) => `${d} ft`, y: ".1%", leagueFgPct: ".1%", share: ".1%" },
          ...own,
        }),
      ),
    );
  }
  return marks;
}
