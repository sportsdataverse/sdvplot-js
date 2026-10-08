// @vitest-environment node
import { readFileSync } from "node:fs";
import { expect, test } from "vitest";

test("the ./interact subpath is exported and its entry module loads", async () => {
  const pkg = JSON.parse(readFileSync(new URL("../../package.json", import.meta.url), "utf8"));
  expect(pkg.exports["./interact"]).toEqual({ types: "./dist/interact.d.ts", import: "./dist/interact.js" });
  await expect(import("../../src/interact/index.js")).resolves.toBeTypeOf("object");
});
