import type { League, LeagueData } from "./data/index.js";
import { InputError, UnresolvedTeamError, warn } from "./errors.js";
import { getLeagueSync, latestSeason, loadLeague } from "./index-data.js";
import { checkSeason, normSeason, normValue } from "./normalize.js";
import { EXPLICIT_ONLY, type IdSystem, PRIORITY, type SeasonInput, type TeamId, asTeamId } from "./types.js";

export type Value = string | number | bigint | null | undefined;
export type Resolved<T> = T extends readonly Value[] ? (TeamId | undefined)[] : TeamId | undefined;
export interface ResolveOptions {
  season?: SeasonInput | readonly SeasonInput[];
  idSystem?: IdSystem;
  strict?: boolean;
}

type Cand = readonly [teamId: string, from: number | null, to: number | null];
type Lookup = Map<string, Map<string, Cand[]>>; // id_system → normalized value → candidates
const lookups = new WeakMap<LeagueData, Lookup>();
function lookup(d: LeagueData): Lookup {
  let l = lookups.get(d);
  if (!l) {
    l = new Map();
    for (const a of d.aliases) {
      const k = normValue(a.value);
      if (k === null) continue;
      let sys = l.get(a.id_system);
      if (!sys) {
        sys = new Map();
        l.set(a.id_system, sys);
      }
      let c = sys.get(k);
      if (!c) {
        c = [];
        sys.set(k, c);
      }
      c.push([a.team_id, a.valid_from, a.valid_to]);
    }
    lookups.set(d, l);
  }
  return l;
}
const covers = (lo: number | null, hi: number | null, s: number): boolean =>
  (lo === null || s >= lo) && (hi === null || s <= hi);

function systems(idSystem: IdSystem): readonly string[] {
  if (
    idSystem !== "auto" &&
    !(PRIORITY as readonly string[]).includes(idSystem) &&
    !(EXPLICIT_ONLY as readonly string[]).includes(idSystem)
  )
    throw new InputError(
      `unknown idSystem ${JSON.stringify(idSystem)}; use "auto" or one of ${[...PRIORITY, ...EXPLICIT_ONLY].join(", ")}`,
    );
  return idSystem === "auto" ? PRIORITY : [idSystem];
}

/** Python `_match`: passes [season, latest, none] (deduped, nulls dropped) × systems in order; first system with a candidate decides. */
function match(
  key: string,
  season: number | null,
  sys: readonly string[],
  table: Lookup,
  latest: number | null,
): string | readonly string[] | null {
  const whens: (number | null)[] = [];
  for (const w of [season, latest]) if (w !== null && !whens.includes(w)) whens.push(w);
  whens.push(null);
  for (const when of whens)
    for (const s of sys) {
      let cands = table.get(s)?.get(key);
      if (!cands?.length) continue;
      if (when !== null) {
        cands = cands.filter((c) => covers(c[1], c[2], when));
        if (!cands.length) continue;
      }
      const ids = [...new Set(cands.map((c) => c[0]))];
      return ids.length === 1 ? (ids[0] as string) : ids.sort();
    }
  return null;
}

function seasons(season: ResolveOptions["season"], n: number, league: League): (number | null)[] {
  if (!Array.isArray(season)) return Array<number | null>(n).fill(normSeason(season as SeasonInput, league));
  if (season.length !== n)
    throw new InputError(`season has ${season.length} values but there are ${n} teams`);
  return (season as readonly SeasonInput[]).map((s) => normSeason(s, league));
}

function resolveIds(
  items: readonly Value[],
  league: League,
  ss: (number | null)[],
  idSystem: IdSystem,
  d: LeagueData,
): { out: (TeamId | undefined)[]; unresolved: Map<string, string> } {
  const sys = systems(idSystem);
  for (const y of new Set(ss)) if (y !== null) checkSeason(y, league);
  const table = lookup(d);
  const latest = latestSeason(league);
  const names = new Map(d.teams.map((t) => [t.team_id, t.name ?? ""]));
  const out: (TeamId | undefined)[] = [];
  const unresolved = new Map<string, string>();
  const memo = new Map<string, ReturnType<typeof match>>();
  items.forEach((v, i) => {
    const key = normValue(v);
    if (key === null) {
      out.push(undefined);
      return;
    }
    const mk = `${key}\u0000${ss[i]}`;
    if (!memo.has(mk)) memo.set(mk, match(key, ss[i] ?? null, sys, table, latest));
    const hit = memo.get(mk) as ReturnType<typeof match>;
    if (hit === null || Array.isArray(hit)) {
      unresolved.set(
        String(v),
        hit === null
          ? "unknown"
          : `ambiguous: ${(hit as readonly string[]).map((t) => `${t} ${names.get(t) ?? ""}`.trim()).join(" or ")}`,
      );
      out.push(undefined);
    } else out.push(asTeamId(hit as string));
  });
  return { out, unresolved };
}

function report(unresolved: Map<string, string>, league: League, strict: boolean): void {
  const shown = [...unresolved].map(([v, why]) => `'${v}' (${why})`).join(", ");
  let msg = `${unresolved.size} value(s) did not resolve to a ${league} team: ${shown}`;
  if ([...unresolved.values()].some((w) => w.startsWith("ambiguous")))
    msg += "; pass season for a code reused across eras, or idSystem for the id system of the values";
  if (strict) throw new UnresolvedTeamError(msg);
  warn(
    `${league}:${[...unresolved.keys()].join(",")}`,
    `${msg}. Use suggest() for candidates, or strict: true to throw.`,
  );
}

export function resolveSync<T extends Value | readonly Value[]>(
  values: T,
  league: League,
  opts: ResolveOptions = {},
): Resolved<T> {
  const d = getLeagueSync(league);
  const arr = Array.isArray(values);
  const items = (arr ? values : [values]) as readonly Value[];
  const { out, unresolved } = resolveIds(
    items,
    league,
    seasons(opts.season, items.length, league),
    opts.idSystem ?? "auto",
    d,
  );
  if (unresolved.size) report(unresolved, league, opts.strict ?? false);
  return (arr ? out : out[0]) as Resolved<T>;
}
export async function resolve<T extends Value | readonly Value[]>(
  values: T,
  league: League,
  opts: ResolveOptions = {},
): Promise<Resolved<T>> {
  await loadLeague(league);
  return resolveSync(values, league, opts);
}

/** Port of `suggest`: difflib.get_close_matches(cutoff 0.6) ≈ normalized Levenshtein ratio ≥ 0.6, best first; never picks one. */
export async function suggest(
  value: Value,
  league: League,
  opts: { n?: number } = {},
): Promise<Array<[TeamId, string]>> {
  const n = opts.n ?? 5;
  if (!Number.isInteger(n) || n < 1)
    throw new InputError(
      `n is the most candidates to return, an int of at least 1, got ${JSON.stringify(n)}`,
    );
  const d = await loadLeague(league);
  const key = normValue(value);
  if (key === null) return [];
  const merged = new Map<string, string[]>();
  for (const sys of lookup(d).values())
    for (const [k, cands] of sys) merged.set(k, [...(merged.get(k) ?? []), ...cands.map((c) => c[0])]);
  const names = new Map(d.teams.map((t) => [t.team_id, t.name ?? t.team_id]));
  const scored = [...merged.keys()]
    .map((k) => [k, ratio(key, k)] as const)
    .filter(([, r]) => r >= 0.6)
    .sort((a, b) => b[1] - a[1])
    .slice(0, n * 3);
  const out: Array<[TeamId, string]> = [];
  for (const [k] of scored)
    for (const tid of merged.get(k) ?? [])
      if (!out.some(([t]) => t === tid)) out.push([asTeamId(tid), names.get(tid) ?? tid]);
  return out.slice(0, n);
}
/** difflib.SequenceMatcher.ratio(): 2*M/T with M = matched chars via longest-common-substring recursion. */
export function ratio(a: string, b: string): number {
  const matches = (x: string, y: string): number => {
    if (!x || !y) return 0;
    let bi = 0;
    let bj = 0;
    let best = 0;
    let prev: number[] = Array<number>(y.length + 1).fill(0);
    for (let i = 1; i <= x.length; i++) {
      const cur: number[] = Array<number>(y.length + 1).fill(0);
      for (let j = 1; j <= y.length; j++)
        if (x[i - 1] === y[j - 1]) {
          const v = (prev[j - 1] ?? 0) + 1;
          cur[j] = v;
          if (v > best) {
            best = v;
            bi = i;
            bj = j;
          }
        }
      prev = cur;
    }
    if (!best) return 0;
    return best + matches(x.slice(0, bi - best), y.slice(0, bj - best)) + matches(x.slice(bi), y.slice(bj));
  };
  return a.length + b.length === 0 ? 1 : (2 * matches(a, b)) / (a.length + b.length);
}
