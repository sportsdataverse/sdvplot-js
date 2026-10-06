import { readFileSync } from "node:fs";
import { expect, test } from "vitest";
import {
  UnknownLeagueError,
  VERSION,
  colorKeys,
  displayRanges,
  features,
  leagues,
  surface,
} from "../src/index.js";

test("VERSION equals package.json", () => {
  const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")) as {
    version: string;
  };
  expect(VERSION).toBe(pkg.version);
});

test("surface dispatches to the three ported sports", () => {
  for (const sport of ["basketball", "hockey", "football"] as const) {
    const lg = leagues(sport)[0] ?? "";
    expect(surface(sport, lg).sport).toBe(sport);
    expect(features(sport).length).toBeGreaterThan(0);
    expect(displayRanges(sport)).toContain("full");
    expect(colorKeys(sport).length).toBeGreaterThan(0);
  }
  expect(surface("basketball", "NBA").league).toBe("nba");
});

test("unported sports throw UnknownLeagueError", () => {
  expect(() => surface("soccer", "fifa")).toThrow(UnknownLeagueError);
  expect(() => surface("tennis", "x")).toThrow("tennis is not ported yet; see the roadmap in README");
  for (const f of [leagues, features, displayRanges, colorKeys])
    expect(() => f("curling")).toThrow(UnknownLeagueError);
});
