// @vitest-environment node
import { readFileSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { expect, test } from "vitest";

const SRC = resolve(dirname(fileURLToPath(import.meta.url)), "../src");

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

test("SSR: ./shadcn imports in Node with no window or document, and its icons server-render (Review Focus 3)", async () => {
  expect(typeof window).toBe("undefined");
  expect(typeof document).toBe("undefined");
  const { loadLeague } = await import("../src/index.js");
  const { teamChartConfig } = await import("../src/shadcn.js");
  await loadLeague("nfl");
  const { config } = teamChartConfig("nfl", ["KC", "LAC"]);
  const Icon = config.kc?.icon;
  if (Icon === undefined) throw new Error("no icon");
  expect(renderToString(createElement(Icon))).toMatch(/<img src="https:[^"]+" alt=""[^>]*data-sdv-id="/);
});

test("bundle hygiene: the main entry never reaches ./shadcn (Review Focus 5)", () => {
  const main = staticGraph(resolve(SRC, "index.ts"));
  expect([...main.files].filter((f) => /shadcn/.test(relative(SRC, f)))).toEqual([]);
});

test("./shadcn is pure: no import of recharts or of any shadcn package, static or dynamic (Review Focus 1)", () => {
  const { bare, files } = staticGraph(resolve(SRC, "shadcn.ts"));
  expect([...bare].filter((b) => b !== "react")).toEqual([]);
  for (const f of files) expect(readFileSync(f, "utf8")).not.toMatch(/import\(\s*["'](recharts|shadcn)/);
});

test("the ./shadcn subpath is exported, with no peer of its own (shadcn's chart.tsx is copied, not installed)", () => {
  const pkg = JSON.parse(readFileSync(resolve(SRC, "../package.json"), "utf8"));
  expect(pkg.exports["./shadcn"]).toEqual({ types: "./dist/shadcn.d.ts", import: "./dist/shadcn.js" });
  expect(Object.keys(pkg.peerDependencies).filter((p) => /shadcn/.test(p))).toEqual([]);
});
