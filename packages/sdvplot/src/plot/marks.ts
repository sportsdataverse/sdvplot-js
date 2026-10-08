import * as Plot from "@observablehq/plot";
import { InputError } from "../errors.js";
import type { EspnHeadshotLeague } from "../headshots.js";
import { getLeagueSync } from "../index-data.js";
import { type Kind, type Placement, checkAlpha, checkHeight, placeSync } from "../placement.js";
import type { Value } from "../resolve.js";
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
  /** Opacity in [0, 1]; default 1. Use Plot's `opacity` instead for a per-row channel (not both). */
  alpha?: number;
  /**
   * Read by `Plot.dodgeX` / `Plot.dodgeY` as the collision radius in pixels (dodge's own option); the image is never
   * clipped or sized by it. Half the drawn height (`height` × frame height / 2) makes neighbours just touch.
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
}
export interface HeadshotOptions<R> extends ImageMarkOptions {
  league: EspnHeadshotLeague;
  player: Channel<R>;
  /** "espn" (default) or "gsis". "gsis" is sync and needs `loadGsis()` to have run first, else this throws InputError. */
  idSystem?: HeadshotIdSystem;
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
/** The data value behind a channel at row i (a dodge keeps x's source; its y is screen space, so none). */
function dataValue(values: Plot.ChannelValues, key: "x" | "y", i: number): string | null {
  const ch = (values.channels as Record<string, Source | undefined>)[key];
  const src = ch?.source ?? (ch?.scale == null ? undefined : ch);
  const v = src?.value[i];
  return v === undefined || v === null ? null : String(v);
}

/**
 * Plot `render` transform: size each `<image>` to `height` x the (facet) frame height, keep the mark's
 * aspect, re-centre on the point and stamp the `data-sdv-*` attributes `drawnMarks` reads.
 * `placed` is looked up by original row index (`Placement.index`), which is what Plot hands `render`.
 */
export function sizeRender(height: number, placed: readonly Placement[], kind: Kind): Plot.RenderFunction {
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
  "sdvplot image marks draw one image per input row, so a transform that makes new rows (bin, group, hexbin) cannot run on them: aggregate first, then draw the result";
/** Row-preserving transforms (filter, sort, stack, window, select, dodge, pointer) are fine; aggregating ones throw. */
function sameRows<F extends (data: never[], ...rest: never[]) => { data?: unknown }>(
  f: F | undefined,
): F | undefined {
  if (f === undefined) return undefined;
  return ((data: never[], ...rest: never[]) => {
    const out = f(data, ...rest);
    if (out.data !== undefined && out.data !== data) throw new InputError(ONE_PER_ROW);
    return out;
  }) as F;
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
  // each image's accessible name: the RESOLVED team (abbreviation, else name), whatever id system the caller used;
  // the raw key where nothing resolved. Headshots have no name source (the gsis map holds ids only), so the id.
  const names = keys.map((k) => String(k));
  if (kind !== "headshot") {
    const team = new Map(getLeagueSync(o.league).teams.map((t) => [t.team_id, t.abbr || t.name]));
    for (const p of placed) names[p.index] = team.get(p.id) || String(keys[p.index]);
  }
  const {
    height: _h,
    alpha: _a,
    r: _r,
    league: _l,
    season: _s,
    variant: _v,
    idSystem: _i,
    render,
    transform,
    initializer,
    channels,
    ...rest
  } = o as typeof o & { team?: unknown; player?: unknown };
  const { team: _t, player: _p, ...pass } = rest as typeof rest & { team?: unknown; player?: unknown };
  const name = kind === "headshot" ? "player" : "team";
  const t = sameRows(transform as never);
  const init = sameRows(initializer as never);
  return Plot.image(data as Plot.Data, {
    ...pass,
    src: src as Plot.ChannelValue,
    ...(o.opacity === undefined ? { opacity: alpha } : {}),
    // an accessible name per image, as the Vega adapter's (PR #28): "KC logo", "3139477 headshot"
    ariaLabel: o.ariaLabel ?? names.map((n) => `${n} ${kind}`),
    channels: { [name]: { value: keys, label: name }, ...channels },
    ...(t === undefined ? {} : { transform: t }),
    ...(init === undefined ? {} : { initializer: init }),
    render: compose(render, sizeRender(height, placed, kind)),
  });
}

/**
 * Team logos as an Observable Plot mark at (x, y), `height` a fraction of the (facet) frame height. Needs
 * `loadLeague(league)` first; a team that does not resolve is left out, with one warning. Every other `Plot.image`
 * option passes through (`tip`, `href`, `fx`/`fy`, `sort`, `filter`, `dx`/`dy`, `className`, `clip`, …), and Plot's
 * row-preserving transforms wrap it (`Plot.dodgeY`, `Plot.stackY`, `Plot.windowY`, `Plot.selectLast`, `Plot.pointer`);
 * an aggregating transform (`bin`, `group`, `hexbin`) throws `InputError`. Each image is named for its team ("KC logo").
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
 * @example A beeswarm: `Plot.dodgeY` reads `r` as the collision radius in pixels, about half the drawn height.
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
