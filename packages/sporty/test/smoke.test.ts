import { readFileSync } from "node:fs";
import { expect, test } from "vitest";
import { SPORTS, VERSION, colorKeys, displayRanges, features, leagues, surface } from "../src/index.js";

test("VERSION equals package.json", () => {
  const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")) as {
    version: string;
  };
  expect(VERSION).toBe(pkg.version);
});

test("surface dispatches to every sport", () => {
  for (const sport of SPORTS) {
    const lg = leagues(sport)[0] ?? "";
    expect(surface(sport, lg).sport).toBe(sport);
    expect(features(sport).length).toBeGreaterThan(0);
    expect(displayRanges(sport)).toContain("full");
    expect(colorKeys(sport).length).toBeGreaterThan(0);
  }
  expect(surface("basketball", "NBA").league).toBe("nba");
});
