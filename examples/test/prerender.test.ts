// @vitest-environment node
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterAll, expect, test } from "vitest";
import { prerender } from "../scripts/gate.js";
import { abs } from "../sources.js";

// Inside the package so the temp test file can resolve "vitest"; `temp/` is gitignored. Its own config, or vitest
// walks up to examples/vitest.config.ts (include: test/**, globalSetup, jsdom).
mkdirSync(abs("examples/temp"), { recursive: true });
const root = mkdtempSync(join(abs("examples/temp"), "prerender-"));
writeFileSync(join(root, "vitest.config.ts"), "export default {};\n");
afterAll(() => rmSync(root, { recursive: true, force: true }));

test("the prerender throws when an example fails: the docs are never built from a failing gate", async () => {
  writeFileSync(
    join(root, "fail.test.ts"),
    'import { expect, test } from "vitest";\ntest("a deliberately failing example", () => {\n  expect(1).toBe(2);\n});\n',
  );
  await expect(
    prerender({ root, files: ["fail.test.ts"], out: join(root, "out"), static: join(root, "static") }),
  ).rejects.toThrow("1 example(s) failed");
});
