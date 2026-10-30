// Sets CITATION.cff's version and release date to the version `changeset version` just wrote, so GitHub's
// "Cite this repository" never lags a release. Runs inside `pnpm version-packages`; the three packages share a version.
// The date is the day the version PR was last regenerated, which is the day it is merged and published in practice.
import { readFileSync, writeFileSync } from "node:fs";

const { version } = JSON.parse(readFileSync("packages/sdvplot/package.json", "utf8"));
const today = new Date().toISOString().slice(0, 10);
const cff = readFileSync("CITATION.cff", "utf8")
  .replace(/^version: .*$/m, `version: ${version}`)
  .replace(/^date-released: .*$/m, `date-released: "${today}"`);
writeFileSync("CITATION.cff", cff);
