import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * The repository root (this file is `examples/sources.ts`). Not `new URL("../", import.meta.url)`: under the jsdom
 * test environment the global URL resolves relative paths against http://localhost:3000.
 */
export const ROOT: string = join(dirname(fileURLToPath(import.meta.url)), "..");
export const abs = (p: string): string => join(ROOT, p);

/**
 * Every specifier an example may import, mapped to its SOURCE file. Examples, the gate and the docs bundle all
 * run package source, never `dist/`. A phase that adds a package subpath adds its row here (test/sources.test.ts
 * fails until it does) and the same row to tsconfig.json `paths`.
 */
export const SOURCES: Readonly<Record<string, string>> = {
  "@sportsdataverse/sdvplot": "packages/sdvplot/src/index.ts",
  "@sportsdataverse/sdvplot/plot": "packages/sdvplot/src/plot/index.ts",
  "@sportsdataverse/sdvplot/d3": "packages/sdvplot/src/d3/index.ts",
  "@sportsdataverse/sdvplot/react": "packages/sdvplot/src/react/index.tsx",
  "@sportsdataverse/sdvplot/testing": "packages/sdvplot/src/testing/index.ts",
  "@sportsdataverse/sporty": "packages/sporty/src/index.ts",
  "@sportsdataverse/sporty/svg": "packages/sporty/src/svg.ts",
  "@sportsdataverse/sporty/specs": "packages/sporty/src/specs/index.ts",
  "@sportsdataverse/sporty/plot": "packages/sporty/src/plot.ts",
  "@sportsdataverse/sporty/d3": "packages/sporty/src/d3.ts",
  "@sportsdataverse/sdvtables": "packages/sdvtables/src/index.ts",
  "@sportsdataverse/sdvtables/html": "packages/sdvtables/src/html/index.ts",
  "@sportsdataverse/examples/data": "examples/src/data.ts",
};

const version = (pkg: string): string =>
  JSON.parse(readFileSync(abs(`packages/${pkg}/package.json`), "utf8")).version;
/** The build-time constants each package's source reads (tsup/vitest `define` in the packages). */
export const DEFINES: Readonly<Record<string, string>> = {
  __SDVPLOT_VERSION__: JSON.stringify(version("sdvplot")),
  __SPORTY_VERSION__: JSON.stringify(version("sporty")),
  __SDVTABLES_VERSION__: JSON.stringify(version("sdvtables")),
};

/**
 * vite/vitest aliases, anchored: a prefix alias for "@sportsdataverse/sdvplot" would swallow ".../plot". The
 * specifiers hold no RegExp metacharacters.
 */
export const ALIASES: { find: RegExp; replacement: string }[] = Object.entries(SOURCES).map(
  ([spec, file]) => ({ find: new RegExp(`^${spec}$`), replacement: abs(file) }),
);
