// After svelte-package: point the declaration files' `./X.svelte` imports at `./X.svelte.js`. TypeScript resolves
// `./X.svelte.js` to `X.svelte.d.ts` under both node16 and bundler resolution, while `./X.svelte` resolves only under
// bundler (node16 looks for `X.d.svelte.ts`). Only the .d.ts files change: the shipped JS keeps `./X.svelte`.
// Both forms are rewritten: `from "./X.svelte"` and an inline `import("./X.svelte")` type. Any `.svelte` specifier
// left afterwards fails the build, so a new form svelte2tsx emits cannot slip into the package unrewritten.
// Usage (from a package dir): node ../../tools/svelte-dts.mjs dist/svelte
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const dir = process.argv[2];
if (!dir) throw new Error("svelte-dts: pass the svelte-package output directory");
const SPEC = /((?:from\s+|import\(\s*)["'])(\.{1,2}\/[^"']+\.svelte)(["'])/g;
let n = 0;
const left = [];
for (const f of readdirSync(dir, { recursive: true }).filter((p) => String(p).endsWith(".d.ts"))) {
  const file = join(dir, String(f));
  const text = readFileSync(file, "utf8");
  const out = text.replace(SPEC, "$1$2.js$3");
  if (out !== text) {
    writeFileSync(file, out);
    n += 1;
  }
  for (const m of out.matchAll(/[^\s"'(]*\.svelte["']/g)) left.push(`${file}: ${m[0]}`);
}
if (left.length > 0) {
  console.error(`svelte-dts: .svelte specifiers left in declaration files:\n  ${left.join("\n  ")}`);
  process.exit(1);
}
console.log(`svelte-dts: ${n} declaration file(s) point at .svelte.js`);
