import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { emitSport } from "./emit-sport.js";

const root = process.cwd();
const data = JSON.parse(
  readFileSync(join(root, "packages", "sporty", "data", "surface-dimensions.json"), "utf8"),
) as Record<string, Record<string, Record<string, unknown>>>;
const outDir = join(root, "packages", "sporty", "src", "specs");
const sports = Object.keys(data).sort();

const files = new Map<string, string>();
for (const s of sports) files.set(`${s}.ts`, emitSport(s, data[s] ?? {}));
files.set("index.ts", sports.map((s) => `export * from "./${s}.js";\n`).join(""));

if (process.argv.includes("--check")) {
  const stale = [...files]
    .filter(([n, c]) => !existsSync(join(outDir, n)) || readFileSync(join(outDir, n), "utf8") !== c)
    .map(([n]) => n);
  if (stale.length) {
    console.error(`codegen --check: stale generated files: ${stale.join(", ")}; run \`pnpm codegen\``);
    process.exit(1);
  }
  console.log("codegen --check: ok");
} else {
  mkdirSync(outDir, { recursive: true });
  for (const [n, c] of files) writeFileSync(join(outDir, n), c);
  console.log(`generated ${files.size} files`);
}
