import { type Alias, type MarkRow, archiveUrl } from "./data/index.js";
import { DownloadError } from "./errors.js";
import { SOURCE_RANK, compareMarks } from "./rank.js";

export const MANIFEST_URL = "https://sdv.nyc3.cdn.digitaloceanspaces.com/assets/public/manifest/marks.csv";

export interface ManifestRow {
  level: string;
  league: string;
  entity_id: string;
  mark_type: string;
  variant: string;
  valid_from: string;
  valid_to: string;
  source: string;
  sha256: string;
  ext: string;
  width: string;
  height: string;
  archive_url: string;
  first_seen: string;
}

/** archive_url reaches the web adapters' HTML (Python drops rows failing SAFE_URL); a row must carry exactly the content-addressed URL the loader derives, or it is dropped. */
export const safeArchive = (m: Pick<ManifestRow, "archive_url" | "sha256" | "ext">): boolean =>
  /^[0-9a-f]{64}$/.test(m.sha256) &&
  /^[a-z0-9]+$/.test(m.ext) &&
  m.archive_url === archiveUrl(m.sha256, m.ext);

/** RFC 4180 over the whole text (quoted commas, doubled quotes, embedded newlines; CRLF or LF); rows keyed by header name. */
export function parseManifestCsv(text: string): ManifestRow[] {
  const src = text.replace(/^\uFEFF/, ""); // a BOM would make the first header "\uFEFFlevel" and drop every row
  const records: string[][] = [];
  let rec: string[] = [];
  let cur = "";
  let q = false;
  const endRecord = (): void => {
    rec.push(cur);
    cur = "";
    if (rec.length > 1 || rec[0] !== "") records.push(rec);
    rec = [];
  };
  for (let i = 0; i < src.length; i++) {
    const c = src[i] as string;
    if (q) {
      if (c !== '"') cur += c;
      else if (src[i + 1] === '"') {
        cur += '"';
        i++;
      } else q = false;
    } else if (c === '"') q = true;
    else if (c === ",") {
      rec.push(cur);
      cur = "";
    } else if (c === "\n") endRecord();
    else if (c === "\r" && src[i + 1] === "\n") continue;
    else cur += c;
  }
  if (cur !== "" || rec.length > 0) endRecord();
  const header = records[0] ?? [];
  return records.slice(1).map((f) => {
    const r: Record<string, string> = {};
    header.forEach((h, i) => {
      r[h] = f[i] ?? "";
    });
    return r as unknown as ManifestRow;
  });
}

const int = (s: string): number | null => (s === "" ? null : Number.parseInt(s, 10));
const key = (source: string, id: string): string => `${source}:${id}`.trim().toLowerCase();

/** mark aliases: key → (team_id, union range), unique team mappings only. */
export function markAliases(
  aliases: readonly Alias[],
): Map<string, { team_id: string; from: number | null; to: number | null }> {
  const by = new Map<
    string,
    { teams: Set<string>; from: number | null; to: number | null; anyOpenFrom: boolean; anyOpenTo: boolean }
  >();
  for (const a of aliases) {
    if (a.id_system !== "mark") continue;
    const k = a.value.trim().toLowerCase();
    const e = by.get(k) ?? {
      teams: new Set<string>(),
      from: null,
      to: null,
      anyOpenFrom: false,
      anyOpenTo: false,
    };
    e.teams.add(a.team_id);
    if (a.valid_from === null) e.anyOpenFrom = true;
    else e.from = e.from === null ? a.valid_from : Math.min(e.from, a.valid_from);
    if (a.valid_to === null) e.anyOpenTo = true;
    else e.to = e.to === null ? a.valid_to : Math.max(e.to, a.valid_to);
    by.set(k, e);
  }
  const out = new Map<string, { team_id: string; from: number | null; to: number | null }>();
  for (const [k, e] of by)
    if (e.teams.size === 1)
      out.set(k, {
        team_id: [...e.teams][0] as string,
        from: e.anyOpenFrom ? null : e.from,
        to: e.anyOpenTo ? null : e.to,
      });
  return out;
}

/** Alias-mapped, safe-URL-filtered, ranked marks of one league; `archive_url` is derived, never copied. Not deduped. */
export function manifestMarks(
  league: string,
  rows: readonly ManifestRow[],
  aliases: readonly Alias[],
): MarkRow[] {
  const ma = markAliases(aliases);
  const out: MarkRow[] = [];
  for (const m of rows) {
    if (m.level !== "team" || m.league !== league || !safeArchive(m)) continue;
    const a = ma.get(key(m.source, m.entity_id));
    if (!a) continue;
    const vf = int(m.valid_from);
    const vt = int(m.valid_to);
    out.push({
      team_id: a.team_id,
      mark_type: m.mark_type as "logo" | "wordmark",
      variant: m.variant,
      valid_from: vf === null ? a.from : a.from === null ? vf : Math.max(vf, a.from), // pl.max_horizontal (nulls ignored)
      valid_to: vt === null ? a.to : a.to === null ? vt : Math.min(vt, a.to), // pl.min_horizontal
      source: m.source,
      first_seen: m.first_seen,
      sha256: m.sha256,
      ext: m.ext,
      width: int(m.width),
      height: int(m.height),
      source_rank: SOURCE_RANK[m.source] ?? 5, // after height: the shard generator's JSON key order
      archive_url: archiveUrl(m.sha256, m.ext),
    });
  }
  return out.sort(compareMarks);
}

let cached: Promise<ManifestRow[]> | undefined;
export function resetManifestCache(): void {
  cached = undefined;
}
/** The CDN manifest, fetched once per process (a failure is not cached). */
export function fetchManifest(o: { fetch?: typeof fetch } = {}): Promise<ManifestRow[]> {
  const f = o.fetch ?? globalThis.fetch;
  cached ??= (async () => {
    const r = await f(MANIFEST_URL);
    if (!r.ok)
      throw new DownloadError(
        `manifest download failed: ${MANIFEST_URL} answered ${r.status}`,
        MANIFEST_URL,
        r.status,
      );
    return parseManifestCsv(await r.text());
  })().catch((e: unknown) => {
    cached = undefined;
    throw e;
  });
  return cached;
}
