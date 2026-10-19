/**
 * The deck.gl adapter: team logos, team-coloured arcs and sporty playing surfaces as deck.gl layer props. Pure: it
 * never imports deck.gl (`@deck.gl/core` and `@deck.gl/layers` 9.4 or later are optional peers), so the props can be
 * built anywhere, a server included; pass them to the layer, as in `new IconLayer(logoIconLayer(rows, o))`. The props
 * are plain objects: the data rows, accessor functions that read them, and the layer's own settings. `surfaceLayer`
 * draws through `@sportsdataverse/sporty`, which this entry imports when it loads. Synchronous: call after
 * `loadLeague(league)` / `preloadAll()`. The Python package's `sdvplot.pydeck` builds the same props for pydeck; the
 * two are held to one shared fixture.
 */
import { type PolygonFeature, surface as sportySurface } from "@sportsdataverse/sporty";
import type { LeagueOf, OptionsOf, Sport } from "@sportsdataverse/sporty";
import { type Row, aspect, colorList, column, markPlacements } from "./_web.js";
import { hex6 } from "./contrast.js";
import { InputError, warn } from "./errors.js";
import { normValue } from "./normalize.js";
import { checkAlpha } from "./placement.js";
import { type Value, resolveSync } from "./resolve.js";
import { teamPalette } from "./team-palette.js";
import type { IdSystem, League, SeasonInput, Variant, Which } from "./types.js";

export type { Row } from "./_web.js";
/** A deck.gl colour: `[r, g, b, a]`, each 0-255. */
export type Rgba = [r: number, g: number, b: number, a: number];
/** An icon deck.gl fetches and packs into its atlas itself (an "auto-packed" icon), keyed by its URL. */
export interface LogoIcon {
  url: string;
  /** The icon's size in the atlas, px: 128 tall, as wide as the logo's aspect makes it. */
  width: number;
  height: number;
  /** Half the height: the logo is centred on its point. */
  anchorY: number;
  mask: false;
}
/** One `logoIconLayer` data row. `index` is the row's position in the input (left-out rows leave gaps). */
export interface IconRow {
  position: [x: number, y: number];
  icon: LogoIcon;
  /** The resolved team id. */
  team: string;
  index: number;
}
/**
 * One `passArcLayer` data row. `team` is the resolved team id, or the row's own value as text when it does not
 * resolve (a number without ".0", a missing value empty).
 */
export interface ArcRow {
  source: [x: number, y: number];
  target: [x: number, y: number];
  sourceColor: Rgba;
  targetColor: Rgba;
  team: string;
  index: number;
}
/** One `surfaceLayer` data row: a closed loop of a sporty polygon feature. */
export interface SurfaceRow {
  name: string;
  /** One closed loop of the feature's path (deck.gl closes it). */
  polygon: (readonly [x: number, y: number])[];
  fillColor: Rgba;
}
/** `logoIconLayer`'s props, for deck.gl's `IconLayer`. */
export interface LogoIconLayerProps {
  id: string;
  data: IconRow[];
  getPosition: (d: IconRow) => [number, number];
  getIcon: (d: IconRow) => LogoIcon;
  getSize: number;
  sizeUnits: "pixels";
  opacity: number;
}
/** `passArcLayer`'s props, for deck.gl's `ArcLayer`. */
export interface PassArcLayerProps {
  id: string;
  data: ArcRow[];
  getSourcePosition: (d: ArcRow) => [number, number];
  getTargetPosition: (d: ArcRow) => [number, number];
  getSourceColor: (d: ArcRow) => Rgba;
  getTargetColor: (d: ArcRow) => Rgba;
  getWidth: number;
  widthUnits: "pixels";
  opacity: number;
  getHeight?: number;
  getTilt?: number;
}
/** `surfaceLayer`'s props, for deck.gl's `PolygonLayer`. */
export interface SurfaceLayerProps {
  id: string;
  data: SurfaceRow[];
  getPolygon: (d: SurfaceRow) => SurfaceRow["polygon"];
  getFillColor: (d: SurfaceRow) => Rgba;
  coordinateSystem: "cartesian";
  filled: true;
  stroked: false;
}

/** `logoIconLayer` options. */
export interface LogoIconOptions {
  /** Name of the row column holding each logo's x position (a longitude on a map, or a surface's own x). */
  x: string;
  /** Name of the row column holding each logo's y position. */
  y: string;
  /** Name of the row column holding the team (abbreviation, name or id; see `idSystem`). */
  team: string;
  /** The league the teams belong to, e.g. "nhl". */
  league: League;
  /** A season (number or string) for every row, or the name of a row column holding each row's season. */
  season?: SeasonInput;
  /** Logo variant, e.g. "dark". Default "default". */
  variant?: Variant;
  /** How the `team` values are read. Default "auto". */
  idSystem?: IdSystem;
  /** The logo's height on screen in px, 1 or more (deck.gl's `getSize` in "pixels" units). Default 32. */
  size?: number;
  /** The layer's opacity in [0, 1]. Default 1. */
  alpha?: number;
  /** The layer id. Default "sdvplot-logos". */
  id?: string;
}
/** `passArcLayer` options. */
export interface PassArcOptions {
  /** Name of the row column holding each arc's source x. */
  x: string;
  /** Name of the row column holding each arc's source y. */
  y: string;
  /** Name of the row column holding each arc's target x. */
  xend: string;
  /** Name of the row column holding each arc's target y. */
  yend: string;
  /** Name of the row column holding the team the arc is coloured by. */
  team: string;
  /** The league the teams belong to, e.g. "soccer". */
  league: League;
  /** The season the teams are resolved for. */
  season?: SeasonInput;
  /** How the `team` values are read. Default "auto". */
  idSystem?: IdSystem;
  /** The colour at the source end, "primary" (default) or "secondary"; the target end takes the other. */
  which?: Which;
  /**
   * The background the arcs are drawn on. Given, each end's colour keeps 3:1 contrast against it (dark mode) and
   * stays distinct (CIE76 ΔE of 20 or more) from every other team's colour at that end, through the shared team
   * palette, as `teamColorPalette` does in the other adapters. Caveat: a colour that does not read gives way to the
   * team's other colour, so when only one of a team's two colours reads on the background, both ends take it and the
   * arcs no longer show their direction (France's navy and mint on a dark pitch are both mint). Pick a background on
   * which both colours read (France's both read on a mid-tone green such as `#4a7f3a`), or check that
   * `sourceColor` and `targetColor` differ.
   */
  background?: string;
  /** The colour of a team that does not resolve, or has no colour. Default "#808080". */
  fallback?: string;
  /** The arc's width in px, 1 or more. Default 2. */
  width?: number;
  /** The layer's opacity in [0, 1]. Default 1. */
  alpha?: number;
  /**
   * deck.gl's `getHeight`, how high each arc rises for its length, 0 or more (0 draws a straight line). Default none:
   * deck.gl's 1. Lower, such as 0.3, keeps arcs laid flat (`tilt: 90`) close to their chord, inside the surface.
   */
  height?: number;
  /**
   * deck.gl's `getTilt`, degrees in [-90, 90]: 90 lays each arc flat on the surface, so a top-down 2D view (an
   * OrthographicView) shows the curve. Default none: deck.gl's upright arcs, for a pitched 3D view.
   */
  tilt?: number;
  /** The layer id. Default "sdvplot-arcs". */
  id?: string;
}
/** `surfaceLayer` options: sporty's own `surface()` options for the sport, plus the layer id. */
export type SurfaceLayerOptions<S extends Sport> = OptionsOf<S> & {
  /** The layer id. Default "sdvplot-surface". */
  id?: string;
};

/** The px height an icon is packed into deck.gl's atlas at (the logo is drawn at `size`, so this is its sharpness). */
const ICON_PX = 128;
const real = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
function checkPx(name: string, v: unknown): number {
  if (!real(v) || v < 1) throw new InputError(`${name} is in px, 1 or more, got ${String(v)}`);
  return v;
}
/** `#rrggbb` / `#rrggbbaa` as deck.gl's `[r, g, b, a]`. */
function rgba(color: string): Rgba {
  const c = String(color).trim().replace(/^#+/, "");
  const a = c.length === 8 ? Number.parseInt(c.slice(6), 16) : 255;
  const [r, g, b] = [1, 3, 5].map((i) =>
    Number.parseInt(hex6(color, { dropAlpha: true }).slice(i, i + 2), 16),
  );
  return [r as number, g as number, b as number, a];
}

/**
 * deck.gl `IconLayer` props drawing each row's team logo at its (x, y). The logos are auto-packed icons: deck.gl
 * fetches each URL once and packs it into its own atlas, at 128 px tall and the logo's aspect, centred on the point.
 * A team with no logo (or one that does not resolve) is left out with one warning, as the other adapters do; so is a
 * row with a missing x or y. `x` and `y` are in the layer's coordinates: longitude and latitude on a map, or a
 * surface's own units on `surfaceLayer` (set `coordinateSystem: "cartesian"` on both, or use a non-geographic view).
 *
 * @example
 * ```ts
 * import { loadLeague } from "@sportsdataverse/sdvplot";
 * import { logoIconLayer } from "@sportsdataverse/sdvplot/deckgl";
 *
 * await loadLeague("nhl");
 * // Edmonton's first shot of game 7 of the 2024 Stanley Cup Final (NHL api-web), in feet from centre ice
 * const shot = { team: "EDM", x: 82, y: -3 };
 * const props = logoIconLayer([shot], { x: "x", y: "y", team: "team", league: "nhl", size: 28 });
 * // in the browser: new IconLayer({ ...props, coordinateSystem: "cartesian" })
 * props.data[0]?.icon.url;
 * ```
 */
export function logoIconLayer(rows: readonly Row[], o: LogoIconOptions): LogoIconLayerProps {
  const size = checkPx("size", o.size ?? 32);
  const opacity = checkAlpha(o.alpha ?? 1);
  const data = markPlacements(rows, "logo", o).map((p): IconRow => {
    const height = ICON_PX;
    return {
      position: [Number(p.x), Number(p.y)],
      icon: { url: p.url, width: Math.round(ICON_PX * aspect(p)), height, anchorY: height / 2, mask: false },
      team: p.id,
      index: p.index,
    };
  });
  return {
    id: o.id ?? "sdvplot-logos",
    data,
    getPosition: (d) => d.position,
    getIcon: (d) => d.icon,
    getSize: size,
    sizeUnits: "pixels",
    opacity,
  };
}

/** An unresolved team value as text, the same in Python: a number without ".0", a missing one empty. */
const label = (t: unknown): string =>
  t === null || t === undefined ? "" : typeof t === "number" ? (normValue(t) ?? "") : String(t);

/**
 * One colour per distinct team at one end of the arcs (`ids[j]` null for a team that did not resolve): the teams'
 * `which` colours, or the shared palette of them on `background`. A team that did not resolve takes the fallback and
 * stays out of the palette, so it never moves a real team's colour (and no warning names it).
 */
function endColors(ids: readonly (string | null)[], o: PassArcOptions, which: Which): string[] {
  const fallback = hex6(o.fallback ?? "#808080");
  const co = { idSystem: "team_id" as const, ...(o.season === undefined ? {} : { season: o.season }) };
  const known = ids.filter((id): id is string => id !== null);
  const main = colorList(o.league, known, { ...co, which });
  const other = colorList(o.league, known, { ...co, which: which === "primary" ? "secondary" : "primary" });
  // a team with no `which` colour (often no secondary) takes its other colour, then the fallback
  let colors = main.map((c, i) => hex6(c ?? other[i] ?? fallback, { dropAlpha: true }));
  if (o.background !== undefined) colors = teamPalette(colors, other, hex6(o.background), known);
  let k = 0;
  return ids.map((id) => (id === null ? fallback : (colors[k++] as string)));
}

/**
 * deck.gl `ArcLayer` props: one arc per row from (x, y) to (xend, yend), in the team's colours: its primary colour at
 * the source and its secondary at the target (`which: "secondary"` swaps them), so the two ends tell the direction
 * apart where the two colours differ (see `background`). Each team keeps one colour per end, the teams taken in the
 * order they first appear. With `background`, every colour keeps 3:1 contrast against it and stays distinct from the
 * other teams' (the shared team palette). A team that does not resolve takes `fallback`; a row with a missing
 * coordinate is left out with one warning.
 *
 * @example
 * ```ts
 * import { loadLeague } from "@sportsdataverse/sdvplot";
 * import { passArcLayer } from "@sportsdataverse/sdvplot/deckgl";
 *
 * await loadLeague("soccer");
 * // France's first completed pass of the 2018 World Cup final (StatsBomb open data through SPADL, metres from the
 * // corner); France is ESPN soccer team 478
 * const pass = { team: "478", start_x: 54.68750000000001, start_y: 6.375, end_x: 56.4375, end_y: 1.2750000000000057 };
 * const props = passArcLayer([pass], {
 *   x: "start_x",
 *   y: "start_y",
 *   xend: "end_x",
 *   yend: "end_y",
 *   team: "team",
 *   league: "soccer",
 *   idSystem: "team_id",
 *   tilt: 90,
 * });
 * // in the browser: new ArcLayer({ ...props, coordinateSystem: "cartesian" })
 * props.data[0]?.sourceColor;
 * ```
 */
export function passArcLayer(rows: readonly Row[], o: PassArcOptions): PassArcLayerProps {
  const width = checkPx("width", o.width ?? 2);
  const opacity = checkAlpha(o.alpha ?? 1);
  if (o.tilt !== undefined && !(real(o.tilt) && o.tilt >= -90 && o.tilt <= 90))
    throw new InputError(`tilt is in degrees, in [-90, 90], got ${String(o.tilt)}`);
  if (o.height !== undefined && !(real(o.height) && o.height >= 0))
    throw new InputError(`height is an arc's height multiplier, 0 or more, got ${String(o.height)}`);
  const cols = [o.x, o.y, o.xend, o.yend].map((c, k) =>
    column(rows, c, ["x", "y", "xend", "yend"][k] as string),
  );
  const teams = column(rows, o.team, "team");
  const keep: number[] = [];
  const missing: Value[] = [];
  rows.forEach((_, i) => {
    if (cols.every((c) => real(c[i]))) keep.push(i);
    else missing.push(teams[i] as Value);
  });
  if (missing.length > 0) {
    const shown =
      missing.slice(0, 10).map(String).join(", ") +
      (missing.length > 10 ? ` and ${missing.length - 10} more` : "");
    warn(
      `deckgl:arcs:${o.league}:missing:${shown}`,
      `skipped ${missing.length} arc(s) with a missing coordinate: ${shown}`,
    );
  }
  const ro = {
    ...(o.season === undefined ? {} : { season: o.season }),
    ...(o.idSystem === undefined ? {} : { idSystem: o.idSystem }),
  };
  const kept = keep.map((i) => teams[i] as Value);
  const resolved = resolveSync(kept, o.league, ro);
  // one colour per distinct team, in order of first appearance; an unresolved team is keyed by its own value
  const keys = kept.map((t, j) => resolved[j] ?? `?${label(t)}`);
  const distinct = [...new Set(keys)];
  const ids = distinct.map((k) => (k.startsWith("?") ? null : k));
  const which = o.which ?? "primary";
  const src = endColors(ids, o, which);
  const tgt = endColors(ids, o, which === "primary" ? "secondary" : "primary");
  const at = new Map(distinct.map((k, j) => [k, j]));
  const data = keep.map((i, j): ArcRow => {
    const k = at.get(keys[j] as string) as number;
    return {
      source: [cols[0]?.[i] as number, cols[1]?.[i] as number],
      target: [cols[2]?.[i] as number, cols[3]?.[i] as number],
      sourceColor: rgba(src[k] as string),
      targetColor: rgba(tgt[k] as string),
      team: resolved[j] ?? label(kept[j]),
      index: i,
    };
  });
  return {
    id: o.id ?? "sdvplot-arcs",
    data,
    getSourcePosition: (d) => d.source,
    getTargetPosition: (d) => d.target,
    getSourceColor: (d) => d.sourceColor,
    getTargetColor: (d) => d.targetColor,
    getWidth: width,
    widthUnits: "pixels",
    opacity,
    ...(o.height === undefined ? {} : { getHeight: o.height }),
    ...(o.tilt === undefined ? {} : { getTilt: o.tilt }),
  };
}

type Pt = readonly [x: number, y: number];
/**
 * A feature's path as closed loops. sporty (after sportyR) draws some features as two loops in one path, such as a
 * faceoff circle's two half rings each closing back on its first point: an SVG or canvas fill draws that as it is, but
 * deck.gl triangulates a polygon as one simple ring and fills the wrong side of it. A loop ends where the path comes
 * back to that loop's first point, after at least two other points (a repeated first point does not end it). The
 * same rule is in sdvplot.pydeck. ponytail: a loop inside another would be filled, not cut out as a hole; sporty
 * builds every ring from two half rings, so none is.
 */
function loops(points: readonly Pt[]): Pt[][] {
  const out: Pt[][] = [];
  let loop: Pt[] = [];
  let away = 0; // points of this loop that are not its first
  for (const p of points) {
    const first = loop[0];
    loop.push(p);
    if (first === undefined) continue;
    if (p[0] !== first[0] || p[1] !== first[1]) away++;
    else if (away >= 2) {
      out.push(loop);
      loop = [];
      away = 0;
    }
  }
  if (away >= 2) out.push(loop); // an open path, closed by deck.gl
  return out;
}

// Copied from ./three/surface.ts (PR #79), where the three.js surface needs the same split: kept here so this PR stands
// alone. ponytail: one shared internal module (src/rings.ts) for both once both have merged.
const turn = (a: Pt, b: Pt, c: Pt): number => (b[0] - a[0]) * (c[1] - a[1]) - (c[0] - a[0]) * (b[1] - a[1]);
function signedArea(r: readonly Pt[]): number {
  let s = 0;
  for (let i = 0; i < r.length; i++) {
    const [a, b] = [r[i] as Pt, r[(i + 1) % r.length] as Pt];
    s += a[0] * b[1] - b[0] * a[1];
  }
  return s / 2;
}
/**
 * No area to fill: a path that goes out along a line and back along it (the NLL goal fan), which a fill leaves
 * invisible, as sporty's own SVG does, or the sliver left where a ring touched itself.
 */
function empty(r: readonly Pt[]): boolean {
  let [x0, y0, x1, y1] = [
    Number.POSITIVE_INFINITY,
    Number.POSITIVE_INFINITY,
    Number.NEGATIVE_INFINITY,
    Number.NEGATIVE_INFINITY,
  ];
  for (const [x, y] of r)
    [x0, y0, x1, y1] = [Math.min(x0, x), Math.min(y0, y), Math.max(x1, x), Math.max(y1, y)];
  return r.length < 3 || Math.abs(signedArea(r)) <= 1e-9 * ((x1 - x0) ** 2 + (y1 - y0) ** 2);
}
/**
 * A ring that crosses itself split at each crossing into rings that do not, each to be filled: what an SVG (nonzero)
 * fill shows of a figure-of-eight, and what deck.gl's earcut cannot triangulate. sporty has a few: the NHL goaltender's
 * trapezoids and some faceoff hash marks twist at their corners by an inch.
 */
function simple(r: readonly Pt[]): Pt[][] {
  const n = r.length;
  const side = (a: Pt, b: Pt, c: Pt): number => Math.sign(turn(a, b, c));
  for (let i = 0; i < n; i++)
    for (let j = i + 2; j < n; j++) {
      if (i === 0 && j === n - 1) continue; // neighbours across the closing edge
      const [a, b, c, d] = [r[i] as Pt, r[(i + 1) % n] as Pt, r[j] as Pt, r[(j + 1) % n] as Pt];
      if (side(a, b, c) * side(a, b, d) >= 0 || side(c, d, a) * side(c, d, b) >= 0) continue;
      const s = turn(c, d, a) / (turn(c, d, a) - turn(c, d, b)); // where the crossing is along a -> b
      const x: Pt = [a[0] + s * (b[0] - a[0]), a[1] + s * (b[1] - a[1])];
      return [
        ...simple([...r.slice(0, i + 1), x, ...r.slice(j + 1)]),
        ...simple([x, ...r.slice(i + 1, j + 1)]),
      ];
    }
  return [[...r]];
}

const drawn = (f: PolygonFeature): boolean =>
  f.points.length > 0 &&
  f.points.every(([x, y]) => Number.isFinite(x) && Number.isFinite(y)) &&
  !(f.fill.length === 9 && f.fill.endsWith("00"));

/**
 * deck.gl `PolygonLayer` props drawing sporty's playing surface for `sport` and `league` (sporty's own league keys,
 * e.g. `surfaceLayer("hockey", "nhl")`, `surfaceLayer("soccer", "fifa")`), in the surface's own coordinates: deck.gl's
 * `"cartesian"` coordinate system, in the surface's units (feet for a rink, metres for a pitch) with the origin at its
 * centre, the frame sporty draws in and NHL api-web's shot coordinates are in. Each closed loop of a polygon feature
 * is one data row (a faceoff circle is two: its half rings; a loop that crosses itself is split at the crossing into
 * rings that do not, and a loop with no area is left out), in sporty's drawing order, filled with its colour (alpha
 * included). sporty's default strokes equal their fills, so
 * the layer is fill-only; a hidden feature (a `#rrggbb00` fill) and text features (a football field's yard numbers)
 * are left out. `o` is passed to sporty's `surface()` (`updates`, `colorUpdates`, `units`, `rotation`, ...); sporty's
 * own errors escape unwrapped. Draw it with deck.gl's OrthographicView.
 *
 * @example
 * ```ts
 * import { surfaceLayer } from "@sportsdataverse/sdvplot/deckgl";
 *
 * const rink = surfaceLayer("hockey", "nhl");
 * // in the browser: new PolygonLayer(rink), in a Deck with views: new OrthographicView({ flipY: false })
 * rink.data.length;
 * ```
 */
export function surfaceLayer<S extends Sport>(
  sport: S,
  league: LeagueOf<S>,
  o: SurfaceLayerOptions<S> = {} as SurfaceLayerOptions<S>,
): SurfaceLayerProps {
  const { id = "sdvplot-surface", ...opts } = o;
  const scene = sportySurface(sport, league, opts as OptionsOf<S>);
  // ponytail: features draw in array order (sporty's zIndex is its position); sort here if that ever changes
  const data = scene.features
    .filter((f): f is PolygonFeature => f.kind === "polygon" && drawn(f))
    .flatMap((f) =>
      loops(f.points)
        .flatMap(simple)
        .filter((r) => !empty(r))
        .map((polygon): SurfaceRow => ({ name: f.name, polygon, fillColor: rgba(f.fill) })),
    );
  return {
    id,
    data,
    getPolygon: (d) => d.polygon,
    getFillColor: (d) => d.fillColor,
    coordinateSystem: "cartesian",
    filled: true,
    stroked: false,
  };
}
