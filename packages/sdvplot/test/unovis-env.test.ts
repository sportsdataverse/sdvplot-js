// @vitest-environment node
import { readFileSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test, vi } from "vitest";
import "./_fixtures.js";

// Unovis is not installed: any import of it fails, as Node's resolver would.
vi.mock("@unovis/ts", () => {
  throw Object.assign(new Error("Cannot find package '@unovis/ts' imported from sdvplot"), {
    code: "ERR_MODULE_NOT_FOUND",
  });
});
vi.mock("@unovis/react", () => {
  throw Object.assign(new Error("Cannot find package '@unovis/react' imported from sdvplot"), {
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

test("SSR and no Unovis: ./unovis imports in Node with no window or document, and builds every piece", async () => {
  expect(typeof window).toBe("undefined");
  expect(typeof document).toBe("undefined");
  const u = await import("../src/unovis.js");
  // what a server component or a SvelteKit load would do: build the accessors and defs, then hand them to the chart
  const color = u.teamColorScale("nfl", [12, "PHI"], { background: "#111827" });
  expect(color.range).toHaveLength(2);
  expect(color("KC")).toBe(color(12));
  expect(u.teamColorPalette("nfl", ["KC"])[0]).toMatch(/^#[0-9a-f]{6}$/);
  const logos = u.logoIcons("nfl", ["KC", 21]);
  expect(logos.range).toHaveLength(2);
  // the defs are markup: writing them needs no DOM
  expect(logos.svgDefs).toMatch(/^<symbol id="sdv-logo-[0-9a-z]+" viewBox="0 0 [0-9.]+ 100"/);
  expect(u.headshotIcons("nfl", [3139477]).svgDefs).toMatch(/<image href="https:\/\/a\.espncdn\.com\//);
});

test("bundle hygiene: the main entry never reaches Unovis or ./unovis", () => {
  const main = staticGraph(resolve(SRC, "index.ts"));
  expect([...main.bare].filter((b) => b.startsWith("@unovis/"))).toEqual([]);
  expect([...main.files].filter((f) => /unovis/.test(relative(SRC, f)))).toEqual([]);
});

test("./unovis is pure: no import of @unovis/*, static, dynamic or for side effects", () => {
  const { bare, files } = staticGraph(resolve(SRC, "unovis.ts"));
  expect([...bare].filter((b) => b.startsWith("@unovis/"))).toEqual([]);
  for (const f of files) expect(readFileSync(f, "utf8")).not.toMatch(/import\s*\(?\s*["']@unovis\//);
});

test("the subpath is exported, with @unovis/ts an optional peer whose floor is the tested version", () => {
  const pkg = JSON.parse(readFileSync(resolve(SRC, "../package.json"), "utf8"));
  const examples = JSON.parse(readFileSync(resolve(SRC, "../../../examples/package.json"), "utf8"));
  expect(pkg.exports["./unovis"]).toEqual({ types: "./dist/unovis.d.ts", import: "./dist/unovis.js" });
  expect(pkg.peerDependencies["@unovis/ts"]).toBe(">=1.7.1");
  expect(pkg.peerDependenciesMeta["@unovis/ts"]).toEqual({ optional: true });
  // every test and the docs render run on exactly the floor
  expect(pkg.devDependencies["@unovis/ts"]).toBe("1.7.1");
  expect(examples.devDependencies["@unovis/ts"]).toBe("1.7.1");
  expect(examples.devDependencies["@unovis/react"]).toBe("1.7.1");
  const installed = JSON.parse(readFileSync(resolve(SRC, "../node_modules/@unovis/ts/package.json"), "utf8"));
  expect([installed.version, installed.license]).toEqual(["1.7.1", "Apache-2.0"]);
});
