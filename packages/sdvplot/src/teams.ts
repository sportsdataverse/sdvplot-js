import { type Alias, INDEX_VERSION, LEAGUES, type League, type Team } from "./data/index.js";
import { InputError, warn } from "./errors.js";
import { checkLeague, leagueRowsSync, loadLeague, preloadAll } from "./index-data.js";

/** A `division` filter value: an NCAA division, a college football tier, or the conference and league rows. */
export type Division = "FBS" | "FCS" | "DI" | "DII" | "DIII" | "P4" | "P5" | "G5" | "Conference";
const COLUMN_DIVISIONS: readonly string[] = ["FBS", "FCS", "DI", "DII", "DIII"];
const DIVISIONS: readonly string[] = [...COLUMN_DIVISIONS, "P4", "P5", "G5", "Conference"];
// College football's tiers by conference (the index's conference_id), as sdvplotR's in_division() and Python's
// _index._in_division; a conference that changes its id needs an update here (the filter warns)
const CFB_POWER4: readonly string[] = ["cfb:acc", "cfb:big-ten", "cfb:big-12", "cfb:sec"];
const CFB_GROUP5: readonly string[] = [
  "cfb:american",
  "cfb:cusa",
  "cfb:mac",
  "cfb:mountain-west",
  "cfb:sun-belt",
];
const CFB_NOTRE_DAME = "87";

/** Options of `teams`. */
export interface TeamsOptions {
  /**
   * Also list the non-team rows, whose `program` is `"conference"`, `"league"` or `"division"` (the index has only the
   * first two today; Python's and sdvplotR's `include_conferences`). The default, false, lists teams only, as palettes,
   * colours and every other team listing do.
   */
  includeConferences?: boolean;
  /**
   * Only the teams in any of these (Python's `teams(division=)`, sdvplotR's `sdv_teams(division =)`, cfbplotR's
   * division lists); needs a `league`. `"FBS"`, `"FCS"`, `"DI"`, `"DII"` and `"DIII"` read each team's `division`;
   * `"P4"` (ACC, Big Ten, Big 12, SEC and Notre Dame), `"P5"` (the P4 and the Pac-12) and `"G5"` (American, Conference
   * USA, MAC, Mountain West, Sun Belt and the FBS independents but Notre Dame) are college football's, from each team's
   * `conference_id`; `"Conference"` is the conference and league rows. With it, `includeConferences` is not read.
   */
  division?: Division | readonly Division[];
}

/** Internal (not in the barrel): Python `_index._in_division`, the rows of one league's index rows in any of `division`. */
export function inDivision(
  rows: readonly Team[],
  league: League,
  division: Division | readonly Division[],
): Team[] {
  const asked: readonly string[] = typeof division === "string" ? [division] : division;
  if (!Array.isArray(asked) || !asked.length || !asked.every((d) => DIVISIONS.includes(d)))
    throw new InputError(
      `division must be one or more of ${DIVISIONS.join(", ")}, got ${JSON.stringify(division)}`,
    );
  const tiers = ["P4", "P5", "G5"].filter((d) => asked.includes(d));
  if (tiers.length && league !== "cfb")
    throw new InputError(`${tiers.join(", ")} are college football tiers; use league "cfb"`);
  const cols = asked.filter((d) => COLUMN_DIVISIONS.includes(d));
  if (cols.length && rows.every((t) => t.division === null))
    throw new InputError(
      `the team index ${INDEX_VERSION} has no ${league} divisions for ${cols.join(", ")}; P4, P5 and G5 work without it, from conferences`,
    );
  const tierIds = [
    ...(tiers.includes("P4") || tiers.includes("P5") ? CFB_POWER4 : []),
    ...(tiers.includes("P5") ? ["cfb:pac-12"] : []),
    ...(tiers.includes("G5") ? [...CFB_GROUP5, "cfb:fbs-independents"] : []),
  ];
  const present = new Set(rows.map((t) => t.conference_id));
  const gone = tierIds.filter((c) => !present.has(c));
  if (gone.length)
    warn(
      `teams:division:${gone.join(",")}`,
      `the team index ${INDEX_VERSION} has no teams in ${gone.join(", ")}, so ${tiers.join(", ")} may be incomplete; the conference may have a new id: report it at https://github.com/sportsdataverse/sdvplot-js/issues`,
    );
  return rows.filter((t) => {
    const conf = t.program === "conference" || t.program === "league"; // sdvplotR non_team_programs
    if (conf) return asked.includes("Conference");
    const cid = t.conference_id ?? "";
    const nd = t.team_id === CFB_NOTRE_DAME;
    const p4 = CFB_POWER4.includes(cid) || nd;
    const p5 = p4 || cid === "cfb:pac-12";
    const g5 = CFB_GROUP5.includes(cid) || (cid === "cfb:fbs-independents" && !nd);
    return (
      (asked.includes("P4") && p4) ||
      (asked.includes("P5") && p5) ||
      (asked.includes("G5") && g5) ||
      (t.division !== null && cols.includes(t.division.toUpperCase()))
    );
  });
}

/**
 * All teams for one league, or every league (in `LEAGUES` order) when omitted.
 *
 * @example
 * ```ts
 * import { teams } from "@sportsdataverse/sdvplot";
 *
 * await teams("cfb", { includeConferences: true });
 * (await teams("cfb", { division: "P5" })).map((t) => t.location); // cfbplotR's P5 schools
 * ```
 */
export async function teams(league?: League, opts: TeamsOptions = {}): Promise<readonly Team[]> {
  if (opts.division !== undefined) {
    if (!league) throw new InputError(`division needs a league, such as teams("cfb", { division: "FBS" })`);
    checkLeague(league);
    await loadLeague(league);
    return inDivision(leagueRowsSync(league), league, opts.division);
  }
  const rows = async (lg: League): Promise<readonly Team[]> => {
    const d = await loadLeague(lg);
    return opts.includeConferences ? leagueRowsSync(lg) : d.teams;
  };
  if (league) return rows(league);
  await preloadAll();
  return (await Promise.all(LEAGUES.map(rows))).flat();
}

/** One row of `aliases`: an index alias with its league. */
export type LeagueAlias = { league: League } & Alias;

/**
 * Every team name, abbreviation and provider id the bundled index resolves, one row per alias (Python `aliases()`,
 * sdvplotR's `sdv_aliases()`, cfbplotR's `team_name_mapping`), for one league or every league. The `"mark"`,
 * `"conference"` and `"competition"` rows serve the mark functions only; `resolve` never reads them.
 *
 * @example
 * ```ts
 * import { aliases } from "@sportsdataverse/sdvplot";
 *
 * (await aliases("cfb")).filter((a) => a.id_system === "name");
 * ```
 */
export async function aliases(league?: League): Promise<readonly LeagueAlias[]> {
  const of = async (lg: League): Promise<LeagueAlias[]> =>
    (await loadLeague(lg)).aliases.map((a) => ({ league: lg, ...a }));
  if (league) {
    checkLeague(league);
    return of(league);
  }
  return (await Promise.all(LEAGUES.map(of))).flat();
}
