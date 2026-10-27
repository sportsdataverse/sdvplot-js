// @vitest-environment node
import { readFileSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { preloadAll, setWarningHandler } from "@sportsdataverse/sdvplot";
import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { beforeAll, expect, test, vi } from "vitest";
import { STANDINGS } from "./fixtures/standings.js";

// The package root of MUI X Data Grid is not installed: any import of it fails, as Node's resolver would.
vi.mock("@mui/x-data-grid", () => {
  throw Object.assign(new Error("Cannot find package '@mui/x-data-grid' imported from sdvtables"), {
    code: "ERR_MODULE_NOT_FOUND",
  });
});

const SRC = resolve(dirname(fileURLToPath(import.meta.url)), "../src");
const MUI = /^@mui\//;

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

test("no MUI and no DOM: ./mui imports in Node, builds the props, and its image cells render on the server (Review Focus 1, 3)", async () => {
  expect(typeof window).toBe("undefined");
  expect(typeof document).toBe("undefined");
  await expect(import("@mui/x-data-grid")).rejects.toThrow(); // the mock holds: the root package is absent
  const { dataGridProps } = await import("../src/mui.js");
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
  const p = dataGridProps(spec, STANDINGS, { teamRows: { key: "team", league: "nfl" } });
  const [logo, head] = p.columns;
  const row = STANDINGS[0] as (typeof STANDINGS)[number];
  const html = renderToString(
    createElement(
      "div",
      null,
      logo?.renderCell?.({ row, value: row.team }),
      head?.renderCell?.({ row, value: row.qb_espn_id }),
    ),
  );
  expect(html).toMatch(/<img [^>]*data-sdv-id="12"[^>]*data-sdv-kind="logo"/);
  expect(html).toMatch(/<img [^>]*data-sdv-id="3139477"[^>]*data-sdv-kind="headshot"/);
  expect(p.getRowClassName({ row, indexRelativeToCurrentPage: 0 })).toMatch(/^sdvt-fill-[0-9a-f]{6}$/);
});

test("bundle hygiene: neither the main entry nor ./html nor ./react reaches MUI or the mui module (Review Focus 5)", () => {
  for (const entry of ["index.ts", "html/index.ts", "react/index.tsx"]) {
    const g = staticGraph(resolve(SRC, entry));
    expect(
      [...g.bare].filter((b) => MUI.test(b) || b.endsWith("/mui")),
      entry,
    ).toEqual([]);
    expect(
      [...g.files].filter((f) => /^mui/.test(relative(SRC, f))),
      entry,
    ).toEqual([]);
  }
});

test("./mui is pure: no import of MUI, static or dynamic; it reuses sdvplot/mui's palette (Review Focus 1)", () => {
  const { bare, files } = staticGraph(resolve(SRC, "mui.ts"));
  expect([...bare].filter((b) => MUI.test(b))).toEqual([]);
  expect([...bare]).toEqual(expect.arrayContaining(["react", "@sportsdataverse/sdvplot/mui"]));
  for (const f of files) expect(readFileSync(f, "utf8")).not.toMatch(/import\(\s*["']@mui/);
});

test("the ./mui subpath is exported, with @mui/x-data-grid an optional peer at the tested 9.15.0, and no Pro, Premium or material peer", () => {
  const pkg = JSON.parse(readFileSync(resolve(SRC, "../package.json"), "utf8"));
  expect(pkg.exports["./mui"]).toEqual({ types: "./dist/mui.d.ts", import: "./dist/mui.js" });
  expect(pkg.peerDependencies["@mui/x-data-grid"]).toBe(">=9.15.0");
  expect(pkg.peerDependenciesMeta["@mui/x-data-grid"]).toEqual({ optional: true });
  expect(pkg.devDependencies["@mui/x-data-grid"], "the floor is the version the tests run").toBe("9.15.0");
  // MUI's own peers (material, system, emotion) are the app's: sdvtables' types never name them
  for (const p of ["@mui/material", "@mui/system", "@emotion/react", "@emotion/styled"])
    expect(pkg.peerDependencies[p], p).toBeUndefined();
  // the MIT community package only
  const all = { ...pkg.dependencies, ...pkg.devDependencies, ...pkg.peerDependencies };
  expect(Object.keys(all).filter((d) => /x-data-grid-(pro|premium)/.test(d))).toEqual([]);
  const installed = JSON.parse(
    readFileSync(resolve(SRC, "../node_modules/@mui/x-data-grid/package.json"), "utf8"),
  );
  expect(installed.version).toBe("9.15.0");
  expect(installed.license).toBe("MIT");
});
