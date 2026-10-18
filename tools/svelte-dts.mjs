// After svelte-package: point the declaration files' `./X.svelte` imports at `./X.svelte.js`. TypeScript resolves
// `./X.svelte.js` to `X.svelte.d.ts` under both node16 and bundler resolution, while `./X.svelte` resolves only under
// bundler (node16 looks for `X.d.svelte.ts`). Only the .d.ts files change: the shipped JS keeps `./X.svelte`.
// Usage (from a package dir): node ../../tools/svelte-dts.mjs dist/svelte
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const dir = process.argv[2];
if (!dir) throw new Error("svelte-dts: pass the svelte-package output directory");
let n = 0;
for (const f of readdirSync(dir, { recursive: true }).filter((p) => String(p).endsWith(".d.ts"))) {
  const file = join(dir, String(f));
  const text = readFileSync(file, "utf8");
  const out = text.replace(/(from\s+["'])(\.{1,2}\/[^"']+\.svelte)(["'])/g, "$1$2.js$3");
  if (out !== text) writeFileSync(file, out);
  n += out === text ? 0 : 1;
}
console.log(`svelte-dts: ${n} declaration file(s) point at .svelte.js`);
