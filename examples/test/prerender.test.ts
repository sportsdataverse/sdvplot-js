// @vitest-environment node
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterAll, expect, test } from "vitest";
import { prerender, svgDocument } from "../scripts/gate.js";
import { abs } from "../sources.js";

// Inside the package so the temp test file can resolve "vitest"; `temp/` is gitignored. Its own config, or vitest
// walks up to examples/vitest.config.ts (include: test/**, globalSetup, jsdom).
mkdirSync(abs("examples/temp"), { recursive: true });
const root = mkdtempSync(join(abs("examples/temp"), "prerender-"));
writeFileSync(join(root, "vitest.config.ts"), "export default {};\n");
afterAll(() => rmSync(root, { recursive: true, force: true }));

const XMLNS = 'xmlns="http://www.w3.org/2000/svg"';

test("an over-limit SVG is written as a document: the root <svg> declares its namespace", async () => {
  // Plot output: HTML-serialised, no xmlns, over INLINE_LIMIT.
  const markup = `<svg class="plot" width="940" height="480">${'<circle r="1"></circle>'.repeat(4000)}</svg>`;
  const row = { id: "sdvplot/plot/big", markup };
  writeFileSync(
    join(root, "big.test.ts"),
    `import { mkdirSync, writeFileSync } from "node:fs";\nimport { test } from "vitest";\ntest("writes an over-limit row", () => {\n  const out = process.env.SDV_EXAMPLES_OUT as string;\n  mkdirSync(out, { recursive: true });\n  writeFileSync(out + "/big.json", ${JSON.stringify(JSON.stringify(row))});\n});\n`,
  );
  const stat = join(root, "static");
  await prerender({ root, files: ["big.test.ts"], out: join(root, "out"), static: stat });
  const written = readFileSync(join(stat, "examples/sdvplot/plot/big.svg"), "utf8");
  expect(written.startsWith(`<svg ${XMLNS} class="plot" width="940"`)).toBe(true);
  expect(written.match(/xmlns=/g)).toHaveLength(1);
});

test("svgDocument leaves a declared namespace alone and adds xlink only when used", () => {
  expect(svgDocument(`<svg ${XMLNS}><g/></svg>`)).toBe(`<svg ${XMLNS}><g/></svg>`);
  expect(svgDocument('<svg><use xlink:href="#a"/></svg>')).toBe(
    `<svg ${XMLNS} xmlns:xlink="http://www.w3.org/1999/xlink"><use xlink:href="#a"/></svg>`,
  );
  expect(svgDocument("<p>not svg</p>")).toBe("<p>not svg</p>");
});

// The failing inner run leaves process.exitCode = 1 in this worker, which the gate also reads (the next test).
test("the prerender throws when an example fails: the docs are never built from a failing gate", async () => {
  writeFileSync(
    join(root, "fail.test.ts"),
    'import { expect, test } from "vitest";\ntest("a deliberately failing example", () => {\n  expect(1).toBe(2);\n});\n',
  );
  await expect(
    prerender({ root, files: ["fail.test.ts"], out: join(root, "out"), static: join(root, "static") }),
  ).rejects.toThrow("1 example(s) failed");
});

test("a process.exitCode left by an earlier failing run does not fail a passing gate", async () => {
  expect(process.exitCode).toBe(1); // the test above
  await prerender({ root, files: ["big.test.ts"], out: join(root, "out"), static: join(root, "static") });
  expect(process.exitCode).toBeFalsy();
});
