// @vitest-environment node
import { readFileSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test, vi } from "vitest";
import "./_fixtures.js";

// TanStack Charts is not installed: any import of it fails, as Node's resolver would.
vi.mock("@tanstack/charts", () => {
  throw Object.assign(new Error("Cannot find package '@tanstack/charts' imported from sdvplot"), {
    code: "ERR_MODULE_NOT_FOUND",
  });
});
vi.mock("@tanstack/charts/svg", () => {
  throw Object.assign(new Error("Cannot find package '@tanstack/charts/svg' imported from sdvplot"), {
    code: "ERR_MODULE_NOT_FOUND",
  });
});
vi.mock("@tanstack/charts/dom", () => {
  throw Object.assign(new Error("Cannot find package '@tanstack/charts/dom' imported from sdvplot"), {
    code: "ERR_MODULE_NOT_FOUND",
  });
});
vi.mock("@tanstack/charts/react", () => {
  throw Object.assign(new Error("Cannot find package '@tanstack/charts/react' imported from sdvplot"), {
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

test("SSR and no TanStack Charts: ./tanstack imports in Node with no window or document, and builds every piece (Review Focus 1, 3)", async () => {
  expect(typeof window).toBe("undefined");
  expect(typeof document).toBe("undefined");
  const ts = await import("../src/tanstack.js");
  // what a server component or a SvelteKit load would do: build the pieces, then hand them to the chart
  expect(ts.teamColorScale("nfl", ["KC", "LV"], { background: "#111827" }).range).toHaveLength(2);
  expect(ts.teamColorPalette("nfl", ["KC"])[0]).toMatch(/^#[0-9a-f]{6}$/);
  const rows = [{ x: 1, y: 2, team: "KC" }];
  const logos = ts.logoDots(rows, { x: "x", y: "y", team: "team", league: "nfl" });
  expect(ts.drawnMarks(logos)).toHaveLength(1);
  expect(ts.wordmarkDots(rows, { x: "x", y: "y", team: "team", league: "nfl" })).toHaveLength(1);
  expect(
    ts.headshotDots([{ x: 1, y: 2, p: "3139477" }], { x: "x", y: "y", player: "p", league: "nfl" }),
  ).toHaveLength(1);
  // the patterns are markup: writing them needs no DOM
  const svg = ts.withPatterns(() => '<svg class="ts-chart"></svg>', logos)({}, { idPrefix: "s" });
  expect(svg).toMatch(/<pattern [^>]*id="s-sdv-logo-/);
});

test("bundle hygiene: the main entry never reaches TanStack Charts or ./tanstack (Review Focus 5)", () => {
  const main = staticGraph(resolve(SRC, "index.ts"));
  expect([...main.bare].filter((b) => b.startsWith("@tanstack/"))).toEqual([]);
  expect([...main.files].filter((f) => /tanstack/.test(relative(SRC, f)))).toEqual([]);
});

test("./tanstack is pure: no import of @tanstack/*, static or dynamic (Review Focus 1)", () => {
  const { bare, files } = staticGraph(resolve(SRC, "tanstack.ts"));
  expect([...bare].filter((b) => b.startsWith("@tanstack/"))).toEqual([]);
  for (const f of files) expect(readFileSync(f, "utf8")).not.toMatch(/import\(\s*["']@tanstack\//);
});

test("the subpath is exported, with @tanstack/charts an optional peer whose floor is the tested version", () => {
  const pkg = JSON.parse(readFileSync(resolve(SRC, "../package.json"), "utf8"));
  const examples = JSON.parse(readFileSync(resolve(SRC, "../../../examples/package.json"), "utf8"));
  expect(pkg.exports["./tanstack"]).toEqual({ types: "./dist/tanstack.d.ts", import: "./dist/tanstack.js" });
  expect(pkg.peerDependencies["@tanstack/charts"]).toBe(">=1.1.0");
  expect(pkg.peerDependenciesMeta["@tanstack/charts"]).toEqual({ optional: true });
  // every test and the docs render run on exactly the floor
  expect(pkg.devDependencies["@tanstack/charts"]).toBe("1.1.0");
  expect(examples.devDependencies["@tanstack/charts"]).toBe("1.1.0");
  const installed = JSON.parse(
    readFileSync(resolve(SRC, "../node_modules/@tanstack/charts/package.json"), "utf8"),
  );
  expect(installed.version).toBe("1.1.0");
});
