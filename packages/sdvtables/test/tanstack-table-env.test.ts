// @vitest-environment node
import { readFileSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { preloadAll, setWarningHandler } from "@sportsdataverse/sdvplot";
import { beforeAll, expect, test, vi } from "vitest";
import { STANDINGS } from "./fixtures/standings.js";

// TanStack Table is not installed: any import of it fails, as Node's resolver would.
for (const pkg of ["@tanstack/table-core", "@tanstack/react-table", "@tanstack/svelte-table"])
  vi.doMock(pkg, () => {
    throw Object.assign(new Error(`Cannot find package '${pkg}' imported from sdvtables`), {
      code: "ERR_MODULE_NOT_FOUND",
    });
  });

const SRC = resolve(dirname(fileURLToPath(import.meta.url)), "../src");
const TANSTACK = /^@tanstack\//;

beforeAll(async () => {
  setWarningHandler(() => {});
  await preloadAll();
});

/** Every module `entry` reaches through static imports (`import type` and dynamic `import()` left out). */
function staticGraph(entry: string): { files: Set<string>; bare: Set<string> } {
  const files = new Set<string>();
  const bare = new Set<string>();
  const visit = (file: string): void => {
    if (files.has(file)) return;
    files.add(file);
    for (const m of readFileSync(file, "utf8").matchAll(
      /^\s*(?:import|export)\s+(?!type\b)[^;]*?\sfrom\s+["']([^"']+)["']/gms,
    )) {
      const spec = m[1] as string;
      if (!spec.startsWith(".")) {
        bare.add(spec);
        continue;
      }
      const ts = resolve(dirname(file), spec).replace(/\.js$/, "");
      const found = [".ts", ".tsx", "/index.ts", "/index.tsx"]
        .map((x) => ts + x)
        .find((f) => {
          try {
            readFileSync(f);
            return true;
          } catch {
            return false;
          }
        });
      if (found !== undefined) visit(found);
    }
  };
  visit(entry);
  return { files, bare };
}

test("no TanStack Table and no DOM: ./tanstack-table imports in Node, builds the options, and its cells render as data", async () => {
  expect(typeof window).toBe("undefined");
  expect(typeof document).toBe("undefined");
  await expect(import("@tanstack/table-core")).rejects.toThrow(); // the mock holds: the package is absent
  const { tanstackTable } = await import("../src/tanstack-table.js");
  const { defineTable } = await import("../src/define.js");
  const { prepare } = await import("../src/html/index.js");
  const spec = defineTable<(typeof STANDINGS)[number]>()
    .columns((c) => [
      c.logo("team", { league: "nfl" }),
      c.headshot("qb_espn_id", { league: "nfl" }),
      c.int("wins"),
    ])
    .theme("midnight")
    .rowKey("team")
    .build();
  await prepare(spec); // the team names the logos' alt text reads
  const features = {}; // what tableFeatures({}) returns: the object itself
  const parts: unknown[] = [];
  const { options } = tanstackTable(spec, STANDINGS, {
    features,
    render: (p) => {
      parts.push(p);
      return p.type;
    },
  });
  expect(options.features).toBe(features);
  expect(options.data).toBe(STANDINGS);
  expect(options.getRowId?.(STANDINGS[1] as (typeof STANDINGS)[number])).toBe("LAC");
  // a cell as TanStack calls it, with only the value its context gives
  const ctx = (v: unknown) => ({ getValue: () => v }) as never;
  const cell = (i: number) => options.columns[i]?.cell as (c: never) => unknown;
  expect([cell(0)(ctx("KC")), cell(1)(ctx("3139477")), cell(2)(ctx(15))]).toEqual(["image", "image", "15"]);
  expect(parts).toEqual([
    expect.objectContaining({ type: "image", kind: "logo", id: "12", alt: "Kansas City Chiefs" }),
    expect.objectContaining({ type: "image", kind: "headshot", id: "3139477", alt: "" }),
  ]);
});

test("bundle hygiene: neither the main entry nor ./html nor ./react reaches TanStack Table or the tanstack-table module", () => {
  for (const entry of ["index.ts", "html/index.ts", "react/index.tsx"]) {
    const g = staticGraph(resolve(SRC, entry));
    expect(
      [...g.bare].filter((b) => TANSTACK.test(b)),
      entry,
    ).toEqual([]);
    expect(
      [...g.files].filter((f) => /^tanstack-table/.test(relative(SRC, f))),
      entry,
    ).toEqual([]);
  }
});

test("./tanstack-table is pure: table-core types only, never imported at runtime; no React, no Svelte", () => {
  const { bare, files } = staticGraph(resolve(SRC, "tanstack-table.ts"));
  expect([...bare].filter((b) => TANSTACK.test(b) || b === "react" || b === "svelte")).toEqual([]);
  const text = readFileSync(resolve(SRC, "tanstack-table.ts"), "utf8");
  expect(text).toMatch(/^import type \{[^}]*\} from "@tanstack\/table-core";$/m);
  for (const f of files)
    expect(readFileSync(f, "utf8"), relative(SRC, f)).not.toMatch(/import\(\s*["']@tanstack\//);
});

test("the ./tanstack-table subpath is exported, @tanstack/table-core an optional peer at the tested 9.3.1 (MIT)", () => {
  const pkg = JSON.parse(readFileSync(resolve(SRC, "../package.json"), "utf8"));
  expect(pkg.exports["./tanstack-table"]).toEqual({
    types: "./dist/tanstack-table.d.ts",
    import: "./dist/tanstack-table.js",
  });
  expect(pkg.peerDependencies["@tanstack/table-core"]).toBe(">=9.3.1");
  expect(pkg.peerDependenciesMeta["@tanstack/table-core"]).toEqual({ optional: true });
  // the React adapter is the tests' only: sdvtables never needs it
  expect(pkg.peerDependencies["@tanstack/react-table"]).toBeUndefined();
  for (const p of ["@tanstack/table-core", "@tanstack/react-table"]) {
    expect(pkg.devDependencies[p], "the floor is the version the tests run").toBe("9.3.1");
    const installed = JSON.parse(readFileSync(resolve(SRC, `../node_modules/${p}/package.json`), "utf8"));
    expect([installed.version, installed.license], p).toEqual(["9.3.1", "MIT"]);
  }
});
