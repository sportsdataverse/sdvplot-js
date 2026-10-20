// @vitest-environment node
import { readFileSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test, vi } from "vitest";
import { ROWS } from "./_fixtures.js";

// uplot is not installed: any import of it fails, as Node's resolver would.
vi.mock("uplot", () => {
  throw Object.assign(new Error("Cannot find package 'uplot' imported from sdvplot"), {
    code: "ERR_MODULE_NOT_FOUND",
  });
});

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

test("SSR and no uplot: ./uplot imports in Node with no window, document or Image, and builds its options (Review Focus 1, 3)", async () => {
  expect(typeof window).toBe("undefined");
  expect(typeof document).toBe("undefined");
  expect(typeof Image).toBe("undefined");
  const up = await import("../src/uplot.js");
  // what a server component or a SvelteKit load would do: build the options, then hand them to the client
  const plugin = up.logoPlugin(ROWS, { x: "x", y: "y", team: "team", league: "nfl" });
  expect(typeof plugin.hooks.draw).toBe("function");
  const opts = up.withTeamSeries({ series: [{}, {}] }, [{ team: "KC" }], { team: "team", league: "nfl" });
  expect(opts.series[1]).toHaveProperty("stroke");
});

test("bundle hygiene: the main entry never reaches uplot (Review Focus 5)", () => {
  const main = staticGraph(resolve(SRC, "index.ts"));
  expect([...main.bare].filter((b) => b.startsWith("uplot"))).toEqual([]);
  expect([...main.files].filter((f) => /uplot/.test(relative(SRC, f)))).toEqual([]);
});

test("./uplot is pure: no import of uplot, static or dynamic (Review Focus 1)", () => {
  const { bare, files } = staticGraph(resolve(SRC, "uplot.ts"));
  expect([...bare].filter((b) => b.startsWith("uplot") || b.startsWith("@sportsdataverse/sporty"))).toEqual(
    [],
  );
  for (const f of files) expect(readFileSync(f, "utf8")).not.toMatch(/import\(\s*["']uplot["']\s*\)/);
});

test("the ./uplot subpath is exported, with uplot an optional peer at 1.6.31 or later", () => {
  const pkg = JSON.parse(readFileSync(resolve(SRC, "../package.json"), "utf8"));
  expect(pkg.exports["./uplot"]).toEqual({ types: "./dist/uplot.d.ts", import: "./dist/uplot.js" });
  expect(pkg.peerDependencies.uplot).toBe(">=1.6.31");
  expect(pkg.peerDependenciesMeta.uplot).toEqual({ optional: true });
});
