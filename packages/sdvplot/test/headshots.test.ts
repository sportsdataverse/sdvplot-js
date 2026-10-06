import { expect, test } from "vitest";
import { InputError } from "../src/errors.js";
import {
  HEADSHOT_ASPECT,
  headshotUrl,
  loadGsis,
  mlbHeadshotUrl,
  nbaHeadshotUrl,
  nhlHeadshotUrl,
  wnbaHeadshotUrl,
} from "../src/headshots.js";

test("espn ids per league slug; malformed id → undefined", () => {
  expect(headshotUrl("3139477", "nfl")).toBe(
    "https://a.espncdn.com/combiner/i?img=/i/headshots/nfl/players/full/3139477.png",
  );
  expect(headshotUrl(3139477, "cfb")).toContain("/college-football/");
  expect(headshotUrl("abc", "nba")).toBeUndefined();
  expect(headshotUrl(null, "nba")).toBeUndefined();
  expect(() => headshotUrl("1", "ohl" as never)).toThrow(InputError);
  expect(() => headshotUrl("1", "nba", { idSystem: "gsis" })).toThrow(InputError);
});
test("argument checks run before the null-id short circuit", () => {
  expect(() => headshotUrl(null, "ohl" as never)).toThrow(InputError);
});
test("gsis → nfl.com headshot rewritten, else ESPN fallback; the map must be loaded first", async () => {
  expect(() => headshotUrl("00-0033873", "nfl", { idSystem: "gsis" })).toThrow(/loadGsis/);
  await loadGsis();
  const u = headshotUrl("00-0033873", "nfl", { idSystem: "gsis" });
  expect(u).toMatch(/^https:\/\/.*\.png$/);
  expect(u).not.toContain("/f_auto,q_auto/");
  expect(u).toContain("/t_headshot_desktop/f_auto/");
  expect(headshotUrl("00-9999999", "nfl", { idSystem: "gsis" })).toBeUndefined();
});
test("league CDN builders (sdvplotR)", () => {
  expect(nbaHeadshotUrl(2544)).toBe("https://cdn.nba.com/headshots/nba/latest/260x190/2544.png");
  expect(wnbaHeadshotUrl("1628932")).toBe("https://cdn.wnba.com/headshots/wnba/latest/260x190/1628932.png");
  expect(mlbHeadshotUrl(660271)).toContain("/people/660271/headshot/67/current.png");
  expect(nhlHeadshotUrl(8478402)).toBe("https://assets.nhle.com/mugs/nhl/latest/8478402.png");
  expect(HEADSHOT_ASPECT).toBeCloseTo(1.3761, 3);
});
