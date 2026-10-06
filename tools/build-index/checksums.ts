import { createHash } from "node:crypto";

/** The digest listing's own name inside `src/data/` (never listed in itself). */
export const CHECKSUMS = "CHECKSUMS";

const sha256 = (b: string | Uint8Array): string => createHash("sha256").update(b).digest("hex");

/** `sha256sum`-format listing (`<hex>  <path>\n`), sorted by path, over each file's bytes. */
export function checksumsText(files: ReadonlyMap<string, string | Uint8Array>): string {
  return [...files.keys()]
    .filter((rel) => rel !== CHECKSUMS)
    .sort()
    .map((rel) => `${sha256(files.get(rel) as string | Uint8Array)}  ${rel}\n`)
    .join("");
}

/** What is wrong with `files` (the tree on disk) against a CHECKSUMS listing: [] when every listed digest matches and nothing is unlisted. */
export function verifyChecksums(
  listing: string,
  files: ReadonlyMap<string, string | Uint8Array>,
): { listed: number; problems: string[] } {
  const problems: string[] = [];
  const want = new Map<string, string>();
  for (const line of listing.split("\n")) {
    if (!line) continue;
    const m = /^([0-9a-f]{64}) {2}(.+)$/.exec(line);
    if (m) want.set(m[2] as string, m[1] as string);
    else problems.push(`malformed line: ${JSON.stringify(line)}`);
  }
  for (const [rel, digest] of want) {
    const b = files.get(rel);
    if (b === undefined) problems.push(`missing: ${rel}`);
    else if (sha256(b) !== digest) problems.push(`digest mismatch: ${rel}`);
  }
  for (const rel of [...files.keys()].sort())
    if (rel !== CHECKSUMS && !want.has(rel)) problems.push(`orphan (not in ${CHECKSUMS}): ${rel}`);
  return { listed: want.size, problems };
}
