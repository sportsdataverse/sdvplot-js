// @vitest-environment node
import { readFileSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test, vi } from "vitest";
import "./_fixtures.js";

// MapLibre and deck.gl's MapLibre overlay are not installed: any import of them fails, as Node's resolver would.
vi.mock("maplibre-gl", () => {
  throw Object.assign(new Error("Cannot find package 'maplibre-gl' imported from sdvplot"), {
    code: "ERR_MODULE_NOT_FOUND",
  });
});
vi.mock("@deck.gl/mapbox", () => {
  throw Object.assign(new Error("Cannot find package '@deck.gl/mapbox' imported from sdvplot"), {
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

test("SSR and no MapLibre: ./maplibre imports in Node with no window or document, and builds every piece", async () => {
  expect(typeof window).toBe("undefined");
  expect(typeof document).toBe("undefined");
  const ml = await import("../src/maplibre.js");
  // what a server would do: build the style JSON, then hand it to the page
  const logos = ml.logoSymbols([{ lon: -94.48, lat: 39.05, team: 12 }], {
    x: "lon",
    y: "lat",
    team: "team",
    league: "nfl",
  });
  expect(ml.drawnMarks(logos)).toHaveLength(1);
  const legs = [{ team: "KC", a: -94.48, b: 39.05, c: -78.79, d: 42.77 }];
  const routes = ml.routeLines(legs, { x: "a", y: "b", xend: "c", yend: "d", team: "team", league: "nfl" });
  expect(routes.source.data.features[0]?.properties.color).toMatch(/^#[0-9a-f]{6}$/);
  expect(ml.basemap("dark").style).toMatch(/^https:\/\/tiles\.openfreemap\.org\//);
});

test("bundle hygiene: the main entry never reaches MapLibre or ./maplibre", () => {
  const main = staticGraph(resolve(SRC, "index.ts"));
  expect([...main.bare].filter((b) => b === "maplibre-gl" || b.startsWith("@deck.gl/"))).toEqual([]);
  expect([...main.files].filter((f) => /maplibre/.test(relative(SRC, f)))).toEqual([]);
});

test("./maplibre is pure: maplibre-gl only as `import type`, no deck.gl, sporty or React, static or dynamic", () => {
  const { bare, files } = staticGraph(resolve(SRC, "maplibre.ts"));
  expect(
    [...bare].filter(
      (b) =>
        b === "maplibre-gl" ||
        b.startsWith("@deck.gl/") ||
        b === "react" ||
        b.startsWith("@sportsdataverse/sporty"),
    ),
  ).toEqual([]);
  for (const f of files) {
    const text = readFileSync(f, "utf8");
    expect(text).not.toMatch(/import\(\s*["'](maplibre-gl|@deck\.gl\/)/);
    // a side-effect import has no `from`, so the graph above does not see it
    expect(text).not.toMatch(/^\s*import\s+["'](maplibre-gl|@deck\.gl\/)/m);
  }
  // its one import of MapLibre is types
  expect(readFileSync(resolve(SRC, "maplibre.ts"), "utf8")).toMatch(
    /^import type \{[^}]*\} from "maplibre-gl";$/m,
  );
});

test("the subpath is exported, with maplibre-gl and @deck.gl/mapbox optional peers whose floors are the tested versions", () => {
  const pkg = JSON.parse(readFileSync(resolve(SRC, "../package.json"), "utf8"));
  const examples = JSON.parse(readFileSync(resolve(SRC, "../../../examples/package.json"), "utf8"));
  expect(pkg.exports["./maplibre"]).toEqual({ types: "./dist/maplibre.d.ts", import: "./dist/maplibre.js" });
  for (const [name, floor] of [
    ["maplibre-gl", "6.14.0"],
    ["@deck.gl/mapbox", "9.4.0"],
  ] as const) {
    expect(pkg.peerDependencies[name]).toBe(`>=${floor}`);
    expect(pkg.peerDependenciesMeta[name]).toEqual({ optional: true });
    // every test and the docs render run on exactly the floor
    expect(pkg.devDependencies[name]).toBe(floor);
    expect(examples.devDependencies[name]).toBe(floor);
    const installed = JSON.parse(readFileSync(resolve(SRC, `../node_modules/${name}/package.json`), "utf8"));
    expect(installed.version).toBe(floor);
  }
  // BSD-3-Clause, a permissive licence
  const ml = JSON.parse(readFileSync(resolve(SRC, "../node_modules/maplibre-gl/package.json"), "utf8"));
  expect(ml.license).toBe("BSD-3-Clause");
});
