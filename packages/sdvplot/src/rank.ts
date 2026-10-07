/** Source preference, best first; unknown sources rank 5. Shared by the shard generator and the lazy full-manifest path. */
export const SOURCE_RANK: Readonly<Record<string, number>> = {
  espn: 0,
  nflverse: 1,
  nhl: 1,
  mlbstatic: 1,
  fox: 1,
  hockeytech: 2,
  cricinfo: 2,
  "ncaa.com": 3,
  "nwhl.co": 4,
  shiftstats: 4,
  wayback: 4,
  "aaf.com": 5,
  "aaf-strip-crop": 6,
};

export interface Rankable {
  source_rank: number;
  valid_from: number | null;
  valid_to: number | null;
  first_seen: string;
  sha256: string;
}
const desc = <T extends string | number>(a: T | null, b: T | null): number =>
  a === b ? 0 : a === null ? 1 : b === null ? -1 : a < b ? 1 : -1;
/** Python `_ranked`: source_rank asc, open-ended (valid_to null) first, valid_to desc, first_seen desc, valid_from desc, sha256 asc; nulls last. */
export function compareMarks(a: Rankable, b: Rankable): number {
  return (
    a.source_rank - b.source_rank ||
    Number(a.valid_to !== null) - Number(b.valid_to !== null) ||
    desc(a.valid_to, b.valid_to) ||
    desc(a.first_seen, b.first_seen) ||
    desc(a.valid_from, b.valid_from) ||
    (a.sha256 < b.sha256 ? -1 : a.sha256 > b.sha256 ? 1 : 0)
  );
}
