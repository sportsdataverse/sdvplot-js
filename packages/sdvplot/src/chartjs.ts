/**
 * Chart.js 4 helpers: team logo / wordmark / headshot point styles, axis-tick logos, faint logo watermarks and team
 * colours. `chart.js` is a type-only import (optional peer, 4.4 or later): everything here is a dataset option or a plugin
 * object, so Svelte, Astro, React or plain scripts pass it to `new Chart(...)` unchanged.
 * Call after `loadLeague(league)` / `preloadAll()`; point styles and plugins need a DOM (build them client-side).
 */
import type { Chart, Plugin, PointStyle, Scale, Tick } from "chart.js";
import { teamColorsSync } from "./colors.js";
import { contrast, hex6, onColor } from "./contrast.js";
import { InputError, UnsupportedTargetError, warn } from "./errors.js";
import type { EspnHeadshotLeague } from "./headshots.js";
import { type Kind, type PlaceOptions, checkAlpha, placeSync } from "./placement.js";
import type { Value } from "./resolve.js";
import type { HeadshotIdSystem, IdSystem, League, SeasonInput, Variant, Which } from "./types.js";

export interface PointOptions {
  league: League;
  /** Half the image height in px; also the dataset's `pointRadius` (hit area). Default 12. */
  radius?: number;
  season?: SeasonInput | readonly SeasonInput[];
  variant?: Variant;
  idSystem?: IdSystem;
  /** What an unresolved value draws: `"text"` (its own label, the default) or any Chart.js point style. */
  fallback?: PointStyle | "text";
  /** The chart's background colour, so the text fallback reads on it (default white, or black with `variant: "dark"`). */
  background?: string;
}
export interface HeadshotPointOptions {
  league: EspnHeadshotLeague;
  radius?: number;
  idSystem?: HeadshotIdSystem;
  fallback?: PointStyle | "text";
  /** The chart's background colour, so the text fallback reads on it (default white). */
  background?: string;
}
/** Spread into a scatter / bubble / line dataset: one style per data point, in data order. */
export interface PointStyles {
  pointStyle: PointStyle[];
  pointRadius: number;
}

function needDom(what: string): Document {
  if (typeof document === "undefined")
    throw new UnsupportedTargetError(
      `${what} needs a DOM: build it in the browser (onMount, $effect, an Astro client:only island), not during SSR`,
    );
  return document;
}
function checkSize(size: number, what: string): number {
  if (!(Number.isFinite(size) && size > 0))
    throw new InputError(`${what} is an image height in px > 0, got ${size}`);
  return size;
}
// ponytail: unbounded cache keyed by size + url; a page holds a few hundred marks at most.
const images = new Map<string, HTMLImageElement>();
function image(url: string, h: number, aspect: number): HTMLImageElement {
  const w = Math.round(h * aspect);
  const key = `${w}x${h} ${url}`;
  let img = images.get(key);
  if (img === undefined) {
    img = needDom("an image point style").createElement("img");
    img.width = w; // Chart.js draws an image point style at the element's own width x height
    img.height = h;
    img.crossOrigin = "anonymous"; // keeps chart.toBase64Image() usable
    img.src = url;
    images.set(key, img);
  }
  return img;
}
/** Game on Paper's light-theme or dark-theme canvas text colour, whichever reads better on `background`. */
function textInk(background: string): string {
  return contrast("#555555", background) >= contrast("#e8e6e3", background) ? "#555555" : "#e8e6e3";
}
function textStyle(label: string, h: number, ink: string): HTMLCanvasElement | "circle" {
  const c = needDom("a text point style").createElement("canvas");
  const g = c.getContext("2d");
  if (g === null) return "circle";
  const font = `bold ${Math.round(h * 0.45)}px sans-serif`;
  g.font = font;
  c.width = Math.max(h, Math.ceil(g.measureText(label).width) + 4);
  c.height = h;
  g.font = font; // resizing a canvas resets its context
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.fillStyle = ink;
  g.fillText(label, c.width / 2, h / 2);
  return c;
}
/** One image per resolvable value at `h` px tall, indexed like `values` (gaps where nothing can be drawn); warns once per call (J28). */
function imagesFor(
  values: readonly Value[],
  h: number,
  place: PlaceOptions,
): (HTMLImageElement | undefined)[] {
  const out = new Array<HTMLImageElement | undefined>(values.length);
  // The row index as x keeps data order; placeSync drops what it cannot draw and warns once per call (J28).
  const idx = values.map((_, i) => i);
  for (const p of placeSync(idx, idx, values, place)) out[p.index] = image(p.url, h, p.aspect ?? 1);
  return out;
}
function points(
  values: readonly Value[],
  kind: Kind,
  radius: number | undefined,
  fallback: PointStyle | "text" | undefined,
  background: string | undefined,
  place: PlaceOptions,
): PointStyles {
  needDom("point styles"); // before resolving, so SSR fails without a resolve warning
  const r = radius ?? 12;
  if (!(Number.isFinite(r) && r > 0))
    throw new InputError(`radius is a point radius in px > 0, got ${String(radius)}`);
  const ink = textInk(background ?? (place.variant === "dark" ? "#000000" : "#ffffff")); // a bad colour throws here
  const styles = new Array<PointStyle>(values.length);
  imagesFor(values, 2 * r, { ...place, kind }).forEach((img, i) => {
    if (img !== undefined) styles[i] = img;
  });
  for (let i = 0; i < values.length; i++)
    styles[i] ??=
      fallback === undefined || fallback === "text"
        ? textStyle(String(values[i] ?? ""), 2 * r, ink)
        : fallback;
  return { pointStyle: styles, pointRadius: r };
}
function teamPoints(teams: readonly Value[], kind: "logo" | "wordmark", o: PointOptions): PointStyles {
  const { league, radius, fallback, background, ...rest } = o;
  return points(teams, kind, radius, fallback, background, { league, ...rest });
}
/** Team logos as point styles: `{ data, ...logoPoints(teams, { league: "nfl", radius: 12 }) }`. Add `pointImages` to `plugins`. */
export function logoPoints(teams: readonly Value[], o: PointOptions): PointStyles {
  return teamPoints(teams, "logo", o);
}
/** As `logoPoints`, with wordmarks. */
export function wordmarkPoints(teams: readonly Value[], o: PointOptions): PointStyles {
  return teamPoints(teams, "wordmark", o);
}
/** ESPN player headshots as point styles; `idSystem: "gsis"` needs `loadGsis()` first. */
export function headshotPoints(players: readonly Value[], o: HeadshotPointOptions): PointStyles {
  return points(players, "headshot", o.radius, o.fallback, o.background, {
    league: o.league,
    idSystem: o.idSystem ?? "espn",
  });
}

const redraws = new WeakMap<Chart, { redraw: () => void; stop: AbortController }>();
const isImage = (v: unknown): v is HTMLImageElement =>
  Object.prototype.toString.call(v) === "[object HTMLImageElement]"; // Chart.js's own test (drawPointLegend)
/** Redraw `chart` once `img` loads; one listener per (image, chart) because addEventListener ignores a repeat. */
function redrawOnLoad(chart: Chart, img: HTMLImageElement): void {
  if (img.complete) return;
  let r = redraws.get(chart);
  if (r === undefined) {
    r = {
      redraw: () => {
        if (chart.ctx) chart.draw(); // null once destroyed
      },
      stop: new AbortController(),
    };
    redraws.set(chart, r);
  }
  img.addEventListener("load", r.redraw, { once: true, signal: r.stop.signal });
}
/** `afterDestroy`: drop the chart's pending load listeners, so a late (or never-loading) image cannot hold or redraw it. */
function forget(chart: Chart): void {
  redraws.get(chart)?.stop.abort();
  redraws.delete(chart);
}
/** Redraws the chart as each image point style finishes loading (Chart.js does not watch them). */
export const pointImages: Plugin = {
  id: "sdvplotPointImages",
  afterDestroy: forget,
  afterDraw(chart) {
    for (const ds of chart.data.datasets) {
      const s = (ds as { pointStyle?: unknown }).pointStyle;
      for (const v of Array.isArray(s) ? s : [s]) if (isImage(v)) redrawOnLoad(chart, v);
    }
  },
};

export interface TeamColorOptions {
  which?: Which;
  season?: SeasonInput;
  idSystem?: IdSystem;
  /** Opacity in [0, 1]; below 1 the colour is written `rgba(r, g, b, a)`. */
  alpha?: number;
  /** The colour of an unresolved team (default `#808080`). */
  fallback?: string;
  /** Return black or white, whichever reads on the team colour (labels, point borders). */
  onColor?: boolean;
}
export type ColorsFor<T> = T extends readonly Value[] ? string[] : string;
/** Team colour(s) for `backgroundColor` / `borderColor`: one team gives one string, an array gives one per team. */
export function teamColor<T extends Value | readonly Value[]>(
  teams: T,
  league: League,
  o: TeamColorOptions = {},
): ColorsFor<T> {
  const { alpha = 1, fallback = "#808080", onColor: ink = false, ...co } = o;
  const a = checkAlpha(alpha);
  const paint = (c: unknown): string => {
    const hex = hex6(typeof c === "string" ? c : fallback, { dropAlpha: true });
    if (ink) return onColor(hex);
    if (a === 1) return hex;
    const n = Number.parseInt(hex.slice(1), 16);
    return `rgba(${n >> 16}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
  };
  const got: unknown = teamColorsSync(league, teams, co);
  return (Array.isArray(got) ? got.map(paint) : paint(got)) as ColorsFor<T>;
}
/** `teamColor` at 0.2 opacity by default: the fill under a radar or area dataset. */
export function teamFill<T extends Value | readonly Value[]>(
  teams: T,
  league: League,
  o: TeamColorOptions = {},
): ColorsFor<T> {
  return teamColor(teams, league, { alpha: 0.2, ...o });
}

export interface AxisLogoOptions {
  league: League;
  /** Image height in px (default 24); the width follows the mark's aspect. */
  size?: number;
  season?: SeasonInput;
  variant?: Variant;
  markType?: "logo" | "wordmark";
  idSystem?: IdSystem;
  /** The category scale's id (default: the axis letter). */
  scaleId?: string;
}
type TickCallback = (this: Scale, value: number | string, index: number, ticks: Tick[]) => unknown;
/**
 * Swap a category axis's tick labels for team logos: resolved labels are painted as images (after the datasets, under
 * the tooltip) and their text is blanked; unresolved labels keep their text, with one warning per distinct label set
 * (J28). Any other scale type is left as it is, with one warning.
 */
export function axisLogos(axis: "x" | "y", o: AxisLogoOptions): Plugin {
  if (axis !== "x" && axis !== "y")
    throw new InputError(`axis must be "x" or "y", got ${JSON.stringify(axis)}`);
  const { league, size = 24, markType = "logo", scaleId = axis, ...rest } = o;
  checkSize(size, "size");
  const byChart = new WeakMap<Chart, { m: Map<string, HTMLImageElement>; band: number }>();
  const bases = new WeakMap<TickCallback, number>(); // each wired callback -> the padding it was wired over
  return {
    id: `sdvplotAxisLogos${axis.toUpperCase()}`,
    afterDestroy: forget,
    beforeUpdate(chart) {
      // Chart.js merges options.scales into a fresh copy on every update (and `chart.options = next` replaces it), so
      // the tick wiring is (re)applied to that copy here, once per copy: never in beforeInit, never the caller's object.
      const conf = chart.config as unknown as {
        options: {
          scales?: Record<string, { type?: string; ticks?: { callback?: TickCallback; padding?: number } }>;
        };
      };
      const scale = conf.options.scales?.[scaleId];
      if (scale?.type !== "category") {
        byChart.delete(chart);
        warn(
          `chartjs:axisLogos:${scaleId}`,
          `axisLogos needs a category scale; scale ${JSON.stringify(scaleId)} is ${scale?.type ?? "missing"}, so its ticks are left as they are`,
        );
        return;
      }
      const labels = (chart.data.labels ?? []).map(String);
      const m = new Map<string, HTMLImageElement>();
      imagesFor(labels, size, { league, kind: markType, ...rest }).forEach((img, i) => {
        if (img !== undefined) m.set(labels[i] ?? "", img);
      });
      // the band the images fill: their height on x, the widest mark on y (a wordmark is several times its height)
      const band = axis === "y" ? Math.max(size, ...[...m.values()].map((img) => img.width)) : size;
      byChart.set(chart, { m, band });
      scale.ticks ??= {};
      const ticks = scale.ticks;
      const user = ticks.callback;
      let base = user === undefined ? undefined : bases.get(user);
      if (base === undefined) {
        base = ticks.padding ?? 3; // 3 = Chart.js's default padding
        const callback: TickCallback = function (this: Scale, value, index, all) {
          const label = this.getLabelForValue(Number(value));
          if (byChart.get(chart)?.m.has(label)) return "";
          return user === undefined ? label : user.call(this, value, index, all);
        };
        bases.set(callback, base);
        ticks.callback = callback;
      }
      ticks.padding = base + band;
    },
    afterDatasetsDraw(chart) {
      const scale = chart.scales[scaleId];
      const got = byChart.get(chart);
      if (scale === undefined || got === undefined) return;
      const { m, band } = got;
      // resolved options: Chart.js has filled every default by draw time
      const { grid, ticks } = scale.options as unknown as {
        grid: { display: boolean; drawTicks: boolean; tickLength: number };
        ticks: { padding: number };
      };
      const gap = (grid.display && grid.drawTicks ? grid.tickLength : 0) + ticks.padding - band;
      scale.ticks.forEach((t, i) => {
        const img = m.get(scale.getLabelForValue(t.value));
        if (img === undefined) return;
        if (!img.complete || img.naturalWidth === 0) return redrawOnLoad(chart, img); // a broken image is skipped
        const at = scale.getPixelForTick(i);
        const { width: w, height: h } = img;
        const x =
          axis === "y" ? (scale.position === "right" ? scale.left + gap : scale.right - gap - w) : at - w / 2;
        const y =
          axis === "x" ? (scale.position === "top" ? scale.bottom - gap - h : scale.top + gap) : at - h / 2;
        chart.ctx.drawImage(img, x, y, w, h);
      });
    },
  };
}

export interface WatermarkOptions {
  league: League;
  /** Image height in px (default 75, Game on Paper's win-probability chart); the width follows the mark's aspect. */
  size?: number;
  /** Opacity of the watermarks (default 0.4). */
  alpha?: number;
  /** Gap in px from the chart area's left edge and from its top / bottom (default 8). */
  inset?: number;
  season?: SeasonInput | readonly SeasonInput[];
  variant?: Variant;
  idSystem?: IdSystem;
}
/**
 * Faint team logos behind the datasets (Game on Paper's win-probability chart): the first team sits top-left of the
 * chart area, the last bottom-left, any between spaced evenly down the left edge, so pass `[home, away]` under a home
 * win-probability line. Unknown teams are skipped with one warning per call (J28); `variant: "dark"` falls back to a
 * light mark by polarity, so no `onerror` retry is needed.
 */
export function logoWatermarks(teams: readonly Value[], o: WatermarkOptions): Plugin {
  needDom("logo watermarks"); // before resolving, so SSR fails without a resolve warning
  const { league, size = 75, alpha = 0.4, inset = 8, ...rest } = o;
  checkSize(size, "size");
  const a = checkAlpha(alpha);
  const imgs = imagesFor(teams, size, { league, kind: "logo", ...rest });
  const n = imgs.length;
  return {
    id: "sdvplotLogoWatermarks",
    afterDestroy: forget,
    beforeDatasetsDraw(chart) {
      const { ctx, chartArea: ar } = chart;
      if (!ar) return; // a draw before the first layout
      ctx.save();
      ctx.globalAlpha = a;
      imgs.forEach((img, i) => {
        if (img === undefined) return;
        if (!img.complete || img.naturalWidth === 0) return redrawOnLoad(chart, img); // a broken image is skipped
        const t = n > 1 ? i / (n - 1) : 0;
        const y = ar.top + inset + t * (ar.bottom - ar.top - 2 * inset - img.height);
        ctx.drawImage(img, ar.left + inset, y, img.width, img.height);
      });
      ctx.restore();
    },
  };
}
