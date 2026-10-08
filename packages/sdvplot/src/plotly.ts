/** The Plotly adapter: logos, wordmarks, headshots and axis logos as layout images on a plain `{ data, layout }` figure.
 *  Pure: plotly.js is never imported at runtime; the figure is a plain object and a NEW one is returned. */
import {
  type AxisOptions,
  type DrawnAxisMark,
  type DrawnMark,
  type HeadshotOptions,
  type MarkOptions,
  type Placement,
  type Row,
  aspect,
  axisLetter,
  axisPlacements,
  checkAlpha,
  checkHeight,
  colorList,
  imageSources,
  markPlacements,
} from "./_web.js";
import { InputError, UnsupportedTargetError, warn } from "./errors.js";
import type { IdSystem, League, SeasonInput } from "./types.js";

export type { AxisOptions, DrawnAxisMark, DrawnMark, HeadshotOptions, MarkOptions, Row } from "./_web.js";
export { embedSources } from "./_web.js"; // public: the README tells callers to build `embed` with it

/** Structural types for a plotly.js figure: the subset `sdvplot/plotly` reads and writes. No runtime import of plotly.js. */
export interface PlotlyAxis {
  type?: "-" | "linear" | "log" | "date" | "category";
  range?: readonly [unknown, unknown];
  autorange?: boolean | "reversed";
  categoryorder?: string;
  categoryarray?: readonly unknown[];
  domain?: readonly [number, number];
  tickmode?: string;
  tickvals?: readonly unknown[];
  ticktext?: readonly string[];
}
export interface LayoutImage {
  source: string;
  xref: string;
  yref: string;
  x: number;
  y: number;
  sizex: number;
  sizey: number;
  sizing: "contain" | "fill" | "stretch";
  xanchor: "left" | "center" | "right";
  yanchor: "top" | "middle" | "bottom";
  opacity?: number;
  layer?: "above" | "below";
  name?: string;
}
// A18: an index-signature pattern may not contain a literal (TS1337), so `xaxis`/`yaxis` are declared and the pattern
// covers the numbered axes only.
export interface PlotlyLayout {
  width?: number;
  height?: number;
  margin?: { l?: number; r?: number; t?: number; b?: number };
  barmode?: string;
  barnorm?: string;
  images?: readonly LayoutImage[];
  xaxis?: PlotlyAxis;
  yaxis?: PlotlyAxis;
  [axis: `${"x" | "y"}axis${number}`]: PlotlyAxis | undefined;
}
export interface PlotlyTrace {
  type?: string;
  x?: readonly unknown[];
  y?: readonly unknown[];
  x0?: number;
  y0?: number;
  dx?: number;
  dy?: number;
  xaxis?: string;
  yaxis?: string;
  orientation?: "v" | "h";
  base?: unknown;
  offsetgroup?: string;
  stackgroup?: string;
  fill?: string;
}
export interface PlotlyFigure {
  data: readonly PlotlyTrace[];
  layout?: PlotlyLayout;
}

export interface PlotlyMarkOptions extends MarkOptions {
  xref?: string;
  yref?: string;
  layer?: "above" | "below";
}
export interface PlotlyHeadshotOptions extends HeadshotOptions {
  xref?: string;
  yref?: string;
  layer?: "above" | "below";
}

const DEFAULT_WIDTH = 700; // plotly.js when layout.width/height are unset
const DEFAULT_HEIGHT = 450;
const DEFAULT_MARGIN = { l: 80, r: 80, t: 100, b: 80 } as const; // plotly.js when layout.margin is unset
const READABLE = new Set(["scatter", "scattergl", "bar"]); // trace types whose extent we can work out
const REF = /^([xy])(\d*)$/;

type Letter = "x" | "y";
type AxisKey = "xaxis" | "yaxis" | `${Letter}axis${number}`;

function figureOf(target: unknown): PlotlyFigure {
  if (typeof target !== "object" || target === null || !Array.isArray((target as PlotlyFigure).data)) {
    throw new UnsupportedTargetError(
      `sdvplot/plotly draws on a { data, layout } figure, got ${typeof target}`,
    );
  }
  const f = target as PlotlyFigure;
  return { data: f.data, layout: structuredClone(f.layout ?? {}) }; // layout is what we patch; traces are read only
}

function axisKey(ref: string, letter: Letter): AxisKey {
  const m = REF.exec(ref);
  if (m === null || m[1] !== letter) {
    throw new InputError(
      `${letter}ref must name ${letter === "x" ? "an x" : "a y"} axis such as "${letter}" or "${letter}2", got ${JSON.stringify(ref)}`,
    );
  }
  return `${letter}axis${m[2] ?? ""}` as AxisKey;
}
function axisOf(layout: PlotlyLayout, ref: string, letter: Letter): PlotlyAxis {
  const key = axisKey(ref, letter);
  const ax = layout[key] ?? {};
  layout[key] = ax;
  return ax;
}
function margin(layout: PlotlyLayout, side: keyof typeof DEFAULT_MARGIN): number {
  return layout.margin?.[side] ?? DEFAULT_MARGIN[side];
}

function tracesOn(fig: PlotlyFigure, letter: Letter, ref: string): PlotlyTrace[] {
  return fig.data.filter((t) => (t[`${letter}axis`] ?? letter) === ref);
}
function vals(t: PlotlyTrace, letter: Letter): unknown[] {
  return (t[letter] ?? []).filter((v) => v !== null && v !== undefined);
}
/** A trace's values point by point; without them, where Plotly draws it: x0 + i·dx. */
function col(t: PlotlyTrace, letter: Letter): unknown[] {
  const v = t[letter];
  if (v !== undefined) return [...v];
  const other = t[letter === "x" ? "y" : "x"] ?? [];
  const start = t[`${letter}0`] ?? 0;
  const step = t[`d${letter}`] ?? 1;
  return other.map((_, i) => start + i * step);
}

function valueKind(v: unknown): "linear" | "date" | "category" {
  if (typeof v === "number" || typeof v === "bigint") return "linear";
  if (v instanceof Date) return "date";
  if (typeof v === "string") {
    if (v.trim() !== "" && Number.isFinite(Number(v))) return "linear";
    return /^\d{4}-\d{2}(-\d{2})?/.test(v) && !Number.isNaN(Date.parse(v)) ? "date" : "category";
  }
  return "linear";
}
function axisType(
  fig: PlotlyFigure,
  letter: Letter,
  ref: string,
  values: readonly unknown[],
): "linear" | "category" {
  const declared = axisOf(fig.layout!, ref, letter).type;
  let kind: string;
  if (declared !== undefined && declared !== "-") kind = declared;
  else {
    const kinds = new Set(
      [...tracesOn(fig, letter, ref).flatMap((t) => vals(t, letter)), ...values]
        .filter((v) => v !== null && v !== undefined)
        .map(valueKind),
    );
    kind = kinds.has("date") ? "date" : kinds.has("category") ? "category" : "linear";
  }
  if (kind !== "linear" && kind !== "category") {
    throw new InputError(`sdvplot does not support ${kind} axes yet (${ref}); use a linear or category axis`);
  }
  return kind;
}
/** A category axis' categories in display order: categoryarray, or first appearance across the traces. */
function categories(fig: PlotlyFigure, letter: Letter, ref: string): unknown[] {
  const ax = axisOf(fig.layout!, ref, letter);
  const order = ax.categoryorder ?? (ax.categoryarray !== undefined ? "array" : "trace");
  const fromTraces = [...new Set(tracesOn(fig, letter, ref).flatMap((t) => vals(t, letter)))];
  if (order === "array") {
    const listed = [...(ax.categoryarray ?? [])];
    return [...listed, ...fromTraces.filter((c) => !listed.includes(c))];
  }
  if (order === "trace") return fromTraces;
  if (order === "category ascending" || order === "category descending") {
    const sign = order === "category descending" ? -1 : 1;
    return [...fromTraces].sort((a, b) => String(a).localeCompare(String(b)) * sign);
  }
  throw new InputError(
    `sdvplot does not support categoryorder=${JSON.stringify(order)} yet (${ref}); use "trace" or "array"`,
  );
}
function unmeasurable(what: string, ref: string, letter: Letter): InputError {
  return new InputError(
    `cannot work out the ${ref} range of ${what}; set it first, e.g. layout.${letter}axis.range = [lo, hi], then add the marks`,
  );
}
const num = (v: unknown): number | null =>
  typeof v === "number"
    ? v
    : typeof v === "string" && v.trim() !== ""
      ? Number(v)
      : v instanceof Date
        ? v.getTime()
        : null;

/** Every coordinate the axis' traces span, plus the new marks: the data Plotly's autorange would fit. */
function extent(
  fig: PlotlyFigure,
  letter: Letter,
  ref: string,
  coords: readonly number[],
  index: Map<unknown, number> | null,
): number[] {
  const out = [...coords];
  const across: Letter = letter === "x" ? "y" : "x";
  const layout = fig.layout!;
  const stacked = layout.barmode === "stack" || layout.barmode === "relative";
  const ends = new Map<string, number>(); // where each bar stack ends so far (Plotly stacks in trace order)
  const filled = new Set<string>(); // subplots that already have a scatter, for fill="tonext…"
  for (const t of tracesOn(fig, letter, ref)) {
    const type = t.type ?? "scatter";
    if (!READABLE.has(type)) throw unmeasurable(`a ${type} trace`, ref, letter);
    const subplot = `${t.xaxis ?? "x"}|${t.yaxis ?? "y"}`;
    const along = letter === (t.orientation === "h" ? "x" : "y"); // bar lengths and stacks run along this axis
    const nums: (number | null)[] =
      index !== null && t[letter] !== undefined
        ? col(t, letter).map((v) => index.get(v) ?? null)
        : col(t, letter).map(num);
    if (type === "bar" && along) {
      if (t.base !== undefined || layout.barnorm !== undefined || (stacked && t.offsetgroup !== undefined)) {
        throw unmeasurable("bars with a base, barnorm or stacked offsetgroups", ref, letter);
      }
      out.push(0); // bars start at zero
      if (stacked) {
        const positions = col(t, across);
        nums.forEach((v, i) => {
          if (v === null || Number.isNaN(v)) return;
          const key = `${subplot}|${String(positions[i])}|${layout.barmode === "relative" && v < 0}`;
          const end = (ends.get(key) ?? 0) + v;
          ends.set(key, end);
          out.push(end);
        });
        continue;
      }
    }
    out.push(...nums.filter((v): v is number => v !== null));
    if (type === "bar" && index === null && !along) {
      // a bar is as wide as the gap between bars
      const spots = [...new Set(nums.filter((v): v is number => v !== null))].sort((a, b) => a - b);
      const gaps = spots.slice(1).map((b, i) => b - spots[i]!);
      const half = (gaps.length ? Math.min(...gaps) : 1) / 2; // Python: min(..., default=1.0) / 2 (A33)
      if (spots.length > 0) out.push(spots[0]! - half, spots[spots.length - 1]! + half);
    } else if (type !== "bar") {
      if (t.stackgroup !== undefined && along)
        throw unmeasurable("stacked scatter traces (stackgroup)", ref, letter);
      if (t.fill === `tozero${letter}` || (t.fill === `tonext${letter}` && !filled.has(subplot))) out.push(0);
      filled.add(subplot);
    }
  }
  if (index !== null) out.push(-0.5, index.size - 0.5); // a category axis shows every category's band
  return out.filter((v) => !Number.isNaN(v));
}

/** The axis range: as set, or the extent with half a mark of room at each end, then pinned. `mark` = fraction of the axis one mark covers. */
function range(
  fig: PlotlyFigure,
  letter: Letter,
  ref: string,
  coords: readonly number[],
  index: Map<unknown, number> | null,
  mark: number,
): [number, number] {
  const ax = axisOf(fig.layout!, ref, letter);
  if (
    ax.range !== undefined &&
    ax.range[0] != null &&
    ax.range[1] != null &&
    (ax.autorange === undefined || ax.autorange === false)
  ) {
    return [Number(ax.range[0]), Number(ax.range[1])];
  }
  const data = extent(fig, letter, ref, coords, index);
  const lo = data.length ? Math.min(...data) : 0;
  const hi = data.length ? Math.max(...data) : 1;
  const span = (hi - lo || 1) / Math.max(1 - mark, 0.5);
  const mid = (lo + hi) / 2;
  let rng: [number, number] = [mid - span / 2, mid + span / 2];
  if (typeof ax.autorange === "string" && ax.autorange.includes("reversed")) rng = [rng[1], rng[0]];
  ax.range = rng;
  ax.autorange = false;
  return rng;
}
/** The subplot's size in pixels at the layout's width and height. */
function plotSize(layout: PlotlyLayout, xref: string, yref: string): [number, number] {
  const w = (layout.width ?? DEFAULT_WIDTH) - margin(layout, "l") - margin(layout, "r");
  const h = (layout.height ?? DEFAULT_HEIGHT) - margin(layout, "t") - margin(layout, "b");
  const xd = layout[axisKey(xref, "x")]?.domain ?? [0, 1];
  const yd = layout[axisKey(yref, "y")]?.domain ?? [0, 1];
  return [w * (xd[1] - xd[0]), h * (yd[1] - yd[0])];
}
/** Values as axis coordinates: numbers as they are, categories as their index (null when not on the axis). */
function coords(
  fig: PlotlyFigure,
  letter: Letter,
  ref: string,
  values: readonly unknown[],
): [(number | null)[], Map<unknown, number> | null] {
  if (axisType(fig, letter, ref, values) === "linear") return [values.map(num), null];
  const index = new Map(categories(fig, letter, ref).map((c, i) => [c, i] as const));
  return [values.map((v) => index.get(v) ?? null), index];
}

function add(
  target: unknown,
  rows: readonly Row[],
  kind: "logo" | "wordmark" | "headshot",
  o: PlotlyMarkOptions | PlotlyHeadshotOptions,
): PlotlyFigure {
  const h = checkHeight(o.height ?? 0.1);
  const a = checkAlpha(o.alpha ?? 1);
  const xref = o.xref ?? "x";
  const yref = o.yref ?? "y";
  const layer = o.layer ?? "above";
  const fig = figureOf(target);
  axisKey(xref, "x");
  axisKey(yref, "y");
  const placements = markPlacements(rows, kind, o);
  const [xs, xIndex] = coords(
    fig,
    "x",
    xref,
    placements.map((p) => p.x),
  );
  const [ys, yIndex] = coords(
    fig,
    "y",
    yref,
    placements.map((p) => p.y),
  );
  const keep = placements.map((_, i) => i).filter((i) => xs[i] !== null && ys[i] !== null);
  if (keep.length < placements.length) {
    const off = placements.filter((_, i) => !keep.includes(i)).map((p) => p.id);
    warn(
      `plotly:${kind}:off-axis:${off.join(",")}`,
      `skipped ${off.length} point(s) whose category is not on the axis: ${JSON.stringify(off)}`,
    );
  }
  const kept: Placement[] = keep.map((i) => placements[i]!);
  const kx = keep.map((i) => xs[i] as number);
  const ky = keep.map((i) => ys[i] as number);
  if (kept.length === 0) return fig;
  const [plotW, plotH] = plotSize(fig.layout!, xref, yref);
  const widest = Math.max(...kept.map(aspect));
  const [xLo, xHi] = range(fig, "x", xref, kx, xIndex, (h * widest * plotH) / plotW);
  const [yLo, yHi] = range(fig, "y", yref, ky, yIndex, h);
  const sizex = 2 * Math.abs(xHi - xLo); // only bounds the width: "contain" fits each image by height
  const sources = imageSources(kept, o.embed);
  const images: LayoutImage[] = kept.map((p, i) => ({
    source: sources[i]!,
    x: kx[i]!,
    y: ky[i]!,
    xref,
    yref,
    sizex,
    sizey: h * Math.abs(yHi - yLo),
    sizing: "contain",
    xanchor: "center",
    yanchor: "middle",
    opacity: a,
    layer,
    name: `sdvplot:${kind}:${p.id}`,
  }));
  fig.layout!.images = [...(fig.layout!.images ?? []), ...images];
  return fig;
}

// A29: each verb is overloaded — the structural type, then the caller's own type (e.g. plotly.js's
// { data: Data[]; layout: Partial<Layout> }) back unchanged. No library type enters the public .d.ts.
export function withLogos(figure: PlotlyFigure, rows: readonly Row[], o: PlotlyMarkOptions): PlotlyFigure;
export function withLogos<F extends object>(figure: F, rows: readonly Row[], o: PlotlyMarkOptions): F;
export function withLogos(figure: object, rows: readonly Row[], o: PlotlyMarkOptions): object {
  return add(figure, rows, "logo", o);
}
export function withWordmarks(figure: PlotlyFigure, rows: readonly Row[], o: PlotlyMarkOptions): PlotlyFigure;
export function withWordmarks<F extends object>(figure: F, rows: readonly Row[], o: PlotlyMarkOptions): F;
export function withWordmarks(figure: object, rows: readonly Row[], o: PlotlyMarkOptions): object {
  return add(figure, rows, "wordmark", o);
}
export function withHeadshots(
  figure: PlotlyFigure,
  rows: readonly Row[],
  o: PlotlyHeadshotOptions,
): PlotlyFigure;
export function withHeadshots<F extends object>(figure: F, rows: readonly Row[], o: PlotlyHeadshotOptions): F;
export function withHeadshots(figure: object, rows: readonly Row[], o: PlotlyHeadshotOptions): object {
  return add(figure, rows, "headshot", o);
}

function span(layout: PlotlyLayout, ref: string): number {
  const r = layout[axisKey(ref, ref[0] as Letter)]?.range ?? [0, 1];
  return Math.abs(Number(r[1]) - Number(r[0]));
}
/** A layout image's emitted height as a fraction of the plot height: sizey over its y reference's span (1 for paper). */
function imageHeight(layout: PlotlyLayout, im: LayoutImage): number {
  return im.sizey / (im.yref === "paper" ? 1 : span(layout, im.yref));
}

/** Test hook: [teamId, x, y, height, source] for each image withLogos/withWordmarks/withHeadshots drew. */
export function drawnMarks(figure: PlotlyFigure): DrawnMark[] {
  const fig = figureOf(figure);
  return (fig.layout!.images ?? []).flatMap((im): DrawnMark[] => {
    const parts = (im.name ?? "").split(":", 3);
    return parts[0] === "sdvplot" && parts[1] !== "axis"
      ? [[parts[2] ?? "", im.x, im.y, imageHeight(fig.layout!, im), im.source]]
      : [];
  });
}

/** Team logos (or wordmarks, `markType`) in place of the tick labels of a category axis.
 *  x: images hang under the plot in paper y (`height` of the plot, exact), and `margin.b` grows to make room.
 *  y: images sit left of the plot in data y; the range is pinned to the category bands so `sizey = h × span`. */
export function withAxisLogos(figure: PlotlyFigure, axis: "x" | "y", o: AxisOptions): PlotlyFigure;
export function withAxisLogos<F extends object>(figure: F, axis: "x" | "y", o: AxisOptions): F;
export function withAxisLogos(figure: object, axis: "x" | "y", o: AxisOptions): object {
  const letter = axisLetter(axis);
  const h = checkHeight(o.height ?? 0.1);
  const fig = figureOf(figure);
  if (axisType(fig, letter, letter, []) !== "category") {
    throw new InputError(`withAxisLogos needs a category ${letter} axis (team names on the axis)`);
  }
  const cats = categories(fig, letter, letter);
  const labels = cats.map(String);
  const placements = axisPlacements(labels, letter, o);
  const ax = axisOf(fig.layout!, letter, letter);
  const drawn = new Set(placements.map((p) => Number(letter === "x" ? p.x : p.y)));
  ax.tickmode = "array";
  ax.tickvals = cats;
  ax.ticktext = labels.map((lab, i) => (drawn.has(i) ? "" : lab));
  if (placements.length === 0) return fig;
  const layout = fig.layout!;
  const plotH = plotSize(layout, "x", "y")[1];
  let lo = 0;
  let hi = 1;
  if (letter === "x") {
    // make room under the plot; the plot shrinks by what the margin grows, so `h` of the shrunk plot is what it gained
    layout.margin = { ...layout.margin, b: margin(layout, "b") + Math.ceil((h * plotH) / (1 + h)) };
  } else {
    [lo, hi] = range(fig, "y", "y", [], new Map(cats.map((c, i) => [c, i] as const)), 0);
    layout.margin = {
      ...layout.margin,
      l: margin(layout, "l") + Math.ceil(h * plotH * Math.max(...placements.map(aspect))),
    };
  }
  const sources = imageSources(placements, o.embed);
  const images: LayoutImage[] = placements.map((p, i) => {
    const loc = Number(letter === "x" ? p.x : p.y);
    const common = {
      source: sources[i]!,
      sizing: "contain" as const,
      layer: "above" as const,
      name: `sdvplot:axis:${letter}:${p.id}`,
    };
    return letter === "x"
      ? {
          ...common,
          x: loc,
          y: 0,
          xref: "x",
          yref: "paper",
          sizex: 2 * cats.length,
          sizey: h,
          xanchor: "center",
          yanchor: "top",
        }
      : {
          ...common,
          x: 0,
          y: loc,
          xref: "paper",
          yref: "y",
          sizex: 1,
          sizey: h * Math.abs(hi - lo),
          xanchor: "right",
          yanchor: "middle",
        };
  });
  layout.images = [...(layout.images ?? []), ...images];
  return fig;
}

/** One colour per team, in order, for `layout.colorway` (Plotly cycles it per trace). */
export function teamColorway(
  league: League,
  teams: readonly unknown[],
  o: { which?: "primary" | "secondary"; season?: SeasonInput; idSystem?: IdSystem; fallback?: string } = {},
): string[] {
  return colorList(league, teams, o).map((c) => c ?? o.fallback ?? "#808080");
}

/** Test hook: [teamId, category index, height] for each image on `axis`, in tick order. */
export function drawnAxisMarks(figure: PlotlyFigure, axis: "x" | "y"): DrawnAxisMark[] {
  const letter = axisLetter(axis);
  const fig = figureOf(figure);
  return (fig.layout!.images ?? [])
    .flatMap((im): DrawnAxisMark[] => {
      const p = (im.name ?? "").split(":", 4);
      return p[0] === "sdvplot" && p[1] === "axis" && p[2] === letter
        ? [[p[3] ?? "", letter === "x" ? im.x : im.y, imageHeight(fig.layout!, im)]]
        : [];
    })
    .sort((a, b) => a[1] - b[1]);
}
/** Test hook: the tick labels on `axis` still shown as text. */
export function visibleAxisLabels(figure: PlotlyFigure, axis: "x" | "y"): string[] {
  const letter = axisLetter(axis);
  return [...(figureOf(figure).layout![axisKey(letter, letter)]?.ticktext ?? [])].filter((t) => t !== "");
}
