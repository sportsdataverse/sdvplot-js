/**
 * The TanStack Charts 1.x adapter: team colours as a chart `color` option (`teamColorScale`) or a list
 * (`teamColorPalette`, also a `theme.palette`), and logos / wordmarks / headshots as TanStack `dot` marks filled with
 * an SVG `<pattern>` (`logoDots`, `wordmarkDots`, `headshotDots`), whose patterns `withPatterns` writes into the
 * chart's own SVG. TanStack Charts has no image mark; a dot keeps its own focus, tooltip, keyboard and keyed update,
 * and the patterns travel with the SVG (server render, `serializeChartSvg`). Pure: `@tanstack/charts` is never
 * imported; the caller hands in its `dot` and `renderChartSvg` (the types are structural, checked against
 * TanStack's own). The SVG renderer only: the Canvas renderer paints an unknown `url(#...)` fill as no fill, so the
 * logos are not drawn there. Call after `loadLeague(league)` / `preloadAll()`.
 */
import {
  type DrawnMark,
  type Row,
  aspect,
  checkAlpha,
  colorPalette,
  imageSource,
  markPlacements,
} from "./_web.js";
import { InputError } from "./errors.js";
import type { EspnHeadshotLeague } from "./headshots.js";
import type { HeadshotIdSystem, IdSystem, League, SeasonInput, Variant, Which } from "./types.js";
export type { DrawnMark, Row } from "./_web.js";
export { embedSources } from "./_web.js"; // public: build `embed` with it, as for the other adapters

/** `teamColorPalette` / `teamColorScale` options. */
export interface TanstackColorOptions {
  /** "primary" (default) or "secondary" colour. */
  which?: Which;
  /** The season the teams are resolved for (a number or string). */
  season?: SeasonInput;
  /** How the team values are read. Default "auto". */
  idSystem?: IdSystem;
  /** The colour of an unresolved team. Default "#808080". */
  fallback?: string;
  /**
   * The chart's background. Given, a team colour under 3:1 contrast against it is swapped for the team's other
   * colour, else moved towards white (on a dark background) or black (a light one) until it reads: dark mode. A
   * colour that would then sit too close to an earlier team's (CIE76 ΔE under 20) takes the team's other colour, or
   * the nearest colour to its own that is distinct and still reads; failing that it is kept, with one warning.
   */
  background?: string;
}
/**
 * One colour per team, in order: a chart `theme.palette`, or anything else that takes colours by position. With
 * `background`, every colour keeps 3:1 contrast against it (dark mode) and aims to stay distinct from the others.
 * `teamColorScale` puts the same colours on the chart's `color` option, keyed by team.
 *
 * @example
 * ```ts
 * import { loadLeague } from "@sportsdataverse/sdvplot";
 * import { teamColorPalette } from "@sportsdataverse/sdvplot/tanstack";
 *
 * await loadLeague("nfl");
 * teamColorPalette("nfl", ["KC", "LAC", "DEN", "LV"], { background: "#111827" });
 * ```
 */
export function teamColorPalette(
  league: League,
  teams: readonly unknown[],
  o: TanstackColorOptions = {},
): string[] {
  return colorPalette(league, teams, o);
}

/** TanStack's `color` option (`ChartColorOptions`) as an ordinal map from each team value to its colour. */
export interface TanstackColorScale<T = unknown> {
  /** The team values exactly as the data holds them (numbers stay numbers), each once and in order. */
  domain: T[];
  /** Their colours, in the same order. */
  range: string[];
}
/**
 * Team colours as TanStack's chart `color` option: `{ domain, range }`, which TanStack maps by position, so the
 * team in a mark's `color` (or `z`) channel draws in its own colour and the legend lists the teams in this order.
 * Spread it and add a `legend` if wanted. With `background` the colours read on it (dark mode). TanStack matches a
 * value by its type as well (12 and "12" are two keys): pass the teams as the data holds them. A value given twice
 * is kept once; 12 and "12" are both kept, with one colour.
 *
 * @example
 * ```ts
 * import { loadLeague } from "@sportsdataverse/sdvplot";
 * import { teamColorScale } from "@sportsdataverse/sdvplot/tanstack";
 *
 * await loadLeague("nfl");
 * // defineChart({ marks: [lineY(rows, { x: "week", y: "margin", z: "team" })], color: <this> })
 * teamColorScale("nfl", ["KC", "LAC", "DEN", "LV"], { background: "#111827" });
 * ```
 */
export function teamColorScale<T>(
  league: League,
  teams: readonly T[],
  o: TanstackColorOptions = {},
): TanstackColorScale<T> {
  const seen = new Map<string, T>(); // TanStack's own value key: the type and the value
  for (const t of teams) if (!seen.has(`${typeof t}:${String(t)}`)) seen.set(`${typeof t}:${String(t)}`, t);
  const domain = [...seen.values()];
  // the palette dedupes by team, so 12 and "12" share a colour
  return { domain, range: colorPalette(league, domain, o) };
}

interface Shared {
  /** Image height in px, 1 or more. Default 24. */
  size?: number;
  /** Opacity in [0, 1]: the dot's `fillOpacity`. Default 1. */
  alpha?: number;
  /** url → data URI map from `embedSources`, to inline the images (needed for an image export). */
  embed?: ReadonlyMap<string, string>;
  /**
   * The start of each dot mark's id and pattern id. Default "sdv-logo", "sdv-wordmark" or "sdv-headshot"; give
   * another when a chart draws the same images twice (TanStack needs each mark id once). Letters, digits, `_` and
   * `-` only (it becomes an SVG id); anything else throws `InputError`.
   */
  id?: string;
}
/** `logoDots` / `wordmarkDots` options. */
export interface TanstackDotOptions<X extends string = string, Y extends string = string> extends Shared {
  /** Name of the row field holding each mark's x position (the chart's x channel). */
  x: X;
  /** Name of the row field holding each mark's y position. */
  y: Y;
  /** Name of the row field holding the team (abbreviation, name or id; see `idSystem`). */
  team: string;
  /** The league the teams belong to, e.g. "nfl". */
  league: League;
  /** A season (number or string) for every row, or the name of a row field holding each row's season. */
  season?: SeasonInput;
  /** Logo variant, e.g. "dark". Default "default". */
  variant?: Variant;
  /** How the `team` values are read. Default "auto". */
  idSystem?: IdSystem;
}
/** `headshotDots` options. */
export interface TanstackHeadshotOptions<X extends string = string, Y extends string = string>
  extends Shared {
  /** Name of the row field holding each headshot's x position. */
  x: X;
  /** Name of the row field holding each headshot's y position. */
  y: Y;
  /** Name of the row field holding the player id. */
  player: string;
  /** The league the players belong to, e.g. "nfl". */
  league: EspnHeadshotLeague;
  /** ESPN athlete ids, or nflverse gsis ids (needs `loadGsis()` first). Default "espn". */
  idSystem?: HeadshotIdSystem;
}

/** What sdvplot adds to each row of a dot. */
export interface TanstackImageFields {
  /** The resolved team id or player id. */
  sdv_id: string;
  /** The image's URL (or data URI). */
  sdv_src: string;
  /** The image's height in px. */
  sdv_height: number;
  /** The row's index in the rows given: the dot's key, stable across updates. */
  sdv_key: string;
}
/** One datum of an sdvplot dot: the caller's row (its own fields, typed) and what it draws. */
export type TanstackImageDatum<R extends object = Row> = R & TanstackImageFields;
/** What sdvplot hands TanStack's `dot(data, options)` (its `DotOptions`, structurally). */
export interface TanstackDotMarkOptions<X extends string = string, Y extends string = string> {
  /** The mark's id, and its pattern's. */
  id: string;
  /** The row fields of the x and y channels, as given. */
  x: X;
  y: Y;
  /** Each dot's key: its row's index (`sdv_key`). */
  key: (d: TanstackImageFields) => string;
  /** The dot's radius in px: the image fits inside it, uncut. */
  r: number;
  /** `url(#<id>)`: the pattern `withPatterns` writes into the chart's SVG. */
  fill: string;
  fillOpacity: number;
}
/** The pattern a dot is filled with: one image, as fractions of the dot's square bounding box. */
export interface TanstackPattern {
  href: string;
  x: number;
  y: number;
  width: number;
  height: number;
}
/** One image's dot: pass it to TanStack as `dot(d.data, d.options)`. */
export interface TanstackImageDot<
  R extends object = Row,
  X extends string = string,
  Y extends string = string,
> {
  data: TanstackImageDatum<R>[];
  options: TanstackDotMarkOptions<X, Y>;
  pattern: TanstackPattern;
}

function checkSize(size: unknown): number {
  if (!(typeof size === "number" && Number.isFinite(size) && size > 0))
    throw new InputError(`size is an image height in px > 0, got ${String(size)}`);
  if (size < 1)
    throw new InputError(
      `size is a height in px, not a fraction of the plot (echarts' \`height\`): got ${size}, which draws a sub-pixel image`,
    );
  return size;
}
/** FNV-1a, base 36: a short id that stays the same for the same image. */
function hash(s: string): string {
  let h = 2166136261;
  for (let i = 0; i < s.length; i += 1) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return (h >>> 0).toString(36);
}

const sdvKey = (d: TanstackImageFields): string => d.sdv_key;

function imageDots<R extends object, X extends string, Y extends string>(
  rows: readonly R[],
  kind: "logo" | "wordmark" | "headshot",
  o: TanstackDotOptions<X, Y> | TanstackHeadshotOptions<X, Y>,
): TanstackImageDot<R, X, Y>[] {
  const h = checkSize(o.size ?? 24);
  const fillOpacity = checkAlpha(o.alpha ?? 1);
  // the id goes into an SVG id and a url(#...) fill, which TanStack escapes: only characters that need no escaping
  if (o.id !== undefined && !/^[A-Za-z0-9_-]+$/.test(o.id))
    throw new InputError(`id may hold only letters, digits, "_" and "-", got ${JSON.stringify(o.id)}`);
  const base = o.id ?? `sdv-${kind}`;
  // TanStack paints a dot's fill once per mark: one dot mark per image, its rows in their order
  const dots = new Map<string, TanstackImageDot<R, X, Y>>();
  for (const p of markPlacements(rows as readonly Row[], kind, o)) {
    const href = imageSource(p, o.embed);
    let d = dots.get(href);
    if (d === undefined) {
      const a = aspect(p);
      // the image's box (a·h by h) inscribed in the dot's circle, so the circle never cuts it
      const r = (h / 2) * Math.hypot(1, a);
      const w = (a * h) / (2 * r);
      const ht = h / (2 * r);
      const id = `${base}-${hash(href)}`;
      d = {
        data: [],
        options: { id, x: o.x, y: o.y, key: sdvKey, r, fill: `url(#${id})`, fillOpacity },
        pattern: { href, x: (1 - w) / 2, y: (1 - ht) / 2, width: w, height: ht },
      };
      dots.set(href, d);
    }
    // the whole row: a tooltip or a caller's channel callback reads its fields
    d.data.push({
      ...rows[p.index],
      sdv_id: p.id,
      sdv_src: href,
      sdv_height: h,
      sdv_key: String(p.index),
    } as TanstackImageDatum<R>);
  }
  return [...dots.values()];
}

/**
 * Team logos as TanStack `dot` marks, one per logo, each filled with its logo: every row's logo is `size` px tall,
 * centred on the row's (`x`, `y`) fields in the chart's scales, and uncut (the dot's radius is the logo box's
 * half-diagonal). Map them to marks with TanStack's `dot`, and pass the chart a `withPatterns` serializer so the
 * patterns are in its SVG. A team with no logo draws nothing and warns once. The dots keep TanStack's focus, tooltip
 * and keyboard navigation; each datum is the caller's row (plus `sdv_*` fields).
 *
 * @example
 * ```ts
 * import { loadLeague } from "@sportsdataverse/sdvplot";
 * import { logoDots } from "@sportsdataverse/sdvplot/tanstack";
 *
 * await loadLeague("nfl");
 * const rows = [
 *   { team: "KC", pf: 385, pa: 326 },
 *   { team: "LAC", pf: 402, pa: 301 },
 * ];
 * const logos = logoDots(rows, { x: "pf", y: "pa", team: "team", league: "nfl", size: 32 });
 * // defineChart({ marks: logos.map((d) => dot(d.data, d.options)), ... }) and
 * // mountChart(el, { definition, renderSvg: withPatterns(renderChartSvg, logos), ... })
 * logos.map((d) => d.options);
 * ```
 */
export function logoDots<R extends object, X extends keyof R & string, Y extends keyof R & string>(
  rows: readonly R[],
  o: TanstackDotOptions<X, Y>,
): TanstackImageDot<R, X, Y>[] {
  return imageDots(rows, "logo", o);
}
/**
 * Team wordmarks as TanStack `dot` marks, each wordmark `size` px tall at its own aspect ratio. The dot's radius is
 * the half-diagonal of the wordmark's box, so a wide wordmark gets a large dot. As `logoDots` otherwise.
 *
 * @example
 * ```ts
 * import { loadLeague } from "@sportsdataverse/sdvplot";
 * import { drawnMarks, wordmarkDots } from "@sportsdataverse/sdvplot/tanstack";
 *
 * await loadLeague("nfl");
 * // [team id, x, y, height in px, wordmark URL]
 * drawnMarks(wordmarkDots([{ team: "LV", wins: 4, week: 18 }], { x: "week", y: "wins", team: "team", league: "nfl", size: 20 }));
 * ```
 */
export function wordmarkDots<R extends object, X extends keyof R & string, Y extends keyof R & string>(
  rows: readonly R[],
  o: TanstackDotOptions<X, Y>,
): TanstackImageDot<R, X, Y>[] {
  return imageDots(rows, "wordmark", o);
}
/**
 * ESPN player headshots as TanStack `dot` marks, from the row's `player` field; an id with no headshot draws
 * nothing and warns once. `idSystem: "gsis"` needs `loadGsis()` first. As `logoDots` otherwise.
 *
 * @example
 * ```ts
 * import { headshotDots } from "@sportsdataverse/sdvplot/tanstack";
 *
 * // Patrick Mahomes (ESPN id 3139477) at his 2024 passing yards and touchdowns, 40 px tall
 * const rows = [{ qb: "3139477", yards: 3928, tds: 26 }];
 * headshotDots(rows, { x: "yards", y: "tds", player: "qb", league: "nfl", size: 40 })[0]?.pattern;
 * ```
 */
export function headshotDots<R extends object, X extends keyof R & string, Y extends keyof R & string>(
  rows: readonly R[],
  o: TanstackHeadshotOptions<X, Y>,
): TanstackImageDot<R, X, Y>[] {
  return imageDots(rows, "headshot", o);
}

const escapeAttr = (s: string): string => s.replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`);
const n = (v: number): string => String(Math.round(v * 1e4) / 1e4);

/**
 * TanStack's SVG serializer (`renderChartSvg` from `@tanstack/charts/svg`, or your own) with the dots' patterns
 * written into the chart's SVG, in a `<defs>` of their own: pass the result as the chart's `renderSvg` (vanilla
 * `mountChart`, React and Svelte `<Chart>`). Pattern ids are scoped by the chart's `idPrefix`, as TanStack scopes
 * its gradients, and each dot's `url(#...)` follows. Build it once per set of dots (a module constant or `useMemo`).
 *
 * @example
 * ```ts
 * import { loadLeague } from "@sportsdataverse/sdvplot";
 * import { logoDots, withPatterns } from "@sportsdataverse/sdvplot/tanstack";
 *
 * await loadLeague("nfl");
 * const logos = logoDots([{ team: "KC", pf: 385, pa: 326 }], { x: "pf", y: "pa", team: "team", league: "nfl" });
 * // renderChartSvg from "@tanstack/charts/svg"; here a stand-in that returns an empty chart
 * const renderChartSvg = (_scene: unknown, _o: { idPrefix?: string }) => '<svg class="ts-chart"></svg>';
 * withPatterns(renderChartSvg, logos)({}, { idPrefix: "epa" });
 * ```
 */
export function withPatterns<S, O extends { idPrefix?: string }>(
  renderSvg: (scene: S, options: O) => string,
  ...sets: readonly (readonly TanstackImageDot<object>[])[]
): (scene: S, options: O) => string {
  const patterns = new Map<string, TanstackPattern>();
  for (const d of sets.flat()) patterns.set(d.options.id, d.pattern);
  return (scene, options) => {
    const svg = renderSvg(scene, options);
    if (patterns.size === 0) return svg;
    const end = svg.lastIndexOf("</svg>");
    if (end < 0) throw new InputError("withPatterns: the SVG renderer returned no </svg>");
    // TanStack's own id scoping: the prefix with everything but [A-Za-z0-9_-] removed
    const prefix = (options.idPrefix ?? "").replace(/[^a-zA-Z0-9_-]/g, "");
    const scoped = (id: string) => (prefix ? `${prefix}-${id}` : id);
    const body = svg
      .slice(0, end)
      .replace(/url\(#([^)]+)\)/g, (m, id: string) => (patterns.has(id) ? `url(#${scoped(id)})` : m));
    let defs = "";
    for (const [id, p] of patterns)
      defs += `<pattern data-ts-key="sdv-pattern:${escapeAttr(id)}" id="${escapeAttr(scoped(id))}" patternContentUnits="objectBoundingBox" width="1" height="1"><image href="${escapeAttr(p.href)}" x="${n(p.x)}" y="${n(p.y)}" width="${n(p.width)}" height="${n(p.height)}" preserveAspectRatio="xMidYMid meet"/></pattern>`;
    return `${body}<defs data-ts-key="sdv-patterns">${defs}</defs>${svg.slice(end)}`;
  };
}

/** Test hook: [id, x, y, height in px, url] per image of every dot in the sets, in order. */
export function drawnMarks(...sets: readonly (readonly TanstackImageDot<object>[])[]): DrawnMark[] {
  return sets
    .flat()
    .flatMap((d) =>
      d.data.map(
        (r): DrawnMark => [
          r.sdv_id,
          (r as Row)[d.options.x],
          (r as Row)[d.options.y],
          r.sdv_height,
          r.sdv_src,
        ],
      ),
    );
}
