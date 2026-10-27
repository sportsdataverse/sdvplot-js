/**
 * The Recharts adapter: team logos and player headshots as Recharts render props (a series' `dot` or `shape`, an
 * axis' `tick`), and team colours for the series' `stroke` / `fill`. Pure: recharts is never imported (the prop types
 * here are structural, read from recharts 3.8 and later); React's `createElement` builds the SVG `<image>` each prop
 * returns. Call after `loadLeague(league)` / `preloadAll()`. The court / field / rink backdrop is a component,
 * `<SurfaceBackdrop>` in `sdvplot/react`.
 */
import { type ReactElement, createElement } from "react";
import { type Row, aspect, checkAlpha, colorPalette, imageSource, place, seasons } from "./_web.js";
import { InputError, warn } from "./errors.js";
import type { EspnHeadshotLeague } from "./headshots.js";
import { type Placement, placedName } from "./placement.js";
import type { Value } from "./resolve.js";
import type { HeadshotIdSystem, IdSystem, League, MarkType, SeasonInput, Variant, Which } from "./types.js";
export type { Row } from "./_web.js";
export { embedSources } from "./_web.js"; // public: build `embed` with it, as for the other adapters

/** What Recharts hands a series' `dot` (Line, Area, Radar) or `shape` (Scatter) render prop: the subset read here. */
export interface RechartsDotProps {
  /** The point's centre in px. */
  cx?: number | string | undefined;
  cy?: number | string | undefined;
  /** The point's index in its series. */
  index?: number | undefined;
  /** The series' points (a Line's or Area's `dot`), so `last` can find the final one. */
  points?: readonly unknown[] | undefined;
  /** The data row the point was drawn from. */
  // biome-ignore lint/suspicious/noExplicitAny: Recharts types the row `any`; a narrower type would not accept its props
  payload?: any;
}
/** What Recharts hands an axis' `tick` render prop: the subset read here. */
export interface RechartsTickProps {
  /** The tick label's anchor in px. */
  x?: number | string | undefined;
  y?: number | string | undefined;
  /** The tick: `value` is the category the axis shows (a team). */
  // biome-ignore lint/suspicious/noExplicitAny: Recharts types the tick value `any`
  payload?: { value?: any } | undefined;
  /** Which side of the plot the axis is on. Default "bottom". */
  orientation?: string | undefined;
  /** The axis' tick text colour, kept for a category drawn as text. */
  fill?: string | undefined;
}
/** A render prop for a series' `dot` or `shape`: an `<image>`, or nothing where no image can be drawn. */
export type DotRenderer = (props: RechartsDotProps) => ReactElement | null;
/** A render prop for an axis' `tick`: an `<image>`, or the category's own text where no image can be drawn. */
export type TickRenderer = (props: RechartsTickProps) => ReactElement;

interface Shared {
  /** Image height in px, 1 or more (Recharts hands a render prop no plot height to take a fraction of). Default 24. */
  size?: number;
  /** Opacity in [0, 1]. Default 1. */
  alpha?: number;
  /**
   * Draw only at the series' last point: an end-dot on a trend line. Default false. It needs the series' `points`,
   * which Recharts hands a Line's or Area's `dot` but not a Scatter's `shape`: there every point is drawn, with one
   * warning.
   */
  last?: boolean;
  /** url → data URI map from `embedSources`, to inline the images. */
  embed?: ReadonlyMap<string, string>;
}
/** `logoDot` options. */
export interface RechartsMarkOptions extends Shared {
  /** Name of the data row column holding the team (abbreviation, name or id; see `idSystem`). */
  team: string;
  /** The league the teams belong to, e.g. "nba". */
  league: League;
  /** A season (number or string) for every row, or the name of a row column holding each row's season. */
  season?: SeasonInput;
  /** Logo variant, e.g. "dark". Default "default". */
  variant?: Variant;
  /** How the `team` values are read. Default "auto". */
  idSystem?: IdSystem;
}
/** `headshotDot` options. */
export interface RechartsHeadshotOptions extends Shared {
  /** Name of the data row column holding the player id. */
  player: string;
  /** The league the players belong to, e.g. "nfl". */
  league: EspnHeadshotLeague;
  /** ESPN athlete ids, or nflverse gsis ids (needs `loadGsis()` first). Default "espn". */
  idSystem?: HeadshotIdSystem;
}
/** `logoTick` options: the axis' categories are the teams. */
export interface RechartsTickOptions {
  /** The league the teams belong to, e.g. "nba". */
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

function checkSize(size: unknown): number {
  if (!(typeof size === "number" && Number.isFinite(size) && size > 0))
    throw new InputError(`size is an image height in px > 0, got ${String(size)}`);
  if (size < 1)
    throw new InputError(
      `size is a height in px, not a fraction of the plot (echarts' \`height\`): got ${size}, which draws a sub-pixel image`,
    );
  return size;
}
const px = (v: unknown): number | undefined => {
  const n = typeof v === "string" ? Number(v) : v;
  return typeof n === "number" && Number.isFinite(n) ? n : undefined;
};
/** The `<image>` of a placed mark, `h` px tall at (x, y) top-left, stamped with what `sdvplot/testing`'s
 *  `drawnMarks` reads back. ponytail: the frame is 1 px, so drawnMarks' `height` reads in px (no plot height here). */
function image(
  p: Placement,
  kind: string,
  label: string,
  at: { x: number; y: number; cx: number; cy: number },
  h: number,
  alpha: number,
  embed: ReadonlyMap<string, string> | undefined,
): ReactElement {
  return createElement("image", {
    href: imageSource(p, embed),
    x: at.x,
    y: at.y,
    width: h * aspect(p),
    height: h,
    preserveAspectRatio: "xMidYMid meet",
    ...(alpha === 1 ? {} : { opacity: alpha }),
    role: "img",
    "aria-label": `${label} ${kind}`,
    "data-sdv-id": p.id,
    "data-sdv-kind": kind,
    "data-sdv-x": String(at.cx),
    "data-sdv-y": String(at.cy),
    "data-sdv-frame": "1",
  });
}

function dot(
  kind: "logo" | "headshot",
  column: string,
  o: RechartsMarkOptions | RechartsHeadshotOptions,
): DotRenderer {
  const h = checkSize(o.size ?? 24);
  const alpha = checkAlpha(o.alpha ?? 1);
  return (props) => {
    const cx = px(props.cx);
    const cy = px(props.cy);
    if (cx === undefined || cy === undefined) return null;
    if (o.last && props.points === undefined)
      warn(
        "recharts:last:no-points",
        "last: true needs the series' points, which a Scatter shape is not given: every point is drawn (use it on a Line or Area dot)",
      );
    else if (o.last && props.points !== undefined && props.index !== props.points.length - 1) return null;
    const row: Row = props.payload ?? {};
    const raw = row[column] as Value;
    if (raw === undefined || raw === null) return null;
    let ps: Placement[];
    if (kind === "headshot") {
      const ho = o as RechartsHeadshotOptions;
      ps = place([cx], [cy], [raw], { league: ho.league, kind, idSystem: ho.idSystem ?? "espn" });
    } else {
      const mo = o as RechartsMarkOptions;
      const season = seasons([row], mo.season);
      ps = place([cx], [cy], [raw], {
        league: mo.league,
        kind,
        ...(season === undefined ? {} : { season }),
        ...(mo.variant === undefined ? {} : { variant: mo.variant }),
        ...(mo.idSystem === undefined ? {} : { idSystem: mo.idSystem }),
      });
    }
    const p = ps[0];
    if (p === undefined) return null; // no mark: nothing drawn, one warning (placeSync), as sdvplot/echarts
    const w = h * aspect(p);
    return image(
      p,
      kind,
      placedName(p, o.league, raw),
      { x: cx - w / 2, y: cy - h / 2, cx, cy },
      h,
      alpha,
      o.embed,
    );
  };
}

/**
 * Team logos as a series' points: the `dot` of a `<Line>` / `<Area>`, or the `shape` of a `<Scatter>`. Each point
 * draws the logo of its data row's `team` column, `size` px tall and centred on the point; `last: true` draws only
 * the series' final point (an end-dot). A team with no logo draws nothing and warns once, as `sdvplot/echarts` does.
 *
 * @example
 * ```tsx
 * import { loadLeague } from "@sportsdataverse/sdvplot";
 * import { logoDot } from "@sportsdataverse/sdvplot/recharts";
 * import { Scatter, ScatterChart, XAxis, YAxis } from "recharts";
 *
 * await loadLeague("nfl");
 * const rows = [
 *   { team: "KC", pf: 385, pa: 326 },
 *   { team: "LAC", pf: 402, pa: 301 },
 * ];
 * <ScatterChart width={400} height={300}>
 *   <XAxis dataKey="pf" type="number" domain={[350, 450]} />
 *   <YAxis dataKey="pa" type="number" domain={[280, 350]} />
 *   <Scatter data={rows} shape={logoDot({ team: "team", league: "nfl", size: 32 })} />
 * </ScatterChart>;
 * ```
 */
export function logoDot(o: RechartsMarkOptions): DotRenderer {
  return dot("logo", o.team, o);
}

/** ESPN player headshots as a series' points (`dot` or `shape`), from the data row's `player` column; an id with no
 *  headshot draws nothing and warns once. `idSystem: "gsis"` needs `loadGsis()` first. */
export function headshotDot(o: RechartsHeadshotOptions): DotRenderer {
  return dot("headshot", o.player, o);
}

/**
 * Team logos as an axis' tick labels: the `tick` of a category `<XAxis>` / `<YAxis>` whose values are teams. The
 * logo sits where the label would (under a bottom axis, left of a left one). A category that resolves to no logo keeps
 * its text label, as `sdvplot/echarts`' `withAxisLogos` does.
 */
export function logoTick(o: RechartsTickOptions): TickRenderer {
  const h = checkSize(o.size ?? 24);
  const kind = o.markType ?? "logo";
  return (props) => {
    const x = px(props.x) ?? 0;
    const y = px(props.y) ?? 0;
    const value = props.payload?.value;
    const side = props.orientation ?? "bottom";
    const p = place([x], [y], [value as Value], {
      league: o.league,
      kind,
      ...(o.season === undefined ? {} : { season: o.season }),
      ...(o.variant === undefined ? {} : { variant: o.variant }),
      ...(o.idSystem === undefined ? {} : { idSystem: o.idSystem }),
    })[0];
    if (p === undefined) {
      const left = side === "left";
      const anchor = left ? "end" : side === "right" ? "start" : "middle";
      const dy = side === "bottom" ? "0.71em" : side === "top" ? "0" : "0.355em";
      return createElement(
        "text",
        // Recharts' own tick classes, so a stylesheet that styles its tick text styles this one too
        {
          className: "recharts-text recharts-cartesian-axis-tick-value",
          x,
          y,
          textAnchor: anchor,
          dy,
          fill: props.fill ?? "#666",
        },
        String(value ?? ""),
      );
    }
    const w = h * aspect(p);
    const at =
      side === "left"
        ? { x: x - w, y: y - h / 2 }
        : side === "right"
          ? { x, y: y - h / 2 }
          : side === "top"
            ? { x: x - w / 2, y: y - h }
            : { x: x - w / 2, y };
    return image(p, kind, placedName(p, o.league, value), { ...at, cx: x, cy: y }, h, 1, o.embed);
  };
}

/** `teamColorPalette` options. */
export interface RechartsColorOptions {
  which?: Which;
  season?: SeasonInput;
  idSystem?: IdSystem;
  /** The colour of an unresolved team. Default "#808080". */
  fallback?: string;
  /**
   * The chart's background. Given, a team colour under 3:1 contrast against it is swapped for the team's other
   * colour, else moved towards white (on a dark background) or black (a light one) until it reads: dark mode. A
   * colour that would then sit too close to an earlier team's (CIE76 ΔE under 20) takes the team's other colour, or
   * the nearest colour to its own (lightness, hue or chroma stepped) that is distinct and still reads; failing that it
   * is kept, with one warning.
   */
  background?: string;
}
/**
 * One colour per team, in order, for each series' `stroke` / `fill`. With `background`, every colour keeps 3:1
 * contrast against it (dark mode) and stays distinct from the others.
 *
 * @example
 * ```tsx
 * import { loadLeague } from "@sportsdataverse/sdvplot";
 * import { teamColorPalette } from "@sportsdataverse/sdvplot/recharts";
 *
 * await loadLeague("nba");
 * teamColorPalette("nba", ["Clippers", "Suns", "Lakers"], { background: "#181a1b" });
 * ```
 */
export function teamColorPalette(
  league: League,
  teams: readonly unknown[],
  o: RechartsColorOptions = {},
): string[] {
  return colorPalette(league, teams, o);
}
