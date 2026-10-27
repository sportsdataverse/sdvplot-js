/**
 * The shadcn/ui charts adapter. shadcn's charts are Recharts charts inside its copy-paste `chart.tsx`
 * (`<ChartContainer config>`, `<ChartLegendContent>`, `<ChartTooltipContent>`), configured by a `ChartConfig`:
 * `teamChartConfig` builds that config from teams, with CSS-safe keys, team colours for its light and dark themes,
 * team names as labels and team logos as the legend's and tooltip's icons. Draw the series with `sdvplot/recharts`
 * (`logoTick`, `logoDot`) as for any Recharts chart. Pure: shadcn is not a package (you copy `chart.tsx` into your
 * app) and recharts is never imported, so the config's types are structural (read from shadcn's new-york-v4
 * `chart.tsx`); React's `createElement` builds the icons. Call after `loadLeague(league)` / `preloadAll()`.
 */
import { type ComponentType, type ReactElement, createElement } from "react";
import { place } from "./_web.js";
import { InputError, warn } from "./errors.js";
import { getLeagueSync } from "./index-data.js";
import { teamColorPalette } from "./recharts.js";
import { type Value, resolveSync } from "./resolve.js";
import type { IdSystem, League, SeasonInput, Which } from "./types.js";

/**
 * One team's entry in the config: shadcn's `ChartConfig` item with a `theme` (never a single `color`), so
 * `<ChartStyle>` writes the light colour under the chart and the dark one under `.dark`.
 */
export interface TeamChartConfigItem {
  /** The team's name, e.g. "Kansas City Chiefs" (its own value when it does not resolve). */
  label: string;
  /** The team's colour on a light chart and on a dark one, each 3:1 or more against that theme's background. */
  theme: { light: string; dark: string };
  /** The team's logo, at legend and tooltip size; absent when the team has no logo (shadcn draws its swatch). */
  icon?: ComponentType;
}
/** What `teamChartConfig` returns. */
export interface TeamChartConfig {
  /** shadcn's `ChartConfig`, keyed by `keys`: pass it to `<ChartContainer config>`. */
  config: Record<string, TeamChartConfigItem>;
  /**
   * `keys[i]` is `teams[i]`'s key in `config`: name a series' `dataKey` with it, colour it `var(--color-<key>)`, and
   * put it in a row column for `<ChartTooltipContent nameKey>`.
   */
  keys: string[];
}
/** `teamChartConfig` options. */
export interface TeamChartConfigOptions {
  /** The team colour taken first: "primary" (default) or "secondary". */
  which?: Which;
  /** The season the teams (their names, colours and logos) are resolved for. */
  season?: SeasonInput;
  /** How the `teams` values are read. Default "auto". */
  idSystem?: IdSystem;
  /**
   * The chart backgrounds the colours must read on (3:1 contrast), as hex. Default shadcn's neutral theme: `light`
   * #ffffff (its page and card), `dark` #171717 (its dark card, `oklch(0.205 0 0)`; a colour that reads on it reads
   * on the darker dark page, #0a0a0a, too).
   */
  background?: { light?: string; dark?: string };
  /** `false`: no logos, so shadcn draws its colour swatch for every team. Default true. */
  icon?: boolean;
  /** The logo's height in px, 1 or more. Default 16. */
  iconSize?: number;
}

/** shadcn's neutral theme (new-york-v4 `registry/themes.ts`): light background and card, and the dark card. */
const LIGHT = "#ffffff";
const DARK = "#171717";

/**
 * A CSS-safe key for each value, in order: diacritics dropped, lower-cased, each run of anything but letters and
 * digits made one "-" ("Trail Blazers" -> "trail-blazers", "Montréal" -> "montreal"; other scripts' letters stay,
 * which a custom property name allows), "team" when nothing is left, and "-2", "-3", ... on a key already taken.
 */
function chartKeys(values: readonly unknown[]): string[] {
  const used = new Set<string>();
  return values.map((v) => {
    const base =
      String(v)
        .normalize("NFKD")
        .replace(/\p{M}/gu, "")
        .toLowerCase()
        .replace(/[^\p{L}\p{N}]+/gu, "-")
        .replace(/^-+|-+$/g, "") || "team";
    let key = base;
    for (let n = 2; used.has(key); n++) key = `${base}-${n}`;
    used.add(key);
    return key;
  });
}

// ponytail: one icon component per (logo, size) for the process, so a config rebuilt on every render hands shadcn the
// same component and React keeps the <img>; bounded by the logos a page draws.
const icons = new Map<string, ComponentType>();
function logoIcon(src: string, id: string, h: number, aspect: number): ComponentType {
  const k = `${h}|${src}`;
  let icon = icons.get(k);
  if (icon === undefined) {
    // alt "": shadcn puts the team's label beside it in the legend and the tooltip
    const img = createElement("img", {
      src,
      alt: "",
      width: Math.round(h * aspect),
      height: h,
      style: { height: h, width: "auto", flexShrink: 0 },
      "data-sdv-id": id,
      "data-sdv-kind": "logo",
    });
    const Logo = (): ReactElement => img;
    Logo.displayName = "TeamLogoIcon";
    icon = Logo;
    icons.set(k, icon);
  }
  return icon;
}

/**
 * shadcn's `ChartConfig` for teams: one entry per team, keyed for CSS (team names like "Trail Blazers" are not valid
 * custom property names), with the team's name as `label`, its colour on shadcn's light and dark backgrounds as
 * `theme` (3:1 contrast on each, and distinct from the other teams'), and its logo as `icon`, which
 * `<ChartLegendContent>` and `<ChartTooltipContent>` draw in place of their colour swatch. A team with no logo has
 * no `icon` (shadcn falls back to the swatch) and warns once. The icons are the same components for the same logo
 * on every call, so building the config inside a component's render is safe.
 *
 * @example
 * ```ts
 * import { loadLeague } from "@sportsdataverse/sdvplot";
 * import { teamChartConfig } from "@sportsdataverse/sdvplot/shadcn";
 *
 * await loadLeague("nba");
 * // "Trail Blazers" is not a CSS name: its key is "trail-blazers", a series' dataKey and var(--color-trail-blazers)
 * const { config, keys } = teamChartConfig("nba", ["Trail Blazers", "Lakers"]);
 * [keys, config["trail-blazers"]?.label, config["trail-blazers"]?.theme];
 * ```
 */
export function teamChartConfig(
  league: League,
  teams: readonly unknown[],
  o: TeamChartConfigOptions = {},
): TeamChartConfig {
  const h = o.iconSize ?? 16;
  if (!(typeof h === "number" && Number.isFinite(h) && h >= 1))
    throw new InputError(`iconSize is a logo height in px, 1 or more, got ${String(h)}`);
  const ro = {
    ...(o.season === undefined ? {} : { season: o.season }),
    ...(o.idSystem === undefined ? {} : { idSystem: o.idSystem }),
  };
  const co = { ...ro, ...(o.which === undefined ? {} : { which: o.which }) };
  const light = teamColorPalette(league, teams, { ...co, background: o.background?.light ?? LIGHT });
  const dark = teamColorPalette(league, teams, { ...co, background: o.background?.dark ?? DARK });
  const ids = resolveSync(teams as readonly Value[], league, ro);
  const names = new Map(getLeagueSync(league).teams.map((t) => [t.team_id, t.name ?? t.abbr]));
  const logos = new Map(
    o.icon === false
      ? []
      : place(
          teams.map(() => 0),
          teams.map(() => 0),
          teams as readonly Value[],
          { league, kind: "logo", ...ro, warn: false },
        ).map((p) => [p.index, p]),
  );
  const keys = chartKeys(teams);
  const noLogo: string[] = [];
  const config: Record<string, TeamChartConfigItem> = {};
  keys.forEach((key, i) => {
    const id = ids[i];
    const item: TeamChartConfigItem = {
      label: (id === undefined ? undefined : names.get(id)) ?? String(teams[i]),
      theme: { light: light[i] as string, dark: dark[i] as string },
    };
    const p = logos.get(i);
    if (p !== undefined) item.icon = logoIcon(p.url, p.id, h, p.aspect ?? 1);
    else if (o.icon !== false && id !== undefined) noLogo.push(String(teams[i])); // unresolved: the resolver warned
    config[key] = item;
  });
  if (noLogo.length > 0)
    warn(
      `shadcn:${league}:no-logo:${noLogo.join(",")}`,
      `teamChartConfig: no logo for ${noLogo.join(", ")} (${league}); the legend and tooltip show its colour swatch`,
    );
  return { config, keys };
}
