import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, expect, test } from "vitest";

const SCRIPT = fileURLToPath(new URL("./index.ts", import.meta.url));
const TSX = createRequire(import.meta.url).resolve("tsx/cli");
const SRC = "data-raw/surface-dimensions.json";
const BLOB = '{\n  "nba": { "court_length": 94 }\n}\n';
const temps: string[] = [];
afterEach(() => {
  for (const t of temps.splice(0)) rmSync(t, { recursive: true, force: true, maxRetries: 3 });
});

/** A sportyR repo whose committed blob is LF while its working tree is CRLF and `git status` is clean: a Windows checkout. */
function sandbox() {
  const tmp = mkdtempSync(join(tmpdir(), "vendor-"));
  temps.push(tmp);
  const root = join(tmp, "sdvplot-js");
  const repo = join(tmp, "sportyR");
  const dest = join(root, "packages/sporty/data/surface-dimensions.json");
  mkdirSync(join(root, "packages/sporty/data"), { recursive: true });
  mkdirSync(join(repo, "data-raw"), { recursive: true });
  const git = (...a: string[]) =>
    execFileSync(
      "git",
      ["-C", repo, "-c", "user.name=t", "-c", "user.email=t@t", "-c", "commit.gpgsign=false", ...a],
      {
        stdio: "pipe",
      },
    ).toString();
  git("init", "-q");
  writeFileSync(join(repo, "DESCRIPTION"), "Package: sportyR\nVersion: 2.2.3\n");
  writeFileSync(join(repo, SRC), BLOB);
  git("add", ".");
  git("commit", "-q", "-m", "data");
  git("config", "core.autocrlf", "true");
  rmSync(join(repo, SRC));
  git("checkout", "--", SRC);
  return { tmp, root, repo, dest, git };
}
const vendor = (root: string, repo: string, ...args: string[]) =>
  spawnSync(process.execPath, [TSX, SCRIPT, ...args], {
    cwd: root,
    env: { ...process.env, SPORTYR_REPO: repo },
    encoding: "utf8",
  });

test("vendors HEAD's LF blob from a CRLF checkout, and --check then passes", { timeout: 60_000 }, () => {
  const { root, repo, dest, git } = sandbox();
  expect(readFileSync(join(repo, SRC), "utf8")).toBe(BLOB.replaceAll("\n", "\r\n"));
  expect(git("status", "--porcelain")).toBe("");

  const w = vendor(root, repo);
  expect(w.status, w.stderr).toBe(0);
  expect(readFileSync(dest, "utf8")).toBe(BLOB);
  const source = join(root, "packages/sporty/data/VENDOR_SOURCE");
  expect(readFileSync(source, "utf8")).toMatch(/^sportyR 2\.2\.3 [0-9a-f]{7,} \d{4}-\d{2}-\d{2}\n$/);
  expect(w.stderr).not.toContain("uncommitted");

  // re-vendoring the same commit keeps VENDOR_SOURCE (and its date): a no-op run leaves git status clean
  const stamped = readFileSync(source, "utf8").replace(/\S+\n$/, "2000-01-01\n");
  writeFileSync(source, stamped);
  expect(vendor(root, repo).status).toBe(0);
  expect(readFileSync(source, "utf8")).toBe(stamped);

  const c = vendor(root, repo, "--check");
  expect(c.status, c.stderr).toBe(0);
  expect(c.stdout).toContain("vendor --check: ok");
});

test("--check fails when the vendored copy differs from HEAD", { timeout: 60_000 }, () => {
  const { root, repo, dest } = sandbox();
  writeFileSync(dest, BLOB.replaceAll("\n", "\r\n"));
  const c = vendor(root, repo, "--check");
  expect(c.status).toBe(1);
  expect(c.stderr).toContain("differs from sportyR HEAD");
});

test("a dirty sibling warns and still vendors HEAD, not the edit", { timeout: 60_000 }, () => {
  const { root, repo, dest } = sandbox();
  writeFileSync(join(repo, SRC), '{ "edited": true }\n');
  const w = vendor(root, repo);
  expect(w.status, w.stderr).toBe(0);
  expect(w.stderr).toContain("ignoring uncommitted changes");
  expect(readFileSync(dest, "utf8")).toBe(BLOB);
});

test("--check skips when there is no sportyR checkout (CI)", { timeout: 60_000 }, () => {
  const { tmp, root, dest } = sandbox();
  writeFileSync(dest, BLOB);
  const missing = join(tmp, "no-sportyR");
  expect(existsSync(missing)).toBe(false);
  const c = vendor(root, missing, "--check");
  expect(c.status, c.stderr).toBe(0);
  expect(c.stdout).toContain("vendor --check: skipped");
});
