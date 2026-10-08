import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

const root = process.cwd();
const repo = resolve(process.env.SPORTYR_REPO ?? join(root, "..", "sportyR"));
const SRC = "data-raw/surface-dimensions.json";
const dir = join(root, "packages", "sporty", "data");
const dest = join(dir, "surface-dimensions.json");
const check = process.argv.includes("--check");
// --no-optional-locks: `status` never rewrites the sibling's index
const git = (...args: string[]): Buffer => execFileSync("git", ["-C", repo, "--no-optional-locks", ...args]);

if (!existsSync(join(repo, SRC))) {
  if (check && existsSync(dest)) {
    console.log(`vendor --check: skipped (no sportyR checkout at ${repo})`);
    process.exit(0);
  }
  console.error(`sportyR source not found: ${join(repo, SRC)} (set SPORTYR_REPO)`);
  process.exit(1);
}
// Vendor sportyR's committed HEAD blobs, never its working tree. A Windows checkout of the same commit can hold CRLF
// line endings (a byte copy fails --check and fixtures-version.test.ts's sha256), and uncommitted edits are not what
// VENDOR_SOURCE's sha names. Both are ignored, and a dirty sibling says so.
const dirty = git("status", "--porcelain", "--", SRC, "DESCRIPTION").toString().trimEnd();
if (dirty) console.warn(`vendor: ignoring uncommitted changes in ${repo}; vendoring HEAD:\n${dirty}`);
const data = git("show", `HEAD:${SRC}`);
if (check) {
  if (!existsSync(dest) || !data.equals(readFileSync(dest))) {
    console.error(
      `vendor --check: packages/sporty/data/surface-dimensions.json differs from sportyR HEAD:${SRC}; run \`pnpm vendor\``,
    );
    process.exit(1);
  }
  console.log("vendor --check: ok");
} else {
  mkdirSync(dir, { recursive: true });
  writeFileSync(dest, data);
  const sha = git("rev-parse", "--short", "HEAD").toString().trim();
  const version = /^Version:\s*(\S+)/m.exec(git("show", "HEAD:DESCRIPTION").toString())?.[1] ?? "unknown";
  // `sportyR <DESCRIPTION version> <git sha> <date>`; fixtures-version.test.ts ties fixtures/sporty/VERSION to it. The
  // date is when that commit was first vendored: re-vendoring the same commit keeps the line, so git status stays clean.
  const source = join(dir, "VENDOR_SOURCE");
  const stamp = `sportyR ${version} ${sha}`;
  if (!existsSync(source) || !readFileSync(source, "utf8").startsWith(`${stamp} `))
    writeFileSync(source, `${stamp} ${new Date().toISOString().slice(0, 10)}\n`);
  console.log(`vendored sportyR ${version} (${sha})`);
}
