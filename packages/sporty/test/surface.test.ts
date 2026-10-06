import { expect, test } from "vitest";
import { basketballCourt } from "../src/basketball/court.js";
import { footballField } from "../src/football/field.js";
import { hockeyRink } from "../src/hockey/rink.js";
import { BASKETBALL_SPECS } from "../src/specs/basketball.js";
import { SportyError, arcResolution, colorAt } from "../src/surface.js";

test("colorAt recycles like R's data.frame (modulo), not last-colour fallback", () => {
  expect(colorAt(["a", "b"], 2)).toBe("a");
  expect(colorAt("c", 5)).toBe("c");
});

test("arcResolution must be an integer >= 2 (default 200), in every assembler", () => {
  expect(arcResolution(undefined)).toBe(200);
  expect(arcResolution(2)).toBe(2);
  for (const bad of [1, 0, -5, 2.5, Number.NaN, Number.POSITIVE_INFINITY]) {
    expect(() => arcResolution(bad)).toThrow(SportyError);
    expect(() => basketballCourt("nba", { arcResolution: bad })).toThrow(SportyError);
    expect(() => hockeyRink("nhl", { arcResolution: bad })).toThrow(SportyError);
    expect(() => footballField("nfl", { arcResolution: bad })).toThrow(SportyError);
  }
});

test("generated specs are frozen (league table and each league)", () => {
  expect(Object.isFrozen(BASKETBALL_SPECS)).toBe(true);
  expect(Object.isFrozen(BASKETBALL_SPECS.nba)).toBe(true);
});
