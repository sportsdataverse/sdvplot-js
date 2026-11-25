import { InputError, warn } from "./errors.js";
import { checkLeague, getLeagueSync, loadLeague } from "./index-data.js";
import { parseManifestCsv } from "./manifest.js";
import { normValue } from "./normalize.js";
import { report, resolveIds } from "./resolve.js";
import type { IdSystem } from "./types.js";

/** College football rosters (ESPN athlete ids): cfbfastR-data's yearly files, what Python and sdvplotR read. */
export const ROSTER_URL = (season: number): string =>
  `https://raw.githubusercontent.com/sportsdataverse/cfbfastR-data/main/rosters/csv/cfb_rosters_${season}.csv`;
const ROSTER_FIRST_SEASON = 2009;

/** One roster row: season, ESPN athlete id, "first last", team, headshot URL. */
export type RosterRow = readonly [
  season: number,
  athleteId: string,
  name: string,
  team: string | null,
  url: string | null,
];

/**
 * A row of `addAthleteId`'s result: the row's own fields, and `athlete_id` (with `headshot_url`) written over any it
 * had. Distributes over a union of row shapes, so each member keeps its own fields.
 */
export type WithAthleteId<R> = R extends unknown
  ? Omit<R, "athlete_id" | "headshot_url"> & {
      athlete_id: string | undefined;
      headshot_url?: string | undefined;
    }
  : never;

/** Options of `addAthleteId`. */
export interface AddAthleteIdOptions {
  /** The key with each player's team; default a `team` or `school` key of the first row, if any. */
  teamKey?: string;
  /** The key with each row's season; default a `season` key of the first row, if any. */
  seasonKey?: string;
  /** A league with rosters: `"cfb"` (the default). */
  league?: "cfb";
  /** The id system of `teamKey`'s values, as in `resolve` (default "auto"); roster team names resolve under "auto". */
  idSystem?: IdSystem;
  /** Throw `UnresolvedTeamError` when a team in `teamKey` does not resolve, instead of matching it by name. */
  strict?: boolean;
  /** Also add each player's `headshot_url`. */
  headshotUrls?: boolean;
  /** The fetch to download rosters with (default `globalThis.fetch`). */
  fetch?: typeof fetch;
  /** The day that decides the latest roster season (it starts on August 15); default today. */
  today?: Date;
}

/** Python `_latest_roster_season`: the latest season with rosters, which starts on August 15. */
export function latestRosterSeason(today: Date = new Date()): number {
  const y = today.getFullYear();
  return today.getMonth() > 7 || (today.getMonth() === 7 && today.getDate() >= 15) ? y : y - 1;
}

const rosters = new Map<number, Promise<readonly RosterRow[]>>();
/** Forget the downloaded rosters (tests; a long-lived page). */
export function resetRosterCache(): void {
  rosters.clear();
}
/**
 * Internal (not in the barrel): one season's roster CSV as rows, as Python `_roster_rows` reads the parquet file. The
 * CSV writes a missing cell as "", which the parquet files never hold (their empty name parts are "", kept: "Zaccario "
 * still matches "Zaccario"); a row with no athlete id is skipped, and an id that went through a float loses its ".0".
 */
export function parseRoster(text: string, season: number): RosterRow[] {
  const out: RosterRow[] = [];
  for (const row of parseManifestCsv(text) as unknown as Record<string, string | undefined>[]) {
    const id = (row.athlete_id ?? "").trim().replace(/^(-?\d+)\.0+$/, "$1");
    if (!id || row.first_name === undefined || row.last_name === undefined) continue;
    out.push([season, id, `${row.first_name} ${row.last_name}`, row.team || null, row.headshot_url || null]);
  }
  return out;
}

// ponytail: kept for the page's life, keyed by season (Python's cache refreshes by TTL); resetRosterCache() empties it
function roster(season: number, f: typeof fetch): Promise<readonly RosterRow[]> {
  let p = rosters.get(season);
  if (!p) {
    // offline, a failed read, a timeout or a season not published yet (404): no rows, never a throw (Python `_roster`)
    const mine: Promise<readonly RosterRow[]> = (async () => {
      const r = await f(ROSTER_URL(season), { signal: AbortSignal.timeout(60_000) });
      return r.ok ? parseRoster(await r.text(), season) : [];
    })().catch(() => []);
    void mine.then((rows) => {
      if (!rows.length && rosters.get(season) === mine) rosters.delete(season); // retry a failed season next call
    });
    rosters.set(season, mine);
    p = mine;
  }
  return p;
}

const NUMBER = /^[-+]?(\d+\.?\d*|\.\d+)([eE][-+]?\d+)?$/;
/** R's as.integer() (Python `_as_int`): a number or numeric text truncated to an integer, anything else null. */
function asInt(v: unknown): number | null {
  if (v === null || v === undefined || typeof v === "boolean") return null;
  const n = typeof v === "string" ? (NUMBER.test(v.trim()) ? Number(v.trim()) : Number.NaN) : Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : null;
}

/**
 * Add each player's ESPN athlete id (the id `headshotUrl` reads) to rows of player names, matched to cfbfastR-data's
 * college football rosters, 2009 on (Python `add_athlete_id`, sdvplotR's `sdv_add_athlete_id()`, cfbplotR's
 * `add_athlete_id_col()`). Names match ignoring case, accents and surrounding spaces; teams match through `resolve`
 * (else by name); a name that matches more than one athlete is left `undefined` (one warning), so the result has a row
 * per row: give `teamKey` and `seasonKey` to tell players apart. Without a season key the latest season's rosters are
 * read, or the season before when the latest is not published yet. Offline, the ids are `undefined` (one warning).
 * The match is experimental: check the ids. Shown by the `sdvplot/core/athlete-ids` example (it downloads a roster).
 */
export async function addAthleteId<R extends Record<string, unknown>>(
  rows: readonly R[],
  nameKey: keyof R & string,
  opts: AddAthleteIdOptions = {},
): Promise<WithAthleteId<R>[]> {
  const league = opts.league ?? "cfb";
  checkLeague(league);
  if (league !== "cfb")
    throw new InputError(`sdvplot has rosters for cfb only, not ${JSON.stringify(league)}`);
  if (!Array.isArray(rows)) throw new InputError("rows must be an array of objects");
  const first = rows[0] ?? {};
  if (rows.some((r) => "athlete_id" in r)) throw new InputError("rows already have an athlete_id key");
  if (rows.length)
    for (const [arg, k] of [
      ["nameKey", nameKey],
      ["teamKey", opts.teamKey],
      ["seasonKey", opts.seasonKey],
    ] as const)
      if (k !== undefined && !(k in first))
        throw new InputError(`${arg} must name a key of the rows, got ${JSON.stringify(k)}`);
  const teamKey = opts.teamKey ?? ["team", "school"].find((k) => k in first);
  let seasonKey = opts.seasonKey ?? ("season" in first ? "season" : undefined);
  await loadLeague(league);
  const f = opts.fetch ?? globalThis.fetch;
  const latest = latestRosterSeason(opts.today);
  const dfSeasons = seasonKey ? rows.map((r) => asInt(r[seasonKey as string])) : [];
  const seasons = [
    ...new Set(dfSeasons.filter((s): s is number => s !== null && s >= ROSTER_FIRST_SEASON && s <= latest)),
  ].sort((a, b) => b - a);
  let ro: RosterRow[];
  let read = seasons;
  if (seasons.length) ro = (await Promise.all(seasons.map((s) => roster(s, f)))).flat();
  else {
    seasonKey = undefined; // no season with rosters: the latest's, as Python and sdvplotR
    read = [latest];
    ro = [...(await roster(latest, f))];
    if (!ro.length) {
      read = [latest - 1];
      ro = [...(await roster(latest - 1, f))];
    }
  }
  if (!ro.length)
    warn(
      `addAthleteId:${read.join(",")}`,
      `could not read the cfb rosters for ${read.join(", ")}, so every athlete_id is undefined`,
    );
  const d = getLeagueSync(league);
  const teamKeys = (values: unknown[], system: IdSystem = "auto", must = false): string[] => {
    const { out, unresolved } = resolveIds(
      values as never,
      league,
      Array(values.length).fill(null),
      system,
      d,
    );
    if (must && unresolved.size) report(unresolved, league, true);
    return values.map((v, i) => out[i] ?? `name:${normValue(v) ?? "\u0000"}`); // a missing team never meets a name
  };
  const keys = (names: unknown[], t: string[] | null, ss: (number | null)[] | null): string[] =>
    names.map((n, i) => [normValue(n), ...(t ? [t[i]] : []), ...(ss ? [ss[i]] : [])].join("\r"));
  const keyDf = keys(
    rows.map((r) => r[nameKey]),
    teamKey
      ? teamKeys(
          rows.map((r) => r[teamKey]),
          opts.idSystem ?? "auto",
          opts.strict ?? false,
        )
      : null,
    seasonKey ? dfSeasons : null,
  );
  const keyRo = keys(
    ro.map((r) => r[2]),
    teamKey ? teamKeys(ro.map((r) => r[3])) : null, // the rosters' own team names: always "auto"
    seasonKey ? ro.map((r) => r[0]) : null,
  );
  const firstHit = new Map<string, number>();
  const athletes = new Map<string, Set<string>>();
  keyRo.forEach((k, j) => {
    if (!firstHit.has(k)) firstHit.set(k, j);
    const s = athletes.get(k) ?? new Set<string>();
    s.add((ro[j] as RosterRow)[1]);
    athletes.set(k, s);
  });
  let ambiguous = 0;
  const out = rows.map((r, i) => {
    // a row with no name, or no team when teams are matched, matches no one and is not counted as ambiguous
    const skip = normValue(r[nameKey]) === null || (teamKey !== undefined && normValue(r[teamKey]) === null);
    const k = keyDf[i] as string;
    const amb = !skip && (athletes.get(k)?.size ?? 0) > 1;
    if (amb) ambiguous++;
    const j = skip || amb ? undefined : firstHit.get(k);
    const hit = j === undefined ? undefined : (ro[j] as RosterRow);
    return {
      ...r,
      athlete_id: hit?.[1],
      ...(opts.headshotUrls ? { headshot_url: hit?.[4] ?? undefined } : {}),
    };
  });
  if (ambiguous)
    warn(
      `addAthleteId:ambiguous:${ambiguous}`,
      `${ambiguous} row(s) matched more than one athlete, so their athlete_id is undefined; give teamKey and seasonKey to tell them apart`,
    );
  return out;
}
