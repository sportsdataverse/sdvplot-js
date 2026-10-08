/** The Vega-Lite adapter: logos, wordmarks and headshots as a native `image` mark layer on a plain spec object.
 *  Pure: vega-lite is never imported at runtime; a NEW layered spec is returned. */
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
import { InputError, UnsupportedTargetError } from "./errors.js";
export type { AxisOptions, DrawnAxisMark, DrawnMark, HeadshotOptions, MarkOptions, Row } from "./_web.js";
export { embedSources } from "./_web.js"; // public: the README tells callers to build `embed` with it

/** Structural types for a Vega-Lite spec: the subset `sdvplot/vega` reads and writes. No runtime import of vega-lite. */
export type VegaLiteSpec = Record<string, unknown> & {
  layer?: unknown[];
  encoding?: Record<string, unknown>;
  mark?: unknown;
  width?: unknown;
  height?: unknown;
  config?: Record<string, unknown>;
  data?: unknown;
  datasets?: Record<string, unknown>;
};
export interface ImageLayer {
  name: string;
  data: { values: Record<string, unknown>[] };
  mark: {
    type: "image";
    width: number;
    height: number;
    aspect: true;
    opacity?: number;
    align?: "left" | "center" | "right";
    baseline?: "top" | "middle" | "bottom";
  };
  encoding: Record<string, unknown>;
}

const DEFAULT_HEIGHT = 300; // px: Vega-Lite's continuous view height when neither chart nor config sets one
const URL = "sdvplot_url";
const TEAM = "sdvplot_team";
const DISCRETE = new Set(["nominal", "ordinal"]);
const UNIT_KEYS = ["mark", "encoding", "transform", "params", "projection", "view", "name"] as const; // what moves into the first layer when a unit spec is wrapped
const COMPOSITE: Record<string, string> = {
  facet: "spec.spec",
  repeat: "spec.spec",
  hconcat: "hconcat[i]",
  vconcat: "vconcat[i]",
  concat: "concat[i]",
};

export type VlType = "quantitative" | "nominal" | "ordinal" | "temporal";
type Enc = Record<string, unknown> & {
  field?: string;
  type?: string;
  sort?: unknown;
  timeUnit?: unknown;
  aggregate?: unknown;
  bin?: unknown;
  axis?: unknown;
  scale?: { domain?: unknown };
};

function specOf(target: unknown): VegaLiteSpec {
  if (typeof target !== "object" || target === null || Array.isArray(target))
    throw new UnsupportedTargetError(
      `sdvplot/vega draws on a Vega-Lite spec object, got ${target === null ? "null" : typeof target}`,
    );
  for (const key of Object.keys(COMPOSITE))
    if (key in target)
      throw new InputError(
        `sdvplot cannot draw on a ${key} spec; draw on one of its charts (${COMPOSITE[key]}), then combine`,
      );
  return target as VegaLiteSpec;
}
const jsonable = (v: unknown): unknown =>
  v instanceof Date ? v.toISOString() : typeof v === "bigint" ? Number(v) : v;
const unescapeField = (f: string): string => f.replace(/\\(.)/g, "$1"); // "a\.b" → the data column "a.b"

/** A spec and every layer inside it, outermost first. */
function units(spec: VegaLiteSpec): VegaLiteSpec[] {
  return [spec, ...(spec.layer ?? []).flatMap((s) => units(s as VegaLiteSpec))];
}
/** The first (unit, channel def) encoding `channel` with a field. */
function unit(spec: VegaLiteSpec, channel: "x" | "y"): [VegaLiteSpec, Enc] {
  for (const u of units(spec)) {
    const e = (u.encoding as Record<string, unknown> | undefined)?.[channel];
    if (typeof e === "object" && e !== null && "field" in e) return [u, e as Enc];
  }
  return [{}, {}];
}
function pixels(h: unknown, name: string): number {
  if (typeof h !== "number" || !Number.isFinite(h) || h <= 0)
    throw new InputError(
      `sdvplot sizes marks from the chart height; ${name} must be a positive number of pixels, not ${JSON.stringify(h)}`,
    );
  return h;
}
function chartHeight(spec: VegaLiteSpec): number {
  for (const u of units(spec)) if (u.height !== undefined) return pixels(u.height, "height");
  if (DISCRETE.has(String(unit(spec, "y")[1].type)))
    throw new InputError(
      "a discrete y axis is sized by its step; set the chart height in pixels (spec.height)",
    );
  const h =
    (spec.config?.view as { continuousHeight?: unknown } | undefined)?.continuousHeight ?? DEFAULT_HEIGHT;
  return pixels(h, "config.view.continuousHeight");
}
/** The discrete axis' sort, when Vega-Lite keeps it once another layer shares the scale (it drops the rest). */
function sortOf(enc: Enc, channel: string): unknown {
  const sort = "sort" in enc ? enc.sort : "ascending";
  const kept =
    sort === null ||
    sort === "ascending" ||
    sort === "descending" ||
    Array.isArray(sort) ||
    (typeof sort === "object" &&
      sort !== null &&
      "field" in sort &&
      ["count", "min", "max"].includes(String((sort as { op?: unknown }).op)));
  if (!kept)
    throw new InputError(
      `Vega-Lite drops the ${channel} sort ${JSON.stringify(sort)} once a layer is added; sort with an explicit list (sort: [...]) or by a field with op "count", "min" or "max", then add the marks`,
    );
  return sort;
}
/** The x and y encodings the layer copies: field, type, timeUnit and (discrete) sort. Aggregate/bin raise. */
function encodings(spec: VegaLiteSpec): { x: Enc; y: Enc } {
  const out = {} as { x: Enc; y: Enc };
  for (const ch of ["x", "y"] as const) {
    const enc = unit(spec, ch)[1];
    for (const key of ["aggregate", "bin"] as const) {
      const v = enc[key];
      if (v !== undefined && v !== null && v !== false && v !== "binned")
        throw new InputError(
          `the chart's ${ch} encoding has ${key}=${JSON.stringify(v)}, which the logo layer cannot copy; compute it in the data first, encode the result, then add the marks`,
        );
    }
    const e: Enc = { field: enc.field ?? ch, type: enc.type ?? "quantitative" };
    if (enc.timeUnit !== undefined) e.timeUnit = enc.timeUnit;
    if (DISCRETE.has(String(e.type)) && "sort" in enc) e.sort = sortOf(enc, ch);
    out[ch] = e;
  }
  return out;
}
function layerOf(
  ps: readonly Placement[],
  kind: string,
  h: number,
  chartH: number,
  alpha: number,
  x: Enc,
  y: Enc,
  embed?: ReadonlyMap<string, string>,
): ImageLayer {
  const hPx = h * chartH;
  const sources = imageSources(ps, embed);
  const values = ps.map((p, i) => ({
    [unescapeField(String(x.field))]: jsonable(p.x),
    [unescapeField(String(y.field))]: jsonable(p.y),
    [URL]: sources[i]!,
    [TEAM]: p.id,
  }));
  const widest = ps.length ? Math.max(...ps.map(aspect)) : 1;
  return {
    name: `sdvplot_${kind}`,
    data: { values },
    mark: { type: "image", width: hPx * widest, height: hPx, aspect: true, opacity: alpha },
    encoding: { x, y, url: { field: URL, type: "nominal" } },
  };
}
/** `spec` plus `layer` as a layered spec: an already-layered spec gains one layer; a unit spec is wrapped, its unit keys moving into layer[0]. */
function layered(spec: VegaLiteSpec, layer: ImageLayer): VegaLiteSpec {
  if (Array.isArray(spec.layer)) return { ...spec, layer: [...spec.layer, layer] };
  const top: VegaLiteSpec = {};
  const first: VegaLiteSpec = {};
  for (const [k, v] of Object.entries(spec))
    ((UNIT_KEYS as readonly string[]).includes(k) ? first : top)[k] = v;
  return { ...top, layer: [first, layer] };
}

export function logoLayer(
  rows: readonly Row[],
  o: MarkOptions & { chartHeight?: number; xType?: VlType; yType?: VlType },
): ImageLayer {
  const h = checkHeight(o.height ?? 0.1);
  const a = checkAlpha(o.alpha ?? 1);
  const ps = markPlacements(rows, "logo", o);
  return layerOf(
    ps,
    "logo",
    h,
    o.chartHeight === undefined ? DEFAULT_HEIGHT : pixels(o.chartHeight, "chartHeight"),
    a,
    { field: "x", type: o.xType ?? "quantitative" },
    { field: "y", type: o.yType ?? "quantitative" },
    o.embed,
  );
}
function add(
  target: unknown,
  rows: readonly Row[],
  kind: "logo" | "wordmark" | "headshot",
  o: MarkOptions | HeadshotOptions,
): VegaLiteSpec {
  const h = checkHeight(o.height ?? 0.1);
  const a = checkAlpha(o.alpha ?? 1);
  const spec = specOf(target);
  const enc = encodings(spec);
  const ps = markPlacements(rows, kind, o);
  return layered(structuredClone(spec), layerOf(ps, kind, h, chartHeight(spec), a, enc.x, enc.y, o.embed));
}
export function withLogos(spec: VegaLiteSpec, rows: readonly Row[], o: MarkOptions): VegaLiteSpec;
export function withLogos<F extends object>(spec: F, rows: readonly Row[], o: MarkOptions): F;
export function withLogos(spec: object, rows: readonly Row[], o: MarkOptions): object {
  return add(spec, rows, "logo", o);
}
export function withWordmarks(spec: VegaLiteSpec, rows: readonly Row[], o: MarkOptions): VegaLiteSpec;
export function withWordmarks<F extends object>(spec: F, rows: readonly Row[], o: MarkOptions): F;
export function withWordmarks(spec: object, rows: readonly Row[], o: MarkOptions): object {
  return add(spec, rows, "wordmark", o);
}
export function withHeadshots(spec: VegaLiteSpec, rows: readonly Row[], o: HeadshotOptions): VegaLiteSpec;
export function withHeadshots<F extends object>(spec: F, rows: readonly Row[], o: HeadshotOptions): F;
export function withHeadshots(spec: object, rows: readonly Row[], o: HeadshotOptions): object {
  return add(spec, rows, "headshot", o);
}

function named(spec: VegaLiteSpec, prefix: string): ImageLayer[] {
  return units(spec).filter(
    (u): u is VegaLiteSpec & ImageLayer => typeof u.name === "string" && u.name.startsWith(prefix),
  );
}
/** Test hook: [teamId, x, y, height, url] per image of the sdvplot layers; height = image px / chart px. */
export function drawnMarks(spec: VegaLiteSpec): DrawnMark[] {
  const s = specOf(spec);
  const ref = chartHeight(s);
  return named(s, "sdvplot_")
    .filter((l) => !l.name.startsWith("sdvplot_axis_"))
    .flatMap((l) => {
      const xk = unescapeField(String((l.encoding.x as Enc).field));
      const yk = unescapeField(String((l.encoding.y as Enc).field));
      return l.data.values.map(
        (r): DrawnMark => [String(r[TEAM]), r[xk], r[yk], l.mark.height / ref, String(r[URL])],
      );
    });
}
