// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react";
import { createElement } from "react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { InputError } from "../src/errors.js";
import { getLeagueSync } from "../src/index-data.js";
import { contrast, logoUrlSync, resetWarnings, resolveSync, setWarningHandler } from "../src/index.js";
import { teamColorPalette } from "../src/recharts.js";
import { type TeamChartConfigOptions, teamChartConfig } from "../src/shadcn.js";
import { MIN_CONTRAST } from "../src/team-palette.js";
import "./_fixtures.js";

beforeEach(() => resetWarnings()); // warn() dedupes per key per process; every test counts its own
afterEach(cleanup);

/** The warnings `fn` emits. */
function warnings(fn: () => void): string[] {
  const out: string[] = [];
  setWarningHandler((m) => out.push(m));
  try {
    fn();
  } finally {
    setWarningHandler(null);
  }
  return out;
}

/**
 * `oklch(L C H)` (CSS Color 4) as sRGB hex: OKLCh -> OKLab -> LMS -> linear sRGB (Björn Ottosson's matrices, as CSS
 * Color 4 gives them) -> the sRGB transfer, rounded per channel and clamped.
 */
function oklchHex(css: string): string {
  const [L, C, H] = (css.match(/[\d.]+/g) ?? []).map(Number) as [number, number, number];
  const a = C * Math.cos((H * Math.PI) / 180);
  const b = C * Math.sin((H * Math.PI) / 180);
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  const rgb = [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
  const srgb = (v: number): number => (v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055);
  return `#${rgb
    .map((v) =>
      Math.round(Math.min(1, Math.max(0, srgb(v))) * 255)
        .toString(16)
        .padStart(2, "0"),
    )
    .join("")}`;
}
/**
 * shadcn's neutral theme, the CLI's default base colour: apps/v4/registry/themes.ts at shadcn-ui/ui commit
 * 8f04138777c1b6996e709993362a7b0a12888ecf (2026-10-26). Light `background` and `card` are both oklch(1 0 0).
 */
const SHADCN = {
  light: "oklch(1 0 0)", // background, card
  darkBackground: "oklch(0.145 0 0)",
  darkCard: "oklch(0.205 0 0)",
};
const AFC_WEST = ["KC", "LAC", "DEN", "LV"];

describe("oklch -> hex", () => {
  test("the conversion lands on known sRGB colours, and on shadcn's backgrounds", () => {
    expect(oklchHex("oklch(0.62796 0.25768 29.2339)")).toBe("#ff0000"); // sRGB red, as CSS Color 4 gives it
    expect(oklchHex("oklch(0.86644 0.29483 142.4953)")).toBe("#00ff00");
    expect(oklchHex(SHADCN.light)).toBe("#ffffff");
    expect(oklchHex(SHADCN.darkCard)).toBe("#171717");
    expect(oklchHex(SHADCN.darkBackground)).toBe("#0a0a0a");
  });
});

describe("teamChartConfig", () => {
  test("one entry per team, under its key: the team's name, a light and a dark colour, its logo", () => {
    const { config, keys } = teamChartConfig("nfl", AFC_WEST);
    expect(keys).toEqual(["kc", "lac", "den", "lv"]);
    expect(Object.keys(config)).toEqual(keys);
    const names = getLeagueSync("nfl").teams;
    AFC_WEST.forEach((t, i) => {
      const item = config[keys[i] as string];
      expect(item?.label).toBe(names.find((n) => n.team_id === resolveSync(t, "nfl"))?.name);
      expect(item?.theme.light).toMatch(/^#[0-9a-f]{6}$/);
      expect(item?.theme.dark).toMatch(/^#[0-9a-f]{6}$/);
      expect(typeof item?.icon).toBe("function");
      expect(item).not.toHaveProperty("color"); // shadcn's ChartConfig takes `color` or `theme`, never both
    });
    expect(config.kc?.label).toBe("Kansas City Chiefs");
  });

  test("the colours are sdvplot/recharts' teamColorPalette on shadcn's light and dark backgrounds", () => {
    const { config, keys } = teamChartConfig("nfl", AFC_WEST);
    const light = teamColorPalette("nfl", AFC_WEST, { background: oklchHex(SHADCN.light) });
    const dark = teamColorPalette("nfl", AFC_WEST, { background: oklchHex(SHADCN.darkCard) });
    expect(keys.map((k) => config[k]?.theme)).toEqual(light.map((l, i) => ({ light: l, dark: dark[i] })));
    // the defaults are those backgrounds: passing them changes nothing
    const given = teamChartConfig("nfl", AFC_WEST, {
      background: { light: oklchHex(SHADCN.light), dark: oklchHex(SHADCN.darkCard) },
    });
    expect(keys.map((k) => given.config[k]?.theme)).toEqual(keys.map((k) => config[k]?.theme));
    // Denver's navy and the Raiders' black do not read on the dark card: their dark colours differ from the light
    expect(config.den?.theme.dark).not.toBe(config.den?.theme.light);
    expect(config.lv?.theme.dark).not.toBe(config.lv?.theme.light);
  });

  test("every colour keeps 3:1 against its theme's backgrounds (light page and card; dark card and page)", () => {
    for (const league of ["nfl", "nba"] as const) {
      const teams = getLeagueSync(league).teams.map((t) => t.team_id);
      let config: ReturnType<typeof teamChartConfig>["config"] = {};
      warnings(() => {
        config = teamChartConfig(league, teams, { icon: false }).config;
      });
      expect(Object.keys(config)).toHaveLength(teams.length);
      for (const { theme } of Object.values(config)) {
        expect(contrast(theme.light, oklchHex(SHADCN.light))).toBeGreaterThanOrEqual(MIN_CONTRAST);
        expect(contrast(theme.dark, oklchHex(SHADCN.darkCard))).toBeGreaterThanOrEqual(MIN_CONTRAST);
        expect(contrast(theme.dark, oklchHex(SHADCN.darkBackground))).toBeGreaterThanOrEqual(MIN_CONTRAST);
      }
    }
  });

  test("custom backgrounds, which, season and idSystem pass through to the palette", () => {
    const o: TeamChartConfigOptions = {
      which: "secondary",
      season: 2024,
      idSystem: "nflverse",
      background: { light: "#f5f5f0", dark: "#1e2229" },
    };
    const { config, keys } = teamChartConfig("nfl", AFC_WEST, o);
    const co = { which: "secondary", season: 2024, idSystem: "nflverse" } as const;
    const light = teamColorPalette("nfl", AFC_WEST, { ...co, background: "#f5f5f0" });
    const dark = teamColorPalette("nfl", AFC_WEST, { ...co, background: "#1e2229" });
    expect(keys.map((k) => config[k]?.theme)).toEqual(light.map((l, i) => ({ light: l, dark: dark[i] })));
  });

  test("keys are CSS-safe: slugged, unicode folded or kept, collisions numbered in order", () => {
    expect(teamChartConfig("nba", ["Trail Blazers", "Lakers"]).keys).toEqual(["trail-blazers", "lakers"]);
    // the same team twice, and values that slug alike, still get a key each, in input order
    expect(teamChartConfig("nba", ["LAL", "lal", "LAL"]).keys).toEqual(["lal", "lal-2", "lal-3"]);
    let keys: string[] = [];
    warnings(() => {
      keys = teamChartConfig("nhl", [
        "a b",
        "a-b",
        "a-b-2",
        "1610612747.0",
        "Montréal Canadiens",
        "Ōsaka 東京",
        "🏒",
        "",
      ]).keys;
    });
    expect(keys).toEqual([
      "a-b",
      "a-b-2",
      "a-b-2-2",
      "1610612747-0",
      "montreal-canadiens",
      "osaka-東京",
      "team",
      "team-2",
    ]);
    // a custom property name: letters, digits and inner dashes only (no space, dot, colon or leading dash)
    for (const k of keys) expect(k).toMatch(/^[\p{L}\p{N}]+(-[\p{L}\p{N}]+)*$/u);
    // the slug is the same on every call
    expect(teamChartConfig("nba", ["Trail Blazers"]).keys).toEqual(["trail-blazers"]);
  });

  test("the icon draws the team's logo at legend size (16 px, or iconSize), decoratively", () => {
    const { config } = teamChartConfig("nfl", ["KC"]);
    const Icon = config.kc?.icon;
    if (Icon === undefined) throw new Error("no icon");
    const img = render(createElement(Icon)).container.querySelector("img");
    expect(img?.getAttribute("src")).toBe(logoUrlSync("KC", "nfl"));
    expect(img?.getAttribute("alt")).toBe(""); // its label is beside it in the legend and the tooltip
    expect(img?.style.height).toBe("16px");
    expect(img?.getAttribute("data-sdv-id")).toBe(resolveSync("KC", "nfl"));
    const Big = teamChartConfig("nfl", ["KC"], { iconSize: 24 }).config.kc?.icon;
    if (Big === undefined) throw new Error("no icon");
    expect(render(createElement(Big)).container.querySelector("img")?.style.height).toBe("24px");
    for (const iconSize of [0, 0.5, Number.NaN, -3])
      expect(() => teamChartConfig("nfl", ["KC"], { iconSize })).toThrow(InputError);
  });

  test("the icon is the same component on every call with the same logo and size, so React keeps the <img>", () => {
    const a = teamChartConfig("nfl", AFC_WEST).config;
    const b = teamChartConfig("nfl", ["LV", "KC"]).config;
    expect(b.kc?.icon).toBe(a.kc?.icon);
    expect(b.lv?.icon).toBe(a.lv?.icon);
    expect(teamChartConfig("nfl", ["KC"], { iconSize: 20 }).config.kc?.icon).not.toBe(a.kc?.icon);
    // a config built inside render, re-rendered: the same <img> node, not a remount
    function Legend({ n }: { n: number }) {
      const Icon = teamChartConfig("nfl", AFC_WEST).config.kc?.icon;
      return Icon === undefined ? null : <div data-n={n}>{createElement(Icon)}</div>;
    }
    const { container, rerender } = render(<Legend n={1} />);
    const first = container.querySelector("img");
    rerender(<Legend n={2} />);
    expect(container.querySelector("div")?.getAttribute("data-n")).toBe("2");
    expect(container.querySelector("img")).toBe(first);
  });

  test("a team with no logo has no icon (shadcn draws its swatch) and warns once, naming it", () => {
    // Delaware is in the NCAA women's hockey index with colours but no archived logo
    const other = getLeagueSync("ncaa_whockey").teams.find((t) => t.abbr !== "DEL")?.team_id as string;
    const spy = vi.fn();
    setWarningHandler(spy);
    const { config, keys } = teamChartConfig("ncaa_whockey", [other, "DEL"]);
    teamChartConfig("ncaa_whockey", [other, "DEL"]); // a re-render does not warn again
    setWarningHandler(null);
    expect(config[keys[0] as string]?.icon).toBeTypeOf("function");
    expect(config.del).not.toHaveProperty("icon");
    expect(config.del?.label).toBe("Delaware Blue Hens");
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy.mock.calls[0]?.[0]).toMatch(/no logo for DEL \(ncaa_whockey\)/);
  });

  test("icon: false leaves every team to its swatch, with no warning", () => {
    const w = warnings(() => {
      const { config } = teamChartConfig("ncaa_whockey", ["DEL"], { icon: false });
      expect(config.del).not.toHaveProperty("icon");
      expect(
        Object.values(teamChartConfig("nfl", AFC_WEST, { icon: false }).config).some((c) => "icon" in c),
      ).toBe(false);
    });
    expect(w).toEqual([]);
  });

  test("an unknown team keeps its own value as label, the fallback colour and no icon: the resolver's one warning", () => {
    let out: ReturnType<typeof teamChartConfig> | undefined;
    const w = warnings(() => {
      out = teamChartConfig("nfl", ["XXX", "KC"]);
    });
    expect(w).toHaveLength(1);
    expect(w[0]).toMatch(/did not resolve/);
    expect(out?.config.xxx?.label).toBe("XXX");
    expect(out?.config.xxx).not.toHaveProperty("icon");
    expect(contrast(out?.config.xxx?.theme.dark as string, "#171717")).toBeGreaterThanOrEqual(MIN_CONTRAST);
  });

  test("no teams: an empty config", () => {
    expect(teamChartConfig("nfl", [])).toEqual({ config: {}, keys: [] });
  });
});
