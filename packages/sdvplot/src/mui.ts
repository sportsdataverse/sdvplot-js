/**
 * The MUI X Charts adapter (`@mui/x-charts` 9, the MIT community package): team colours for a chart's `colors` (a
 * palette that follows MUI's light and dark mode) or a series' `colorGetter` (a colour per data point), and team logos
 * and player headshots through MUI's own slots: a scatter's `marker`, a line's `mark` and an axis' `axisTickLabel`.
 * Pure: MUI is never imported (the slot props here are structural, read from @mui/x-charts 9.15 and checked against
 * its own types); React's `createElement` builds the SVG `<image>` each slot returns, so the logos also render on the
 * server. Call after `loadLeague(league)` / `preloadAll()`. `sdvplot/testing`'s `drawnMarks(container)` reads back
 * what the slots drew.
 */
import { type ReactElement, createElement } from "react";
import { aspect, checkAlpha, colorPalette, imageSource, place } from "./_web.js";
import { InputError, warn } from "./errors.js";
import type { EspnHeadshotLeague } from "./headshots.js";
import { type Placement, placedName } from "./placement.js";
import type { Value } from "./resolve.js";
import type { HeadshotIdSystem, IdSystem, League, MarkType, SeasonInput, Variant, Which } from "./types.js";
export { embedSources } from "./_web.js"; // public: build `embed` with it, as for the other adapters

/** `teamColorPalette` and `teamColorGetter` options. */
export interface MuiColorOptions {
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
   * the nearest colour to its own (lightness, hue or chroma stepped) that is distinct and still reads; failing that it
   * is kept, with one warning.
   */
  background?: string;
}

/**
 * One colour per team, in order: a chart's `colors` (series i takes colour i) or a series' `color`. With
 * `background`, every colour keeps 3:1 contrast against it (dark mode) and aims to stay distinct from the others.
 * `teamColors` gives the same colours as a palette that follows MUI's light and dark mode.
 *
 * @example
 * ```tsx
 * import { loadLeague } from "@sportsdataverse/sdvplot";
 * import { teamColorPalette } from "@sportsdataverse/sdvplot/mui";
 *
 * await loadLeague("nfl");
 * teamColorPalette("nfl", ["KC", "LAC", "DEN", "LV"], { background: "#121212" });
 * ```
 */
export function teamColorPalette(
  league: League,
  teams: readonly unknown[],
  o: MuiColorOptions = {},
): string[] {
  return colorPalette(league, teams, o);
}

/** `teamColors` options: the backgrounds the light and dark palettes keep 3:1 contrast against. */
export interface MuiPaletteOptions extends Omit<MuiColorOptions, "background"> {
  /** The chart's background in each mode. Default MUI's own: `{ light: "#ffffff", dark: "#121212" }`. */
  background?: { light?: string; dark?: string };
}
/** MUI's `colors` callback: the palette for the theme's mode. */
export type MuiColorPalette = (mode: "light" | "dark") => string[];

/**
 * Team colours as a chart's `colors`, MUI's palette callback: MUI calls it with the theme's mode, so under a dark
 * `ThemeProvider` every series takes its team colour readable on the dark background (3:1 contrast, distinct from the
 * others), and under a light one readable on white. Series i takes `teams[i]`'s colour: give the series in the same
 * order. Each mode's palette is worked out once, when MUI first asks for it.
 *
 * @example
 * ```tsx
 * import { createTheme, ThemeProvider } from "@mui/material/styles";
 * import { LineChart } from "@mui/x-charts/LineChart";
 * import { loadLeague } from "@sportsdataverse/sdvplot";
 * import { teamColors } from "@sportsdataverse/sdvplot/mui";
 *
 * await loadLeague("nfl");
 * const teams = ["KC", "DEN"];
 * <ThemeProvider theme={createTheme({ palette: { mode: "dark" } })}>
 *   <LineChart
 *     width={400}
 *     height={240}
 *     colors={teamColors("nfl", teams)}
 *     xAxis={[{ data: [1, 2, 3] }]}
 *     series={[
 *       { id: "KC", data: [1, 2, 3] },
 *       { id: "DEN", data: [0, 1, 2] },
 *     ]}
 *   />
 * </ThemeProvider>;
 * ```
 */
export function teamColors(
  league: League,
  teams: readonly unknown[],
  o: MuiPaletteOptions = {},
): MuiColorPalette {
  const { background, ...co } = o;
  const bg = { light: background?.light ?? "#ffffff", dark: background?.dark ?? "#121212" };
  const memo: { light?: string[]; dark?: string[] } = {};
  return (mode) => {
    const m = mode === "dark" ? "dark" : "light";
    memo[m] ??= colorPalette(league, teams, { ...co, background: bg[m] });
    return [...memo[m]];
  };
}

/** What MUI hands a series' `colorGetter`: the data point's index (and value, unused here). */
export interface MuiColorCallbackValue {
  /** The data point's index in its series. */
  dataIndex: number;
}
/**
 * A colour per data point, for a series' `colorGetter` (bar, scatter, line): `teams[i]` is the team of data point
 * i, so each bar or point takes its own team's colour. A team that repeats keeps one colour. With `background`, every
 * colour keeps 3:1 contrast against it (dark mode). A point past the end of `teams` takes `fallback`.
 *
 * @example
 * ```tsx
 * import { BarChart } from "@mui/x-charts/BarChart";
 * import { loadLeague } from "@sportsdataverse/sdvplot";
 * import { teamColorGetter } from "@sportsdataverse/sdvplot/mui";
 *
 * await loadLeague("nfl");
 * const teams = ["KC", "BUF", "BAL"];
 * <BarChart
 *   width={400}
 *   height={240}
 *   xAxis={[{ scaleType: "band", data: teams }]}
 *   series={[{ data: [15, 13, 12], colorGetter: teamColorGetter("nfl", teams) }]}
 * />;
 * ```
 */
export function teamColorGetter(
  league: League,
  teams: readonly unknown[],
  o: MuiColorOptions = {},
): (d: MuiColorCallbackValue) => string {
  const colors = colorPalette(league, teams, o);
  const fallback = o.fallback ?? "#808080";
  return ({ dataIndex }) => colors[dataIndex] ?? fallback;
}

/** What MUI hands a scatter's `marker` slot: the subset read here. */
export interface MuiMarkerProps {
  /** The series the point belongs to. */
  seriesId: string;
  /** The point's index in its series' data. */
  dataIndex: number;
  /** The point's centre in px. */
  x: number;
  /** The point's centre in px. */
  y: number;
  /** The marker's radius in px: the series' `markerSize`. The logo is twice it tall. */
  size: number;
  /** MUI highlights the point (the pointer is on it or its series): drawn 1.2 times as tall. */
  isHighlighted?: boolean;
  /** MUI fades the point (another series is highlighted): drawn at 0.3 of the opacity. */
  isFaded?: boolean;
  /** MUI's click handler, kept on the image. */
  onClick?: ((event: never) => void) | undefined;
}
/** What MUI hands a line's `mark` slot: the subset read here. */
export interface MuiMarkProps {
  /** The series the mark belongs to: by default its id is the team. */
  seriesId: string;
  /** The mark's index along the x axis. */
  dataIndex: number;
  /** The mark's centre in px. */
  x?: number | string | undefined;
  /** The mark's centre in px. */
  y?: number | string | undefined;
  /** The series is hidden (from its legend): nothing is drawn. */
  hidden?: boolean | undefined;
  /** MUI highlights the mark; a logo keeps its size. */
  isHighlighted?: boolean | undefined;
  /** MUI fades the series (another is highlighted): drawn at 0.3 of the opacity. */
  isFaded?: boolean | undefined;
  /** MUI's click handler, kept on the image. */
  onClick?: ((event: never) => void) | undefined;
}
/** What MUI hands an axis' `axisTickLabel` slot: the subset read here. */
export interface MuiTickLabelProps {
  /** The label's anchor in px (in its tick's frame). */
  x?: number | string | undefined;
  /** The label's anchor in px (in its tick's frame). */
  y?: number | string | undefined;
  /** The tick's label: the team, as the axis' `valueFormatter` wrote it. */
  text?: string | undefined;
  /** The label's style: its `textAnchor` and `dominantBaseline` say which side of the anchor it runs. */
  style?: { textAnchor?: string | undefined; dominantBaseline?: string | undefined } | undefined;
  /** MUI's tick label class, kept on the image or the text. */
  className?: string | undefined;
}
/** A scatter's `marker` slot: `<ScatterChart slots={{ marker }}>`. */
export type MuiMarkerSlot = (props: MuiMarkerProps) => ReactElement | null;
/** A line's `mark` slot: `<LineChart slots={{ mark }}>`. */
export type MuiMarkSlot = (props: MuiMarkProps) => ReactElement | null;
/** An axis' `axisTickLabel` slot: `<ChartsXAxis slots={{ axisTickLabel }}>`. */
export type MuiTickLabelSlot = (props: MuiTickLabelProps) => ReactElement;

/** The team (or player) of each data point: one list for every series, or a list per series id. */
export type MuiPointValues = readonly Value[] | Readonly<Record<string, readonly Value[]>>;

interface Shared {
  /** Opacity in [0, 1]. Default 1. MUI's faded points (another series highlighted) draw at 0.3 of it. */
  alpha?: number;
  /** url → data URI map from `embedSources`, to inline the images. */
  embed?: ReadonlyMap<string, string>;
}
interface TeamShared extends Shared {
  /** The league the teams belong to, e.g. "nfl". */
  league: League;
  /** The season the teams are resolved for. */
  season?: SeasonInput;
  /** Logo variant, e.g. "dark". Default "default". */
  variant?: Variant;
  /** "logo" (default) or "wordmark". */
  markType?: MarkType;
  /** How the team values are read. Default "auto". */
  idSystem?: IdSystem;
}
/** `logoMarker` options. */
export interface MuiMarkerOptions extends TeamShared {
  /** The team of each data point (abbreviation, name or id; see `idSystem`): `teams[i]` is point i's. */
  teams: MuiPointValues;
}
/** `headshotMarker` options. */
export interface MuiHeadshotOptions extends Shared {
  /** The player of each data point: `players[i]` is point i's. */
  players: MuiPointValues;
  /** The league the players belong to, e.g. "nfl". */
  league: EspnHeadshotLeague;
  /** ESPN athlete ids, or nflverse gsis ids (needs `loadGsis()` first). Default "espn". */
  idSystem?: HeadshotIdSystem;
}
/** `logoMark` options. */
export interface MuiMarkOptions extends TeamShared {
  /** Each series' team by series id. Default: the series id is the team. */
  teams?: Readonly<Record<string, Value>>;
  /** The logo's height in px, 1 or more (MUI hands a line mark no size). Default 24. */
  size?: number;
}
/** `logoTickLabel` options. */
export interface MuiTickLabelOptions extends Omit<TeamShared, "alpha"> {
  /** The logo's height in px, 1 or more. Default 24: give the axis room (an x axis' `height`, a y axis' `width`). */
  size?: number;
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
/** The event handlers, class, ref and `data-*` MUI put on its own marker, kept on the image (tooltips, highlight). */
function passThrough(props: object): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(props).filter(
      ([k, v]) =>
        v !== undefined && (/^on[A-Z]/.test(k) || k.startsWith("data-") || k === "className" || k === "ref"),
    ),
  );
}

/** The `<image>` of a placed mark, `h` px tall with its top-left at (left, top), stamped with what `sdvplot/testing`'s
 *  `drawnMarks` reads back. ponytail: the frame is 1 px, so drawnMarks' `height` reads in px (no plot height here). */
function image(
  p: Placement,
  kind: string,
  label: string,
  box: { left: number; top: number; h: number },
  at: { x: number; y: number },
  embed: ReadonlyMap<string, string> | undefined,
  extra: Record<string, unknown>,
): ReactElement {
  return createElement("image", {
    ...extra,
    href: imageSource(p, embed),
    x: box.left,
    y: box.top,
    width: box.h * aspect(p),
    height: box.h,
    preserveAspectRatio: "xMidYMid meet",
    role: "img",
    "aria-label": `${label} ${kind}`,
    "data-sdv-id": p.id,
    "data-sdv-kind": kind,
    "data-sdv-x": String(at.x),
    "data-sdv-y": String(at.y),
    "data-sdv-frame": "1",
  });
}

const teamPlace = (x: number, y: number, raw: Value, o: TeamShared): Placement | undefined =>
  place([x], [y], [raw], {
    league: o.league,
    kind: o.markType ?? "logo",
    ...(o.season === undefined ? {} : { season: o.season }),
    ...(o.variant === undefined ? {} : { variant: o.variant }),
    ...(o.idSystem === undefined ? {} : { idSystem: o.idSystem }),
  })[0];

const valueAt = (values: MuiPointValues, seriesId: string, i: number): Value | undefined =>
  (Array.isArray(values) ? values : (values as Record<string, readonly Value[]>)[seriesId])?.[i];

function marker(
  name: string,
  kind: "logo" | "wordmark" | "headshot",
  values: MuiPointValues,
  o: Shared,
  placed: (x: number, y: number, raw: Value) => Placement | undefined,
  league: League,
): MuiMarkerSlot {
  const alpha = checkAlpha(o.alpha ?? 1);
  return (props) => {
    const { seriesId, dataIndex, x, y, size } = props;
    const raw = valueAt(values, seriesId, dataIndex);
    if (raw === undefined || raw === null) {
      warn(
        `mui:${name}:no-value:${seriesId}`,
        `${name}: series ${seriesId} has no ${kind === "headshot" ? "player" : "team"} for point ${dataIndex}: nothing drawn there`,
      );
      return null;
    }
    if (!(size > 0)) {
      warn(`mui:${name}:size:${size}`, `${name}: MUI drew a marker of size ${size} (px): nothing drawn`);
      return null;
    }
    const p = placed(x, y, raw);
    if (p === undefined) return null; // no mark: nothing drawn, one warning (placeSync), as sdvplot/echarts
    // MUI's own marker grows 1.2 times when highlighted and fades to 0.3 when another series is highlighted
    const h = 2 * size * (props.isHighlighted ? 1.2 : 1);
    const w = h * aspect(p);
    const opacity = alpha * (props.isFaded ? 0.3 : 1);
    return image(
      p,
      kind,
      placedName(p, league, raw),
      { left: x - w / 2, top: y - h / 2, h },
      { x, y },
      o.embed,
      { ...passThrough(props), ...(opacity === 1 ? {} : { opacity }) },
    );
  };
}

/**
 * Team logos as a scatter's points: `<ScatterChart slots={{ marker: logoMarker({ league, teams }) }}>`. Point i is
 * drawn as the logo of `teams[i]` (or `teams[seriesId][i]`), centred on the point and twice the series'
 * `markerSize` tall, in px: set `markerSize` on the series. MUI's tooltip, highlight (1.2 times as tall) and fade
 * (0.3 opacity) keep working. A team with no logo draws nothing and warns once, as `sdvplot/echarts` does.
 * Synchronous: call it after `loadLeague(league)`. Build it once (module scope or `useMemo`): a new slot on every
 * render remounts the points.
 *
 * @example
 * ```tsx
 * import { ScatterChart } from "@mui/x-charts/ScatterChart";
 * import { loadLeague } from "@sportsdataverse/sdvplot";
 * import { logoMarker } from "@sportsdataverse/sdvplot/mui";
 *
 * await loadLeague("nfl");
 * const rows = [
 *   { team: "KC", pf: 385, pa: 326 },
 *   { team: "LAC", pf: 402, pa: 301 },
 *   { team: "DEN", pf: 425, pa: 311 },
 * ];
 * const marker = logoMarker({ league: "nfl", teams: rows.map((r) => r.team) });
 * <ScatterChart
 *   width={400}
 *   height={300}
 *   series={[{ data: rows.map((r) => ({ x: r.pf, y: r.pa })), markerSize: 14 }]}
 *   slots={{ marker }}
 * />;
 * ```
 */
export function logoMarker(o: MuiMarkerOptions): MuiMarkerSlot {
  const kind = o.markType ?? "logo";
  return marker("logoMarker", kind, o.teams, o, (x, y, raw) => teamPlace(x, y, raw, o), o.league);
}

/**
 * ESPN player headshots as a scatter's points (`marker` slot), from `players[i]` for point i; twice the series'
 * `markerSize` tall. An id with no headshot draws nothing and warns once. `idSystem: "gsis"` needs `loadGsis()` first.
 *
 * @example
 * ```tsx
 * import { ScatterChart } from "@mui/x-charts/ScatterChart";
 * import { headshotMarker } from "@sportsdataverse/sdvplot/mui";
 *
 * // Patrick Mahomes (ESPN 3139477): 2024, 3,928 passing yards and 26 touchdowns
 * <ScatterChart
 *   width={400}
 *   height={300}
 *   series={[{ data: [{ x: 3928, y: 26 }], markerSize: 20 }]}
 *   slots={{ marker: headshotMarker({ league: "nfl", players: ["3139477"] }) }}
 * />;
 * ```
 */
export function headshotMarker(o: MuiHeadshotOptions): MuiMarkerSlot {
  const idSystem = o.idSystem ?? "espn";
  return marker(
    "headshotMarker",
    "headshot",
    o.players,
    o,
    (x, y, raw) => place([x], [y], [raw], { league: o.league, kind: "headshot", idSystem })[0],
    o.league,
  );
}

/**
 * Team logos as a line's marks: `<LineChart slots={{ mark: logoMark({ league }) }}>`. Each mark is drawn as its
 * series' team logo, `size` px tall and centred on the point: the series' id is the team (or give `teams`, series id
 * to team). Which points get a mark is the series' `showMark`: `({ index }) => index === last` puts one logo at the
 * end of each line. A team with no logo draws nothing and warns once. Build it once (module scope or `useMemo`).
 *
 * @example
 * ```tsx
 * import { LineChart } from "@mui/x-charts/LineChart";
 * import { loadLeague } from "@sportsdataverse/sdvplot";
 * import { logoMark } from "@sportsdataverse/sdvplot/mui";
 *
 * await loadLeague("nfl");
 * const end = ({ index }: { index: number }) => index === 2; // the last of three points
 * <LineChart
 *   width={400}
 *   height={240}
 *   xAxis={[{ data: [1, 2, 3] }]}
 *   series={[
 *     { id: "KC", data: [1, 2, 3], showMark: end },
 *     { id: "DEN", data: [0, 1, 2], showMark: end },
 *   ]}
 *   slots={{ mark: logoMark({ league: "nfl", size: 28 }) }}
 * />;
 * ```
 */
export function logoMark(o: MuiMarkOptions): MuiMarkSlot {
  const h = checkSize(o.size ?? 24);
  const alpha = checkAlpha(o.alpha ?? 1);
  const kind = o.markType ?? "logo";
  return (props) => {
    const x = px(props.x);
    const y = px(props.y);
    if (x === undefined || y === undefined || props.hidden) return null;
    const raw = o.teams === undefined ? props.seriesId : o.teams[props.seriesId];
    if (raw === undefined || raw === null) {
      warn(
        `mui:mark:no-team:${props.seriesId}`,
        `logoMark: no team for series ${props.seriesId} in teams: nothing drawn`,
      );
      return null;
    }
    const p = teamPlace(x, y, raw, o);
    if (p === undefined) return null; // no mark: nothing drawn, one warning (placeSync)
    const w = h * aspect(p);
    const opacity = alpha * (props.isFaded ? 0.3 : 1);
    return image(
      p,
      kind,
      placedName(p, o.league, raw),
      { left: x - w / 2, top: y - h / 2, h },
      { x, y },
      o.embed,
      { ...passThrough(props), ...(opacity === 1 ? {} : { opacity }) },
    );
  };
}

/** Where a box of width w and height h starts, for a label anchored at (x, y) the way `style` would place text. */
function anchored(x: number, y: number, w: number, h: number, style: MuiTickLabelProps["style"]) {
  const a = style?.textAnchor ?? "start";
  const b = style?.dominantBaseline ?? "auto";
  const left = a === "middle" ? x - w / 2 : a === "end" ? x - w : x;
  const top = /^(hanging|text-before-edge)$/.test(b) ? y : /^(central|middle)$/.test(b) ? y - h / 2 : y - h; // alphabetic, auto, ideographic, text-after-edge: the text sits above the anchor
  return { left, top };
}

/**
 * Team logos as an axis' tick labels: `<ChartsXAxis slots={{ axisTickLabel: logoTickLabel({ league }) }} />` on a
 * band axis whose values are teams. The logo sits where MUI would put the label (under a bottom axis, left of a left
 * one), `size` px tall; give the axis room for it (an x axis' `height`, a y axis' `width`). A label that resolves to
 * no logo keeps its text and warns once, as `sdvplot/echarts`' `withAxisLogos` does. The label is the axis'
 * formatted value, so a `valueFormatter` must keep it a team (abbreviation, name or id).
 *
 * Give it to the team axis alone, as a prop of the composition API's `<ChartsXAxis>` / `<ChartsYAxis>`: a chart's
 * `slots` reach every axis (a value axis' label "12" would resolve as team id 12), and in @mui/x-charts 9.15 the
 * `slots` of an axis in the `xAxis` prop are dropped by `BarChart` and the other single-component charts.
 *
 * @example
 * ```tsx
 * import { BarPlot } from "@mui/x-charts/BarChart";
 * import { ChartsContainer } from "@mui/x-charts/ChartsContainer";
 * import { ChartsXAxis } from "@mui/x-charts/ChartsXAxis";
 * import { ChartsYAxis } from "@mui/x-charts/ChartsYAxis";
 * import { loadLeague } from "@sportsdataverse/sdvplot";
 * import { logoTickLabel } from "@sportsdataverse/sdvplot/mui";
 *
 * await loadLeague("nfl");
 * const teams = ["KC", "BUF", "BAL"];
 * <ChartsContainer
 *   width={400}
 *   height={260}
 *   xAxis={[{ id: "teams", scaleType: "band", data: teams, height: 40 }]}
 *   yAxis={[{ id: "wins" }]}
 *   series={[{ type: "bar", data: [15, 13, 12] }]}
 * >
 *   <BarPlot />
 *   <ChartsXAxis axisId="teams" slots={{ axisTickLabel: logoTickLabel({ league: "nfl", size: 28 }) }} />
 *   <ChartsYAxis axisId="wins" />
 * </ChartsContainer>;
 * ```
 */
export function logoTickLabel(o: MuiTickLabelOptions): MuiTickLabelSlot {
  const h = checkSize(o.size ?? 24);
  const kind = o.markType ?? "logo";
  return (props) => {
    const x = px(props.x) ?? 0;
    const y = px(props.y) ?? 0;
    const text = props.text ?? "";
    const p = text === "" ? undefined : teamPlace(x, y, text, o);
    if (p === undefined) {
      // the label as MUI's ChartsText draws one line of it: the anchors as attributes, the rest of the style kept
      const { textAnchor, dominantBaseline, ...style } = props.style ?? {};
      return createElement(
        "text",
        { x, y, className: props.className, textAnchor, dominantBaseline, style },
        text,
      );
    }
    const w = h * aspect(p);
    const box = anchored(x, y, w, h, props.style);
    return image(p, kind, placedName(p, o.league, text), { ...box, h }, { x, y }, o.embed, {
      className: props.className,
    });
  };
}
