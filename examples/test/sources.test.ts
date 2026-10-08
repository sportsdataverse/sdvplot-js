import { existsSync, readFileSync } from "node:fs";
import { expect, test } from "vitest";
import { SOURCES, abs } from "../sources.js";

const PACKAGES = ["sdvplot", "sporty", "sdvtables"] as const;

test("every package export but ./package.json has a SOURCES row, and every row's file exists", () => {
  for (const p of PACKAGES) {
    const exp: Record<string, unknown> = JSON.parse(
      readFileSync(abs(`packages/${p}/package.json`), "utf8"),
    ).exports;
    for (const key of Object.keys(exp)) {
      if (key === "./package.json") continue;
      const spec = key === "." ? `@sportsdataverse/${p}` : `@sportsdataverse/${p}/${key.slice(2)}`;
      expect(Object.hasOwn(SOURCES, spec), `${spec} has no SOURCES row`).toBe(true);
    }
  }
  for (const [spec, file] of Object.entries(SOURCES))
    expect(existsSync(abs(file)), `${spec} -> ${file}`).toBe(true);
});

test("tsconfig.json paths mirror SOURCES exactly", () => {
  const paths: unknown = JSON.parse(readFileSync(abs("examples/tsconfig.json"), "utf8")).compilerOptions
    .paths;
  expect(paths).toEqual(
    Object.fromEntries(Object.entries(SOURCES).map(([spec, file]) => [spec, [`../${file}`]])),
  );
});
