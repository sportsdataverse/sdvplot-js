// @vitest-environment node
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { expect, test } from "vitest";
import { abs } from "../sources.js";

/**
 * docs/plugins/import-url-loader.cjs, the loader the docs build runs over Perspective 5.5's viewer and charts builds:
 * it marks each `import(<expression>)` webpackIgnore, and fails the build when a file it is pointed at has none (a
 * Perspective that loads its glue another way must not leave the docs silently broken).
 */
const require = createRequire(abs("examples/package.json"));
const loader = require(abs("docs/plugins/import-url-loader.cjs")) as (
  this: { resourcePath: string },
  s: string,
) => string;
const run = (source: string, resourcePath = "x.js") => loader.call({ resourcePath }, source);
const IGNORE = "import(/* webpackIgnore: true */ ";

test("each import() of an expression is left to the browser; a string import, import.meta and a method named import are not touched", () => {
  const out = run(
    'a=await import(t);b=import("x");c=import.meta.url;d=import(e.clientWorkerURL.toString());f=o.import(y);g=$import(z)',
  );
  expect(out).toBe(
    `a=await ${IGNORE}t);b=import("x");c=import.meta.url;d=${IGNORE}e.clientWorkerURL.toString());f=o.import(y);g=$import(z)`,
  );
});

test("a file with no import() of an expression fails the build, naming the file", () => {
  expect(() => run('const x = import("./a.js"); o.import(y);', "viewer.js")).toThrow(/viewer\.js/);
});

test("the Perspective 5.5.1 builds it is pointed at: the viewer has one such import, the charts plugin two", () => {
  const file = (pkg: string, path: string) => require.resolve(`${pkg}/${path}`);
  for (const [pkg, path, n] of [
    ["@perspective-dev/viewer", "dist/esm/perspective-viewer.js", 1],
    ["@perspective-dev/viewer-charts", "dist/esm/perspective-viewer-charts.js", 2],
  ] as const) {
    const f = file(pkg, path);
    expect(run(readFileSync(f, "utf8"), f).split(IGNORE).length - 1, pkg).toBe(n);
  }
});
