import { expect, test } from "vitest";
import type { Alias } from "../../packages/sdvplot/src/data/index.js";
import { type ManifestRow, leagueMarks, manifestVariants, markAliases, safeArchive } from "./marks.js";

const al = (value: string, team_id: string, valid_from: number | null, valid_to: number | null): Alias => ({
  id_system: "mark",
  value,
  team_id,
  valid_from,
  valid_to,
});
const mf = (o: Partial<ManifestRow>): ManifestRow => ({
  level: "team",
  league: "nfl",
  entity_id: "1",
  mark_type: "logo",
  variant: "default",
  valid_from: "",
  valid_to: "",
  source: "espn",
  sha256: "a",
  ext: "png",
  width: "",
  height: "",
  archive_url: "u",
  first_seen: "2024-01-01",
  ...o,
});

test("markAliases drops ambiguous values and keeps unique ones", () => {
  const m = markAliases([
    al("espn:1", "A", null, null),
    al("espn:2", "B", null, null),
    al("espn:2", "C", null, null),
  ]);
  expect(m.has("espn:2")).toBe(false);
  expect(m.get("espn:1")?.team_id).toBe("A");
});

test("markAliases unions ranges; an open end wins", () => {
  const u = markAliases([al("espn:1", "A", 2000, 2005), al("espn:1", "A", 2006, 2010)]);
  expect(u.get("espn:1")).toEqual({ team_id: "A", from: 2000, to: 2010 });
  const o = markAliases([al("espn:1", "A", 2000, 2005), al("espn:1", "A", 2006, null)]);
  expect(o.get("espn:1")).toEqual({ team_id: "A", from: 2000, to: null });
});

test("leagueMarks intersects manifest and alias ranges", () => {
  const rows = leagueMarks("nfl", [mf({ valid_from: "2003" })], [al("espn:1", "A", 2000, 2008)]);
  expect(rows).toHaveLength(1);
  expect(rows[0]).toMatchObject({ team_id: "A", valid_from: 2003, valid_to: 2008 });
});

test("leagueMarks dedups per (team,type,variant,range), keeping the best-ranked source", () => {
  const rows = leagueMarks(
    "nfl",
    [mf({ source: "wayback", sha256: "w" }), mf({ source: "espn", sha256: "e" })],
    [al("espn:1", "A", null, null), al("wayback:1", "A", null, null)],
  );
  expect(rows).toHaveLength(1);
  expect(rows[0]?.source).toBe("espn");
});

test("leagueMarks skips non-team rows and rows without an alias", () => {
  const rows = leagueMarks(
    "nfl",
    [mf({ level: "league" }), mf({ entity_id: "99" })],
    [al("espn:1", "A", null, null)],
  );
  expect(rows).toEqual([]);
});

test("safeArchive accepts only the derived content-addressed URL", () => {
  const base = "https://sdv.nyc3.cdn.digitaloceanspaces.com/assets/public/sha256";
  expect(safeArchive({ sha256: "abcd", ext: "png", archive_url: `${base}/ab/abcd.png` })).toBe(true);
  expect(safeArchive({ sha256: "abcd", ext: "png", archive_url: `${base}/ab/abcd.svg` })).toBe(false);
  expect(safeArchive({ sha256: "abcd", ext: "png", archive_url: "javascript:alert(1)" })).toBe(false);
});

test("manifestVariants is the sorted unique set over every row", () => {
  expect(manifestVariants([{ variant: "b" }, { variant: "a" }, { variant: "b" }, { variant: "" }])).toEqual([
    "a",
    "b",
  ]);
});
