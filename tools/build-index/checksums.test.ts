import { expect, test } from "vitest";
import { CHECKSUMS, checksumsText, verifyChecksums } from "./checksums.js";

const tree = (o: Record<string, string>) => new Map(Object.entries(o));
const files = tree({ "teams/nfl.ts": "a", "index.ts": "b" });

test("checksumsText is sorted sha256sum lines and skips itself", () => {
  const text = checksumsText(new Map([...files, [CHECKSUMS, "x"]]));
  expect(text).toBe(
    "3e23e8160039594a33894f6564e1b1348bbd7a0088d42c4acb73eeaed59c009d  index.ts\n" +
      "ca978112ca1bbdcafac231b39a23dc4da786eff8147c4e72b9807785afee48bb  teams/nfl.ts\n",
  );
});

test("verifyChecksums passes a matching tree and counts the listed files", () => {
  const listing = checksumsText(files);
  expect(verifyChecksums(listing, new Map([...files, [CHECKSUMS, listing]]))).toEqual({
    listed: 2,
    problems: [],
  });
});

test("verifyChecksums flags a hand edit, a deleted file, an orphan and a malformed line", () => {
  const listing = `${checksumsText(files)}not a digest line\n`;
  const { problems } = verifyChecksums(listing, tree({ "teams/nfl.ts": "edited", "marks/xfl.ts": "new" }));
  expect(problems).toEqual([
    'malformed line: "not a digest line"',
    "missing: index.ts",
    "digest mismatch: teams/nfl.ts",
    "orphan (not in CHECKSUMS): marks/xfl.ts",
  ]);
});
