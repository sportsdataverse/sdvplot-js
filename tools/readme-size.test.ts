import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "vitest";

// npm stores at most 65,536 characters of a README and cuts the rest off its package page (sdvplot 0.2.0 lost its
// tail that way). Keep every README that ships a margin below that.
const LIMIT = 64_000;
const root = join(import.meta.dirname, "..");
const readmes = [
  "README.md",
  ...readdirSync(join(root, "packages")).map((p) => join("packages", p, "README.md")),
];

test.each(readmes)("%s stays under npm's README cut", (path) => {
  const chars = readFileSync(join(root, path), "utf8").length; // UTF-16 units, as npm counts
  expect(chars, `${path} has ${chars} characters; npm cuts a README at 65,536`).toBeLessThan(LIMIT);
});
