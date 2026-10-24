/**
 * The uPlot adapter: team colours for each series' `stroke` / `fill`, and team logos drawn on uPlot's canvas by a
 * plugin (its `draw` hook), at points in data units. Pure: uplot is never imported (the types here are structural,
 * read from uplot 1.6.31 and later), so the options can be built anywhere, a server included; only `new uPlot(...)`
 * needs a browser. Call after `loadLeague(league)` / `preloadAll()`.
 */
import {
  type MarkOptions,
  type Row,
  aspect,
  checkAlpha,
  checkHeight,
  colorList,
  markPlacements,
} from "./_web.js";
import type { DrawnMark } from "./_web.js";
import { hex6 } from "./contrast.js";
import { InputError, UnsupportedTargetError, warn } from "./errors.js";
import type { Placement } from "./placement.js";
import { teamPalette } from "./team-palette.js";
import type { IdSystem, League, SeasonInput, Which } from "./types.js";
export type { DrawnMark, MarkOptions, Row } from "./_web.js";

/** The subset of a uPlot chart this adapter reads: `new uPlot(...)` is one. */
export interface UPlotLike {
  /** The canvas' 2D context. */
  readonly ctx: CanvasRenderingContext2D;
  /** The plot area in canvas pixels. */
  readonly bbox: { left: number; top: number; width: number; height: number };
  /** The chart's data: x values first, then one array per series. */
  readonly data: readonly ArrayLike<number | null | undefined>[];
  /** A value on scale `scaleKey` as a position (canvas pixels with `canvasPixels`). */
  valToPos(val: number, scaleKey: string, canvasPixels?: boolean): number;
  /** Redraws the chart (`rebuildPaths: false` reuses the series paths). */
  redraw(rebuildPaths?: boolean, recalcAxes?: boolean): void;
}
/** A uPlot plugin: put it in the options' `plugins`. */
export interface UPlotPlugin {
  /** `init` registers the chart (for redraws as images land), `draw` paints the logos, `destroy` forgets the chart. */
  hooks: {
    init: (u: UPlotLike) => void;
    draw: (u: UPlotLike) => void;
    destroy: (u: UPlotLike) => void;
  };
}

/** `logoPlugin` options: the spec adapters' mark options, less `embed`, plus the y scale. */
export interface UPlotLogoOptions extends Omit<MarkOptions, "embed"> {
  /** The scale key the `y` values are on. Default "y". (`x` is on uPlot's "x" scale; a time scale counts seconds.) */
  scale?: string;
}

// ponytail: a WeakMap per chart of what each plugin last drew, so drawnMarks reads what reached the canvas
const drawn = new WeakMap<object, Map<object, DrawnMark[]>>();

/**
 * Team logos on a uPlot chart: a plugin whose `draw` hook paints each row's logo centred on its `x` / `y` (data units,
 * placed with uPlot's own `valToPos`), `height` of the plot area tall (a fraction, as in the spec adapters), over the
 * series. The images start loading when the chart starts (uPlot's `init` hook, before its first draw), and the
 * chart redraws as each one lands; building the plugin fetches nothing. A team with no logo draws nothing and warns
 * once, as `sdvplot/echarts` does; an image that fails to load is never drawn and warns once; a point outside the plot
 * area (after a zoom) is not drawn over the axes.
 *
 * `rows` can also be a function of the chart, read at every draw: give it `u.data` and the logos follow live data
 * (`u.setData(...)`), such as a logo at each line's newest point.
 *
 * @example
 * ```ts
 * import { loadLeague } from "@sportsdataverse/sdvplot";
 * import { logoPlugin } from "@sportsdataverse/sdvplot/uplot";
 *
 * await loadLeague("nfl");
 * // the 2024 Chiefs and Bills: points for (x) against points against (y)
 * const rows = [
 *   { team: "KC", pf: 385, pa: 326 },
 *   { team: "BUF", pf: 525, pa: 368 },
 * ];
 * const plugin = logoPlugin(rows, { x: "pf", y: "pa", team: "team", league: "nfl", height: 0.15 });
 * // in the browser: new uPlot({ width: 640, height: 320, series, plugins: [plugin] }, data, element)
 * Object.keys(plugin.hooks);
 * ```
 */
export function logoPlugin(
  rows: readonly Row[] | ((u: UPlotLike) => readonly Row[]),
  o: UPlotLogoOptions,
): UPlotPlugin {
  const h = checkHeight(o.height ?? 0.1);
  const a = checkAlpha(o.alpha ?? 1);
  const yScale = o.scale ?? "y";
  // ponytail: one cached placement per rows identity; a rows function returning a fresh array re-resolves its teams
  // every draw, cheap for a few end logos (memoise by team if a feed ever draws hundreds)
  let placed: { rows: readonly Row[]; ps: Placement[] } | undefined;
  const placements = (rs: readonly Row[]): Placement[] => {
    if (placed?.rows !== rs) placed = { rows: rs, ps: markPlacements(rs, "logo", o) };
    return placed.ps;
  };
  const token = {}; // this plugin's key in `drawn`
  const charts = new Set<UPlotLike>();
  const images = new Map<string, HTMLImageElement | null>(); // null: it failed to load
  const load = (url: string): HTMLImageElement | null | undefined => {
    if (images.has(url) || typeof Image === "undefined") return images.get(url);
    const img = new Image();
    img.crossOrigin = "anonymous"; // keeps the canvas exportable
    images.set(url, img);
    img.onload = () => {
      for (const u of charts) u.redraw(false);
    };
    img.onerror = () => {
      images.set(url, null);
      warn(`uplot:image:${url}`, `could not load ${url}, so it is not drawn`);
    };
    img.src = url;
    return img;
  };
  const preload = (): void => {
    if (typeof rows !== "function") for (const p of placements(rows)) load(p.url);
  };
  if (typeof rows !== "function") placements(rows); // validates the rows now, when the options are built
  return {
    hooks: {
      init(u) {
        charts.add(u);
        preload();
      },
      destroy(u) {
        charts.delete(u);
      },
      draw(u) {
        const { ctx, bbox } = u;
        const out: DrawnMark[] = [];
        const ph = h * bbox.height;
        ctx.save();
        ctx.globalAlpha = a;
        for (const p of placements(typeof rows === "function" ? rows(u) : rows)) {
          const img = load(p.url);
          if (!img?.complete || img.naturalWidth === 0) continue;
          const cx = u.valToPos(Number(p.x), "x", true);
          const cy = u.valToPos(Number(p.y), yScale, true);
          const inside =
            cx >= bbox.left && cx <= bbox.left + bbox.width && cy >= bbox.top && cy <= bbox.top + bbox.height;
          if (!inside) continue; // also drops NaN
          const pw = ph * aspect(p);
          ctx.drawImage(img, cx - pw / 2, cy - ph / 2, pw, ph);
          out.push([p.id, p.x, p.y, h, p.url]);
        }
        ctx.restore();
        const byPlugin = drawn.get(u) ?? new Map<object, DrawnMark[]>();
        byPlugin.set(token, out);
        drawn.set(u, byPlugin);
      },
    },
  };
}

/** Test hook: [teamId, x, y, height, url] per logo the chart's `logoPlugin`s last drew, `height` a fraction of the
 *  plot area. */
export function drawnMarks(u: UPlotLike): DrawnMark[] {
  return [...(drawn.get(u)?.values() ?? [])].flat();
}

/** `withTeamSeries` options. */
export interface UPlotSeriesOptions {
  /** Name of the row column holding the team (abbreviation, name or id; see `idSystem`). */
  team: string;
  /** The league the teams belong to, e.g. "nfl". */
  league: League;
  /** The season the teams are resolved (and coloured) for. */
  season?: SeasonInput;
  /** "primary" (default) or "secondary". */
  which?: Which;
  /** How the `team` values are read. Default "auto". */
  idSystem?: IdSystem;
  /** The colour of an unresolved team. Default "#808080". */
  fallback?: string;
  /**
   * The chart's background. Given, a team colour under 3:1 contrast against it is swapped for the team's other
   * colour, else moved towards white (on a dark background) or black (a light one) until it reads: dark mode. A
   * colour that would then sit too close to an earlier team's (CIE76 ΔE under 20) takes the team's other colour, or
   * the nearest colour to its own (lightness, hue or chroma stepped) that is distinct and still reads; failing that it
   * is kept, with one warning.
   */
  background?: string;
  /** Also fill the area under each line in its colour, at this opacity in [0, 1]. Default: no fill. */
  fill?: number;
}
const rgba = (hex: string, alpha: number): string => {
  const n = Number.parseInt(hex.slice(1), 16);
  return `rgba(${n >> 16}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
};

/**
 * Team colours for a uPlot chart's series: row `i`'s team strokes `series[i + 1]` (series 0 is uPlot's x), and with
 * `fill` also fills the area under it. The rest of each series is kept and the options are copied, never changed. With
 * `background`, every colour keeps 3:1 contrast against it (dark mode) and aims to stay distinct from the others (when
 * it cannot, it keeps the readable colour and warns once).
 *
 * @example
 * ```ts
 * import { loadLeague } from "@sportsdataverse/sdvplot";
 * import { withTeamSeries } from "@sportsdataverse/sdvplot/uplot";
 *
 * await loadLeague("nfl");
 * withTeamSeries(
 *   { width: 640, height: 320, series: [{}, { label: "Kansas City" }, { label: "Buffalo" }] },
 *   [{ team: "KC" }, { team: "BUF" }],
 *   { team: "team", league: "nfl", background: "#181a1b" },
 * );
 * ```
 */
export function withTeamSeries<F extends object>(opts: F, rows: readonly Row[], o: UPlotSeriesOptions): F {
  const series = (opts as { series?: unknown } | null)?.series;
  if (typeof opts !== "object" || opts === null || !Array.isArray(series))
    throw new UnsupportedTargetError("sdvplot/uplot colours a uPlot options object with a `series` array");
  if (rows.length > series.length - 1)
    throw new InputError(
      `${rows.length} rows for ${series.length - 1} data series: row i colours series[i + 1] (series[0] is x)`,
    );
  const fill = o.fill === undefined ? undefined : checkAlpha(o.fill);
  const teams = rows.map((r) => r[o.team]);
  if (rows.length > 0 && !rows.some((r) => o.team in r))
    throw new InputError(`team column ${JSON.stringify(o.team)} is not in rows`);
  const co = {
    ...(o.season === undefined ? {} : { season: o.season }),
    ...(o.idSystem === undefined ? {} : { idSystem: o.idSystem }),
  };
  const fallback = o.fallback ?? "#808080";
  const main = colorList(o.league, teams, { ...co, ...(o.which === undefined ? {} : { which: o.which }) });
  const bg = o.background === undefined ? undefined : hex6(o.background);
  const other =
    bg === undefined
      ? []
      : colorList(o.league, teams, { ...co, which: o.which === "secondary" ? "primary" : "secondary" });
  const colors = main.map((c) => hex6(c ?? fallback, { dropAlpha: true }));
  const strokes = bg === undefined ? colors : teamPalette(colors, other, bg, teams.map(String));
  const out = series.map((s: unknown, i) => {
    const stroke = strokes[i - 1];
    if (stroke === undefined) return s;
    return { ...(s as object), stroke, ...(fill === undefined ? {} : { fill: rgba(stroke, fill) }) };
  });
  return { ...opts, series: out };
}
