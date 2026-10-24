// @vitest-environment node
import { readFileSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { renderToString } from "react-dom/server";
import { expect, test, vi } from "vitest";

// Review Focus 1: three and @react-three/fiber are not installed for this test. ./three never imports them, and
// ./react imports them only when a 3D component renders on the client, so the mocks never run here.
vi.mock("three", () => {
  throw new Error("three is not installed");
});
vi.mock("@react-three/fiber", () => {
  throw new Error("@react-three/fiber is not installed");
});

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = resolve(HERE, "../src");
const THREE = /^(three|@react-three\/)/;
const read = (p: string): string => readFileSync(resolve(HERE, p), "utf8");
const rel = (f: string): string => relative(SRC, f).replace(/\\/g, "/");

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

const PATH = [
  [0, 50, 6],
  [0, 17 / 12, 2],
] as const;

test("SSR and no three (Review Focus 1, 3): ./three and ./react import in Node with no window or document", async () => {
  expect(typeof window).toBe("undefined");
  expect(typeof document).toBe("undefined");
  const { loadLeague } = await import("../src/index.js");
  const three = await import("../src/three/index.js");
  const react = await import("../src/react/index.js");
  await loadLeague("mlb");
  expect(three.surfaceMesh("hockey", "nhl").positions.length).toBeGreaterThan(0);
  // the components load three on the client: a server render draws no mesh (React leaves it to the client), and
  // does not throw
  const NO_MESH = /<(mesh|bufferGeometry|meshBasicMaterial)\b/;
  expect(renderToString(<react.Surface3D sport="baseball" league="mlb" />)).not.toMatch(NO_MESH);
  expect(
    renderToString(<react.Trajectory points={PATH} radius={0.121} team="NYY" league="mlb" />),
  ).not.toMatch(NO_MESH);
});

test("./three names no three module, not even dynamically (Review Focus 1)", () => {
  const { bare, files } = staticGraph(resolve(SRC, "three/index.ts"));
  expect([...bare].filter((b) => THREE.test(b))).toEqual([]);
  for (const f of files)
    expect(readFileSync(f, "utf8"), rel(f)).not.toMatch(/import\(\s*["'](three|@react-three)/);
});

test("./react loads three, @react-three/fiber and sporty only when a 3D component renders (Review Focus 1)", () => {
  const { bare, files } = staticGraph(resolve(SRC, "react/index.tsx"));
  expect([...bare].filter((b) => THREE.test(b) || b.startsWith("@sportsdataverse/sporty"))).toEqual([]);
  // the tube is pure (team colours and buffers); the surface, which needs sporty, is imported when it renders
  expect([...files].map(rel).filter((f) => f.startsWith("three/"))).toEqual(["three/tube.ts"]);
});

test("the main entry never reaches three or the three modules (Review Focus 5)", () => {
  const { files, bare } = staticGraph(resolve(SRC, "index.ts"));
  expect([...bare].filter((b) => THREE.test(b))).toEqual([]);
  expect([...files].map(rel).filter((f) => /three/.test(f))).toEqual([]);
});

test("the ./three subpath export, the optional peers, and floors that are the tested versions", () => {
  const pkg = JSON.parse(read("../package.json"));
  const examples = JSON.parse(read("../../../examples/package.json"));
  expect(pkg.exports["./three"]).toEqual({ types: "./dist/three.d.ts", import: "./dist/three.js" });
  // each floor is the newest release at least two weeks old on 2026-10-18 (three 0.186.1 and @react-three/fiber
  // 9.8.1, both of 2026-09-24), and it is the version the tests and the examples run against
  for (const [name, version] of [
    ["three", "0.186.1"],
    ["@react-three/fiber", "9.8.1"],
  ] as const) {
    expect(pkg.peerDependenciesMeta[name]).toEqual({ optional: true });
    expect(pkg.peerDependencies[name]).toBe(`>=${version}`);
    expect(pkg.devDependencies[name]).toBe(version);
    expect(examples.devDependencies[name]).toBe(version);
  }
  expect(pkg.devDependencies["@react-three/test-renderer"]).toBe("9.1.1");
  expect(pkg.peerDependencies["@react-three/test-renderer"]).toBeUndefined(); // dev only
});
