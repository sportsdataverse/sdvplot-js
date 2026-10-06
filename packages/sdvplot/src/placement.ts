import type { MarkRow } from "./data/index.js";
import { InputError, warn } from "./errors.js";
import { ESPN_HEADSHOT_LEAGUES, HEADSHOT_ASPECT, headshotUrl, loadGsis } from "./headshots.js";
import type { EspnHeadshotLeague } from "./headshots.js";
import { loadLeague } from "./index-data.js";
import { selectMarkSync } from "./marks.js";
import { normValue } from "./normalize.js";
import { type ResolveOptions, type Value, resolveSync } from "./resolve.js";
import type { HeadshotIdSystem, IdSystem, League, SeasonInput, Variant } from "./types.js";

export type Kind = "logo" | "wordmark" | "headshot";
/** One point to draw: the caller's own x/y, the image URL and its width / height ratio (null when unknown). `index` is the row's position in the input arrays (skipped rows leave gaps). */
export interface Placement {
  index: number;
  id: string;
  x: Value;
  y: Value;
  url: string;
  aspect: number | null;
  mark: MarkRow | null;
}
export interface PlaceOptions {
  league: League;
  season?: SeasonInput | readonly SeasonInput[];
  kind?: Kind;
  variant?: Variant;
  /** Team id system for logos/wordmarks (default "auto"); "espn" or "gsis" for headshots (default "espn"). */
  idSystem?: IdSystem | HeadshotIdSystem;
  strict?: boolean;
  warn?: boolean;
}
export { HEADSHOT_ASPECT };

const real = (v: unknown): v is number => typeof v === "number" && !Number.isNaN(v);
export function checkHeight(height: unknown): number {
  if (!real(height) || !(height > 0 && height <= 1))
    throw new InputError(`height is a fraction of the plot height in (0, 1], got ${String(height)}`);
  return height;
}
export function checkAlpha(alpha: unknown): number {
  if (!real(alpha) || !(alpha >= 0 && alpha <= 1))
    throw new InputError(`alpha is an opacity in [0, 1], got ${String(alpha)}`);
  return alpha;
}

const missing = (v: Value): boolean =>
  v === null || v === undefined || (typeof v === "number" && Number.isNaN(v));
function skipped(league: string, reason: string, values: Value[], on: boolean): void {
  if (!on || values.length === 0) return;
  const extra = values.length > 10 ? ` and ${values.length - 10} more` : "";
  const shown = `${values.slice(0, 10).map(String).join(", ")}${extra}`;
  warn(`place:${league}:${reason}:${shown}`, `skipped ${values.length} point(s) ${reason}: ${shown}`);
}

/** Port of `_placement.place` (post-preload): pairs each (x, y) with its team's mark or player's headshot, dropping and warning (once per reason) on rows that cannot be drawn. Needs `loadLeague(league)` (or `preloadAll()`) first; gsis headshots also need `loadGsis()`. */
export function placeSync(
  xs: readonly Value[],
  ys: readonly Value[],
  teams: readonly Value[],
  o: PlaceOptions,
): Placement[] {
  const { league, kind = "logo", variant = "default", strict = false, warn: on = true } = o;
  if (!(xs.length === ys.length && ys.length === teams.length))
    throw new InputError(
      `x, y and teams must have the same length, got ${xs.length}, ${ys.length} and ${teams.length}`,
    );
  const out: Placement[] = [];
  const missingXY: Value[] = [];
  if (kind === "headshot") {
    if (!Object.hasOwn(ESPN_HEADSHOT_LEAGUES, league))
      throw new InputError(
        `no ESPN headshots for league ${JSON.stringify(league)}; supported: ${Object.keys(ESPN_HEADSHOT_LEAGUES).sort().join(", ")}`,
      );
    const hl = league as EspnHeadshotLeague;
    const gsis = o.idSystem === "gsis";
    const noImage: Value[] = [];
    teams.forEach((pid, i) => {
      if (missing(pid)) return;
      if (missing(xs[i]) || missing(ys[i])) {
        missingXY.push(pid);
        return;
      }
      const url = headshotUrl(pid, hl, { idSystem: gsis ? "gsis" : "espn" });
      if (url === undefined) {
        noImage.push(pid);
        return;
      }
      const id = gsis ? String(pid).trim() : (normValue(pid) ?? String(pid).trim());
      out.push({ index: i, id, x: xs[i], y: ys[i], url, aspect: HEADSHOT_ASPECT, mark: null });
    });
    skipped(league, "with no headshot", noImage, on);
  } else {
    const seasons: readonly SeasonInput[] = Array.isArray(o.season)
      ? (o.season as readonly SeasonInput[])
      : teams.map(() => o.season as SeasonInput);
    const ropts: ResolveOptions = { season: seasons, strict };
    if (o.idSystem !== undefined) ropts.idSystem = o.idSystem as IdSystem;
    const ids = resolveSync(teams, league, ropts);
    const cache = new Map<string, MarkRow | undefined>();
    const noMark: Value[] = [];
    teams.forEach((raw, i) => {
      const id = ids[i];
      if (id === undefined) return; // the resolver already warned (once per call)
      if (missing(xs[i]) || missing(ys[i])) {
        missingXY.push(raw);
        return;
      }
      const k = `${id}|${String(seasons[i])}`;
      if (!cache.has(k))
        cache.set(k, selectMarkSync(id, league, { season: seasons[i], variant, markType: kind }));
      const row = cache.get(k);
      if (!row) {
        noMark.push(raw);
        return;
      }
      const aspect = row.width && row.height ? row.width / row.height : null;
      out.push({ index: i, id, x: xs[i], y: ys[i], url: row.archive_url, aspect, mark: row });
    });
    skipped(league, `with no ${kind} archived`, noMark, on);
  }
  skipped(league, "with a missing x or y", missingXY, on);
  return out;
}
export async function place(
  xs: readonly Value[],
  ys: readonly Value[],
  teams: readonly Value[],
  o: PlaceOptions,
): Promise<Placement[]> {
  await loadLeague(o.league);
  if (o.kind === "headshot" && o.idSystem === "gsis") await loadGsis();
  return placeSync(xs, ys, teams, o);
}
