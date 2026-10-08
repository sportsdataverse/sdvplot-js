// `npm ci` for the notebooks when node_modules is missing or was installed from another package-lock.json. Plain Node,
// because nothing is installed yet: `npm run build` runs it first, so a clean clone (Vercel, CI) needs no manual step.
import { execSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const dir = fileURLToPath(new URL("..", import.meta.url));
const lock = createHash("sha256")
  .update(readFileSync(`${dir}/package-lock.json`))
  .digest("hex");
const stamp = `${dir}/node_modules/.sdv-lock-sha256`;
if (!existsSync(stamp) || readFileSync(stamp, "utf8") !== lock) {
  execSync("npm ci --no-audit --no-fund", { cwd: dir, stdio: "inherit" });
  writeFileSync(stamp, lock);
}
