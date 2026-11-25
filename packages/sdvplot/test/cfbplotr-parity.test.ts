// The cfbplotR-era functions held to Python's sdvplot (fixtures/sdvplot/cfbplotr.json, `pnpm oracle:cfbplotr`), whose
// answers on these inputs sdvplot's own tests hold to sdvplotR: teams({ division }), aliases, cleanNames, teamFactor,
// altColors and addAthleteId.
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { beforeAll, expect, test } from "vitest";
import { addAthleteId, latestRosterSeason, parseRoster, resetRosterCache } from "../src/athletes.js";
import { palette, teamColorsSync } from "../src/colors.js";
import { INDEX_VERSION, type League } from "../src/data/index.js";
import { InputError, UnresolvedTeamError, resetWarnings, setWarningHandler } from "../src/errors.js";
import { preloadAll } from "../src/index-data.js";
import { cleanNames, cleanNamesSync, teamFactor, teamFactorSync } from "../src/names.js";
import { aliases, inDivision, teams } from "../src/teams.js";

const fx = JSON.parse(
  readFileSync(new URL("../../../fixtures/sdvplot/cfbplotr.json", import.meta.url), "utf8"),
);
const und = (x: unknown) => (x === null ? undefined : x);
const lg = (s: string) => s as League;
const warnings: string[] = [];
beforeAll(async () => {
  setWarningHandler((m) => warnings.push(m));
  await preloadAll();
}, 120_000);

test("the fixture answers for the bundled index", () => {
  expect(fx.meta.index_version).toBe(INDEX_VERSION);
});

test("teams({ division }) matches Python on every college league", async () => {
  expect(fx.divisions.length).toBe(40); // 7 college leagues: 5 cases each, cfb 10
  for (const c of fx.divisions) {
    const got = teams(lg(c.league), { division: c.division });
    if (!Array.isArray(c.team_ids)) {
      await expect(got).rejects.toBeInstanceOf(InputError);
      continue;
    }
    expect((await got).map((t) => t.team_id).sort(), `${c.league} ${c.division}`).toEqual(c.team_ids);
  }
});

test("aliases() is the index's alias table, row for row (md5 per league)", async () => {
  for (const c of fx.aliases) {
    const x = await aliases(lg(c.league));
    const lines = x
      .map((a) =>
        [a.league, a.id_system, a.value, a.team_id, a.valid_from, a.valid_to].map((v) => v ?? "").join("\t"),
      )
      .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
    const md5 = createHash("md5").update(lines.join("\n"), "utf8").digest("hex");
    expect([x.length, md5], c.league).toEqual([c.rows, c.md5]);
  }
  expect((await aliases()).length).toBe(fx.aliases.reduce((n: number, c: { rows: number }) => n + c.rows, 0));
});

test("cleanNames matches Python, keeping or dropping what does not resolve", () => {
  for (const c of fx.clean_names) {
    const values = c.values.map(und);
    expect(cleanNamesSync(values, lg(c.league), { column: c.column }), `${c.league} ${c.column}`).toEqual(
      c.keep.map(und),
    );
    expect(cleanNamesSync(values, lg(c.league), { column: c.column, keepNonMatches: false })).toEqual(
      c.drop.map(und),
    );
  }
});

test("teamFactor matches Python's values and categories", () => {
  for (const c of fx.team_factor) {
    const f = teamFactorSync(c.values.map(und), lg(c.league));
    expect(f.values).toEqual(c.factor.map(und));
    expect(f.levels).toEqual(c.levels);
  }
});

test("altColors matches Python in teamColors and palette", async () => {
  let swapped = 0;
  for (const c of fx.alt_colors) {
    const o = { which: c.which, altColors: c.alt_colors };
    expect(teamColorsSync(lg(c.league), c.values, { which: c.which })).toEqual(c.colors.map(und));
    expect(teamColorsSync(lg(c.league), c.values, o)).toEqual(c.swapped.map(und));
    expect({ ...(await palette(lg(c.league), c.values, o)) }).toEqual(c.palette);
    expect({ ...(await palette(lg(c.league), undefined, o)) }).toEqual(c.palette_whole);
    swapped += c.colors.filter((x: string, i: number) => x !== c.swapped[i]).length;
  }
  expect(swapped).toBeGreaterThan(0);
});

// the roster rows sdvplotR read, served as the CSV files addAthleteId downloads
const a = fx.add_athlete_id;
const header = ["athlete_id", "first_name", "last_name", "team", "headshot_url"];
const rosterFetch = (async (url: string) => {
  const season = /cfb_rosters_(\d+)\.csv$/.exec(String(url))?.[1] ?? "";
  const rows: Record<string, string | null>[] | undefined = a.rosters[season];
  if (!rows) return new Response("", { status: 404 });
  const q = (v: string | null) => (v === null ? "" : `"${v.replaceAll('"', '""')}"`);
  const body = [header.join(","), ...rows.map((r) => header.map((h) => q(r[h] ?? null)).join(","))].join(
    "\n",
  );
  return new Response(`${body}\n`);
}) as typeof fetch;
const today = new Date(a.latest_season, 10, 25);

test("addAthleteId matches Python with team and season, season only, and neither", async () => {
  resetRosterCache();
  const players = a.players.map((p: Record<string, unknown>) => ({
    ...p,
    player_name: und(p.player_name),
    team: und(p.team),
  }));
  const opts = { fetch: rosterFetch, today };
  const withTeam = await addAthleteId(players, "player_name", { ...opts, headshotUrls: true });
  expect(withTeam.map((r) => r.athlete_id)).toEqual(
    a.with_team.map((r: { athlete_id: string | null }) => und(r.athlete_id)),
  );
  expect(withTeam.map((r) => r.headshot_url)).toEqual(
    a.with_team.map((r: { headshot_url: string | null }) => und(r.headshot_url)),
  );
  const nameOnly = await addAthleteId(
    players.map((p: { player_name: unknown }) => ({ player_name: p.player_name })),
    "player_name",
    opts,
  );
  expect(nameOnly.map((r) => r.athlete_id)).toEqual(a.name_only.map(und));
  const nameSeason = await addAthleteId(
    players.map((p: { player_name: unknown; season: unknown }) => ({
      player_name: p.player_name,
      season: p.season,
    })),
    "player_name",
    opts,
  );
  expect(nameSeason.map((r) => r.athlete_id)).toEqual(a.name_season.map(und));
  expect(
    a.with_team.filter((r: { athlete_id: string | null }) => r.athlete_id !== null).length,
  ).toBeGreaterThan(5);
});

test("addAthleteId warns offline, keeps every row and checks its arguments", async () => {
  resetRosterCache();
  resetWarnings();
  warnings.length = 0;
  const off = (async () => {
    throw new TypeError("fetch failed");
  }) as typeof fetch;
  const out = await addAthleteId([{ p: "A B" }, { p: "C D" }], "p", { fetch: off, today });
  expect(out.map((r) => r.athlete_id)).toEqual([undefined, undefined]);
  expect(warnings.some((w) => w.includes("could not read the cfb rosters"))).toBe(true);
  await expect(addAthleteId([{ p: "x", athlete_id: "1" }], "p")).rejects.toBeInstanceOf(InputError);
  await expect(addAthleteId([{ p: "x" }], "p", { league: "nfl" as never })).rejects.toBeInstanceOf(
    InputError,
  );
  expect(latestRosterSeason(new Date(2026, 7, 14))).toBe(2025);
  expect(latestRosterSeason(new Date(2026, 7, 15))).toBe(2026);
});

test("teams({ division }), cleanNames and teamFactor check their arguments", async () => {
  await expect(teams(undefined, { division: "FBS" })).rejects.toThrow("division needs a league");
  await expect(teams("cfb", { division: "D1" as never })).rejects.toThrow("division must be one or more of");
  await expect(teams("cfb", { division: [] })).rejects.toThrow("division must be one or more of");
  await expect(teams("nfl", { division: "P5" })).rejects.toThrow("college football tiers");
  expect(() => cleanNamesSync("KC", "nfl", { column: "school" as never })).toThrow("column must be one of");
  expect(cleanNamesSync([12, 12.5, null], "nfl", { column: "abbr" })).toEqual(["KC", "12.5", undefined]);
  expect(() => cleanNamesSync(["nope"], "nfl", { strict: true })).toThrow(UnresolvedTeamError);
  expect(teamFactorSync(["KC", "BUF", "KC"], "nfl")).toEqual({
    values: ["KC", "BUF", "KC"],
    levels: ["BUF", "KC"],
  });
});

test("addAthleteId parses seasons and team ids as Python does, and falls back to the latest rosters", async () => {
  resetRosterCache();
  const opts = { fetch: rosterFetch, today };
  for (const k of ["mixed", "out_of_range"] as const) {
    const players = a[k].players.map((p: Record<string, unknown>) => ({ ...p, season: und(p.season) }));
    const got = await addAthleteId(players, "player_name", opts);
    expect(
      got.map((r) => r.athlete_id),
      k,
    ).toEqual(a[k].athlete_id.map(und));
  }
  // the latest season not published yet (404): the season before's, as Python
  resetRosterCache();
  const later = new Date(a.latest_season + 1, 10, 25);
  const names = a.players.map((p: { player_name: unknown }) => ({ player_name: und(p.player_name) }));
  const got = await addAthleteId(names, "player_name", { fetch: rosterFetch, today: later });
  expect(got.map((r) => r.athlete_id)).toEqual(a.name_only.map(und));
});

test("a real roster CSV reads as Python reads the same rows of the parquet file", () => {
  const c = a.csv_2009;
  expect(parseRoster(c.text, 2009)).toEqual(c.rows.map((r: unknown[]) => r.map(und).map((v) => v ?? null)));
  expect(c.empty_name_ids.length).toBeGreaterThan(0); // "Zaccario ": an empty last name is kept, as in the parquet
});

test("addAthleteId rejects a key the rows do not have", async () => {
  await expect(addAthleteId([{ p: "A B" }], "q" as never)).rejects.toThrow("nameKey must name a key");
  await expect(addAthleteId([{ p: "A B" }], "p", { teamKey: "tem" })).rejects.toThrow(
    "teamKey must name a key",
  );
});

test("the async forms, a scalar altColors and the edge branches answer as their Sync forms and Python", async () => {
  expect(await cleanNames(["utah", "nope"], "cfb")).toEqual(cleanNamesSync(["utah", "nope"], "cfb"));
  expect(await teamFactor(["KC", "BUF"], "nfl")).toEqual(teamFactorSync(["KC", "BUF"], "nfl"));
  expect(teamColorsSync("cfb", "Utah", { altColors: "Utah" })).toBe(
    teamColorsSync("cfb", "Utah", { which: "secondary" }),
  );
  // a league whose index has no divisions is an error, as in Python
  await expect(teams("nfl", { division: "FBS" })).rejects.toThrow("has no nfl divisions");
  // a tier whose conference id the index lacks warns that the tier may be incomplete
  warnings.length = 0;
  resetWarnings();
  const cfb = (await teams("cfb")).filter((t) => t.conference_id !== "cfb:pac-12");
  expect(inDivision(cfb, "cfb", "P5").length).toBeGreaterThan(60);
  expect(warnings.some((w) => w.includes("cfb:pac-12"))).toBe(true);
  // rows that are not an array; a roster row with no id, or an id that went through a float
  await expect(addAthleteId("x" as never, "p")).rejects.toThrow("rows must be an array");
  const text = "athlete_id,first_name,last_name,team,headshot_url\n12.0,A,B,Utah,\n,C,D,Utah,u\n";
  expect(parseRoster(text, 2021)).toEqual([[2021, "12", "A B", "Utah", null]]);
  // seasons the way R's as.integer() reads them: booleans and words are no season
  resetRosterCache();
  const rows = [
    { p: "x", season: true },
    { p: "y", season: "abc" },
  ];
  const got = await addAthleteId(rows, "p", { fetch: rosterFetch, today });
  expect(got.map((r) => r.athlete_id)).toEqual([undefined, undefined]);
});
