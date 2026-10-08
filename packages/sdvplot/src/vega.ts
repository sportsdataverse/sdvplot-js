/** The Vega-Lite adapter: logos, wordmarks and headshots as a native `image` mark layer on a plain spec object.
 *  Pure: vega-lite is never imported at runtime; a NEW layered spec is returned. */
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
import { placedName } from "./placement.js";
import type { IdSystem, League, SeasonInput } from "./types.js";
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
    aria: true;
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
const AXIS_GAP = 6; // px between the axis line and the axis images (past Vega-Lite's 5 px ticks)
const LABEL_PADDING = 2; // px: Vega-Lite's default axis labelPadding
const URL = "sdvplot_url";
const TEAM = "sdvplot_team";
const LABEL = "sdvplot_label"; // the accessible description, e.g. "KC logo"; Vega's automatic aria-label would read out the image URL
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
  stack?: unknown;
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
const STACKED_BY_DEFAULT = new Set(["bar", "area", "arc"]); // Vega-Lite stacks a quantitative measure on these marks
/** Vega-Lite's sort-by-channel shorthand ("y", "-y") as the field sort it compiles to: the channel's aggregate, else
 *  "sum" for a stacked measure (a bar, area or arc mark unless the channel sets `stack: null`), else "min". */
function byChannel(sort: string, u: VegaLiteSpec): Record<string, unknown> {
  const desc = sort.startsWith("-");
  const def = (u.encoding as Record<string, unknown> | undefined)?.[desc ? sort.slice(1) : sort] as
    | Enc
    | undefined;
  if (def?.field === undefined && def?.aggregate === undefined)
    throw new InputError(
      `the sort ${JSON.stringify(sort)} names a channel without a field; sort with an explicit list (sort: [...])`,
    );
  // a shared encoding on a layered spec is stacked when any layer under it stacks
  const marks = units(u).map((v) =>
    String(typeof v.mark === "object" && v.mark !== null ? (v.mark as { type?: unknown }).type : v.mark),
  );
  const stacked =
    def.type === "quantitative" &&
    !def.bin &&
    ("stack" in def ? Boolean(def.stack) : marks.some((m) => STACKED_BY_DEFAULT.has(m)));
  return {
    ...(def.field !== undefined ? { field: def.field } : {}),
    op: def.aggregate ?? (stacked ? "sum" : "min"),
    ...(desc ? { order: "descending" } : {}),
  };
}
/** The rows a unit reads: its own inline values or named dataset, else the top-level ones; undefined for url data. */
function inlineRows(spec: VegaLiteSpec, u: VegaLiteSpec): Record<string, unknown>[] | undefined {
  const data = (u.data ?? spec.data ?? {}) as { name?: string; values?: Record<string, unknown>[] };
  return data.name !== undefined
    ? (spec.datasets?.[data.name] as Record<string, unknown>[] | undefined)
    : data.values;
}
/** A count sort as the explicit list Vega-Lite orders the axis by: kept as a count, the image layer's own rows would add
 *  to the counts (the layers share the scale). Ties keep their first appearance, as Vega's stable sort does. */
function countOrder(
  spec: VegaLiteSpec,
  u: VegaLiteSpec,
  enc: Enc,
  order: unknown,
  channel: string,
): unknown[] {
  const rows = inlineRows(spec, u);
  const all = units(spec);
  if (
    rows === undefined ||
    new Set(all.map((v) => v.data).filter((d) => d !== undefined)).size > 1 ||
    all.some((v) => v.transform !== undefined)
  )
    throw new InputError(
      `the ${channel} count sort is kept once a layer is added only on inline data with no transform (one data source); sort with an explicit list (sort: [...]), then add the marks`,
    );
  const key = unescapeField(String(enc.field));
  const counts = new Map<unknown, number>();
  for (const r of rows)
    if (r[key] !== null && r[key] !== undefined) counts.set(r[key], (counts.get(r[key]) ?? 0) + 1);
  const sign = order === "descending" ? -1 : 1;
  return [...counts].sort((a, b) => (a[1] - b[1]) * sign).map(([c]) => c);
}
/** The discrete axis' sort, when Vega-Lite keeps it once another layer shares the scale (it drops the rest).
 *  `u` is the unit encoding the channel: the shorthand ("-y") reads its sibling channel and comes back as a field sort,
 *  and a count sort comes back as the explicit list (`countOrder`), for both layers. */
function sortOf(spec: VegaLiteSpec, enc: Enc, channel: string, u: VegaLiteSpec): unknown {
  const given = "sort" in enc ? enc.sort : "ascending";
  const sort =
    typeof given === "string" && given !== "ascending" && given !== "descending"
      ? byChannel(given, u)
      : given;
  const op = String((sort as { op?: unknown } | null)?.op);
  const kept =
    sort === null ||
    sort === "ascending" ||
    sort === "descending" ||
    Array.isArray(sort) ||
    (typeof sort === "object" && ("field" in sort || op === "count") && ["count", "min", "max"].includes(op));
  if (!kept)
    throw new InputError(
      `Vega-Lite drops the ${channel} sort ${JSON.stringify(given)}${given === sort ? "" : ` (${JSON.stringify(sort)})`} once a layer is added; sort with an explicit list (sort: [...]) or by a field with op "count", "min" or "max", then add the marks`,
    );
  return op === "count" ? countOrder(spec, u, enc, (sort as { order?: unknown }).order, channel) : sort;
}
/** The x and y encodings the layer copies: field, type, timeUnit and (discrete) sort. Aggregate/bin raise. */
function encodings(spec: VegaLiteSpec): { x: Enc; y: Enc } {
  const out = {} as { x: Enc; y: Enc };
  for (const ch of ["x", "y"] as const) {
    const [u, enc] = unit(spec, ch);
    for (const key of ["aggregate", "bin"] as const) {
      const v = enc[key];
      if (v !== undefined && v !== null && v !== false && v !== "binned")
        throw new InputError(
          `the chart's ${ch} encoding has ${key}=${JSON.stringify(v)}, which the logo layer cannot copy; compute it in the data first, encode the result, then add the marks`,
        );
    }
    const e: Enc = { field: enc.field ?? ch, type: enc.type ?? "quantitative" };
    if (enc.timeUnit !== undefined) e.timeUnit = enc.timeUnit;
    if (DISCRETE.has(String(e.type)) && "sort" in enc) e.sort = sortOf(spec, enc, ch, u);
    out[ch] = e;
  }
  return out;
}
/** What each placed image's accessible description names: the resolved team, or a headshot's own player id (placedName). */
function labelsOf(
  rows: readonly Row[],
  ps: readonly Placement[],
  o: MarkOptions | HeadshotOptions,
): string[] {
  const key = "player" in o ? o.player : o.team;
  return ps.map((p) => placedName(p, o.league, rows[p.index]?.[key]));
}
function layerOf(
  ps: readonly Placement[],
  kind: string,
  h: number,
  chartH: number,
  alpha: number,
  x: Enc,
  y: Enc,
  labels: readonly string[],
  embed?: ReadonlyMap<string, string>,
): ImageLayer {
  const hPx = h * chartH;
  const sources = imageSources(ps, embed);
  const values = ps.map((p, i) => ({
    [unescapeField(String(x.field))]: jsonable(p.x),
    [unescapeField(String(y.field))]: jsonable(p.y),
    [URL]: sources[i]!,
    [TEAM]: p.id,
    [LABEL]: `${labels[i]} ${kind}`,
  }));
  const widest = ps.length ? Math.max(...ps.map(aspect)) : 1;
  return {
    name: `sdvplot_${kind}`,
    data: { values },
    mark: { type: "image", aria: true, width: hPx * widest, height: hPx, aspect: true, opacity: alpha },
    encoding: { x, y, url: { field: URL, type: "nominal" }, description: { field: LABEL, type: "nominal" } },
  };
}
/** `spec` plus `layer` as a layered spec: a unit spec is wrapped, its unit keys moving into layer[0]; a layered spec
 *  gains one layer. A layered spec's top-level encoding and transform move into a group around its own layers, so the
 *  image layer inherits neither (a shared colour field would add an empty legend entry for the images). */
function layered(spec: VegaLiteSpec, layer: ImageLayer): VegaLiteSpec {
  if (Array.isArray(spec.layer)) {
    const { encoding, transform, ...top } = spec;
    if (encoding === undefined && transform === undefined) return { ...spec, layer: [...spec.layer, layer] };
    const group = {
      ...(transform !== undefined ? { transform } : {}),
      ...(encoding !== undefined ? { encoding } : {}),
    };
    return { ...top, layer: [{ ...group, layer: spec.layer }, layer] };
  }
  const top: VegaLiteSpec = {};
  const first: VegaLiteSpec = {};
  for (const [k, v] of Object.entries(spec))
    ((UNIT_KEYS as readonly string[]).includes(k) ? first : top)[k] = v;
  return { ...top, layer: [first, layer] };
}

export function logoLayer(
  rows: readonly Row[],
  o: MarkOptions & {
    /** The chart height in px that `height` is a fraction of. Default 300 (Vega-Lite's continuous height). */
    chartHeight?: number;
    /** The layer's x encoding type (its field is "x"). Default "quantitative". */
    xType?: VlType;
    /** The layer's y encoding type (its field is "y"). Default "quantitative". */
    yType?: VlType;
  },
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
    labelsOf(rows, ps, o),
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
  const base = structuredClone(spec);
  for (const ch of ["x", "y"] as const)
    if (Array.isArray(enc[ch].sort)) targetChannel(base, ch).sort = enc[ch].sort; // a count sort's list (sortOf)
  return layered(
    base,
    layerOf(ps, kind, h, chartHeight(spec), a, enc.x, enc.y, labelsOf(rows, ps, o), o.embed),
  );
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

const BLANKED = /^indexof\((\[.*?\]), datum\.label\) >= 0/;

/** A discrete axis' categories in display order: explicit scale domain or sort list, else the inline data. */
function categoriesOf(spec: VegaLiteSpec, u: VegaLiteSpec, enc: Enc): unknown[] {
  if (Array.isArray(enc.scale?.domain)) return enc.scale.domain;
  const sort = "sort" in enc ? enc.sort : "ascending";
  const rows = inlineRows(spec, u);
  if (rows === undefined) {
    if (Array.isArray(sort)) return sort;
    throw new InputError(
      "withAxisLogos reads the categories from inline data; give the axis an explicit sort=[...] list",
    );
  }
  const key = unescapeField(String(enc.field));
  const seen = [...new Set(rows.map((r) => r[key]).filter((v) => v !== null && v !== undefined))];
  if (Array.isArray(sort)) return [...sort, ...seen.filter((c) => !sort.includes(c))];
  if (sort === "ascending" || sort === "descending")
    return seen.sort((a, b) => String(a).localeCompare(String(b)) * (sort === "descending" ? -1 : 1));
  return seen; // sort null or a field sort: data order
}
/** The channel object the spec reads the axis from (the first unit encoding it with a field), inside a deep copy. */
function targetChannel(spec: VegaLiteSpec, channel: "x" | "y"): Enc {
  for (const u of units(spec)) {
    const e = (u.encoding as Record<string, unknown> | undefined)?.[channel];
    if (typeof e === "object" && e !== null && "field" in e) return e as Enc;
  }
  throw new InputError(`the spec has no ${channel} encoding with a field`);
}

/** Team logos (or wordmarks, `markType`) in place of the labels of a nominal or ordinal axis: a `labelExpr` blanks the
 *  resolved labels and an image layer draws them. Assumes the default axis orient (x at the bottom, y on the left) and
 *  that `height` is the plot height: an axis with `orient: "top"` or `"right"` gets its logos on the opposite side. */
export function withAxisLogos(spec: VegaLiteSpec, axis: "x" | "y", o: AxisOptions): VegaLiteSpec;
export function withAxisLogos<F extends object>(spec: F, axis: "x" | "y", o: AxisOptions): F;
export function withAxisLogos(spec: object, axis: "x" | "y", o: AxisOptions): object {
  const letter = axisLetter(axis);
  const h = checkHeight(o.height ?? 0.1);
  const s = specOf(spec);
  const [u, enc] = unit(s, letter);
  if (!DISCRETE.has(String(enc.type)))
    throw new InputError(`withAxisLogos needs a nominal or ordinal ${letter} axis (team names on the axis)`);
  if (enc.axis === null) throw new InputError(`the chart's ${letter} axis is hidden (axis: null)`);
  const sort = sortOf(s, enc, letter, u);
  const cats = categoriesOf(s, u, enc);
  const ps = axisPlacements(cats.map(String), letter, o);
  const chartH = chartHeight(s);
  const hPx = h * chartH;
  const widest = ps.length ? Math.max(...ps.map(aspect)) : 1;
  const pos = ps.map((p) => Number(letter === "x" ? p.x : p.y));
  const blank = JSON.stringify(pos.map((i) => String(cats[i])));
  const old = (typeof enc.axis === "object" && enc.axis !== null ? enc.axis : {}) as Record<
    string,
    unknown
  > & { labelExpr?: string; labelPadding?: number };
  const room = (letter === "x" ? hPx : hPx * widest) + AXIS_GAP;
  const expr = `indexof(${blank}, datum.label) >= 0 ? '' : ${old.labelExpr !== undefined ? `(${old.labelExpr})` : "datum.label"}`;
  const base = structuredClone(s);
  const target = targetChannel(base, letter);
  target.axis = {
    ...old,
    labelExpr: expr,
    labelPadding: (old.labelPadding ?? LABEL_PADDING) + room,
  };
  if (Array.isArray(sort)) target.sort = sort; // a count sort's list (sortOf)
  const key = unescapeField(String(enc.field));
  const sources = imageSources(ps, o.embed);
  const values = ps.map((p, i) => ({
    [key]: cats[pos[i]!],
    [URL]: sources[i]!,
    [TEAM]: p.id,
    [LABEL]: `${placedName(p, o.league, cats[pos[i]!])} ${o.markType ?? "logo"}`,
  }));
  const channel: Enc = {
    field: enc.field ?? letter,
    type: String(enc.type),
    ...("sort" in enc ? { sort } : {}),
  };
  const url = { field: URL, type: "nominal" as const };
  const description = { field: LABEL, type: "nominal" as const };
  const layer: ImageLayer =
    letter === "x"
      ? {
          name: "sdvplot_axis_x",
          data: { values },
          mark: {
            type: "image",
            aria: true,
            width: hPx * widest,
            height: hPx,
            aspect: true,
            baseline: "top",
          },
          encoding: { x: channel, y: { value: chartH + AXIS_GAP }, url, description },
        }
      : {
          name: "sdvplot_axis_y",
          data: { values },
          mark: { type: "image", aria: true, width: hPx * widest, height: hPx, aspect: true, align: "right" },
          encoding: { y: channel, x: { value: -AXIS_GAP }, url, description },
        };
  return layered(base, layer);
}

/** `{ domain, range }` for `encoding.color.scale`: the values as given, their team colours. */
export function teamColorScale(
  league: League,
  teams: readonly unknown[],
  o: { which?: "primary" | "secondary"; season?: SeasonInput; idSystem?: IdSystem; fallback?: string } = {},
): { domain: string[]; range: string[] } {
  return {
    domain: teams.map(String),
    range: colorList(league, teams, o).map((c) => c ?? o.fallback ?? "#808080"),
  };
}

/** Test hook: [teamId, category position, height] per image on `axis`, in tick order. */
export function drawnAxisMarks(spec: VegaLiteSpec, axis: "x" | "y"): DrawnAxisMark[] {
  const letter = axisLetter(axis);
  const s = specOf(spec);
  const [u, enc] = unit(s, letter);
  const cats = categoriesOf(s, u, enc);
  const ref = chartHeight(s);
  return named(s, `sdvplot_axis_${letter}`)
    .flatMap((l) => {
      const key = unescapeField(String((l.encoding[letter] as Enc).field));
      return l.data.values.map(
        (r): DrawnAxisMark => [String(r[TEAM]), cats.indexOf(r[key]), l.mark.height / ref],
      );
    })
    .sort((a, b) => a[1] - b[1]);
}
/** Test hook: the labels on `axis` its labelExpr still shows as text. */
export function visibleAxisLabels(spec: VegaLiteSpec, axis: "x" | "y"): string[] {
  const letter = axisLetter(axis);
  const s = specOf(spec);
  const [u, enc] = unit(s, letter);
  const m = BLANKED.exec(String((enc.axis as { labelExpr?: string } | undefined)?.labelExpr ?? ""));
  const blanked = new Set<string>(m ? (JSON.parse(m[1]!) as string[]) : []);
  return categoriesOf(s, u, enc)
    .map(String)
    .filter((c) => !blanked.has(c));
}
