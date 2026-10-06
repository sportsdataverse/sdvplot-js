import { readFileSync } from "node:fs";
import { expect, test } from "vitest";
import { VERSION, versions } from "../src/index.js";
const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
test("VERSION is package.json's version", () => {
  expect(VERSION).toBe(pkg.version);
  expect(versions().sdvplot).toBe(pkg.version);
});
