// Packs the package in the current directory and checks the tarball with attw (ESM-only profile) and publint --strict.
// Plain Node, so `pnpm pack:check` runs the same under sh and Windows cmd (no `>/dev/null`, no shell glob).
// Usage (from a package dir): node ../../tools/pack-check.mjs
import { spawnSync } from "node:child_process";
import { readdirSync, rmSync } from "node:fs";

const OUT = "temp/pack"; // relative and space-free: the args go through cmd's shell on Windows
const run = (cmd, args, quiet = false) =>
  spawnSync(cmd, args, {
    stdio: quiet ? ["ignore", "ignore", "inherit"] : "inherit", // pnpm pack lists every file on stdout
    shell: process.platform === "win32", // pnpm, attw and publint are .cmd shims there
  }).status === 0;

rmSync(OUT, { recursive: true, force: true }); // exactly one tarball: never a stale one from an older version
if (!run("pnpm", ["pack", "--pack-destination", OUT], true)) process.exit(1);
const tgz = readdirSync(OUT).find((f) => f.endsWith(".tgz"));
const ok = run("attw", [`${OUT}/${tgz}`, "--profile", "esm-only"]) && run("publint", ["--strict"]);
process.exit(ok ? 0 : 1);
