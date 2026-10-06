import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { expect, test } from "vitest";

// Spec §7 drift gate: the R fixtures must come from the sportyR whose data is vendored in data/ (tools/oracle/sporty.R
// checks all.equal before writing them and records the JSON's sha256 in fixtures/sporty/VERSION).
const read = (rel: string): Buffer => readFileSync(new URL(rel, import.meta.url));
const version = read("../../../fixtures/sporty/VERSION").toString();
const field = (key: string): string | undefined => new RegExp(`^${key} (\\S+)`, "m").exec(version)?.[1];
const [, vendorVersion, vendorSha] = read("../data/VENDOR_SOURCE").toString().trim().split(" ");

test("fixtures were generated against the vendored surface-dimensions.json (sha256)", () => {
  const sha = createHash("sha256").update(read("../data/surface-dimensions.json")).digest("hex");
  expect(field("surface-dimensions-sha256"), "re-run `pnpm oracle:sporty basketball hockey football`").toBe(
    sha,
  );
});

test("fixtures' sportyR version and checkout match data/VENDOR_SOURCE", () => {
  expect(field("sportyR")).toBe(vendorVersion);
  expect(field("sportyR-git")).toBe(vendorSha);
});
