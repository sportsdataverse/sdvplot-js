import { expect, test } from "vitest";
import {
  SPORTS,
  UnknownLeagueError,
  colorKeys,
  displayRanges,
  features,
  leagues,
  surface,
} from "../src/index.js";
test("surface() dispatches all 9 sports (every league, custom included) and matches the typed entry points", () => {
  for (const sport of SPORTS)
    for (const league of leagues(sport)) {
      const s = surface(sport, league);
      expect(s.sport).toBe(sport);
      expect(s.league).toBe(league);
      expect(s.features.length).toBeGreaterThan(0);
    }
  expect(surface("baseball", "mlb").origin).toBe("home_plate");
  expect(surface("curling", "wcf", { displayRange: "house" }).bbox[1]).toBe(32);
  expect(() => surface("cricket" as never, "ipl")).toThrow(UnknownLeagueError);
  expect(() => surface("soccer", "bundesliga")).toThrow(UnknownLeagueError);
});
test("discovery tables are complete: leagues keep custom, features are Feature.names, colorKeys are colour keys", () => {
  expect(leagues("lacrosse")).toEqual([
    "custom",
    "ncaam",
    "ncaaw",
    "nll",
    "pll",
    "usam",
    "usaw",
    "world lacrosse",
  ]);
  expect(features("curling")).toContain("house_ring");
  expect(colorKeys("curling")).toContain("house_rings");
  expect(displayRanges("tennis")).toContain("receive half");
  expect(displayRanges("tennis")).toContain("receivicehalf");
  expect(SPORTS).toHaveLength(9);
});
