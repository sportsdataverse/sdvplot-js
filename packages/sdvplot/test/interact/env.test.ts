// @vitest-environment node
import { readFileSync } from "node:fs";
import { expect, test } from "vitest";
import { hasDom, highlight } from "../../src/interact/index.js";

test("the ./interact subpath is exported", () => {
  const pkg = JSON.parse(readFileSync(new URL("../../package.json", import.meta.url), "utf8"));
  expect(pkg.exports["./interact"]).toEqual({ types: "./dist/interact.d.ts", import: "./dist/interact.js" });
});
test("without a DOM, highlight is a no-op: it returns [] and touches nothing (a server render never changes)", () => {
  expect(typeof document).toBe("undefined");
  expect(hasDom()).toBe(false);
  // any read of the root throws, so a guard placed after the first property access fails here too
  const root = new Proxy({} as Element, {
    get(_, key) {
      throw new Error(`highlight read root.${String(key)} without a DOM`);
    },
  });
  expect(highlight(root, new Set(["KC"]))).toEqual([]);
  expect(highlight(root, null)).toEqual([]);
});
