/**
 * The G2 5 adapter, and so Ant Design Charts (`@ant-design/plots`), whose configs are G2 specs underneath: team colours
 * as a `scale.color` (`teamColorScale`) or a list (`teamColorPalette`), logos / wordmarks / headshots as G2 `image`
 * marks (`logoMark`, `wordmarkMark`, `headshotMark`), and logos as a band axis' labels (`axisLogos`). Each returns
 * plain spec pieces: a mark goes in a view's `children` (`chart.options(...)`) or an Ant Design Charts config's
 * `annotations`, a scale in `scale.color`, the axis labels in `axis.x`. Pure: @antv/g2 is never imported (the types
 * are structural, checked against G2 5.4's own). Call after `loadLeague(league)` / `preloadAll()`.
 */
import {
  type DrawnMark,
  type Row,
  aspect,
  checkAlpha,
  colorPalette,
  imageSource,
  markPlacements,
  place,
} from "./_web.js";
import { InputError } from "./errors.js";
import type { EspnHeadshotLeague } from "./headshots.js";
import { type Placement, placedName } from "./placement.js";
import type { Value } from "./resolve.js";
import type { HeadshotIdSystem, IdSystem, League, MarkType, SeasonInput, Variant, Which } from "./types.js";
export type { DrawnMark, Row } from "./_web.js";
export { embedSources } from "./_web.js"; // public: build `embed` with it, as for the other adapters

/** `teamColorPalette` / `teamColorScale` options. */
export interface G2ColorOptions {
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
 * One colour per team, in order, for anything that takes colours by position. With `background`, every colour keeps
 * 3:1 contrast against it (dark mode) and aims to stay distinct from the others. `teamColorScale` puts the same
 * colours on a G2 `scale.color`, keyed by team.
 *
 * @example
 * ```ts
 * import { loadLeague } from "@sportsdataverse/sdvplot";
 * import { teamColorPalette } from "@sportsdataverse/sdvplot/g2";
 *
 * await loadLeague("nfl");
 * teamColorPalette("nfl", ["KC", "LAC", "DEN", "LV"], { background: "#141414" });
 * ```
 */
export function teamColorPalette(
  league: League,
  teams: readonly unknown[],
  o: G2ColorOptions = {},
): string[] {
  return colorPalette(league, teams, o);
}

/** A G2 `scale.color`: an ordinal scale from each team value to its colour. */
export interface G2ColorScale<T = unknown> {
  /** Ordinal: a numeric team column (ESPN ids, say) keeps one colour per id, never a gradient. */
  type: "ordinal";
  /** The team values exactly as the data holds them (numbers stay numbers), each once and in order. */
  domain: T[];
  /** Their colours, in the same order. */
  range: string[];
}
/**
 * Team colours as a G2 `scale.color` (`{ type: "ordinal", domain, range }`): the mark's `encode.color` field holds the
 * team values, and each draws in its own colour; the legend lists the teams in this order. With `background` the
 * colours read on it (dark mode). Pass the teams as the data holds them: G2 matches the domain to the data by exact
 * value, so a numeric id stays a number here (12, not "12"); a value given twice (also 12 and "12") is kept once.
 *
 * @example
 * ```ts
 * import { loadLeague } from "@sportsdataverse/sdvplot";
 * import { teamColorScale } from "@sportsdataverse/sdvplot/g2";
 *
 * await loadLeague("nfl");
 * // { type: "interval", encode: { x: "team", y: "wins", color: "team" }, scale: { color: <this> } }
 * teamColorScale("nfl", ["KC", "LAC", "DEN", "LV"]);
 * ```
 */
export function teamColorScale<T>(
  league: League,
  teams: readonly T[],
  o: G2ColorOptions = {},
): G2ColorScale<T> {
  const seen = new Map<string, T>(); // keyed by String(v): the first of 12 and "12" wins
  for (const t of teams) if (!seen.has(String(t))) seen.set(String(t), t);
  return { type: "ordinal", domain: [...seen.values()], range: colorPalette(league, [...seen.keys()], o) };
}

interface Shared {
  /** Image height in px, 1 or more (G2 sizes an image mark in px). Default 24. */
  size?: number;
  /** Opacity in [0, 1]. Default 1. */
  alpha?: number;
  /** url → data URI map from `embedSources`, to inline the images. */
  embed?: ReadonlyMap<string, string>;
}
/** `logoMark` / `wordmarkMark` options. */
export interface G2MarkOptions extends Shared {
  /** Name of the row field holding each mark's x position (the field the chart's x channel encodes). */
  x: string;
  /** Name of the row field holding each mark's y position. */
  y: string;
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
/** `headshotMark` options. */
export interface G2HeadshotOptions extends Shared {
  /** Name of the row field holding each headshot's x position. */
  x: string;
  /** Name of the row field holding each headshot's y position. */
  y: string;
  /** Name of the row field holding the player id. */
  player: string;
  /** The league the players belong to, e.g. "nfl". */
  league: EspnHeadshotLeague;
  /** ESPN athlete ids, or nflverse gsis ids (needs `loadGsis()` first). Default "espn". */
  idSystem?: HeadshotIdSystem;
}

/** One datum of an sdvplot image mark: the caller's row and what it draws. */
export type G2ImageDatum = Row & {
  /** The resolved team id or player id. */
  sdv_id: string;
  /** The image's URL (or data URI). */
  sdv_src: string;
  /** Its size in px. */
  sdv_width: number;
  sdv_height: number;
};
/**
 * A G2 `image` mark (G2 5's `ImageMark`, structurally): one image per drawable row, centred on the row's (x, y) in
 * the view's own scales. Out of the tooltip and the legend.
 */
export interface G2ImageMark {
  type: "image";
  data: G2ImageDatum[];
  encode: { x: string; y: string; src: "sdv_src" };
  style: {
    width: (d: G2ImageDatum) => number;
    height: (d: G2ImageDatum) => number;
    opacity: number;
  };
  tooltip: false;
  legend: false;
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
const width = (d: G2ImageDatum): number => d.sdv_width;
const height = (d: G2ImageDatum): number => d.sdv_height;

function imageMark(
  rows: readonly Row[],
  kind: "logo" | "wordmark" | "headshot",
  o: G2MarkOptions | G2HeadshotOptions,
): G2ImageMark {
  const h = checkSize(o.size ?? 24);
  const opacity = checkAlpha(o.alpha ?? 1);
  // markPlacements reads the x/y fields only to drop rows with a missing one; G2 reads them itself, by field name
  const ps: Placement[] = markPlacements(rows, kind, o);
  return {
    type: "image",
    // the whole row, not only x and y: a view's encode (say color: "team") reaches this mark too, and a caller's own
    // style callback on it (opacity by wins, say) reads the row's fields
    data: ps.map((p) => ({
      ...rows[p.index],
      sdv_id: p.id,
      sdv_src: imageSource(p, o.embed),
      sdv_width: h * aspect(p),
      sdv_height: h,
    })),
    encode: { x: o.x, y: o.y, src: "sdv_src" },
    style: { width, height, opacity },
    tooltip: false,
    legend: false,
  };
}

/**
 * Team logos as a G2 `image` mark: one logo per row, `size` px tall, centred on the row's (`x`, `y`) fields in the
 * view's scales. Put it last in a view's `children` (G2: `chart.options({ type: "view", children: [..., mark] })`), or
 * in an Ant Design Charts config's `annotations`, which reach G2 as they are. A team with no logo draws nothing and
 * warns once.
 *
 * @example
 * ```ts
 * import { loadLeague } from "@sportsdataverse/sdvplot";
 * import { logoMark } from "@sportsdataverse/sdvplot/g2";
 *
 * await loadLeague("nfl");
 * const rows = [
 *   { team: "KC", pf: 385, pa: 326 },
 *   { team: "LAC", pf: 402, pa: 301 },
 * ];
 * // chart.options({ type: "view", data: rows, children: [{ type: "point", encode: { x: "pf", y: "pa" } }, <this>] })
 * logoMark(rows, { x: "pf", y: "pa", team: "team", league: "nfl", size: 32 });
 * ```
 */
export function logoMark(rows: readonly Row[], o: G2MarkOptions): G2ImageMark {
  return imageMark(rows, "logo", o);
}
/**
 * Team wordmarks as a G2 `image` mark, `size` px tall at their own aspect ratio; as `logoMark` otherwise.
 *
 * @example
 * ```ts
 * import { loadLeague } from "@sportsdataverse/sdvplot";
 * import { drawnMarks, wordmarkMark } from "@sportsdataverse/sdvplot/g2";
 *
 * await loadLeague("nfl");
 * // [team id, x, y, height in px, wordmark URL]: each wordmark 20 px tall, as wide as its own shape
 * drawnMarks(wordmarkMark([{ team: "LV", wins: 4, week: 18 }], { x: "week", y: "wins", team: "team", league: "nfl", size: 20 }));
 * ```
 */
export function wordmarkMark(rows: readonly Row[], o: G2MarkOptions): G2ImageMark {
  return imageMark(rows, "wordmark", o);
}
/**
 * ESPN player headshots as a G2 `image` mark, from the row's `player` field; an id with no headshot draws nothing and
 * warns once. `idSystem: "gsis"` needs `loadGsis()` first.
 *
 * @example
 * ```ts
 * import { headshotMark } from "@sportsdataverse/sdvplot/g2";
 *
 * // Patrick Mahomes (ESPN id 3139477) at his 2024 passing yards and touchdowns, 40 px tall
 * const rows = [{ qb: "3139477", yards: 3928, tds: 26 }];
 * headshotMark(rows, { x: "yards", y: "tds", player: "qb", league: "nfl", size: 40 }).data;
 * ```
 */
export function headshotMark(rows: readonly Row[], o: G2HeadshotOptions): G2ImageMark {
  return imageMark(rows, "headshot", o);
}

/** `axisLogos` options: the axis' categories are the teams. */
export interface G2AxisOptions {
  /** The league the teams belong to, e.g. "nfl". */
  league: League;
  /** The season the axis' teams are resolved for. */
  season?: SeasonInput;
  /** Image height in px, 1 or more. Default 24. */
  size?: number;
  /** Logo variant, e.g. "dark". Default "default". */
  variant?: Variant;
  /** "logo" (default) or "wordmark". */
  markType?: MarkType;
  /** How the axis categories are read. Default "auto". */
  idSystem?: IdSystem;
  /** url → data URI map from `embedSources`, to inline the images. */
  embed?: ReadonlyMap<string, string>;
}
/** What G2 hands an axis' `labelRender`: the subset read here. */
export interface G2AxisDatum {
  /** The tick's label: the category, as the axis' `labelFormatter` shows it. */
  label?: unknown;
}
/** Axis options for a G2 band axis whose categories are teams: spread them into `axis.x`. */
export interface G2AxisLabels {
  /** HTML for each label: the team's logo, or the category's own text where it has none. */
  labelRender: (datum: G2AxisDatum) => string;
  /** G2's theme draws labels at 0.45 opacity: a logo is drawn whole. */
  labelOpacity: 1;
  /** No label is hidden or rotated: each logo box is one band wide, so they never overlap. */
  labelAutoHide: false;
  labelAutoRotate: false;
  transform: [];
}

const escapeHtml = (s: string): string => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

/**
 * Team logos as a horizontal band axis' labels (a column chart's `axis.x`), through G2's `labelRender`: each label is
 * HTML, the logo `size` px tall and centred on its tick (laid out for `@antv/component` 2.1.12, the axis G2 5.4.8
 * installs). A category with no logo keeps its text and warns once. G2
 * lays an HTML label out one band wide along a horizontal axis only; for a vertical axis (a bar chart's, or under
 * `transpose`) draw a `logoMark` at the axis' position instead. HTML labels are page elements over the chart, not
 * pixels on its canvas: a `toDataURL` export leaves them out.
 *
 * @example
 * ```ts
 * import { loadLeague } from "@sportsdataverse/sdvplot";
 * import { axisLogos } from "@sportsdataverse/sdvplot/g2";
 *
 * await loadLeague("nfl");
 * // { type: "interval", encode: { x: "team", y: "wins" }, axis: { x: { ...<this>, title: false } } }
 * axisLogos({ league: "nfl", size: 28 }).labelRender({ label: "KC" });
 * ```
 */
export function axisLogos(o: G2AxisOptions): G2AxisLabels {
  const h = checkSize(o.size ?? 24);
  const kind = o.markType ?? "logo";
  return {
    labelRender: (datum) => {
      const value = datum.label as Value;
      const p = place([0], [0], [value], {
        league: o.league,
        kind,
        ...(o.season === undefined ? {} : { season: o.season }),
        ...(o.variant === undefined ? {} : { variant: o.variant }),
        ...(o.idSystem === undefined ? {} : { idSystem: o.idSystem }),
      })[0];
      // G2's axis (@antv/component 2.1.12) puts an HTML label's box with its left edge on the tick: each label shifts
      // itself left by half its own width to centre there. (2.1.11 and earlier centred the box: see the guide.)
      if (p === undefined)
        return `<span style="display:block;width:max-content;transform:translateX(-50%)">${escapeHtml(String(value ?? ""))}</span>`;
      const alt = escapeHtml(`${placedName(p, o.league, value)} ${kind}`);
      const w = h * aspect(p);
      // G2 reads the label's height from its inline style; imageSource escapes quotes and angle brackets
      return `<img src="${imageSource(p, o.embed)}" alt="${alt}" data-sdv-id="${escapeHtml(p.id)}" style="display:block;margin-left:${-w / 2}px;width:${w}px;height:${h}px">`;
    },
    labelOpacity: 1,
    labelAutoHide: false,
    labelAutoRotate: false,
    transform: [],
  };
}

const isImageMark = (v: unknown): v is G2ImageMark =>
  typeof v === "object" &&
  v !== null &&
  (v as { type?: unknown }).type === "image" &&
  Array.isArray((v as { data?: unknown }).data) &&
  (v as { encode?: { src?: unknown } }).encode?.src === "sdv_src";
/**
 * Test hook: [id, x, y, height in px, url] per image of every sdvplot mark in `spec`: a mark, a list of them, a G2
 * spec (its `children`, at any depth) or an Ant Design Charts config (its `children` and `annotations`). The height is
 * what the mark's own style hands G2.
 */
export function drawnMarks(spec: unknown): DrawnMark[] {
  if (Array.isArray(spec)) return spec.flatMap(drawnMarks);
  if (typeof spec !== "object" || spec === null) return [];
  if (isImageMark(spec))
    return spec.data.map((d) => [
      d.sdv_id,
      d[spec.encode.x],
      d[spec.encode.y],
      spec.style.height(d),
      d.sdv_src,
    ]);
  const { children, annotations } = spec as { children?: unknown; annotations?: unknown };
  return [...drawnMarks(children), ...drawnMarks(annotations)];
}
