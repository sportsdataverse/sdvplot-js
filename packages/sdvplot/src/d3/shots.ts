// d3 twins of the shot-chart marks: blazing-the-nets `main` lib/charts/theme.ts (legend), hexShotChart.ts (size key)
// and shootingSignature.ts (@31427b8), which are d3 themselves. Never imports ../plot/*.
import { type BaseType, type Selection, area, curveBasis, curveMonotoneX, line } from "d3";
import { type BinShape, cellPath } from "../bins/index.js";
import { contentId } from "../content-id.js";
import { InputError } from "../errors.js";
import { type DiffScale, diffScale } from "../shots/diff.js";
import { type SignaturePoint, signatureGradient } from "../shots/signature.js";

/** Any `<g>` selection, whatever its datum (d3's `Selection` is invariant in it; see `Sel` in ./index.ts). */
type G<D> = Selection<SVGGElement, D, BaseType, unknown>;
const FONT_PX = 11; // blazing-the-nets main lib/charts/theme.ts:24
const CHAR_PX = 6.2; // theme.ts:26
const LINE_H = 15; // theme.ts:92
const MUTED = "var(--sdv-muted, currentColor)"; // main's TOKENS.muted where the page sets it, else the page's ink

/** Signed points from a fraction (blazing-the-nets `main` `lib/format.ts:8`): 0.042 → "+4.2", -0.042 → "−4.2". */
const fmtPts = (v: number): string => `${v >= 0 ? "+" : "−"}${Math.abs(v * 100).toFixed(1)}`;

/** Greedy word wrap at an estimated 6.2 px per character (theme.ts:77-90): no measuring, so SSR-safe. */
function wrap(text: string, maxWidth: number): string[] {
  const perLine = Math.max(8, Math.floor(maxWidth / CHAR_PX));
  const lines: string[] = [];
  let cur = "";
  for (const word of text.split(" ")) {
    if (cur && cur.length + 1 + word.length > perLine) {
      lines.push(cur);
      cur = word;
    } else cur = cur ? `${cur} ${word}` : word;
  }
  if (cur) lines.push(cur);
  return lines;
}

/** Options for `appendLegend`. */
export interface AppendLegendOptions {
  /** Top-left corner of the legend in px; default (0, 0). */
  x?: number;
  /** See `x`. */
  y?: number;
  /** Space available, which the text wraps to; the bar is at most 240 px (theme.ts:122). */
  width?: number;
  /**
   * Diffs the bar spans; default the scale's end stops. `master`'s legend spanned [-0.30, 0.30]
   * (`ShootingSignature/Legend.js:36-38`): `{ domain: [-0.3, 0.3], ticks: [-0.3, -0.15, 0, 0.15, 0.3] }`.
   */
  domain?: readonly [lo: number, hi: number];
  /** Tick diffs; default the domain's ends, and 0 when it lies inside them. */
  ticks?: readonly number[];
  /** Tick text; default signed points, "0" at 0 (theme.ts:140). */
  format?: (d: number) => string;
  /** Caption and key in words (theme.ts:35, :120); `null` for none. */
  caption?: readonly string[] | null;
  /** More lines under the caption, wrapped to `width` (e.g. a shrinkage note). */
  notes?: readonly string[];
  /** A cell size key under the colour key: pixel size per attempt count and the counts (`sizeCells(...).steps`). */
  size?: {
    readonly px: (attempts: number) => number;
    readonly steps: readonly number[];
    /** The key's cell shape; default `"hex"`. */
    readonly shape?: BinShape;
    /** Default `"hex size: attempts"` or `"square size: attempts"`. */
    readonly note?: string;
  };
}

/**
 * A diff-colour legend for d3 charts: gradient bar, ticks, caption, notes and an optional cell size key
 * (blazing-the-nets `main` `lib/charts/theme.ts:109-143`, `lib/charts/hexShotChart.ts:196-213`). It replaces
 * `master`'s static PNG ramp (`ShootingSignature/Legend.js:45-50`, `rgy5.png`) with a gradient generated from the
 * scale, whose id is a hash of its stops. Nothing is measured (text wraps at an estimated 6.2 px per character), so
 * it renders the same in jsdom and SSR. Returns the height used. Plot users: `Plot.legend({ color: scale.plot })`.
 *
 * @example
 * ```ts
 * import { create } from "d3";
 * import { appendLegend } from "@sportsdataverse/sdvplot/d3";
 * import { diffScale } from "@sportsdataverse/sdvplot/shots";
 *
 * const svg = create("svg").attr("viewBox", "0 0 300 80");
 * appendLegend(svg.append("g"), diffScale(), { width: 280 });
 * svg.node();
 * ```
 */
export function appendLegend<D>(
  g: G<D>,
  scale: DiffScale = diffScale(),
  o: AppendLegendOptions = {},
): number {
  const x = o.x ?? 0;
  const y = o.y ?? 0;
  const maxWidth = o.width ?? 240;
  const width = Math.min(maxWidth, 240);
  const [lo, hi] = o.domain ?? [scale.stops[0] ?? 0, scale.stops.at(-1) ?? 0];
  if (!(Number.isFinite(lo) && Number.isFinite(hi) && hi > lo))
    throw new InputError(`appendLegend domain must be finite and run low to high, got [${lo}, ${hi}]`);
  // The domain's ends plus every scale stop inside it: exact for a piecewise-linear scale (master), 5 samples of RdBu.
  const at = [lo, ...scale.stops.filter((d) => d > lo && d < hi), hi];
  const stops = at.map((d) => [((d - lo) / (hi - lo)) * 100, scale(d)] as const);
  const id = contentId("sdv-legend", stops.map((s) => s.join(" ")).join(";"));
  const grad = g.append("defs").append("linearGradient").attr("id", id);
  for (const [offset, colour] of stops)
    grad.append("stop").attr("offset", `${offset}%`).attr("stop-color", colour);
  g.append("rect")
    .attr("x", x)
    .attr("y", y)
    .attr("width", width)
    .attr("height", 8)
    .attr("rx", 2)
    .style("fill", `url(#${id})`);
  const format = o.format ?? ((d: number) => (d === 0 ? "0" : fmtPts(d)));
  for (const d of o.ticks ?? (lo < 0 && hi > 0 ? [lo, 0, hi] : [lo, hi])) {
    g.append("text")
      .attr("x", x + ((d - lo) / (hi - lo)) * width)
      .attr("y", y + 8 + FONT_PX + 2)
      .attr("text-anchor", d === lo ? "start" : d === hi ? "end" : "middle")
      .style("font-size", `${FONT_PX}px`)
      .style("fill", MUTED)
      .text(format(d));
  }
  let used = 8 + FONT_PX + 6;
  const caption =
    o.caption === undefined
      ? ["FG% vs league (points)", "red: above league · blue: below"]
      : (o.caption ?? []);
  const lines = [...caption, ...(o.notes ?? [])].flatMap((n) => wrap(n, maxWidth));
  lines.forEach((t, i) => {
    g.append("text")
      .attr("x", x)
      .attr("y", y + used + FONT_PX + i * LINE_H)
      .style("font-size", `${FONT_PX}px`)
      .style("fill", MUTED)
      .text(t);
  });
  used += lines.length * LINE_H;
  const size = o.size;
  if (size) {
    const shape = size.shape ?? "hex";
    const key = g.append("g").attr("transform", `translate(${x},${y + used + 8})`);
    size.steps.forEach((n, i) => {
      const cx = 12 + i * 34;
      key
        .append("path")
        .attr("transform", `translate(${cx},10)`)
        .attr("d", cellPath(shape, size.px(n)))
        .style("fill", MUTED);
      key
        .append("text")
        .attr("x", cx)
        .attr("y", 36)
        .attr("text-anchor", "middle")
        .style("font-size", `${FONT_PX}px`)
        .style("fill", MUTED)
        .text(i === size.steps.length - 1 ? `${n}+` : String(n));
    });
    // main's drawNotes(key, 118, 4, width - 24 - 118, …) (hexShotChart.ts:212): wrapped, 8 characters a line at the least
    const note = wrap(size.note ?? `${shape} size: attempts`, maxWidth - 118);
    note.forEach((t, i) => {
      key
        .append("text")
        .attr("x", 118)
        .attr("y", 4 + FONT_PX + i * LINE_H)
        .style("font-size", `${FONT_PX}px`)
        .style("fill", MUTED)
        .text(t);
    });
    used += 8 + Math.max(42, 8 + note.length * LINE_H);
  }
  return used;
}

/** Options for `appendSignature`. */
export interface AppendSignatureOptions {
  /** The caller's scale from distance (ft) to px. */
  x: (distance: number) => number;
  /** The caller's scale from FG% (0-1) to px; a clamped scale clamps the ribbon's centre. */
  y: (fgPct: number) => number;
  /** Colour of `colourDiff`; default `diffScale()`. */
  fill?: DiffScale;
  /** `"monotone-x"` (default, `main`) or `"basis"` (`master` `ShootingSignature/index.js:96`). */
  curve?: "monotone-x" | "basis";
  /** Ribbon half-width in PIXELS; default `main`'s `max(share / maxShare * 20, 0.75)` (`shootingSignature.ts:131-132`). */
  halfWidth?: (p: SignaturePoint, maxShare: number) => number;
  /** The dashed league line, faint everywhere and full strength under the ribbon (`:165-181`); default true. */
  league?: boolean;
}

/**
 * The d3 twin of `sdvplot/plot`'s `shootingSignature`: the dashed league line and the ribbon along FG% by distance,
 * as wide as the shot share and coloured along x by the shrunk FG% vs league (blazing-the-nets `main`
 * `lib/charts/shootingSignature.ts:165-211`). The same points give the Plot mark's ribbon and league paths, gradient
 * stops and gradient id when the scales match (with a 190 px [0, 1] y axis for the default half-width). A null
 * `fgPct` is a gap. The gradient id hashes its stops and its pixel x range, so two signatures on a page, or one at
 * two widths, never share one. y goes through the caller's `y` as it is: the ribbon's edges are
 * `y(fgPct) ± halfWidth`, and a clamped scale clamps the centre (as `main` does). Returns the `<g>` it appended.
 *
 * @example
 * ```ts
 * import { create, scaleLinear } from "d3";
 * import { appendSignature } from "@sportsdataverse/sdvplot/d3";
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
 * const svg = create("svg").attr("viewBox", "0 0 400 200");
 * appendSignature(svg.append("g"), points, { x: scaleLinear([0, 35], [0, 400]), y: scaleLinear([0, 1], [200, 0]) });
 * svg.node();
 * ```
 */
export function appendSignature<D>(
  sel: G<D>,
  points: readonly SignaturePoint[],
  o: AppendSignatureOptions,
): G<D> {
  const curve = (o.curve ?? "monotone-x") === "basis" ? curveBasis : curveMonotoneX;
  const { maxShare, maxFt, stops, id: gradientId } = signatureGradient(points, o.fill ?? diffScale());
  const half = o.halfWidth ?? ((p: SignaturePoint, m: number) => Math.max((p.share / m) * 20, 0.75));
  const g = sel.append("g").attr("class", "sdv-signature");
  if (o.league ?? true) {
    for (const strong of [false, true]) {
      const l = line<SignaturePoint>()
        .defined((p) => p.leagueFgPct !== null && (!strong || p.fgPct !== null))
        .x((p) => o.x(p.distance))
        .y((p) => o.y(p.leagueFgPct ?? 0))
        .curve(curve);
      g.append("path")
        .attr("d", l([...points]) ?? "")
        .style("fill", "none")
        .style("stroke", MUTED)
        .style("stroke-opacity", strong ? 1 : 0.4)
        .style("stroke-dasharray", "3 3");
    }
  }
  const [x1, x2] = [String(o.x(0)), String(o.x(maxFt))];
  const id = gradientId(x1, x2);
  const grad = g
    .append("defs")
    .append("linearGradient")
    .attr("id", id)
    .attr("gradientUnits", "userSpaceOnUse")
    .attr("x1", x1)
    .attr("x2", x2)
    .attr("y1", "0")
    .attr("y2", "0");
  for (const [offset, colour] of stops)
    grad.append("stop").attr("offset", `${offset}%`).attr("stop-color", colour);
  const ribbon = area<SignaturePoint>()
    .defined((p) => p.fgPct !== null)
    .x((p) => o.x(p.distance))
    .y0((p) => o.y(p.fgPct ?? 0) + half(p, maxShare))
    .y1((p) => o.y(p.fgPct ?? 0) - half(p, maxShare))
    .curve(curve);
  g.append("path")
    .attr("d", ribbon([...points]) ?? "")
    .style("fill", `url(#${id})`)
    .style("stroke", "currentColor")
    .style("stroke-opacity", 0.2)
    .style("stroke-width", 0.5);
  return g;
}
