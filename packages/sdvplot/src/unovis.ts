/**
 * The Unovis 1.7 adapter: accessor helpers in Unovis's own idiom, for `@unovis/ts` (plain JavaScript, Svelte, any
 * framework) and `@unovis/react`. Team colours as a function a colour accessor calls (`teamColorScale`: a Graph's
 * `nodeFill` / `nodeStroke` / `linkStroke`, a Sankey's `nodeColor` / `linkColor`, a Chord's `nodeColor`), or as a list
 * (`teamColorPalette`, for an XY component's `color`). Logos and headshots for a Graph's nodes (`logoIcons`,
 * `headshotIcons`): Unovis draws a node icon that starts with `#` as an SVG `<use>` of that id, and the icons' `svgDefs`
 * (for the container's `svgDefs`) hold one `<symbol>` per image. A Sankey's node icon is text only, so a Sankey takes
 * team colours, not logos. Pure: `@unovis/*` is never imported. Call after `loadLeague(league)` / `preloadAll()`.
 */
import { aspect, colorPalette, imageSource } from "./_web.js";
import { contentId } from "./content-id.js";
import { warn } from "./errors.js";
import type { EspnHeadshotLeague } from "./headshots.js";
import { normValue } from "./normalize.js";
import { type Kind, placeSync } from "./placement.js";
import { type Value, resolveSync } from "./resolve.js";
import type { HeadshotIdSystem, IdSystem, League, SeasonInput, Variant, Which } from "./types.js";

/** `teamColorPalette` / `teamColorScale` options. */
export interface UnovisColorOptions {
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
 * One colour per team, in order: an XY component's `color` (one per `y` accessor), or anything else that takes
 * colours by position. With `background`, every colour keeps 3:1 contrast against it (dark mode) and aims to stay
 * distinct from the others. `teamColorScale` gives the same colours keyed by team, for accessors.
 *
 * @example
 * ```ts
 * import { loadLeague } from "@sportsdataverse/sdvplot";
 * import { teamColorPalette } from "@sportsdataverse/sdvplot/unovis";
 *
 * await loadLeague("nfl");
 * // new Line({ x, y: [kc, phi], color: <this> })
 * teamColorPalette("nfl", ["KC", "PHI"], { background: "#111827" });
 * ```
 */
export function teamColorPalette(
  league: League,
  teams: readonly unknown[],
  o: UnovisColorOptions = {},
): string[] {
  return colorPalette(league, teams, o);
}

/** A value's key as the data holds it: 12 and "12" are two keys, each kept. */
const keyOf = (v: unknown): string => `${typeof v}:${String(v)}`;
function distinct<T>(values: readonly T[]): T[] {
  const seen = new Map<string, T>();
  for (const v of values) if (!seen.has(keyOf(v))) seen.set(keyOf(v), v);
  return [...seen.values()];
}
const shown = (v: unknown): string => (typeof v === "string" ? JSON.stringify(v) : String(v));

/** A team's colour: call it from a Unovis colour accessor with the team value the datum holds. */
export interface UnovisTeamColorScale<T = unknown> {
  /** The colour of `team`: its own for a team of the domain (by any value naming it), else `fallback`. */
  (team: unknown): string;
  /** The team values exactly as given (numbers stay numbers), each once and in order. */
  readonly domain: readonly T[];
  /** Their colours, in the same order. */
  readonly range: readonly string[];
}
/**
 * Team colours for Unovis's colour accessors: `color(d.team)` from a Graph's `nodeFill`, `nodeStroke` or
 * `linkStroke`, a Sankey's `nodeColor` or `linkColor`, a Chord's `nodeColor`. Give every team the chart draws, so
 * the colours are worked out together: with `background` they read on it (dark mode) and stay distinct. The domain
 * keeps the values as the data holds them (12 and "12" are both kept); the colours are the resolved team's, so 12,
 * "12" and "KC" draw in one colour. A value outside the domain gets `fallback`, with one warning.
 *
 * @example
 * ```ts
 * import { loadLeague } from "@sportsdataverse/sdvplot";
 * import { teamColorScale } from "@sportsdataverse/sdvplot/unovis";
 *
 * await loadLeague("nfl");
 * const color = teamColorScale("nfl", ["KC", "PHI"]);
 * // new Sankey({ linkColor: (l) => color(l.team), ... })
 * [color("KC"), color(21), color.range];
 * ```
 */
export function teamColorScale<T>(
  league: League,
  teams: readonly T[],
  o: UnovisColorOptions = {},
): UnovisTeamColorScale<T> {
  const domain = distinct(teams);
  const ro = {
    ...(o.season === undefined ? {} : { season: o.season }),
    ...(o.idSystem === undefined ? {} : { idSystem: o.idSystem }),
  };
  const fallback = o.fallback ?? "#808080";
  const ids = resolveSync(domain as readonly Value[], league, ro);
  // keyed by the resolved team: a team named twice (12 and "KC") is one team, with one colour
  const known = [...new Set(ids.filter((id) => id !== undefined))];
  const palette = colorPalette(league, known, {
    ...ro,
    idSystem: "team_id",
    ...(o.which === undefined ? {} : { which: o.which }),
    ...(o.background === undefined ? {} : { background: o.background }),
    fallback,
  });
  const byTeam = new Map<string, string>(known.map((id, j) => [id, palette[j] as string]));
  const memo = new Map(domain.map((t, i) => [keyOf(t), byTeam.get(ids[i] as string) ?? fallback]));
  const scale = (team: unknown): string => {
    const k = keyOf(team);
    let c = memo.get(k);
    if (c === undefined) {
      const id = resolveSync(team as Value, league, ro);
      c = id === undefined ? undefined : byTeam.get(id);
      if (c === undefined)
        warn(
          `unovis:${league}:color:${k}`,
          `teamColorScale: ${shown(team)} is not one of its teams; drawn in ${fallback}`,
        );
      c ??= fallback;
      memo.set(k, c);
    }
    return c;
  };
  return Object.assign(scale, { domain, range: domain.map((t) => memo.get(keyOf(t)) as string) });
}

/** `logoIcons` options. */
export interface UnovisLogoOptions {
  /** The season the teams are resolved for (a number or string). */
  season?: SeasonInput;
  /** Logo variant, e.g. "dark". Default "default". */
  variant?: Variant;
  /** How the team values are read. Default "auto". */
  idSystem?: IdSystem;
}
/** `headshotIcons` options. */
export interface UnovisHeadshotOptions {
  /** ESPN athlete ids, or nflverse gsis ids (needs `loadGsis()` first). Default "espn". */
  idSystem?: HeadshotIdSystem;
}
/** Images for a Graph's node icons: call it from `nodeIcon` with the team (or player) the node holds. */
export interface UnovisIcons<T = unknown> {
  /** `#<symbol id>` of the image of `value` (by any value naming the same team or player), else undefined. */
  (value: unknown): string | undefined;
  /** The values that have an image, as given (numbers stay numbers), each once and in order. */
  readonly domain: readonly T[];
  /** Their `#<symbol id>`s, in the same order. */
  readonly range: readonly string[];
  /** One `<symbol>` per image: the chart container's `svgDefs` (join two sets' with `+`). */
  readonly svgDefs: string;
}

const escapeAttr = (s: string): string => s.replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`);
const n = (v: number): string => String(Math.round(v * 1e4) / 1e4);

function icons<T>(
  kind: Kind,
  league: League,
  values: readonly T[],
  o: { season?: SeasonInput; variant?: Variant; idSystem?: IdSystem | HeadshotIdSystem },
): UnovisIcons<T> {
  const given = distinct(values);
  const at = given.map(() => 0); // a node's place is Unovis's layout: placeSync only pairs each value with its image
  const placed = placeSync(at, at, given as readonly Value[], {
    league,
    kind,
    ...(o.season === undefined ? {} : { season: o.season }),
    ...(o.variant === undefined ? {} : { variant: o.variant }),
    ...(o.idSystem === undefined ? {} : { idSystem: o.idSystem }),
  });
  // a node's value -> the id its image is keyed by: the resolved team, or the player id as placeSync normalises it
  const idOf = (v: unknown): string | undefined =>
    kind === "headshot"
      ? o.idSystem === "gsis"
        ? String(v).trim()
        : (normValue(v) ?? undefined)
      : resolveSync(v as Value, league, {
          ...(o.season === undefined ? {} : { season: o.season }),
          ...(o.idSystem === undefined ? {} : { idSystem: o.idSystem as IdSystem }),
        });
  const byId = new Map<string, string>();
  let svgDefs = "";
  for (const p of placed) {
    if (byId.has(p.id)) continue;
    const href = imageSource(p);
    const id = contentId(`sdv-${kind}`, href);
    // the symbol's box is the image's own aspect: a `<use>` of it fits the image, uncut, in nodeIconSize
    const w = 100 * aspect(p);
    if (!svgDefs.includes(`id="${id}"`))
      svgDefs += `<symbol id="${id}" viewBox="0 0 ${n(w)} 100" preserveAspectRatio="xMidYMid meet"><image href="${escapeAttr(href)}" width="${n(w)}" height="100" preserveAspectRatio="xMidYMid meet"/></symbol>`;
    byId.set(p.id, `#${id}`);
  }
  const memo = new Map<string, string | undefined>(
    placed.map((p) => [keyOf(given[p.index]), byId.get(p.id)]),
  );
  const icon = (value: unknown): string | undefined => {
    const k = keyOf(value);
    if (!memo.has(k)) {
      const id = value === null || value === undefined ? undefined : idOf(value);
      memo.set(k, id === undefined ? undefined : byId.get(id));
    }
    return memo.get(k);
  };
  return Object.assign(icon, {
    domain: placed.map((p) => given[p.index] as T),
    range: placed.map((p) => byId.get(p.id) as string),
    svgDefs,
  });
}

/**
 * Team logos for a Unovis Graph's nodes: `nodeIcon: (n) => logos(n.team)`, with
 * `svgDefs: logos.svgDefs` on the container. Unovis draws each icon as a `<use>` of the logo's `<symbol>`, `nodeIconSize` px across, the logo
 * fitted inside, uncut; a node's fill shows round it. A team with no logo has no icon, with one warning. Every value
 * naming a team finds its logo (12, "12" and "KC").
 *
 * @example
 * ```ts
 * import { loadLeague } from "@sportsdataverse/sdvplot";
 * import { logoIcons } from "@sportsdataverse/sdvplot/unovis";
 *
 * await loadLeague("nfl");
 * const logos = logoIcons("nfl", ["KC", "LV"], { variant: "dark" });
 * // new SingleContainer(el, { component: new Graph({ nodeIcon: (n) => logos(n.team), nodeIconSize: 28 }),
 * //   svgDefs: logos.svgDefs }, data)
 * [logos("KC"), logos.range];
 * ```
 */
export function logoIcons<T>(league: League, teams: readonly T[], o: UnovisLogoOptions = {}): UnovisIcons<T> {
  return icons("logo", league, teams, o);
}

/**
 * ESPN player headshots for a Unovis Graph's nodes, as `logoIcons`: `nodeIcon: (n) => heads(n.player)`, with the
 * container's `svgDefs: heads.svgDefs`. A gsis id with no headshot has no icon, with one warning; an ESPN id's URL is
 * built without checking the image exists, so an id ESPN has no photo for keeps an empty icon, with no warning.
 *
 * @example
 * ```ts
 * import { headshotIcons } from "@sportsdataverse/sdvplot/unovis";
 *
 * // Patrick Mahomes and Travis Kelce, by ESPN athlete id
 * const heads = headshotIcons("nfl", [3139477, 15847]);
 * [heads(3139477), heads.svgDefs.length > 0];
 * ```
 */
export function headshotIcons<T>(
  league: EspnHeadshotLeague,
  players: readonly T[],
  o: UnovisHeadshotOptions = {},
): UnovisIcons<T> {
  return icons("headshot", league, players, o);
}
