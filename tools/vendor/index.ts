import { execFileSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

const root = process.cwd();
const repo = resolve(process.env.SPORTYR_REPO ?? join(root, "..", "sportyR"));
const src = join(repo, "data-raw", "surface-dimensions.json");
const dir = join(root, "packages", "sporty", "data");
const dest = join(dir, "surface-dimensions.json");
const check = process.argv.includes("--check");

if (!existsSync(src)) {
  if (check && existsSync(dest)) {
    console.log(`vendor --check: skipped (no sportyR checkout at ${repo})`);
    process.exit(0);
  }
  console.error(`sportyR source not found: ${src} (set SPORTYR_REPO)`);
  process.exit(1);
}
if (check) {
  if (!existsSync(dest) || !readFileSync(src).equals(readFileSync(dest))) {
    console.error("vendor --check: packages/sporty/data/surface-dimensions.json is stale; run `pnpm vendor`");
    process.exit(1);
  }
  console.log("vendor --check: ok");
} else {
  mkdirSync(dir, { recursive: true });
  copyFileSync(src, dest);
  const sha = execFileSync("git", ["-C", repo, "rev-parse", "--short", "HEAD"], { encoding: "utf8" }).trim();
  const version =
    /^Version:\s*(\S+)/m.exec(readFileSync(join(repo, "DESCRIPTION"), "utf8"))?.[1] ?? "unknown";
  // `sportyR <DESCRIPTION version> <git sha> <date>`; fixtures-version.test.ts ties fixtures/sporty/VERSION to it
  writeFileSync(
    join(dir, "VENDOR_SOURCE"),
    `sportyR ${version} ${sha} ${new Date().toISOString().slice(0, 10)}\n`,
  );
  console.log(`vendored sportyR ${version} (${sha})`);
}
