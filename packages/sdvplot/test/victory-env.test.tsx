// @vitest-environment node
import { readFileSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { renderToString } from "react-dom/server";
import { VictoryAxis, VictoryChart, VictoryScatter } from "victory";
import { expect, test } from "vitest";
import { BUF, KC } from "./_fixtures.js";

const SRC = resolve(dirname(fileURLToPath(import.meta.url)), "../src");
const VICTORY = /^victory($|-)/;

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

test("SSR: ./victory and ./react import in Node with no window or document, and the logos server-render (Review Focus 3)", async () => {
  expect(typeof window).toBe("undefined");
  expect(typeof document).toBe("undefined");
  const victory = await import("../src/victory.js");
  const { LogoPoint, LogoTick } = await import("../src/react/index.js");
  const rows = [
    { team: KC, pf: 385 },
    { team: BUF, pf: 525 },
  ];
  // Victory draws its svg on the server, and both components are synchronous: the logos are in the server html
  const html = renderToString(
    <VictoryChart theme={victory.teamTheme({ league: "nfl", teams: [KC, BUF] })} animate={false}>
      <VictoryAxis tickLabelComponent={<LogoTick league="nfl" />} />
      <VictoryScatter
        data={rows}
        x="team"
        y="pf"
        size={10}
        dataComponent={<LogoPoint league="nfl" team="team" />}
      />
    </VictoryChart>,
  );
  expect(html.match(/<image[^>]*data-sdv-id=/g)).toHaveLength(4);
});

test("bundle hygiene: the main entry never reaches victory or the victory modules (Review Focus 5)", () => {
  const main = staticGraph(resolve(SRC, "index.ts"));
  expect([...main.bare].filter((b) => VICTORY.test(b))).toEqual([]);
  expect([...main.files].filter((f) => /victory/.test(relative(SRC, f)))).toEqual([]);
});

test("./victory is pure: no import of victory, static or dynamic (Review Focus 1)", () => {
  const { bare, files } = staticGraph(resolve(SRC, "victory.ts"));
  expect([...bare].filter((b) => VICTORY.test(b))).toEqual([]);
  for (const f of files) expect(readFileSync(f, "utf8")).not.toMatch(/import\(\s*["']victory/);
});

test("./react loads victory only when a LogoTick draws a text label (Review Focus 1)", () => {
  const { bare } = staticGraph(resolve(SRC, "react/index.tsx"));
  expect([...bare].filter((b) => VICTORY.test(b))).toEqual([]);
});

test("the ./victory subpath is exported, with victory an optional peer at the tested 37.3.6", () => {
  const pkg = JSON.parse(readFileSync(resolve(SRC, "../package.json"), "utf8"));
  expect(pkg.exports["./victory"]).toEqual({ types: "./dist/victory.d.ts", import: "./dist/victory.js" });
  expect(pkg.peerDependencies.victory).toBe(">=37.3.6");
  expect(pkg.peerDependenciesMeta.victory).toEqual({ optional: true });
  expect(pkg.devDependencies.victory, "the floor is the version the tests run").toBe("37.3.6");
});
