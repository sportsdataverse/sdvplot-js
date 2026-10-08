import { readFileSync } from "node:fs";
import { beforeAll, describe, expect, test } from "vitest";
import { teamColorsSync } from "../src/colors.js";
import { contrast } from "../src/contrast.js";
import { INDEX_VERSION } from "../src/data/index.js";
import { InputError, resetWarnings, setWarningHandler } from "../src/errors.js";
import { loadLeague } from "../src/index-data.js";
import { deltaE2000, deltaE2000Lab, matchupColors, matchupColorsSync } from "../src/matchup-colors.js";

type Pair = { home: string; away: string };
type Source = { color: string; alternateColor: string | null };
type Case = {
  game_id: string;
  why: string;
  home_id: string;
  away_id: string;
  home: string;
  away: string;
  input: { home: Source; away: Source };
  expected: { light: Pair; dark: Pair };
};
const oracle = JSON.parse(
  readFileSync(new URL("../../../fixtures/matchup-colors/oracle.json", import.meta.url), "utf8"),
) as { meta: { index_version: string }; cases: Case[] };

beforeAll(async () => {
  await loadLeague("cfb");
});

// Sharma, Wu and Dalal (2005), Table 1: L*a*b* pairs and their CIEDE2000, to 4 decimals.
const SHARMA: [[number, number, number], [number, number, number], string][] = [
  [[50, 2.6772, -79.7751], [50, 0, -82.7485], "2.0425"],
  [[50, 3.1571, -77.2803], [50, 0, -82.7485], "2.8615"],
  [[50, 2.8361, -74.02], [50, 0, -82.7485], "3.4412"],
  [[50, -1.3802, -84.2814], [50, 0, -82.7485], "1.0000"],
  [[50, -1.1848, -84.8006], [50, 0, -82.7485], "1.0000"],
  [[50, -0.9009, -85.5211], [50, 0, -82.7485], "1.0000"],
  [[50, 0, 0], [50, -1, 2], "2.3669"],
  [[50, -1, 2], [50, 0, 0], "2.3669"],
  [[50, 2.49, -0.001], [50, -2.49, 0.0009], "7.1792"],
  [[50, 2.49, -0.001], [50, -2.49, 0.001], "7.1792"],
  [[50, 2.49, -0.001], [50, -2.49, 0.0011], "7.2195"],
  [[50, 2.49, -0.001], [50, -2.49, 0.0012], "7.2195"],
  [[50, -0.001, 2.49], [50, 0.0009, -2.49], "4.8045"],
  [[50, -0.001, 2.49], [50, 0.001, -2.49], "4.8045"],
  [[50, -0.001, 2.49], [50, 0.0011, -2.49], "4.7461"],
  [[50, 2.5, 0], [50, 0, -2.5], "4.3065"],
  [[50, 2.5, 0], [73, 25, -18], "27.1492"],
  [[50, 2.5, 0], [61, -5, 29], "22.8977"],
  [[50, 2.5, 0], [56, -27, -3], "31.9030"],
  [[50, 2.5, 0], [58, 24, 15], "19.4535"],
  [[50, 2.5, 0], [50, 3.1736, 0.5854], "1.0000"],
  [[50, 2.5, 0], [50, 3.2972, 0], "1.0000"],
  [[50, 2.5, 0], [50, 1.8634, 0.5757], "1.0000"],
  [[50, 2.5, 0], [50, 3.2592, 0.335], "1.0000"],
  [[60.2574, -34.0099, 36.2677], [60.4626, -34.1751, 39.4387], "1.2644"],
  [[63.0109, -31.0961, -5.8663], [62.8187, -29.7946, -4.0864], "1.2630"],
  [[61.2901, 3.7196, -5.3901], [61.4292, 2.248, -4.962], "1.8731"],
  [[35.0831, -44.1164, 3.7933], [35.0232, -40.0716, 1.5901], "1.8645"],
  [[22.7233, 20.0904, -46.694], [23.0331, 14.973, -42.5619], "2.0373"],
  [[36.4612, 47.858, 18.3852], [36.2715, 50.5065, 21.2231], "1.4146"],
  [[90.8027, -2.0831, 1.441], [91.1528, -1.6435, 0.0447], "1.4441"],
  [[90.9257, -0.5406, -0.9208], [88.6381, -0.8985, -0.7239], "1.5381"],
  [[6.7747, -0.2908, -2.4247], [5.8714, -0.0985, -2.2286], "0.6377"],
  [[2.0776, 0.0795, -1.135], [0.9033, -0.0636, -0.5514], "0.9082"],
];
test.each(SHARMA)("CIEDE2000 Sharma pair %#", (a, b, want) => {
  expect(deltaE2000Lab(a, b).toFixed(4)).toBe(want);
  expect(deltaE2000Lab(b, a).toFixed(4)).toBe(want); // symmetric
});

describe("Game on Paper parity (fixtures/matchup-colors)", () => {
  test("the fixture was built from these shards", () => {
    expect(oracle.meta.index_version).toBe(INDEX_VERSION);
    expect(oracle.cases.length).toBeGreaterThanOrEqual(30);
    for (const c of oracle.cases) {
      const ids = [c.home_id, c.away_id];
      expect(teamColorsSync("cfb", ids, { idSystem: "espn" })).toEqual([
        c.input.home.color,
        c.input.away.color,
      ]);
      expect(teamColorsSync("cfb", ids, { idSystem: "espn", which: "secondary" })).toEqual([
        c.input.home.alternateColor ?? undefined,
        c.input.away.alternateColor ?? undefined,
      ]);
    }
  });
  test.each(oracle.cases)("$game_id $why: $home vs $away", (c) => {
    const got = matchupColorsSync(c.home_id, c.away_id, { league: "cfb", idSystem: "espn" });
    expect(got).toEqual({
      light: [c.expected.light.home, c.expected.light.away],
      dark: [c.expected.dark.home, c.expected.dark.away],
    });
  });
  test("every pair reads on its background and separates (ΔE2000 at least 20, WCAG at least 2.5)", () => {
    for (const c of oracle.cases) {
      for (const [theme, bg] of [
        ["light", "#ffffff"],
        ["dark", "#181a1b"],
      ] as const) {
        const { home, away } = c.expected[theme];
        expect(contrast(home, bg)).toBeGreaterThanOrEqual(2.5);
        expect(contrast(away, bg)).toBeGreaterThanOrEqual(2.5);
        expect(deltaE2000(home, away)).toBeGreaterThanOrEqual(20);
      }
    }
  });
});

describe("matchupColors", () => {
  test("async loads the league and matches the sync form; names resolve like any team value", async () => {
    const got = await matchupColors("Alabama", "Georgia", { league: "cfb", season: 2025 });
    expect(got).toEqual(matchupColorsSync("333", "61", { league: "cfb", idSystem: "espn" }));
  });
  test("theme sets the backgrounds the pairs must read on", () => {
    const { light, dark } = matchupColorsSync("Alabama", "Georgia", {
      league: "cfb",
      theme: { light: "#000000", dark: "#ffffff" },
    });
    for (const c of light) expect(contrast(c, "#000000")).toBeGreaterThanOrEqual(2.5);
    for (const c of dark) expect(contrast(c, "#ffffff")).toBeGreaterThanOrEqual(2.5);
    expect(() => matchupColorsSync("Alabama", "Georgia", { league: "cfb", theme: { dark: "nope" } })).toThrow(
      InputError,
    );
  });
  test("a team with no colour gets #2394fd, after one unresolved-team warning", () => {
    const seen: string[] = [];
    setWarningHandler((m) => seen.push(m));
    resetWarnings();
    try {
      const { light } = matchupColorsSync("Nowhere State", "Alabama", { league: "cfb" });
      expect(light[0]).toBe("#2394fd");
      expect(seen).toHaveLength(1);
    } finally {
      setWarningHandler(null);
    }
  });
  test("strict rejects an unresolved team", () => {
    expect(() => matchupColorsSync("Nowhere State", "Alabama", { league: "cfb", strict: true })).toThrow();
  });
});
