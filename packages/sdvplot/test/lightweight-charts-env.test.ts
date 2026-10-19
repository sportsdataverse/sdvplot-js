// @vitest-environment node
import { readFileSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test, vi } from "vitest";
import "./_fixtures.js";

// lightweight-charts is not installed: any import of it fails, as Node's resolver would.
vi.mock("lightweight-charts", () => {
  throw Object.assign(new Error("Cannot find package 'lightweight-charts' imported from sdvplot"), {
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

test("SSR and no lightweight-charts: ./lightweight-charts imports in Node with no window, document or Image, and builds everything (Review Focus 1, 3)", async () => {
  expect(typeof window).toBe("undefined");
  expect(typeof document).toBe("undefined");
  expect(typeof Image).toBe("undefined");
  const lwc = await import("../src/lightweight-charts.js");
  // what a server component or a SvelteKit load would do: build the options, then hand them to the client
  expect(lwc.withAttribution({ width: 640 }).layout.attributionLogo).toBe(true);
  expect(lwc.teamSeriesOptions("KC", { league: "nfl", units: "probability" }).color).toMatch(
    /^#[0-9a-f]{6}$/,
  );
  const prim = lwc.logoMarkers([{ t: 60, y: 0.5, team: "KC" }], {
    x: "t",
    y: "y",
    team: "team",
    league: "nfl",
  });
  expect(typeof prim.paneViews).toBe("function");
  // attached on a server (no Image): it loads nothing and does not throw
  // on a server there is no page: attributionNotice does nothing and hands the container back
  const container = {} as HTMLElement;
  expect(lwc.attributionNotice(container)).toBe(container);
  prim.attached({
    chart: { timeScale: () => ({ timeToCoordinate: () => null }) },
    series: { priceToCoordinate: () => null },
    requestUpdate: () => {},
  });
});

test("bundle hygiene: the main entry never reaches lightweight-charts (Review Focus 5)", () => {
  const main = staticGraph(resolve(SRC, "index.ts"));
  expect([...main.bare].filter((b) => b.startsWith("lightweight-charts"))).toEqual([]);
  expect([...main.files].filter((f) => /lightweight/.test(relative(SRC, f)))).toEqual([]);
});

test("./lightweight-charts is pure: no import of lightweight-charts, static or dynamic (Review Focus 1)", () => {
  const { bare, files } = staticGraph(resolve(SRC, "lightweight-charts.ts"));
  expect([...bare].filter((b) => b.startsWith("lightweight-charts") || b.startsWith("fancy-canvas"))).toEqual(
    [],
  );
  for (const f of files)
    expect(readFileSync(f, "utf8")).not.toMatch(/import\(\s*["']lightweight-charts["']\s*\)/);
});

test("the subpath is exported, with lightweight-charts an optional peer whose floor is the tested version", () => {
  const pkg = JSON.parse(readFileSync(resolve(SRC, "../package.json"), "utf8"));
  const examples = JSON.parse(readFileSync(resolve(SRC, "../../../examples/package.json"), "utf8"));
  expect(pkg.exports["./lightweight-charts"]).toEqual({
    types: "./dist/lightweight-charts.d.ts",
    import: "./dist/lightweight-charts.js",
  });
  expect(pkg.peerDependencies["lightweight-charts"]).toBe(">=5.2.1");
  expect(pkg.peerDependenciesMeta["lightweight-charts"]).toEqual({ optional: true });
  // every test and the docs render run on exactly the floor
  expect(pkg.devDependencies["lightweight-charts"]).toBe("5.2.1");
  expect(examples.devDependencies["lightweight-charts"]).toBe("5.2.1");
});
