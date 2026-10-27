/**
 * The Victory adapter: team colours as a Victory theme (`teamTheme`) or as a `colorScale` (`teamColorPalette`). Pure:
 * victory is never imported (the theme is a plain object, typed structurally and checked against victory 37.3's own
 * `VictoryThemeDefinition`). Call after `loadLeague(league)` / `preloadAll()`. The logos are components, `<LogoPoint>`
 * (a scatter's `dataComponent`) and `<LogoTick>` (an axis' `tickLabelComponent`), in `sdvplot/react`.
 */
import { colorPalette } from "./_web.js";
import { InputError } from "./errors.js";
import type { IdSystem, League, SeasonInput, Which } from "./types.js";
export { embedSources } from "./_web.js"; // public: build `<LogoPoint embed>` / `<LogoTick embed>` with it

/** `teamColorPalette` options. */
export interface VictoryColorOptions {
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
 * One colour per team, in order: a `colorScale` for a `VictoryGroup`, `VictoryStack`, `VictoryPie` or
 * `VictoryLegend`, or a series' `style.data.stroke` / `fill`. With `background`, every colour keeps 3:1 contrast
 * against it (dark mode) and aims to stay distinct from the others (when it cannot, it keeps the readable colour and
 * warns once). It has the shape of `sdvplot/echarts`'
 * `teamColorPalette`; `teamTheme` puts the same colours into a Victory theme.
 *
 * @example
 * ```tsx
 * import { loadLeague } from "@sportsdataverse/sdvplot";
 * import { teamColorPalette } from "@sportsdataverse/sdvplot/victory";
 *
 * await loadLeague("nfl");
 * teamColorPalette("nfl", ["KC", "LAC", "DEN", "LV"], { background: "#181a1b" });
 * ```
 */
export function teamColorPalette(
  league: League,
  teams: readonly unknown[],
  o: VictoryColorOptions = {},
): string[] {
  return colorPalette(league, teams, o);
}

/** `teamTheme` options: the teams, in the order the chart draws them, and an optional theme to build on. */
export interface TeamThemeOptions<T extends object = Record<never, never>> extends VictoryColorOptions {
  /** The league the teams belong to, e.g. "nfl". */
  league: League;
  /** Every team the chart draws, in order: a group's or stack's i-th child takes the i-th colour. */
  teams: readonly unknown[];
  /**
   * The theme to build on, e.g. `VictoryTheme.clean`; its axes, fonts and every other key are kept. Default none: the
   * result then holds only the colours, and Victory draws everything else unstyled.
   */
  base?: T;
}
type Scale = { colorScale: string[] };
type Painted<P extends string> = { style: { data: { [K in P]: string } } };
/** What `teamTheme` writes into the theme. */
export interface TeamThemeColors {
  group: Scale;
  stack: Scale;
  pie: Scale;
  legend: Scale;
  /** A lone series takes the first team's colour. */
  line: Painted<"stroke">;
  area: Painted<"fill">;
  bar: Painted<"fill">;
  scatter: Painted<"fill">;
}

/**
 * A Victory theme from team colours (`teamColorPalette`): the palette as the `colorScale` of every group, stack, pie
 * and legend, so each child of a `VictoryGroup` is drawn in its team's colour, and the first team's colour for a lone
 * line, area, bar or scatter. Built over `base` (a Victory theme), whose other keys and styles are kept. Pass it as a
 * `VictoryChart`'s `theme`. With `background`, every colour keeps 3:1 contrast against it and aims to stay distinct from
 * the others (else the readable colour and one warning); the chart's own background and axis ink are the base theme's to set.
 *
 * @example
 * ```tsx
 * import { loadLeague } from "@sportsdataverse/sdvplot";
 * import { teamTheme } from "@sportsdataverse/sdvplot/victory";
 * import { VictoryBar, VictoryChart, VictoryGroup, VictoryTheme } from "victory";
 *
 * await loadLeague("nfl");
 * const rows = [
 *   { team: "KC", pf: 385 },
 *   { team: "BUF", pf: 525 },
 * ];
 * // each of the group's bars in its team's colour
 * <VictoryChart
 *   theme={teamTheme({ league: "nfl", teams: rows.map((r) => r.team), base: VictoryTheme.clean })}
 *   domainPadding={60}
 * >
 *   <VictoryGroup>
 *     {rows.map((r) => (
 *       <VictoryBar key={r.team} data={[r]} x="team" y="pf" />
 *     ))}
 *   </VictoryGroup>
 * </VictoryChart>;
 * ```
 */
export function teamTheme<T extends object = Record<never, never>>(
  o: TeamThemeOptions<T>,
): T & TeamThemeColors {
  const { league, teams, base, ...co } = o;
  if (teams.length === 0) throw new InputError("teamTheme needs at least one team");
  const colors = teamColorPalette(league, teams, co);
  const first = colors[0] as string;
  type Piece = { style?: { data?: object } };
  const b = (base ?? {}) as Record<string, Piece | undefined>;
  const scale = (k: string): Scale => ({ ...b[k], colorScale: colors });
  const paint = (k: string, prop: "stroke" | "fill"): Piece => ({
    ...b[k],
    style: { ...b[k]?.style, data: { ...b[k]?.style?.data, [prop]: first } },
  });
  return {
    ...b,
    group: scale("group"),
    stack: scale("stack"),
    pie: scale("pie"),
    legend: scale("legend"),
    line: paint("line", "stroke"),
    area: paint("area", "fill"),
    bar: paint("bar", "fill"),
    scatter: paint("scatter", "fill"),
  } as T & TeamThemeColors;
}
