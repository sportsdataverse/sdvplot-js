// @vitest-environment node
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { preloadAll, setWarningHandler } from "@sportsdataverse/sdvplot";
import { beforeAll, expect, test, vi } from "vitest";
import { STANDINGS } from "./fixtures/standings.js";

// AG Grid is not installed: any import of it fails, as Node's resolver would.
for (const pkg of ["ag-grid-community", "ag-grid-react", "ag-grid-enterprise"])
  vi.doMock(pkg, () => {
    throw Object.assign(new Error(`Cannot find package '${pkg}' imported from sdvtables`), {
      code: "ERR_MODULE_NOT_FOUND",
    });
  });

const SRC = resolve(dirname(fileURLToPath(import.meta.url)), "../src");
const AG = /^ag-grid/;

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
    const text = readFileSync(file, "utf8");
    for (const m of text.matchAll(/^\s*(?:import|export)\s+(?!type\b)[^;]*?\sfrom\s+["']([^"']+)["']/gms)) {
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

test("no AG Grid and no DOM: ./aggrid imports in Node and builds the options; its cell renderers are classes, run only by AG Grid", async () => {
  expect(typeof window).toBe("undefined");
  expect(typeof document).toBe("undefined");
  await expect(import("ag-grid-community")).rejects.toThrow(); // the mock holds: the package is absent
  const { gridOptions } = await import("../src/aggrid.js");
  const { defineTable } = await import("../src/define.js");
  const spec = defineTable<(typeof STANDINGS)[number]>()
    .columns((c) => [
      c.logo("team", { league: "nfl" }),
      c.headshot("qb_espn_id", { league: "nfl" }),
      c.int("wins"),
    ])
    .theme("midnight")
    .rowKey("team")
    .build();
  const o = gridOptions(spec, STANDINGS, { teamRows: { key: "team", league: "nfl" } });
  expect(o.rowData).toHaveLength(STANDINGS.length);
  expect(o.getRowId({ data: STANDINGS[1] } as never)).toBe("LAC");
  // ag-grid-react renders a plain function as a React component; a class with getGui is a JavaScript component in both
  for (const c of o.columnDefs.slice(0, 2)) expect(typeof c.cellRenderer.prototype.getGui).toBe("function");
  expect(o.getRowStyle({ data: STANDINGS[0] } as never)).toMatchObject({
    backgroundColor: expect.stringMatching(/^#[0-9a-f]{6}$/),
  });
  expect("theme" in o).toBe(false);
});

test("bundle hygiene: neither the main entry nor ./html nor ./react reaches AG Grid or the aggrid module", () => {
  for (const entry of ["index.ts", "html/index.ts", "react/index.tsx"]) {
    const g = staticGraph(resolve(SRC, entry));
    expect(
      [...g.bare].filter((b) => AG.test(b)),
      entry,
    ).toEqual([]);
    expect(
      [...g.files].filter((f) => /^aggrid/.test(relative(SRC, f))),
      entry,
    ).toEqual([]);
  }
});

test("./aggrid is pure and community only: AG Grid types only, never imported at runtime, nothing from ag-grid-enterprise", () => {
  const { bare, files } = staticGraph(resolve(SRC, "aggrid.ts"));
  expect([...bare].filter((b) => AG.test(b))).toEqual([]);
  // the palette is sdvplot's (its React-free tanstack subpath), so vanilla pages need no React
  expect([...bare]).toEqual(expect.arrayContaining(["@sportsdataverse/sdvplot/tanstack"]));
  expect([...bare]).not.toContain("react");
  const text = readFileSync(resolve(SRC, "aggrid.ts"), "utf8");
  expect(text).toMatch(/^import type \{[^}]*\} from "ag-grid-community";$/m);
  for (const f of files) {
    const t = readFileSync(f, "utf8");
    expect(t, relative(SRC, f)).not.toMatch(/import\(\s*["']ag-grid/);
    expect(t, relative(SRC, f)).not.toMatch(/["']ag-grid-enterprise["']|@ag-grid-enterprise\//);
  }
});

test("the ./aggrid subpath is exported, ag-grid-community an optional peer at the tested 36.2.0 (MIT); no enterprise package anywhere", () => {
  const root = resolve(SRC, "../../..");
  const pkg = JSON.parse(readFileSync(resolve(SRC, "../package.json"), "utf8"));
  expect(pkg.exports["./aggrid"]).toEqual({ types: "./dist/aggrid.d.ts", import: "./dist/aggrid.js" });
  expect(pkg.peerDependencies["ag-grid-community"]).toBe(">=36.2.0");
  expect(pkg.peerDependenciesMeta["ag-grid-community"]).toEqual({ optional: true });
  expect(pkg.devDependencies["ag-grid-community"], "the floor is the version the tests run").toBe("36.2.0");
  const installed = JSON.parse(
    readFileSync(resolve(SRC, "../node_modules/ag-grid-community/package.json"), "utf8"),
  );
  expect(installed.version).toBe("36.2.0");
  expect(installed.license).toBe("MIT");
  // every workspace manifest: no ag-grid-enterprise and no @ag-grid-enterprise/* module
  const manifests = [
    "package.json",
    "examples/package.json",
    "docs/package.json",
    ...readdirSync(join(root, "packages")).map((p) => `packages/${p}/package.json`),
  ];
  for (const m of manifests) {
    const j = JSON.parse(readFileSync(join(root, m), "utf8"));
    const deps = Object.keys({ ...j.dependencies, ...j.devDependencies, ...j.peerDependencies });
    expect(
      deps.filter((d) => /ag-grid-enterprise|^@ag-grid-enterprise\//.test(d)),
      m,
    ).toEqual([]);
  }
  // nor in the lockfile, so nothing pulls it in transitively
  expect(readFileSync(join(root, "pnpm-lock.yaml"), "utf8")).not.toMatch(/ag-grid-enterprise/);
});
