import * as Plot from "@observablehq/plot";
import { InputError } from "../errors.js";
import type { EspnHeadshotLeague } from "../headshots.js";
import { type Kind, type Placement, checkAlpha, checkHeight, placeSync, placedName } from "../placement.js";
import type { Value } from "../resolve.js";
import { toId } from "../selection.js";
import { stampImage } from "../stamp.js";
import type { HeadshotIdSystem, IdSystem, League, SeasonInput, Variant } from "../types.js";

/** A column name, an accessor, or an array of values (one per row). */
export type Channel<R> = keyof R | ((d: R, i: number) => Value) | readonly Value[];
/** Rows to draw: any iterable, or an Arrow-like table `Plot.valueof` accepts. */
export type Data<R> = Iterable<R> | { numRows: number };

/**
 * Every `Plot.image` option sdvplot does not compute passes through untouched: `x`, `y`, `fx`, `fy`, `tip`, `href`,
 * `target`, `title`, `ariaLabel`, `ariaDescription`, `sort`, `filter`, `reverse`, `dx`, `dy`, `clip`, `className`,
 * `opacity`, `rotate`, `frameAnchor`, `channels`, and `transform` / `initializer` / `render` (so Plot's transforms and
 * `Plot.pointer` wrap the mark). sdvplot owns `src`, `width` and `height` (the image and its size).
 */
export type ImagePassThrough = Omit<
  Plot.ImageOptions,
  "src" | "width" | "height" | "r" | "preserveAspectRatio"
>;

/** sdvplot's own image-mark options (shared by `logos`, `wordmarks` and `headshots`); the rest are Plot's. */
export interface ImageMarkOptions extends ImagePassThrough {
  /** Fraction of the (facet) frame height in (0, 1]; default 0.1. */
  height?: number;
  /**
   * Opacity in [0, 1]; default 1. `alpha` is the Python sdvplot name for a constant `opacity`, kept for parity; Plot's
   * `opacity` also takes a per-row channel. Passing both throws `InputError`.
   */
  alpha?: number;
  // ponytail: no circular crop on the Plot image marks; add an explicit `clip: "circle"` option, as the d3 faces have
  // (appendHeadshots), if Plot users need round headshots.
  /**
   * Read by `Plot.dodgeX` / `Plot.dodgeY` as the collision radius in pixels (dodge's own option); the image is never
   * clipped or sized by it. Half the drawn height (`height` × frame height / 2) makes neighbours just touch; a smaller
   * `r` lets them overlap (by design: the images keep their size). Plot's own image mark uses `r` to clip the image to
   * a circle, while sdvplot uses `r` only for dodge spacing and never clips.
   */
  r?: Plot.ChannelValue;
}
export interface MarkOptions<R> extends ImageMarkOptions {
  league: League;
  team: Channel<R>;
  /** A literal season (number, null, or a 4-digit string like "2023"), or a channel: any other string is a column name; functions and arrays are per-row channels. */
  season?: SeasonInput | Channel<R>;
  variant?: Variant;
  idSystem?: IdSystem;
  /**
   * The link id stamped as each image's `data-sdv-id`, which `sdvplot/interact` matches against a store or a linked
   * table's `rowKey` (`id: "team"` for a table keyed by abbreviation). One value per row, like every channel; it
   * follows its row through `sort`, `filter` and `Plot.dodgeY`. It changes only the stamp: each image keeps its
   * team's accessible name and tip. Default: the resolved ESPN team id ("12" for KC), which never matches "KC".
   */
  id?: Channel<R>;
}
export interface HeadshotOptions<R> extends ImageMarkOptions {
  league: EspnHeadshotLeague;
  player: Channel<R>;
  /** "espn" (default) or "gsis". "gsis" is sync and needs `loadGsis()` to have run first, else this throws InputError. */
  idSystem?: HeadshotIdSystem;
  /** The link id stamped as each image's `data-sdv-id`, as `logos`' `id`. Default: the player id. */
  id?: Channel<R>;
}

/** Materialise a one-shot iterable once (it is read several times); arrays and Arrow-like tables pass through. */
const once = <R>(data: Data<R>): Data<R> =>
  Symbol.iterator in data && !Array.isArray(data) && !("numRows" in data) ? Array.from(data) : data;

const values = <R>(data: Data<R>, c: Channel<R> | Plot.ChannelValue): Value[] =>
  Plot.valueof(data as Plot.Data, c as Plot.ChannelValue) as Value[];

/** The values behind x or y when the caller gave them (a column, accessor, array or `{ value }`), not a transform such as dodge. */
function given<R>(data: Data<R>, c: unknown): Value[] | null {
  const v = typeof c === "object" && c !== null && !Array.isArray(c) && "value" in c ? c.value : c;
  return typeof v === "string" || typeof v === "function" || Array.isArray(v)
    ? values(data, v as Plot.ChannelValue)
    : null;
}

type Source = { value: ArrayLike<unknown>; scale?: unknown; source?: Source | null };
/**
 * The data value behind a channel at row i (a dodge keeps x's source; its y is screen space, so none), as the
 * `data-sdv-x`/`-y` text `drawnMarks` reads back: a Date as its time in ms, so it reads back as a number.
 */
function dataValue(values: Plot.ChannelValues, key: "x" | "y", i: number): string | null {
  const ch = (values.channels as Record<string, Source | undefined>)[key];
  const src = ch?.source ?? (ch?.scale == null ? undefined : ch);
  const v = src?.value[i];
  return v === undefined || v === null ? null : String(v instanceof Date ? v.getTime() : v);
}

/**
 * Plot `render` transform: size each `<image>` to `height` x the (facet) frame height, keep the mark's
 * aspect, re-centre on the point and stamp the `data-sdv-*` attributes `drawnMarks` reads.
 * `placed` is looked up by original row index (`Placement.index`), which is what Plot hands `render`; so are `ids`,
 * the link ids by row (the `id` option), stamped in place of each placement's resolved id.
 */
export function sizeRender(
  height: number,
  placed: readonly Placement[],
  kind: Kind,
  ids?: readonly string[],
): Plot.RenderFunction {
  const byRow = new Map(placed.map((p) => [p.index, p]));
  return (index, scales, vals, dimensions, context, next) => {
    const g = next?.(index, scales, vals, dimensions, context) as SVGElement | null | undefined;
    if (g == null) return null;
    const { width, height: H, marginTop, marginRight, marginBottom, marginLeft } = dimensions;
    const frame = H - marginTop - marginBottom;
    const px = height * frame;
    const X = vals.x as ArrayLike<number> | undefined;
    const Y = vals.y as ArrayLike<number> | undefined;
    const images = g.querySelectorAll("image"); // descendants: an `href` wraps each image in an <a>
    index.forEach((i, k) => {
      const img = images[k];
      const p = byRow.get(i);
      if (!img || !p) return;
      const cx = X ? (X[i] as number) : (marginLeft + width - marginRight) / 2; // Plot's middle frame anchor
      const cy = Y ? (Y[i] as number) : (marginTop + H - marginBottom) / 2;
      stampImage(img, p, kind, px, frame, cx, cy);
      img.setAttribute("data-sdv-id", ids?.[i] ?? p.id); // by row index i, never draw order k: Plot sorts and filters
      const dx = dataValue(vals, "x", i);
      const dy = dataValue(vals, "y", i);
      if (dx !== null) img.setAttribute("data-sdv-x", dx);
      if (dy !== null) img.setAttribute("data-sdv-y", dy);
    });
    return g;
  };
}

/**
 * `outer` wraps `inner`, as Plot composes render transforms: a caller's `Plot.pointer` must stay outermost, because
 * it re-renders the mark on every pointer move. Not re-exported from the subpath barrel.
 * @internal
 */
export function compose(
  outer: Plot.RenderFunction | undefined,
  inner: Plot.RenderFunction,
): Plot.RenderFunction {
  if (outer === undefined) return inner;
  return function (this: Plot.Mark, index, scales, values, dimensions, context, next) {
    return outer.call(this, index, scales, values, dimensions, context, (i, s, v, d, c) =>
      inner.call(this, i, s, v, d, c, next),
    );
  };
}

const ONE_PER_ROW =
  "sdvplot marks draw one shape per input row (an image, a cell, a zone), so a transform that makes new rows (bin, group, hexbin) cannot run on them: aggregate first, then draw the result";
type StepOut = {
  data?: unknown;
  facets?: readonly Iterable<number>[];
  channels?: Record<string, { value?: ArrayLike<unknown> | null } | undefined>;
};
/**
 * Guard a caller's `transform` or `initializer`: row-preserving ones (filter, sort, stack, window, select, dodge) pass;
 * one that makes new rows throws `InputError`. A transform such as `Plot.group` returns new data; an initializer such
 * as `Plot.hexbin` keeps the data but returns channels with one value per bin, and facets of bin indices. So the
 * returned data must be the input, every returned channel one value per input row, and every returned facet a subset
 * of its input facet. Runs as the mark (dodge reads `this.r`). Not re-exported from the subpath barrel.
 * @internal
 */
export function sameRows<F extends (...args: never[]) => unknown>(f: F): F {
  return function (this: unknown, data: unknown, facets?: readonly Iterable<number>[], ...rest: unknown[]) {
    const out = (f as unknown as (...a: unknown[]) => StepOut).call(this, data, facets, ...rest);
    if (out.data !== undefined && out.data !== data) throw new InputError(ONE_PER_ROW);
    const n = Array.isArray(data) ? data.length : (data as { numRows?: number } | null)?.numRows;
    for (const c of Object.values(out.channels ?? {}))
      if (c?.value != null && c.value.length !== n) throw new InputError(ONE_PER_ROW);
    out.facets?.forEach((I, k) => {
      const own = new Set(facets?.[k]);
      for (const i of I) if (!own.has(i)) throw new InputError(ONE_PER_ROW);
    });
    return out;
  } as unknown as F;
}

// The mark is built on the caller's own data (not on the placements) so Plot's top-level `facet: {data}` identity
// check applies; `src` is row-aligned, null where a row is skipped (Plot then drops the row).
function imageMark<R>(
  input: Data<R>,
  o: ImageMarkOptions & {
    league: League;
    season?: unknown;
    variant?: Variant;
    idSystem?: IdSystem | HeadshotIdSystem;
    id?: Channel<R>;
  },
  kind: Kind,
  key: Channel<R>,
): Plot.Markish {
  const data = once(input);
  const height = checkHeight(o.height ?? 0.1);
  if (o.alpha !== undefined && o.opacity !== undefined)
    throw new InputError("pass alpha (a constant) or opacity (Plot's channel), not both");
  const alpha = checkAlpha(o.alpha ?? 1);
  const keys = values(data, key);
  const ids = o.id == null ? undefined : values(data, o.id).map(toId); // null is no channel, as in Plot
  if (ids !== undefined && ids.length !== keys.length)
    throw new InputError(`id needs one value per row, got ${ids.length} for ${keys.length} rows`);
  // x / y feed only the skip-and-warn check (a missing x or y); Plot draws from its own channels
  const zeros = keys.map(() => 0);
  const xs = given(data, o.x) ?? zeros;
  const ys = given(data, o.y) ?? zeros;
  const season =
    o.season == null ||
    typeof o.season === "number" ||
    (typeof o.season === "string" && /^\d{4}$/.test(o.season))
      ? (o.season as SeasonInput)
      : (values(data, o.season as Channel<R>) as readonly SeasonInput[]);
  const placed = placeSync(xs, ys, keys, {
    league: o.league,
    kind,
    ...(kind === "headshot" ? {} : { variant: o.variant ?? "default" }),
    ...(o.idSystem === undefined
      ? kind === "headshot"
        ? { idSystem: "espn" }
        : {}
      : { idSystem: o.idSystem }),
    ...(season === undefined || kind === "headshot" ? {} : { season }),
  });
  const src: (string | null)[] = new Array(keys.length).fill(null);
  for (const p of placed) src[p.index] = p.url;
  // each image's accessible name: the resolved team ("KC"), whatever id system the caller used (see placedName)
  const names = keys.map((k) => String(k));
  for (const p of placed) names[p.index] = placedName(p, o.league, keys[p.index]);
  const {
    height: _h,
    alpha: _a,
    r: _r,
    league: _l,
    season: _s,
    variant: _v,
    idSystem: _i,
    id: _id, // sdvplot's link id, stamped by sizeRender: never Plot's
    render,
    transform,
    initializer,
    channels,
    ...rest
  } = o as typeof o & { team?: unknown; player?: unknown };
  const { team: _t, player: _p, ...pass } = rest as typeof rest & { team?: unknown; player?: unknown };
  const name = kind === "headshot" ? "player" : "team";
  return Plot.image(data as Plot.Data, {
    ...pass,
    src: src as Plot.ChannelValue,
    ...(o.opacity === undefined ? { opacity: alpha } : {}),
    // an accessible name per image, as the Vega adapter's (PR #28): "KC logo", "3139477 headshot"
    ariaLabel: o.ariaLabel ?? names.map((n) => `${n} ${kind}`),
    // the tip names the team as the image does ("KC", not team_id "12"); a headshot has only its id
    channels: { [name]: { value: kind === "headshot" ? keys : names, label: name }, ...channels },
    ...(transform === undefined ? {} : { transform: sameRows(transform) }),
    ...(initializer === undefined ? {} : { initializer: sameRows(initializer) }),
    render: compose(render, sizeRender(height, placed, kind, ids)),
  });
}

/**
 * Team logos as an Observable Plot mark at (x, y), `height` a fraction of the (facet) frame height. Needs
 * `loadLeague(league)` first; a team that does not resolve is left out, with one warning. Every other `Plot.image`
 * option passes through (`tip`, `href`, `fx`/`fy`, `sort`, `filter`, `dx`/`dy`, `className`, `clip`, …), and Plot's
 * row-preserving transforms wrap it (`Plot.dodgeY`, `Plot.stackY`, `Plot.windowY`, `Plot.selectLast`, `Plot.pointer`);
 * an aggregating transform (`bin`, `group`, `hexbin`) throws `InputError`. Each image is named for its team ("KC logo").
 * `ariaLabel` is Plot's per-image channel, so a string is a COLUMN name (`ariaLabel: "qb"` names each image by its
 * row's `qb`); pass an accessor or an array for any other text.
 *
 * @example
 * ```ts
 * import * as Plot from "@observablehq/plot";
 * import { loadLeague } from "@sportsdataverse/sdvplot";
 * import { logos } from "@sportsdataverse/sdvplot/plot";
 *
 * await loadLeague("nfl");
 * const afc = [
 *   { team: "KC", pf: 385, pa: 326 },
 *   { team: "BUF", pf: 525, pa: 368 },
 *   { team: "DEN", pf: 425, pa: 311 },
 * ];
 * Plot.plot({ marks: [logos(afc, { league: "nfl", x: "pf", y: "pa", team: "team", tip: true })] });
 * ```
 *
 * @example A beeswarm: Plot.dodgeY reads r as the collision radius in pixels, about half the drawn height.
 * ```ts
 * import * as Plot from "@observablehq/plot";
 * import { loadLeague } from "@sportsdataverse/sdvplot";
 * import { logos } from "@sportsdataverse/sdvplot/plot";
 *
 * await loadLeague("nfl");
 * const afc = [
 *   { team: "KC", net_epa: 0.063 },
 *   { team: "LAC", net_epa: 0.101 },
 *   { team: "DEN", net_epa: 0.108 },
 *   { team: "BUF", net_epa: 0.19 },
 * ];
 * Plot.plot({ height: 160, marks: [logos(afc, Plot.dodgeY({ league: "nfl", team: "team", x: "net_epa", r: 12, height: 0.18 }))] });
 * ```
 */
export function logos<R>(data: Data<R>, o: MarkOptions<R>): Plot.Markish {
  return imageMark(data, o, "logo", o.team);
}
/** Team wordmarks, as `logos` (same options and pass-through); each image is named for its team ("KC wordmark"). */
export function wordmarks<R>(data: Data<R>, o: MarkOptions<R>): Plot.Markish {
  return imageMark(data, o, "wordmark", o.team);
}
/** ESPN player headshots, as `logos` with a `player` channel; each image is named for its player id ("3139477 headshot"; pass `ariaLabel` for names). */
export function headshots<R>(data: Data<R>, o: HeadshotOptions<R>): Plot.Markish {
  return imageMark(data, o, "headshot", o.player);
}
