/**
 * The TradingView Lightweight Charts adapter: chart options that keep TradingView's attribution on, team-coloured
 * series options with prices read as probabilities or odds, and team logos drawn at points by a series primitive.
 * Pure: lightweight-charts is never imported (the types here are structural, read from lightweight-charts 5.2.1), so
 * everything can be built anywhere, a server included; only `createChart(...)` needs a browser. Call after
 * `loadLeague(league)` / `preloadAll()`.
 *
 * Lightweight Charts is Apache-2.0 and asks every page that shows it for TradingView's attribution notice
 * (`TRADINGVIEW_NOTICE`) and a link to https://www.tradingview.com/. `withAttribution` keeps the library's own
 * attribution logo on, which is that link, and `attributionNotice` puts the notice on the page.
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
import { InputError, warn } from "./errors.js";
import { resolveSync } from "./resolve.js";
import type { Value } from "./resolve.js";
import { teamPalette } from "./team-palette.js";
import type { IdSystem, League, SeasonInput, Which } from "./types.js";
export type { DrawnMark, MarkOptions, Row } from "./_web.js";

/**
 * TradingView's attribution notice: the NOTICE file of tradingview/lightweight-charts at v5.2.1, verbatim (its "с" is
 * the Cyrillic letter, as upstream writes it). Lightweight Charts' licence asks for it, and a link to
 * https://www.tradingview.com/, on the page that shows the chart.
 */
export const TRADINGVIEW_NOTICE =
  "TradingView Lightweight Charts™\nCopyright (с) 2025 TradingView, Inc. https://www.tradingview.com/";

/** `withAttribution` options. */
export interface AttributionOptions {
  /**
   * `true` turns TradingView's attribution logo off. Pass it only when the page already shows TradingView's
   * attribution notice and a link to https://www.tradingview.com/ elsewhere: meeting Lightweight Charts' licence is
   * then on you. Anything but `true` (or `false`, the default) throws.
   */
  attributedElsewhere?: boolean;
}

/**
 * Chart options for `createChart` with TradingView's attribution logo on (`layout.attributionLogo: true`), the
 * library's own link to https://www.tradingview.com/ that its licence asks for. The options are copied, never changed;
 * the rest of them is kept. A `layout.attributionLogo: false` in them is turned back on, with one warning: only the
 * explicit `{ attributedElsewhere: true }` turns it off, and the licence is then the caller's to meet.
 *
 * @example
 * ```ts
 * import { attributionNotice, withAttribution } from "@sportsdataverse/sdvplot/lightweight-charts";
 * import { createChart } from "lightweight-charts";
 *
 * const el = document.body.appendChild(document.createElement("div"));
 * // the chart, with TradingView's logo (its link) on it, and TradingView's notice on the page
 * const chart = createChart(el, withAttribution({ width: 640, height: 320 }));
 * const notice = attributionNotice(el.parentElement ?? el);
 * [chart.options().layout.attributionLogo, notice.textContent];
 * ```
 */
export function withAttribution<F extends object = Record<never, never>>(
  chartOptions?: F,
  o: AttributionOptions = {},
): F & { layout: { attributionLogo: boolean } } {
  const off = o.attributedElsewhere;
  if (off !== undefined && typeof off !== "boolean")
    throw new InputError(
      `attributedElsewhere is true (your page attributes TradingView itself) or left out, not ${JSON.stringify(off)}`,
    );
  const opts = (chartOptions ?? {}) as F & { layout?: { attributionLogo?: unknown } };
  if (off !== true && opts.layout?.attributionLogo === false)
    warn(
      "lightweight-charts:attribution",
      "layout.attributionLogo: false was turned back on: Lightweight Charts' licence asks for TradingView's notice and link. Pass { attributedElsewhere: true } only if your page shows both itself",
    );
  return { ...opts, layout: { ...opts.layout, attributionLogo: off !== true } };
}

/**
 * Puts TradingView's attribution notice on the page, as Lightweight Charts' licence asks: a `<p>` appended to
 * `container`, holding `TRADINGVIEW_NOTICE` (its URL a link, its two lines kept), and returned. Idempotent: called
 * again on the same container it returns the notice already there rather than adding a second. Give it the element
 * around the chart (`el.parentElement ?? el` for the chart's own `el`), so the notice sits under the chart. On a
 * server (no `document`) it does nothing and returns `container`. `withAttribution`'s example draws a chart with it.
 *
 * @example
 * ```ts
 * import { TRADINGVIEW_NOTICE, attributionNotice } from "@sportsdataverse/sdvplot/lightweight-charts";
 *
 * const figure = document.body.appendChild(document.createElement("figure"));
 * const notice = attributionNotice(figure);
 * // once per container, and exactly TradingView's notice
 * [attributionNotice(figure) === notice, notice.textContent === TRADINGVIEW_NOTICE];
 * ```
 */
export function attributionNotice(container: HTMLElement): HTMLElement {
  if (typeof document === "undefined") return container;
  for (const c of Array.from(container.children))
    if (c instanceof HTMLElement && c.dataset.sdvAttribution === "tradingview") return c;
  const doc = container.ownerDocument;
  const url = "https://www.tradingview.com/";
  const p = doc.createElement("p");
  p.dataset.sdvAttribution = "tradingview";
  p.style.whiteSpace = "pre-line"; // the notice's two lines
  const a = doc.createElement("a");
  a.href = url;
  a.textContent = url;
  p.append(TRADINGVIEW_NOTICE.slice(0, -url.length), a);
  container.append(p);
  return p;
}

/** What a price is: a probability (a fraction in [0, 1], read as a percentage) or American odds (-110, +150). */
export type PriceUnits = "probability" | "american";
const UNITS: readonly PriceUnits[] = ["probability", "american"];
const checkUnits = (u: unknown): PriceUnits | undefined => {
  if (u === undefined || UNITS.includes(u as PriceUnits)) return u as PriceUnits | undefined;
  throw new InputError(`units is "probability" or "american", not ${JSON.stringify(u)}`);
};
const percent = (p: number): string => `${Number((p * 100).toFixed(1))}%`;
/** American odds as text: rounded half away from zero, signed, and "0" (never "+0" or "-0") for a zero. */
const american = (v: number): string => {
  const r = Math.sign(v) * Math.round(Math.abs(v));
  return r === 0 ? "0" : `${r > 0 ? "+" : ""}${r}`;
};

/** A Lightweight Charts custom price format. */
export interface LwcPriceFormat {
  /** Always "custom": the formatter reads the prices. */
  type: "custom";
  /** A price as text: "58.5%" for a probability, "+150" for American odds. */
  formatter: (price: number) => string;
  /** The smallest price step: 0.001 for a probability (0.1%), 1 for American odds. */
  minMove: number;
}
/** What `teamSeriesOptions` returns: a LineSeries' options. */
export interface LwcTeamSeriesOptions {
  /** The line's colour, `#rrggbb`. */
  color: string;
  /** With `units`: how the price scale, the crosshair label and the last-value label read the prices. */
  priceFormat?: LwcPriceFormat;
}
/** `teamSeriesOptions` options. */
export interface TeamSeriesOptions {
  /** The league the team belongs to, e.g. "nfl". */
  league: League;
  /** Every team on the chart, in order (the team itself among them), so that with `background` each gets its own
   *  colour. Default: the team alone. */
  teams?: readonly Value[];
  /** What the prices are: "probability" (a fraction in [0, 1], read "58.5%") or "american" (odds, read "+150").
   *  Default: Lightweight Charts' own number format. */
  units?: PriceUnits;
  /** The season the team is resolved (and coloured) for. */
  season?: SeasonInput;
  /** "primary" (default) or "secondary". */
  which?: Which;
  /** How the team values are read. Default "auto". */
  idSystem?: IdSystem;
  /** The colour of a team that does not resolve. Default "#808080". */
  fallback?: string;
  /**
   * The chart's background. Given, every colour keeps 3:1 contrast against it (dark mode): a team colour under that
   * is swapped for the team's other colour, else moved towards white (on a dark background) or black (a light one)
   * until it reads. A colour that would then sit too close to an earlier team's in `teams` (CIE76 ΔE under 20) takes
   * the team's other colour, or the nearest colour to its own (lightness, hue or chroma stepped) that is distinct and
   * still reads; failing that it is kept, with one warning.
   */
  background?: string;
}

/**
 * A LineSeries' options in a team's colour, for `chart.addSeries(LineSeries, ...)`. With `units`, the prices read as
 * probabilities ("58.5%") or American odds ("+150", "-120") on the price scale, the crosshair and the last-value line.
 * With `background`, the colour keeps 3:1 contrast against it and aims to stay distinct from the other `teams` on the
 * chart (when it cannot, it keeps the readable colour and warns once).
 * A team that does not resolve takes `fallback` and warns; it never moves a real team's colour.
 *
 * @example
 * ```ts
 * import { loadLeague } from "@sportsdataverse/sdvplot";
 * import { teamSeriesOptions } from "@sportsdataverse/sdvplot/lightweight-charts";
 *
 * await loadLeague("nfl");
 * const teams = ["PHI", "KC"];
 * const phi = teamSeriesOptions("PHI", { league: "nfl", teams, units: "probability", background: "#181a1b" });
 * // in the browser: chart.addSeries(LineSeries, phi)
 * [phi.color, phi.priceFormat?.formatter(0.5846)];
 * ```
 */
export function teamSeriesOptions(team: Value, o: TeamSeriesOptions): LwcTeamSeriesOptions {
  const units = checkUnits(o.units);
  const teams = o.teams ?? [team];
  const at = teams.indexOf(team);
  if (at < 0) throw new InputError(`team ${JSON.stringify(team)} is not in teams ${JSON.stringify(teams)}`);
  const fallback = hex6(o.fallback ?? "#808080", { dropAlpha: true });
  const season = o.season === undefined ? {} : { season: o.season };
  const ids = resolveSync(teams, o.league, {
    ...season,
    ...(o.idSystem === undefined ? {} : { idSystem: o.idSystem }),
  });
  const id = ids[at];
  let color = fallback;
  if (id !== undefined && id !== null) {
    // the palette runs over the resolved teams only: an unresolved one never moves a real team's colour
    const known = [...new Set(ids.filter((x): x is NonNullable<typeof x> => x !== undefined && x !== null))];
    const which = o.which ?? "primary";
    const co = { ...season, idSystem: "team_id" as const };
    const main = colorList(o.league, known, { ...co, which });
    const other = colorList(o.league, known, { ...co, which: which === "primary" ? "secondary" : "primary" });
    let colors = main.map((c, i) => hex6(c ?? other[i] ?? fallback, { dropAlpha: true }));
    if (o.background !== undefined) colors = teamPalette(colors, other, hex6(o.background), known);
    color = colors[known.indexOf(id)] as string;
  }
  if (units === undefined) return { color };
  return {
    color,
    priceFormat:
      units === "probability"
        ? { type: "custom", formatter: percent, minMove: 0.001 }
        : { type: "custom", formatter: american, minMove: 1 },
  };
}

/** A Lightweight Charts time: a UTC timestamp in seconds, a "yyyy-mm-dd" string or a business day. */
export type LwcTime = number | string | { year: number; month: number; day: number };
/** The parts of what Lightweight Charts attaches a series primitive with that `logoMarkers` reads. */
export interface LwcAttached {
  /** The chart: its time scale places `x`. */
  chart: { timeScale(): { timeToCoordinate(time: LwcTime): number | null } };
  /** The series the primitive is attached to: its price scale places `y`. */
  series: { priceToCoordinate(price: number): number | null };
  /** Asks the chart to redraw. */
  requestUpdate: () => void;
}
/** The drawing target Lightweight Charts hands a primitive's renderer (fancy-canvas' `CanvasRenderingTarget2D`). */
export interface LwcRenderTarget {
  /** Calls `f` with the 2D context scaled to CSS pixels and the pane's size in them. */
  useMediaCoordinateSpace<T>(
    f: (scope: { context: CanvasRenderingContext2D; mediaSize: { width: number; height: number } }) => T,
  ): T;
}
/** A Lightweight Charts series primitive: attach it with `series.attachPrimitive(primitive)`. */
export interface LwcSeriesPrimitive {
  /** Lightweight Charts calls this on `attachPrimitive`: the logos start loading. */
  attached(param: LwcAttached): void;
  /** Lightweight Charts calls this on `detachPrimitive`: the chart is forgotten, nothing more is drawn, and
   *  `drawnMarks` reads empty. */
  detached(): void;
  /** Lightweight Charts calls this when the view changes; the logos are placed at each draw, so it does nothing. */
  updateAllViews(): void;
  /** The one pane view, whose renderer paints the logos (the same array every call, as the library asks). */
  paneViews(): readonly { renderer(): { draw(target: LwcRenderTarget): void } | null }[];
}
/** `logoMarkers` options: the spec adapters' mark options, less `embed`, plus what the prices are. */
export interface LogoMarkersOptions extends Omit<MarkOptions, "embed"> {
  /** What `y` is: "probability" values must be fractions in [0, 1], "american" values -100 or less or +100 or more. */
  units?: PriceUnits;
}

// ponytail: a WeakMap per primitive of what it last drew, so drawnMarks reads what reached the canvas
const drawn = new WeakMap<LwcSeriesPrimitive, DrawnMark[]>();

/**
 * Team logos on a Lightweight Charts series: a series primitive (`series.attachPrimitive(...)`) whose renderer paints
 * each row's logo centred on its `x` (a time, as in the series' data) and `y` (a price on the series' scale), placed
 * with the chart's own `timeToCoordinate` / `priceToCoordinate`, `height` of the pane tall (a fraction, as in the spec
 * adapters). Lightweight Charts' series markers draw only shapes and text, so logos take a primitive. The images start
 * loading when it is attached, and the chart redraws as each one lands; building it fetches nothing. A team with no
 * logo draws nothing and warns once, as `sdvplot/echarts` does; an image that fails to load is never drawn and warns
 * once; a row at a time the chart has no point for, or off the pane, is not drawn.
 *
 * @example
 * ```ts
 * import { loadLeague } from "@sportsdataverse/sdvplot";
 * import { logoMarkers } from "@sportsdataverse/sdvplot/lightweight-charts";
 *
 * await loadLeague("nfl");
 * // Super Bowl LIX's final reading (ESPN): 3600 seconds played, Philadelphia's win probability 1
 * const rows = [{ t: 3600, wp: 1, team: "PHI" }];
 * const logos = logoMarkers(rows, { x: "t", y: "wp", team: "team", league: "nfl", units: "probability" });
 * // in the browser: series.attachPrimitive(logos)
 * typeof logos.paneViews;
 * ```
 */
export function logoMarkers(rows: readonly Row[], o: LogoMarkersOptions): LwcSeriesPrimitive {
  const h = checkHeight(o.height ?? 0.1);
  const a = checkAlpha(o.alpha ?? 1);
  const units = checkUnits(o.units);
  if (units !== undefined)
    for (const r of rows) {
      // a missing y is left to markPlacements, which skips the row with one warning (Number(null) is 0, a "probability")
      if (r[o.y] === undefined || r[o.y] === null) continue;
      const v = Number(r[o.y]);
      if (units === "probability" && !(v >= 0 && v <= 1))
        throw new InputError(
          `a probability is a fraction in [0, 1], not ${r[o.y]} (a percent? divide it by 100)`,
        );
      if (units === "american" && !(Math.abs(v) >= 100))
        throw new InputError(`American odds are -100 or less or +100 or more, not ${r[o.y]} (decimal odds?)`);
    }
  const ps = markPlacements(rows, "logo", o); // validates the rows (and warns on a team with no logo) now
  const images = new Map<string, HTMLImageElement | null>(); // null: it failed to load
  let at: LwcAttached | undefined;
  const load = (url: string): void => {
    if (images.has(url) || typeof Image === "undefined") return;
    const img = new Image();
    img.crossOrigin = "anonymous"; // keeps the canvas exportable
    images.set(url, img);
    img.onload = () => at?.requestUpdate();
    img.onerror = () => {
      images.set(url, null);
      warn(`lightweight-charts:image:${url}`, `could not load ${url}, so it is not drawn`);
    };
    img.src = url;
  };
  const draw = (target: LwcRenderTarget): void => {
    const c = at;
    if (c === undefined) return;
    target.useMediaCoordinateSpace(({ context: ctx, mediaSize }) => {
      const out: DrawnMark[] = [];
      const ph = h * mediaSize.height;
      ctx.save();
      ctx.globalAlpha = a;
      for (const p of ps) {
        const img = images.get(p.url);
        if (!img?.complete || img.naturalWidth === 0) continue;
        const cx = c.chart.timeScale().timeToCoordinate(p.x as LwcTime);
        const cy = c.series.priceToCoordinate(Number(p.y));
        if (cx === null || cy === null) continue;
        if (!(cx >= 0 && cx <= mediaSize.width && cy >= 0 && cy <= mediaSize.height)) continue; // also drops NaN
        const pw = ph * aspect(p);
        ctx.drawImage(img, cx - pw / 2, cy - ph / 2, pw, ph);
        out.push([p.id, p.x, p.y, h, p.url]);
      }
      ctx.restore();
      drawn.set(primitive, out);
    });
  };
  const views = [{ renderer: () => ({ draw }) }] as const; // the same array every time, as the library asks
  const primitive: LwcSeriesPrimitive = {
    attached(param) {
      at = param;
      for (const p of ps) load(p.url);
      param.requestUpdate(); // logos loaded before (attached again) draw now, not at the next unrelated redraw
    },
    detached() {
      at = undefined;
      drawn.delete(primitive);
    },
    updateAllViews() {},
    paneViews: () => views,
  };
  return primitive;
}

/** Test hook: [teamId, x, y, height, url] per logo the primitive last drew, `height` a fraction of the pane. */
export function drawnMarks(primitive: LwcSeriesPrimitive): DrawnMark[] {
  return [...(drawn.get(primitive) ?? [])];
}
