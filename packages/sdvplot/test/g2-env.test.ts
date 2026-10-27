// @vitest-environment node
import { readFileSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test, vi } from "vitest";
import "./_fixtures.js";

// G2 is not installed: any import of it fails, as Node's resolver would.
vi.mock("@antv/g2", () => {
  throw Object.assign(new Error("Cannot find package '@antv/g2' imported from sdvplot"), {
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

test("SSR and no G2: ./g2 imports in Node with no window or document, and builds every piece (Review Focus 1, 3)", async () => {
  expect(typeof window).toBe("undefined");
  expect(typeof document).toBe("undefined");
  const g2 = await import("../src/g2.js");
  // what a server component or a SvelteKit load would do: build the spec pieces, then hand them to the client
  expect(g2.teamColorScale("nfl", ["KC", "LV"], { background: "#141414" }).range).toHaveLength(2);
  expect(g2.teamColorPalette("nfl", ["KC"])[0]).toMatch(/^#[0-9a-f]{6}$/);
  const rows = [{ x: 1, y: 2, team: "KC" }];
  const mark = g2.logoMark(rows, { x: "x", y: "y", team: "team", league: "nfl" });
  expect(g2.drawnMarks(mark)).toHaveLength(1);
  expect(g2.wordmarkMark(rows, { x: "x", y: "y", team: "team", league: "nfl" }).data).toHaveLength(1);
  expect(
    g2.headshotMark([{ x: 1, y: 2, p: "3139477" }], { x: "x", y: "y", player: "p", league: "nfl" }).data,
  ).toHaveLength(1);
  // the label HTML is a string: building it needs no DOM
  expect(g2.axisLogos({ league: "nfl" }).labelRender({ label: "KC" })).toMatch(/^<img /);
});

test("bundle hygiene: the main entry never reaches G2 or ./g2 (Review Focus 5)", () => {
  const main = staticGraph(resolve(SRC, "index.ts"));
  expect([...main.bare].filter((b) => b.startsWith("@antv/"))).toEqual([]);
  expect([...main.files].filter((f) => /g2/.test(relative(SRC, f)))).toEqual([]);
});

test("./g2 is pure: no import of @antv/*, static or dynamic (Review Focus 1)", () => {
  const { bare, files } = staticGraph(resolve(SRC, "g2.ts"));
  expect([...bare].filter((b) => b.startsWith("@antv/") || b.startsWith("@ant-design/"))).toEqual([]);
  for (const f of files) expect(readFileSync(f, "utf8")).not.toMatch(/import\(\s*["']@ant(v|-design)\//);
});

test("the subpath is exported, with @antv/g2 an optional peer whose floor is the tested version", () => {
  const pkg = JSON.parse(readFileSync(resolve(SRC, "../package.json"), "utf8"));
  const examples = JSON.parse(readFileSync(resolve(SRC, "../../../examples/package.json"), "utf8"));
  expect(pkg.exports["./g2"]).toEqual({ types: "./dist/g2.d.ts", import: "./dist/g2.js" });
  expect(pkg.peerDependencies["@antv/g2"]).toBe(">=5.4.8");
  expect(pkg.peerDependenciesMeta["@antv/g2"]).toEqual({ optional: true });
  // every test and the docs render run on exactly the floor; sdvplot's types never name Ant Design Charts, so it is
  // the examples' alone
  expect(pkg.devDependencies["@antv/g2"]).toBe("5.4.8");
  expect(examples.devDependencies["@antv/g2"]).toBe("5.4.8");
  expect(examples.devDependencies["@ant-design/plots"]).toBe("2.6.8");
  expect(pkg.peerDependencies["@ant-design/plots"]).toBeUndefined();
});
