// @vitest-environment node
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test, vi } from "vitest";

// Review Focus 1: cytoscape is not installed for this test. The adapter never imports it, so the mock never runs.
vi.mock("cytoscape", () => {
  throw new Error("cytoscape is not installed");
});

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = resolve(HERE, "../src");
const read = (p: string): string => readFileSync(resolve(HERE, p), "utf8");

/** Every module `entry` reaches through static imports (`import type` left out), and the bare specifiers it names. */
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
      const found = [".ts", ".tsx", "/index.ts"]
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

test("SSR and no cytoscape (Review Focus 1, 3): ./cytoscape imports in Node with no window or document, and builds", async () => {
  expect(typeof window).toBe("undefined");
  expect(typeof document).toBe("undefined");
  const { loadLeague } = await import("../src/index.js");
  const { passNetwork, teamStylesheet } = await import("../src/cytoscape.js");
  await loadLeague("nfl");
  // Patrick Mahomes to Xavier Worthy, a Super Bowl LIX touchdown (ESPN ids)
  const net = passNetwork([{ from: 3139477, to: 4683062, team: "KC" }], {
    from: "from",
    to: "to",
    team: "team",
    league: "nfl",
  });
  expect(net.elements.nodes).toHaveLength(2);
  expect(net.elements.edges).toHaveLength(1);
  expect(JSON.parse(JSON.stringify(net))).toEqual(net); // plain data: elements and style JSON
  expect(teamStylesheet({ league: "nfl", teams: ["KC"] }).length).toBeGreaterThan(0);
});

test("./cytoscape names no cytoscape module, not even dynamically (Review Focus 1)", () => {
  const { bare } = staticGraph(resolve(SRC, "cytoscape.ts"));
  expect([...bare].filter((s) => s.startsWith("cytoscape"))).toEqual([]);
  expect(read("../src/cytoscape.ts")).not.toMatch(/import\(\s*["']cytoscape/);
});

test("the main entry never reaches the cytoscape adapter (Review Focus 5)", () => {
  const { files, bare } = staticGraph(resolve(SRC, "index.ts"));
  expect([...files].some((f) => f.endsWith("cytoscape.ts"))).toBe(false);
  expect([...bare].filter((s) => s.startsWith("cytoscape"))).toEqual([]);
});

test("the subpath export, the optional peer, and a floor that is the tested version", () => {
  const pkg = JSON.parse(read("../package.json"));
  const examples = JSON.parse(read("../../../examples/package.json"));
  expect(pkg.exports["./cytoscape"]).toEqual({
    types: "./dist/cytoscape.d.ts",
    import: "./dist/cytoscape.js",
  });
  expect(pkg.peerDependenciesMeta.cytoscape).toEqual({ optional: true });
  // the floor is 3.34.3 (2026-09-07, the newest release at least two weeks old on 2026-10-18), and it is what the
  // tests and the examples run against
  expect(pkg.peerDependencies.cytoscape).toBe(">=3.34.3");
  expect(pkg.devDependencies.cytoscape).toBe("3.34.3");
  expect(examples.devDependencies.cytoscape).toBe("3.34.3");
});
