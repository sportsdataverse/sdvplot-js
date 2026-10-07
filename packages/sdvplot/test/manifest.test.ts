import { readFileSync } from "node:fs";
import { beforeAll, beforeEach, expect, test } from "vitest";
import { getLeagueSync } from "../src/index-data.js";
import { loadLeague, marks } from "../src/index.js";
import {
  MANIFEST_URL,
  type ManifestRow,
  manifestMarks,
  parseManifestCsv,
  resetManifestCache,
} from "../src/manifest.js";

const text = readFileSync(new URL("../../../fixtures/sdvplot/manifest_sample.csv", import.meta.url), "utf8");
const fakeFetch: typeof fetch = async (url) => {
  expect(String(url)).toBe(MANIFEST_URL);
  return new Response(text, { status: 200 });
};
beforeAll(() => loadLeague("nfl"));
beforeEach(() => resetManifestCache());

test("parseManifestCsv maps columns by header and keeps every row", () => {
  const rows = parseManifestCsv(text);
  expect(rows.length).toBe(text.trimEnd().split("\n").length - 1);
  expect(rows[0]).toHaveProperty("archive_url");
  expect(rows[0]!.level).toBe("team");
});
test("parseManifestCsv strips a leading BOM so the first header still matches", () => {
  const rows = parseManifestCsv(`\uFEFF${text}`);
  expect(rows.length).toBe(parseManifestCsv(text).length);
  expect(rows[0]!.level).toBe("team");
});
test("parseManifestCsv handles RFC 4180 quoting and CRLF", () => {
  const csv =
    'level,entity_name,league\r\nteam,"A, B",nfl\r\nteam,"say ""hi""",nfl\r\nteam,"two\r\nlines",nfl\r\n';
  const rows = parseManifestCsv(csv) as unknown as { entity_name: string; league: string }[];
  expect(rows.map((r) => r.entity_name)).toEqual(["A, B", 'say "hi"', "two\r\nlines"]);
  expect(rows.every((r) => r.league === "nfl")).toBe(true);
});
test("parseManifestCsv tolerates LF-only input and no trailing newline", () => {
  expect(parseManifestCsv("level,league\nteam,nfl")).toHaveLength(1);
});
test("marks(full: true) returns every manifest row for the team, a superset of the shard rows", async () => {
  const shard = await marks("LV", "nfl");
  const full = await marks("LV", "nfl", { full: true, fetch: fakeFetch });
  expect(full.length).toBeGreaterThanOrEqual(shard.length);
  for (const r of shard) expect(full.some((f) => f.sha256 === r.sha256)).toBe(true);
  expect(new Set(full.map((f) => f.team_id)).size).toBe(1);
});
test("the manifest is fetched once per process", async () => {
  let calls = 0;
  const counting: typeof fetch = async (u, i) => {
    calls++;
    return fakeFetch(u, i);
  };
  await marks("LV", "nfl", { full: true, fetch: counting });
  await marks("LAR", "nfl", { full: true, fetch: counting });
  expect(calls).toBe(1);
});
test("a failed fetch is a DownloadError, never an empty list", async () => {
  const failing: typeof fetch = async () => new Response("", { status: 503 });
  await expect(marks("LV", "nfl", { full: true, fetch: failing })).rejects.toThrow(/503/);
});
test("an unresolved team throws on the full path too", async () => {
  await expect(marks(null, "nfl", { full: true, fetch: fakeFetch })).rejects.toThrow();
});
test("manifestMarks derives archive_url and drops rows with a bad url or sha", () => {
  const rows = parseManifestCsv(text);
  const good = rows[0]!;
  const bad: ManifestRow[] = [
    { ...good, archive_url: "javascript:alert(1)" },
    { ...good, sha256: "zz" },
    { ...good, ext: "p/ng" },
  ];
  const aliases = getLeagueSync("nfl").aliases;
  const out = manifestMarks("nfl", [good, ...bad], aliases);
  expect(out).toHaveLength(1);
  expect(out[0]!.archive_url).toBe(good.archive_url);
});
