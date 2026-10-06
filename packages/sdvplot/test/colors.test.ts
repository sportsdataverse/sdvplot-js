import { beforeEach, expect, test } from "vitest";
import { palette, teamColors } from "../src/colors.js";
import { InputError, UnresolvedTeamError, resetWarnings, setWarningHandler } from "../src/errors.js";
import { loadLeague } from "../src/index-data.js";
beforeEach(() => {
  resetWarnings();
  setWarningHandler(() => {});
});
test("palette keyed by caller values; whole league keyed by abbr", async () => {
  const p = await palette("nfl", ["KC", "SF"]);
  expect(Object.keys(p)).toEqual(["KC", "SF"]);
  expect(p.KC).toMatch(/^#[0-9a-f]{6}$/);
  const all = await palette("nfl");
  expect(Object.keys(all).length).toBe(32);
  expect(all.KC).toBe(p.KC);
});
test("teamColors mirrors container; secondary; which validated", async () => {
  expect(await teamColors("nfl", "KC", { which: "secondary" })).toMatch(/^#/);
  expect(await teamColors("nfl", ["KC", "ZZZ"])).toEqual([expect.any(String), undefined]);
  await expect(palette("nfl", ["KC"], { which: "tertiary" as never })).rejects.toThrow(InputError);
});
test("a value in the teams list that is a color slot is an InputError (pre-0.1 call shape)", async () => {
  await expect(palette("nfl", ["primary"])).rejects.toThrow(/color slot/);
});

test("shared abbr is keyed by team_id with ONE palette:shared warning", async () => {
  const msgs: string[] = [];
  setWarningHandler((m) => msgs.push(m));
  const p = await palette("ncaa_baseball");
  await palette("ncaa_baseball");
  expect(msgs.filter((m) => m.includes("shared by several"))).toHaveLength(1);
  expect(msgs[0]).toContain("LIN");
  expect(Object.keys(p)).not.toContain("LIN");
  expect(Object.keys(p).length).toBeGreaterThan(400);
});
test("(value, season) dedupe: one key, first team wins", async () => {
  const p = await palette("nfl", ["OAK", "OAK"], { season: [2010, 2024] });
  expect(Object.keys(p)).toEqual(["OAK"]);
  expect(p.OAK).toBe(await teamColors("nfl", "OAK", { season: 2010 }));
});
test("strict rejects unknown values", async () => {
  await expect(palette("nfl", ["ZZZ"], { strict: true })).rejects.toThrow(UnresolvedTeamError);
  await expect(teamColors("nfl", "ZZZ", { strict: true })).rejects.toThrow(UnresolvedTeamError);
});
test("palette(league, null) is the whole league, like Python teams=None; no prototype keys", async () => {
  const all = await palette("nfl");
  expect(await palette("nfl", null)).toEqual(all);
  expect(Object.getPrototypeOf(all)).toBeNull();
  expect("constructor" in (await palette("nfl", ["constructor"]))).toBe(false);
});
test("loadLeague rejects (never throws synchronously) for an unknown league", async () => {
  const p = loadLeague("nlf" as never);
  expect(p).toBeInstanceOf(Promise);
  await expect(p).rejects.toThrow(InputError);
});
