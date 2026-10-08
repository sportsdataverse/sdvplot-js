// Release-plan guard for the 0.x policy: nothing reaches 1.0.0 by accident. Changesets bumps the dependents of a
// peer that leaves their range by "major", which in 0.x means 1.0.0; a `workspace:^` peer on a 0.0.0 package
// leaves `^0.0.0` at 0.1.0. Delete this check when 1.0.0 is intended.
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";

const bin = createRequire(import.meta.url).resolve("@changesets/cli/bin.js");
const dir = mkdtempSync(join(tmpdir(), "release-plan-"));
try {
  execFileSync(process.execPath, [bin, "status", "--output", join(dir, "plan.json")], { stdio: "inherit" });
  const { releases } = JSON.parse(readFileSync(join(dir, "plan.json"), "utf8"));
  for (const r of releases) console.log(`${r.name} ${r.oldVersion} -> ${r.newVersion} (${r.type})`);
  const major = releases.filter((r) => Number.parseInt(r.newVersion, 10) >= 1);
  if (major.length > 0) {
    console.error(`release plan reaches 1.0.0: ${major.map((r) => r.name).join(", ")}`);
    process.exitCode = 1;
  }
} finally {
  rmSync(dir, { recursive: true, force: true });
}
