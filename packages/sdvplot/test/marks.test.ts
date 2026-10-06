import { beforeEach, expect, test } from "vitest";
import { InputError, resetWarnings, setWarningHandler } from "../src/errors.js";
import { logoUrl, marks, selectMark } from "../src/marks.js";
import { teams } from "../src/teams.js";

beforeEach(() => {
  resetWarnings();
  setWarningHandler(() => {});
});
const ARCHIVE =
  /^https:\/\/sdv\.nyc3\.cdn\.digitaloceanspaces\.com\/assets\/public\/sha256\/[0-9a-f]{2}\/[0-9a-f]{64}\.(png|svg|jpg|gif|bmp)$/;

test("logoUrl is an archive URL; dark falls back (Review Focus 3); wordmark type", async () => {
  expect(await logoUrl("KC", "nfl")).toMatch(ARCHIVE);
  for (const r of await teams("nfl"))
    expect(await logoUrl(r.team_id as string, "nfl", { variant: "dark" })).toMatch(ARCHIVE); // every NFL team has SOME logo
  expect(await logoUrl("KC", "nfl", { markType: "wordmark" })).toMatch(ARCHIVE);
});
test("season picks the era's mark for a relocated franchise", async () => {
  const now = await logoUrl("LV", "nfl");
  const then = await logoUrl("OAK", "nfl", { season: 2010 });
  expect(then).toMatch(ARCHIVE);
  expect(then).not.toBe(now);
});
test("unknown variant is an InputError listing variants; unknown team → undefined", async () => {
  await expect(logoUrl("KC", "nfl", { variant: "neon" })).rejects.toThrow(InputError);
  expect(await logoUrl("ZZZ", "nfl")).toBeUndefined();
});
test("marks() returns rows best-first with source_rank", async () => {
  const m = await marks("KC", "nfl");
  expect(m.length).toBeGreaterThan(5);
  expect(m[0]?.source_rank).toBe(0);
});
test("selectMark polarity order: dark → on_dark → default → any", async () => {
  const r = await selectMark("KC", "nfl", { variant: "dark" });
  expect(
    r?.variant === "dark" ||
      r?.variant.endsWith("_on_dark") ||
      r?.variant === "on_dark" ||
      r?.variant === "default",
  ).toBe(true);
});
