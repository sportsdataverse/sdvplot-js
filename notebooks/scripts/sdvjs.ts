// The "Workflows with sdv-js" snapshots: real ESPN responses, committed verbatim (gzipped) in fixtures/sdvjs with
// their provenance, and the vendored sportsdataverse-js parser that turns them into rows. Shared by the snapshot
// script, the notebooks build and examples/test/sdvjs-snapshots.test.ts, so all three trim and hash the same way.
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { gunzipSync } from "node:zlib";
import { abs } from "../../examples/sources.js";

export const FIXTURES: string = abs("fixtures/sdvjs");
export const VENDORED: string = abs("notebooks/vendor/sdv-parsers.js");
const MARKER = "// ---- upstream bytes follow ----\n";

/** One parse a page runs on a snapshot: an ESPN endpoint short name and, for `summary`, the section. */
export interface Parsed {
  endpoint: string;
  section?: string;
  rows: number;
  /** sha256 of `JSON.stringify(rows)`, parsed from the WHOLE response: the trimmed copy must give the same rows. */
  rows_sha256: string;
}
export interface Snapshot {
  name: string;
  /** The notebook that reads it (notebooks/src/<page>.md). */
  page: string;
  url: string;
  /** The sportsdataverse-js call that makes the same request. */
  sdv_js: string;
  captured_at: string;
  /** Size and sha256 of the response body as served (the gunzipped fixture). */
  bytes: number;
  sha256: string;
  file: string;
  /** Top-level keys the page attachment keeps. */
  keep: string[];
  /** Drop every `links` array below them too (a game log's per-game link lists are most of its bytes). */
  cut_links?: boolean;
  parsed: Parsed[];
}
export interface Provenance {
  parser: { file: string; source: string; sdv_js_commit: string; sha256: string };
  snapshots: Snapshot[];
}

export const sha256 = (data: string | Uint8Array): string => createHash("sha256").update(data).digest("hex");

export const provenance = (): Provenance =>
  JSON.parse(readFileSync(join(FIXTURES, "provenance.json"), "utf8")) as Provenance;

/** The response body exactly as served. */
export const rawText = (s: Snapshot): string =>
  gunzipSync(readFileSync(join(FIXTURES, s.file))).toString("utf8");

/**
 * What a page reads: the top-level keys in `keep`, and with `cut_links` no `links` array anywhere below them. The
 * snapshot script and the test check that the parsed rows are unchanged by the cut.
 */
export function trim(
  raw: Record<string, unknown>,
  { keep, cut_links }: Pick<Snapshot, "keep" | "cut_links">,
): Record<string, unknown> {
  const drop = (v: unknown): unknown =>
    Array.isArray(v)
      ? v.map(drop)
      : v !== null && typeof v === "object"
        ? Object.fromEntries(
            Object.entries(v as Record<string, unknown>)
              .filter(([k]) => !(cut_links && k === "links"))
              .map(([k, x]) => [k, drop(x)]),
          )
        : v;
  return Object.fromEntries(keep.filter((k) => k in raw).map((k) => [k, cut_links ? drop(raw[k]) : raw[k]]));
}

/** The vendored bundle's upstream bytes (below its header). */
export const vendoredBody = (): string => {
  const text = readFileSync(VENDORED, "utf8");
  const at = text.indexOf(MARKER);
  if (at < 0) throw new Error(`${VENDORED}: no "${MARKER.trim()}" line`);
  // the pin covers the bytes below the marker; the header above it must not run anything, so: comment lines only
  if (
    text
      .slice(0, at)
      .split("\n")
      .some((line) => line !== "" && !line.startsWith("// "))
  )
    throw new Error(`${VENDORED}: a header line above the marker is not a comment`);
  return text.slice(at + MARKER.length);
};

/** Throws unless the vendored parser is byte-for-byte the pinned sportsdataverse-js bundle. */
export function checkVendored(p: Provenance = provenance()): void {
  const got = sha256(vendoredBody());
  if (got !== p.parser.sha256)
    throw new Error(
      `notebooks/vendor/sdv-parsers.js is not the pinned sportsdataverse-js bundle: sha256 ${got}, pinned ${p.parser.sha256} (fixtures/sdvjs/provenance.json)`,
    );
}

type ParseEndpoint = (kind: "espn", key: string, raw: unknown, section?: string) => unknown;
/** The vendored parser's `parseEndpoint`, after the pin check. */
export async function parser(): Promise<ParseEndpoint> {
  checkVendored();
  const mod = (await import(pathToFileURL(VENDORED).href)) as { parseEndpoint: ParseEndpoint };
  return mod.parseEndpoint;
}

/** Each of the snapshot's parses, run on `raw`. */
export const parseAll = (parse: ParseEndpoint, s: Pick<Snapshot, "parsed">, raw: unknown): unknown[] =>
  s.parsed.map((p) => parse("espn", p.endpoint, raw, p.section));
