/** The ECharts adapter: logos, wordmarks and headshots as a `custom` series whose renderItem draws image elements in
 *  data coordinates; axis logos as rich-text axis labels. Pure: echarts is never imported at runtime. */
import {
  type AxisOptions,
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
import type { DrawnAxisMark, DrawnMark } from "./_web.js";
import { InputError, UnsupportedTargetError } from "./errors.js";
import type { IdSystem, League, SeasonInput } from "./types.js";
export type { AxisOptions, DrawnAxisMark, DrawnMark, HeadshotOptions, MarkOptions, Row } from "./_web.js";
export { embedSources } from "./_web.js"; // public: the README tells callers to build `embed` with it

/** Structural types for an ECharts option: the subset `sdvplot/echarts` reads and writes. No runtime import of echarts. */
export interface EChartsAxis {
  type?: "value" | "category" | "time" | "log";
  data?: readonly unknown[];
  axisLabel?: Record<string, unknown>;
}
// A20: an interface is not a Record<string, unknown>, so the series list names LogoSeries explicitly.
export interface EChartsOption {
  xAxis?: EChartsAxis | readonly EChartsAxis[];
  yAxis?: EChartsAxis | readonly EChartsAxis[];
  series?: readonly (Record<string, unknown> | LogoSeries)[];
  color?: readonly string[];
  grid?: Record<string, unknown>;
}
/** No `name`: ECharts leaves an unnamed series out of the default legend (measured, echarts 6.1.0), so `legend: {}`
 *  lists only the caller's series; the `id` carries the bookkeeping. */
export interface LogoSeries {
  id: string;
  type: "custom";
  coordinateSystem: "cartesian2d";
  xAxisIndex?: number;
  yAxisIndex?: number;
  data: (string | number)[][];
  encode: { x: number; y: number };
  z: number;
  silent: true;
  renderItem: (params: RenderParams, api: RenderApi) => RenderedImage;
}
/** echarts types `coordSys` as `{ type: string }`; a cartesian2d series gets x, y, width and height at run time. */
export interface RenderParams {
  coordSys: { type?: string; x?: number; y?: number; width?: number; height?: number };
} // A20
export interface RenderApi {
  value: (dim: number) => number | string;
  coord: (data: (number | string)[]) => number[];
}
export interface RenderedImage {
  type: "image";
  style: { image: string; x: number; y: number; width: number; height: number; opacity?: number };
}

/** `withLogos` / `withWordmarks` options: the shared ones plus the axes (grid) the series draws on. */
export interface EChartsMarkOptions extends MarkOptions {
  /** The x axis (and so the grid) the logos draw on. Default 0. */
  xAxisIndex?: number;
  /** The y axis the logos draw on. Default 0. */
  yAxisIndex?: number;
  /** The series' z. Default 100 (above the caller's series). */
  z?: number;
}
/** `withHeadshots` options: the shared ones plus the axes (grid) the series draws on. */
export interface EChartsHeadshotOptions extends HeadshotOptions {
  /** The x axis (and so the grid) the headshots draw on. Default 0. */
  xAxisIndex?: number;
  /** The y axis the headshots draw on. Default 0. */
  yAxisIndex?: number;
  /** The series' z. Default 100 (above the caller's series). */
  z?: number;
}

// the data row layout; Frame is the axis bookkeeping's grid height in px, the frame its rich labels are sized against
const Dim = { X: 0, Y: 1, Url: 2, Team: 3, Aspect: 4, Height: 5, Alpha: 6, Frame: 7 } as const;

/** Deep copy of plain objects and arrays. Functions (renderItem, formatters) and class instances are kept by reference:
 *  structuredClone throws a DataCloneError on a function, and ECharts options routinely hold them. */
function copy<T>(v: T): T {
  if (Array.isArray(v)) return v.map(copy) as T;
  if (typeof v === "object" && v !== null && Object.getPrototypeOf(v) === Object.prototype)
    return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, copy(x)])) as T;
  return v;
}
function optionOf(target: unknown): EChartsOption {
  if (typeof target !== "object" || target === null || Array.isArray(target))
    throw new UnsupportedTargetError(
      `sdvplot/echarts draws on an ECharts option object, got ${target === null ? "null" : Array.isArray(target) ? "array" : typeof target}`,
    );
  return copy(target as EChartsOption);
}
const datum = (v: unknown): string | number =>
  v instanceof Date ? v.toISOString() : typeof v === "number" || typeof v === "string" ? v : String(v);

/** The renderItem every sdvplot custom series uses: one image per datum, centred on api.coord([x, y]), `height` of the grid tall. */
export function renderLogo(params: RenderParams, api: RenderApi): RenderedImage {
  const [px, py] = api.coord([api.value(Dim.X), api.value(Dim.Y)]) as [number, number];
  const h = Number(api.value(Dim.Height)) * (params.coordSys.height ?? 0);
  const w = h * Number(api.value(Dim.Aspect));
  return {
    type: "image",
    style: {
      image: String(api.value(Dim.Url)),
      x: px - w / 2,
      y: py - h / 2,
      width: w,
      height: h,
      opacity: Number(api.value(Dim.Alpha)),
    },
  };
}

function add(
  target: unknown,
  rows: readonly Row[],
  kind: "logo" | "wordmark" | "headshot",
  o: EChartsMarkOptions | EChartsHeadshotOptions,
): EChartsOption {
  const h = checkHeight(o.height ?? 0.1);
  const a = checkAlpha(o.alpha ?? 1);
  const option = optionOf(target);
  const ps: Placement[] = markPlacements(rows, kind, o);
  if (ps.length === 0) return option;
  const sources = imageSources(ps, o.embed);
  const [xi, yi, z] = [o.xAxisIndex ?? 0, o.yAxisIndex ?? 0, o.z ?? 100];
  const series: LogoSeries = {
    // the axes and z are in the id: a call on other axes gets its own series, a repeat call on the same ones joins it
    id: `sdvplot:${kind}${xi === 0 && yi === 0 && z === 100 ? "" : `:${xi}:${yi}:${z}`}`,
    type: "custom",
    coordinateSystem: "cartesian2d",
    ...(o.xAxisIndex !== undefined ? { xAxisIndex: o.xAxisIndex } : {}),
    ...(o.yAxisIndex !== undefined ? { yAxisIndex: o.yAxisIndex } : {}),
    data: ps.map((p, i) => [datum(p.x), datum(p.y), sources[i]!, p.id, aspect(p), h, a]),
    encode: { x: Dim.X, y: Dim.Y },
    z,
    silent: true,
    renderItem: renderLogo,
  };
  const existing = (option.series ?? []).find((s) => s.id === series.id) as LogoSeries | undefined;
  if (existing !== undefined) {
    existing.data = [...existing.data, ...series.data];
    return option;
  }
  option.series = [...(option.series ?? []), series];
  return option;
}
export function withLogos(option: EChartsOption, rows: readonly Row[], o: EChartsMarkOptions): EChartsOption;
export function withLogos<F extends object>(option: F, rows: readonly Row[], o: EChartsMarkOptions): F;
export function withLogos(option: object, rows: readonly Row[], o: EChartsMarkOptions): object {
  return add(option, rows, "logo", o);
}
export function withWordmarks(
  option: EChartsOption,
  rows: readonly Row[],
  o: EChartsMarkOptions,
): EChartsOption;
export function withWordmarks<F extends object>(option: F, rows: readonly Row[], o: EChartsMarkOptions): F;
export function withWordmarks(option: object, rows: readonly Row[], o: EChartsMarkOptions): object {
  return add(option, rows, "wordmark", o);
}
export function withHeadshots(
  option: EChartsOption,
  rows: readonly Row[],
  o: EChartsHeadshotOptions,
): EChartsOption;
export function withHeadshots<F extends object>(
  option: F,
  rows: readonly Row[],
  o: EChartsHeadshotOptions,
): F;
export function withHeadshots(option: object, rows: readonly Row[], o: EChartsHeadshotOptions): object {
  return add(option, rows, "headshot", o);
}

const REF = 1000; // px: the grid height the test hooks render a series' renderItem against
/** Test hook: [teamId, x, y, height, url] per datum of the sdvplot mark series, read from what the series' own
 *  renderItem draws (the point it asks api.coord for, the image and its height over the grid's). */
export function drawnMarks(option: EChartsOption): DrawnMark[] {
  const opt = optionOf(option);
  return (opt.series ?? [])
    .filter(
      (s): s is LogoSeries =>
        typeof s.id === "string" && s.id.startsWith("sdvplot:") && !s.id.startsWith("sdvplot:axis:"),
    )
    .flatMap((s) =>
      s.data.map((d): DrawnMark => {
        let at: readonly unknown[] = [];
        const el = s.renderItem(
          { coordSys: { x: 0, y: 0, width: REF, height: REF } },
          {
            value: (dim) => d[dim]!,
            coord: (c) => {
              at = c;
              return [0, 0];
            },
          },
        );
        return [String(d[Dim.Team]), at[0], at[1], el.style.height / REF, el.style.image];
      }),
    );
}

const DEFAULT_CHART_HEIGHT = 400; // px: ECharts has no default canvas height in a pure option; documented in the README
const LABEL_MARGIN = 8; // px: ECharts' default axisLabel.margin
const GRID_TOP = 65; // px: echarts 6's default grid.top
const GRID_BOTTOM = 80; // px: echarts 6's default grid.bottom

/** `withAxisLogos` options: the shared ones plus which axis and the canvas height. */
export interface EChartsAxisOptions extends AxisOptions {
  /** Which x (or y) axis, for an option with several. Default 0. */
  axisIndex?: number;
  /** The canvas height in px (an option has none). With the axis' grid it gives the plot-area height that `height`
   *  is a fraction of. Default 400. */
  chartHeight?: number;
}

/** A grid size in px: a number, or a "N%" of the canvas; NaN when unset. */
function gridPx(v: unknown, chartH: number): number {
  if (typeof v === "number") return v;
  if (typeof v !== "string" || v.trim() === "") return Number.NaN;
  return v.trim().endsWith("%") ? (Number.parseFloat(v) / 100) * chartH : Number(v);
}
/** The plot-area (grid) height in px of the axis' grid on a `chartH` px canvas: grid.height, else chartH less
 *  grid.top and grid.bottom (echarts 6 defaults 65 and 80). `containLabel` or labels overflowing the canvas can shrink
 *  the drawn grid below this. */
function gridHeight(option: EChartsOption, ax: EChartsAxis, chartH: number): number {
  const grids: unknown = option.grid;
  const gi = Number((ax as { gridIndex?: unknown }).gridIndex ?? 0);
  const g = ((Array.isArray(grids) ? grids[gi] : grids) ?? {}) as Record<string, unknown>;
  const or = (v: number, d: number): number => (Number.isFinite(v) ? v : d);
  const set = gridPx(g.height, chartH);
  const h = Number.isFinite(set)
    ? set
    : chartH - or(gridPx(g.top, chartH), GRID_TOP) - or(gridPx(g.bottom, chartH), GRID_BOTTOM);
  if (!(h > 0))
    throw new InputError(
      `the grid is ${h} px tall on a ${chartH} px canvas; pass the canvas height in px as chartHeight`,
    );
  return h;
}

function axisAt(
  option: EChartsOption,
  letter: "x" | "y",
  index: number,
): EChartsAxis & { axisLabel?: Record<string, unknown> } {
  const axes = option[`${letter}Axis`];
  const list = Array.isArray(axes) ? axes : axes === undefined ? [] : [axes];
  const ax = list[index] as EChartsAxis | undefined;
  if (ax === undefined || ax.type !== "category" || !Array.isArray(ax.data))
    throw new InputError(`withAxisLogos needs a category ${letter} axis with data (team names on the axis)`);
  return ax;
}
/** The category labels as ECharts shows them: a `{ value }` item reads as its value. */
const categories = (ax: EChartsAxis): string[] =>
  (ax.data ?? []).map((c) =>
    typeof c === "object" && c !== null && "value" in c ? String((c as { value: unknown }).value) : String(c),
  );

export function withAxisLogos(option: EChartsOption, axis: "x" | "y", o: EChartsAxisOptions): EChartsOption;
export function withAxisLogos<F extends object>(option: F, axis: "x" | "y", o: EChartsAxisOptions): F;
export function withAxisLogos(option: object, axis: "x" | "y", o: EChartsAxisOptions): object {
  const letter = axisLetter(axis);
  const h = checkHeight(o.height ?? 0.1);
  const chartH = o.chartHeight ?? DEFAULT_CHART_HEIGHT;
  if (!Number.isFinite(chartH) || chartH <= 0)
    throw new InputError(
      `chartHeight must be a positive number of pixels, got ${JSON.stringify(o.chartHeight)}`,
    );
  const opt = optionOf(option);
  const index = o.axisIndex ?? 0;
  const ax = axisAt(opt, letter, index);
  const cats = categories(ax);
  const ps = axisPlacements(cats, letter, o);
  if (ps.length === 0) return opt;
  const frame = gridHeight(opt, ax, chartH);
  const hPx = h * frame;
  const sources = imageSources(ps, o.embed);
  const keyOf = new Map<string, string>(); // category label → rich key
  const rich: Record<string, { backgroundColor: { image: string }; height: number; width: number }> = {};
  for (const [i, p] of ps.entries()) {
    const ci = Number(letter === "x" ? p.x : p.y);
    const key = `t_${ci}`;
    keyOf.set(cats[ci]!, key);
    rich[key] = { backgroundColor: { image: sources[i]! }, height: hPx, width: hPx * aspect(p) };
  }
  const old = { ...(ax.axisLabel ?? {}) } as {
    formatter?: unknown;
    rich?: Record<string, unknown>;
    margin?: number;
  };
  // an unresolved label keeps the caller's formatter: a function gets ECharts' own arguments, a string template its {value}
  const fallback = (v: string, rest: unknown[]): string =>
    typeof old.formatter === "function"
      ? String((old.formatter as (v: string, ...rest: unknown[]) => unknown)(v, ...rest))
      : typeof old.formatter === "string"
        ? old.formatter.replaceAll("{value}", v)
        : v;
  ax.axisLabel = {
    ...old,
    formatter: (v: string, ...rest: unknown[]) => {
      const k = keyOf.get(v);
      return k === undefined ? fallback(v, rest) : `{${k}|}`;
    },
    rich: { ...old.rich, ...rich },
    margin: (old.margin ?? LABEL_MARGIN) + 4,
  };
  // pure-data bookkeeping for the test hooks: an invisible custom series. Dim 0 (the tick index) sits on the category
  // axis; dim 1 is "-" (ECharts' empty value) on the value axis, so the series never stretches that axis' extent (A22).
  const book: LogoSeries = {
    id: `sdvplot:axis:${letter}`,
    type: "custom",
    coordinateSystem: "cartesian2d",
    ...(index === 0 ? {} : letter === "x" ? { xAxisIndex: index } : { yAxisIndex: index }), // visibleAxisLabels reads it
    data: ps.map((p, i) => [
      Number(letter === "x" ? p.x : p.y),
      "-",
      sources[i]!,
      p.id,
      aspect(p),
      h,
      1,
      frame,
    ]),
    encode: letter === "x" ? { x: 0, y: 1 } : { x: 1, y: 0 },
    z: 0,
    silent: true,
    renderItem: renderNothing,
  };
  opt.series = [...(opt.series ?? []).filter((s) => s.id !== book.id), book];
  return opt;
}
function renderNothing(): RenderedImage {
  return { type: "image", style: { image: "", x: 0, y: 0, width: 0, height: 0, opacity: 0 } };
}

/** One colour per team, in order, for `option.color`. */
export function teamColorPalette(
  league: League,
  teams: readonly unknown[],
  o: { which?: "primary" | "secondary"; season?: SeasonInput; idSystem?: IdSystem; fallback?: string } = {},
): string[] {
  return colorList(league, teams, o).map((c) => c ?? o.fallback ?? "#808080");
}
const bookOf = (option: EChartsOption, letter: "x" | "y"): LogoSeries | undefined =>
  (option.series ?? []).find((s) => s.id === `sdvplot:axis:${letter}`) as LogoSeries | undefined;
/** The axis `withAxisLogos` drew on (its bookkeeping names the index), else axis 0. */
function drawnAxis(option: EChartsOption, letter: "x" | "y"): EChartsAxis {
  const book = bookOf(option, letter);
  return axisAt(option, letter, (letter === "x" ? book?.xAxisIndex : book?.yAxisIndex) ?? 0);
}
/** Test hook: [teamId, category index, height] per axis image, in tick order; height is the axis label's rich
 *  image height over the grid height it was sized against. */
export function drawnAxisMarks(option: EChartsOption, axis: "x" | "y"): DrawnAxisMark[] {
  const letter = axisLetter(axis);
  const opt = optionOf(option);
  const book = bookOf(opt, letter);
  if (book === undefined) return [];
  const rich = (drawnAxis(opt, letter).axisLabel?.rich ?? {}) as Record<string, { height?: unknown }>;
  return book.data
    .map((d): DrawnAxisMark => {
      const tick = Number(d[Dim.X]);
      return [String(d[Dim.Team]), tick, Number(rich[`t_${tick}`]?.height) / Number(d[Dim.Frame])];
    })
    .sort((a, b) => a[1] - b[1]);
}
/** Test hook: the text each category label shows (the axis' own formatter run on it), less the empty rich image
 *  labels, on the axis `withAxisLogos` drew on (`axisIndex`). */
export function visibleAxisLabels(option: EChartsOption, axis: "x" | "y"): string[] {
  const letter = axisLetter(axis);
  const ax = drawnAxis(optionOf(option), letter);
  const f = ax.axisLabel?.formatter;
  return categories(ax)
    .map((c, i) =>
      typeof f === "function"
        ? String((f as (v: string, i: number) => unknown)(c, i))
        : typeof f === "string"
          ? f.replaceAll("{value}", c)
          : c,
    )
    .map((t) => t.replace(/\{t_\d+\|\}/g, ""))
    .filter((t) => t !== "");
}
