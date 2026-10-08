import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { SOURCES, abs } from "../sources.js";
import type { ExampleEntry, ExamplePackage } from "../src/contract.js";
import {
  type GenFile,
  browserModule,
  codeOf,
  discoverSporty,
  docModule,
  extractDocExamples,
  familyModules,
  metaOf,
  registryModules,
} from "./lib.js";

/** Sports whose surfaces the gallery draws: discovered, with every omitted sport or league logged. */
function sportySurfaces(): Record<string, string[]> {
  const dir = abs("packages/sporty/src/specs");
  if (!existsSync(dir)) return {};
  const specs: Record<string, string> = {};
  for (const f of readdirSync(dir)) {
    const sport = f.replace(/\.ts$/, "");
    if (/^[a-z]+\.ts$/.test(f) && sport !== "index") specs[sport] = readFileSync(join(dir, f), "utf8");
  }
  const { all, dispatched } = discoverSporty(specs, readFileSync(abs("packages/sporty/src/api.ts"), "utf8"));
  for (const [sport, leagues] of Object.entries(all)) {
    const missing = sport in dispatched ? [] : leagues;
    if (missing.length > 0)
      console.log(
        `examples: sporty ${sport} has no surface() dispatch yet; no gallery surfaces for: ${missing.join(", ")}`,
      );
  }
  return dispatched;
}

const EX = abs("examples");
const PACKAGES: readonly ExamplePackage[] = ["sdvplot", "sporty", "sdvtables"];
const posix = (p: string): string => p.split(sep).join("/");

function walk(dir: string, skip: (rel: string) => boolean, base: string = dir): string[] {
  const files: string[] = [];
  for (const d of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, d.name);
    if (skip(posix(relative(base, full)))) continue;
    if (d.isDirectory()) files.push(...walk(full, skip, base));
    else if (/\.tsx?$/.test(d.name) && !d.name.endsWith(".d.ts")) files.push(full);
  }
  return files.sort((a, b) => (posix(a) < posix(b) ? -1 : 1));
}

function entryOf(file: string): ExampleEntry {
  const rel = posix(relative(join(EX, "src"), file));
  const id = rel.replace(/^generated\//, "").replace(/\.tsx?$/, "");
  const seg = id.split("/");
  const pkg = seg[0] === "api" ? seg[1] : seg[0];
  if (pkg !== "sdvplot" && pkg !== "sporty" && pkg !== "sdvtables")
    throw new Error(`examples/src/${rel}: the first folder must be sdvplot, sporty or sdvtables`);
  const text = readFileSync(file, "utf8");
  return {
    id,
    package: pkg,
    ...metaOf(text, rel),
    code: codeOf(text, rel),
    lang: rel.endsWith(".tsx") ? "tsx" : "ts",
    file: `src/${rel}`,
  };
}

/** Write the generated examples (families, docstrings), the registry and the browser loaders; return the registry. */
export function generate(): readonly ExampleEntry[] {
  rmSync(join(EX, "src/generated"), { recursive: true, force: true });
  // The theme family needs Phase 4's html renderer; until its SOURCES row exists the family is skipped, not thrown.
  const html = "@sportsdataverse/sdvtables/html" in SOURCES;
  if (!html) console.log("examples: sdvtables/html not wired yet (Phase 4); skipping the theme family");
  const out: GenFile[] = familyModules(sportySurfaces()).filter(
    (f) => html || !f.path.startsWith("src/generated/sdvtables/"),
  );
  for (const p of PACKAGES) {
    const seen = new Map<string, number>();
    if (!existsSync(abs(`packages/${p}/src`))) {
      console.log(`examples: packages/${p}/src not present yet; no docstring examples from it`);
      continue;
    }
    for (const f of walk(abs(`packages/${p}/src`), (rel) => rel === "data" || rel === "specs")) {
      const from = posix(relative(abs(""), f));
      for (const ex of extractDocExamples(readFileSync(f, "utf8"), from)) {
        const k = (seen.get(ex.symbol) ?? 0) + 1;
        seen.set(ex.symbol, k);
        out.push({
          path: `src/generated/api/${p}/${k === 1 ? ex.symbol : `${ex.symbol}-${k}`}.${ex.lang}`,
          text: docModule({ ...ex, from, contract: "../../../contract.js" }),
        });
      }
    }
  }
  for (const f of out) {
    mkdirSync(dirname(join(EX, f.path)), { recursive: true });
    writeFileSync(join(EX, f.path), f.text);
  }
  // draw/ is the docs' browser renderer for BrowserSpec, not an example
  const skip = (rel: string): boolean =>
    rel === "contract.ts" || rel === "data.ts" || rel === "draw" || rel.endsWith(".gen.ts");
  const entries = walk(join(EX, "src"), skip).map(entryOf);
  const dup = entries.find((e, i) => entries.findIndex((o) => o.id === e.id) !== i);
  if (dup) throw new Error(`two examples share the id ${dup.id}`);
  // Written after the walk, so they are never read as examples.
  const browser = entries.flatMap((e) => {
    const text = browserModule(readFileSync(join(EX, e.file), "utf8"), e.file);
    if (text === null) return [];
    mkdirSync(dirname(join(EX, `src/generated/browser/${e.id}.ts`)), { recursive: true });
    writeFileSync(join(EX, `src/generated/browser/${e.id}.ts`), text);
    return [e.id];
  });
  const generated = registryModules(entries, browser);
  writeFileSync(join(EX, "src/registry.gen.ts"), generated.registry);
  writeFileSync(join(EX, "src/loaders.gen.ts"), generated.loaders);
  writeFileSync(join(EX, "src/browser.gen.ts"), generated.browser);
  return entries;
}

if (process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  console.log(`examples: ${generate().length} in the registry`);
}
