// @vitest-environment node
import { readFileSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Bump } from "@nivo/bump";
import { renderToString } from "react-dom/server";
import { expect, test } from "vitest";
import { KC } from "./_fixtures.js";

const SRC = resolve(dirname(fileURLToPath(import.meta.url)), "../src");
const NIVO = /^@nivo\//;

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

test("SSR: ./nivo and ./react import in Node with no window or document, and the logos server-render (Review Focus 3)", async () => {
  expect(typeof window).toBe("undefined");
  expect(typeof document).toBe("undefined");
  const nivo = await import("../src/nivo.js");
  const react = await import("../src/react/index.js");
  expect(typeof react.LogoBump).toBe("function");
  // nivo draws its svg on the server; the layer is pure, so the logos are in the server html too
  const html = renderToString(
    <Bump
      width={300}
      height={200}
      animate={false}
      data={[{ id: KC, data: [{ x: 1, y: 1 }] }]}
      colors={nivo.teamColors({ league: "nfl" })}
      layers={["lines", nivo.logoLayer({ league: "nfl" })]}
    />,
  );
  expect(html).toMatch(/<image[^>]*data-sdv-id=/);
  // LogoBump loads @nivo/bump on the client: a server render draws no chart (React leaves it to the client)
  expect(renderToString(<react.LogoBump league="nfl" data={[]} width={300} height={200} />)).not.toMatch(
    /<svg|<image/,
  );
});

test("bundle hygiene: the main entry never reaches nivo or the nivo modules (Review Focus 5)", () => {
  const main = staticGraph(resolve(SRC, "index.ts"));
  expect([...main.bare].filter((b) => NIVO.test(b))).toEqual([]);
  expect([...main.files].filter((f) => /nivo/.test(relative(SRC, f)))).toEqual([]);
});

test("./nivo is pure: no import of nivo, static or dynamic (Review Focus 1)", () => {
  const { bare, files } = staticGraph(resolve(SRC, "nivo.ts"));
  expect([...bare].filter((b) => NIVO.test(b))).toEqual([]);
  for (const f of files) expect(readFileSync(f, "utf8")).not.toMatch(/import\(\s*["']@nivo\//);
});

test("./react loads @nivo/bump only when LogoBump renders (Review Focus 1)", () => {
  const { bare } = staticGraph(resolve(SRC, "react/index.tsx"));
  expect([...bare].filter((b) => NIVO.test(b))).toEqual([]);
});

test("the ./nivo subpath is exported, with the nivo packages optional peers at the tested 0.99", () => {
  const pkg = JSON.parse(readFileSync(resolve(SRC, "../package.json"), "utf8"));
  expect(pkg.exports["./nivo"]).toEqual({ types: "./dist/nivo.d.ts", import: "./dist/nivo.js" });
  for (const p of ["@nivo/core", "@nivo/bump", "@nivo/swarmplot", "@nivo/chord"]) {
    expect(pkg.peerDependencies[p], p).toBe(">=0.99");
    expect(pkg.peerDependenciesMeta[p], p).toEqual({ optional: true });
    expect(pkg.devDependencies[p], `${p}: the floor is the version the tests run`).toBe("0.99.0");
  }
});
