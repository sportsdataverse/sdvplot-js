import { beforeAll, beforeEach, expect, test } from "vitest";
import { InputError, loadLeague, resetWarnings, setWarningHandler } from "../src/index.js";
import { checkAlpha, checkHeight, place, placeSync } from "../src/placement.js";

const warned: string[] = [];
beforeAll(() => loadLeague("nfl"));
beforeEach(() => {
  warned.length = 0;
  resetWarnings();
  setWarningHandler((m) => warned.push(m));
});

test("checkHeight accepts (0, 1] and rejects pixels, zero, NaN, strings", () => {
  expect(checkHeight(0.1)).toBe(0.1);
  expect(checkHeight(1)).toBe(1);
  for (const bad of [0, 1.01, 40, Number.NaN, "0.1", null])
    expect(() => checkHeight(bad)).toThrow(InputError);
});
test("checkAlpha accepts [0, 1]", () => {
  expect(checkAlpha(0)).toBe(0);
  expect(() => checkAlpha(1.5)).toThrow(InputError);
});

test("known teams place at their own x/y with the team's logo url and aspect, no warning", () => {
  const p = placeSync([10, 20], [-3, -7], ["LV", "LAR"], { league: "nfl" });
  expect(p.map((m) => [m.id, m.x, m.y])).toEqual([
    [expect.any(String), 10, -3],
    [expect.any(String), 20, -7],
  ]);
  expect(p[0]?.url).toMatch(/^https:\/\/sdv\.nyc3\.cdn\.digitaloceanspaces\.com\//);
  expect(p[0]?.aspect).toBeGreaterThan(0);
  expect(warned).toEqual([]);
});
test("an unknown team is dropped with its own x/y and exactly one warning", () => {
  const p = placeSync([10, 20], [-3, -7], ["XXX", "LV"], { league: "nfl" });
  expect(p.map((m) => [m.x, m.y])).toEqual([[20, -7]]);
  expect(warned).toHaveLength(1);
});
test("missing x or y is skipped with one warning", () => {
  const p = placeSync([10, null, Number.NaN], [-3, -7, -9], ["LV", "LAR", "LAC"], { league: "nfl" });
  expect(p).toHaveLength(1);
  expect(warned).toHaveLength(1);
  expect(warned[0]).toMatch(/missing x or y/);
});
test("headshots place player ids; an unknown id warns once; aspect is HEADSHOT_ASPECT", () => {
  const p = placeSync([10, 20], [-3, -7], ["not-an-id", "3139477"], {
    league: "nfl",
    kind: "headshot",
    idSystem: "espn",
  });
  expect(p.map((m) => [m.id, m.x, m.y])).toEqual([["3139477", 20, -7]]);
  expect(p[0]?.aspect).toBeCloseTo(600 / 436, 6);
  expect(warned).toHaveLength(1);
});
test("length mismatch is an InputError; strict re-throws UnresolvedTeamError", () => {
  expect(() => placeSync([1], [1, 2], ["LV"], { league: "nfl" })).toThrow(InputError);
  expect(() => placeSync([1], [1], ["XXX"], { league: "nfl", strict: true })).toThrow(/XXX/);
});
test("a league without ESPN headshots is an InputError", () => {
  expect(() => placeSync([1], [1], ["1"], { league: "nfl", kind: "headshot" })).not.toThrow();
  expect(() => placeSync([1], [1], ["1"], { league: "epl" as never, kind: "headshot" })).toThrow(InputError);
});
test("place() loads the gsis map for gsis headshots", async () => {
  const p = await place([1], [1], ["00-0033873"], { league: "nfl", kind: "headshot", idSystem: "gsis" });
  expect(p).toHaveLength(1);
  expect(p[0]?.url).toContain("t_headshot_desktop");
});
test("warnings are keyed per bad set: a different set warns again, the same set does not", () => {
  placeSync([null], [1], ["LV"], { league: "nfl" });
  placeSync([null], [1], ["LAR"], { league: "nfl" });
  expect(warned).toHaveLength(2);
  placeSync([null], [1], ["LAR"], { league: "nfl" });
  expect(warned).toHaveLength(2);
});
