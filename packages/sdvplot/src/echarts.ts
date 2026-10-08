/** The ECharts adapter: logos, wordmarks and headshots as a `custom` series whose renderItem draws image elements in
 *  data coordinates; axis logos as rich-text axis labels. Pure: echarts is never imported at runtime. */
import {
  type HeadshotOptions,
  type MarkOptions,
  type Placement,
  type Row,
  aspect,
  checkAlpha,
  checkHeight,
  imageSources,
  markPlacements,
} from "./_web.js";
import type { DrawnMark } from "./_web.js";
import { UnsupportedTargetError } from "./errors.js";
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
export interface LogoSeries {
  id: string;
  name: string;
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

export interface EChartsMarkOptions extends MarkOptions {
  xAxisIndex?: number;
  yAxisIndex?: number;
  z?: number;
}
export interface EChartsHeadshotOptions extends HeadshotOptions {
  xAxisIndex?: number;
  yAxisIndex?: number;
  z?: number;
}

const Dim = { X: 0, Y: 1, Url: 2, Team: 3, Aspect: 4, Height: 5, Alpha: 6 } as const; // the data row layout

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
  const series: LogoSeries = {
    id: `sdvplot:${kind}`,
    name: `sdvplot:${kind}`,
    type: "custom",
    coordinateSystem: "cartesian2d",
    ...(o.xAxisIndex !== undefined ? { xAxisIndex: o.xAxisIndex } : {}),
    ...(o.yAxisIndex !== undefined ? { yAxisIndex: o.yAxisIndex } : {}),
    data: ps.map((p, i) => [datum(p.x), datum(p.y), sources[i]!, p.id, aspect(p), h, a]),
    encode: { x: Dim.X, y: Dim.Y },
    z: o.z ?? 100,
    silent: true,
    renderItem: renderLogo,
  };
  // a second call of the same kind appends to the existing series' data instead of adding a second series
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

/** Test hook: [teamId, x, y, height, url] per datum of the sdvplot mark series (the renderItem draws exactly these). */
export function drawnMarks(option: EChartsOption): DrawnMark[] {
  const opt = optionOf(option);
  return (opt.series ?? [])
    .filter(
      (s): s is LogoSeries =>
        typeof s.id === "string" && s.id.startsWith("sdvplot:") && !s.id.startsWith("sdvplot:axis:"),
    )
    .flatMap((s) =>
      s.data.map(
        (d): DrawnMark => [
          String(d[Dim.Team]),
          d[Dim.X],
          d[Dim.Y],
          Number(d[Dim.Height]),
          String(d[Dim.Url]),
        ],
      ),
    );
}
