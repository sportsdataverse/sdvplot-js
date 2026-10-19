// @vitest-environment node
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test, vi } from "vitest";

// Review Focus 1: deck.gl is not installed for this test. The adapter never imports it, so the mocks never run.
vi.mock("@deck.gl/core", () => {
  throw new Error("@deck.gl/core is not installed");
});
vi.mock("@deck.gl/layers", () => {
  throw new Error("@deck.gl/layers is not installed");
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

test("SSR and no deck.gl (Review Focus 1, 3): ./deckgl imports in Node with no window or document, and builds props", async () => {
  expect(typeof window).toBe("undefined");
  expect(typeof document).toBe("undefined");
  const { loadLeague } = await import("../src/index.js");
  const { logoIconLayer, surfaceLayer } = await import("../src/deckgl.js");
  await loadLeague("nhl");
  const p = logoIconLayer([{ team: "EDM", x: 82, y: -3 }], { x: "x", y: "y", team: "team", league: "nhl" });
  expect(p.data).toHaveLength(1);
  expect(surfaceLayer("hockey", "nhl").data.length).toBeGreaterThan(0);
});

test("./deckgl names no deck.gl module, not even dynamically (Review Focus 1)", () => {
  const { bare } = staticGraph(resolve(SRC, "deckgl.ts"));
  expect([...bare].filter((s) => s.startsWith("@deck.gl"))).toEqual([]);
  expect(read("../src/deckgl.ts")).not.toMatch(/import\(\s*["']@deck\.gl/);
});

test("the main entry never reaches the deck.gl adapter (Review Focus 5)", () => {
  const { files, bare } = staticGraph(resolve(SRC, "index.ts"));
  expect([...files].some((f) => f.endsWith("deckgl.ts"))).toBe(false);
  expect([...bare].filter((s) => s.startsWith("@deck.gl"))).toEqual([]);
});

test("the subpath export, the optional peers, and floors that are the tested versions", () => {
  const pkg = JSON.parse(read("../package.json"));
  const examples = JSON.parse(read("../../../examples/package.json"));
  expect(pkg.exports["./deckgl"]).toEqual({ types: "./dist/deckgl.d.ts", import: "./dist/deckgl.js" });
  for (const name of ["@deck.gl/core", "@deck.gl/layers"]) {
    expect(pkg.peerDependenciesMeta[name]).toEqual({ optional: true });
    // the floor is 9.4.0 (2026-09-05, the newest release at least two weeks old on 2026-10-18), and it is what the
    // tests and the examples run against
    expect(pkg.peerDependencies[name]).toBe(">=9.4.0");
    expect(pkg.devDependencies[name]).toBe("9.4.0");
    expect(examples.devDependencies[name]).toBe("9.4.0");
  }
});
