// @vitest-environment node
import { readFileSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { renderToString } from "react-dom/server";
import { Line, LineChart, XAxis, YAxis } from "recharts";
import { expect, test } from "vitest";

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

test("SSR: ./recharts and ./react import in Node with no window or document (Review Focus 3)", async () => {
  expect(typeof window).toBe("undefined");
  expect(typeof document).toBe("undefined");
  const rc = await import("../src/recharts.js");
  const react = await import("../src/react/index.js");
  expect(typeof rc.logoDot).toBe("function");
  expect(typeof react.SurfaceBackdrop).toBe("function");
  // a server render of a chart drawing through the render props and the backdrop does not touch the DOM either
  const html = renderToString(
    <LineChart width={300} height={200} data={[{ week: 1, wins: 1, team: "KC" }]}>
      <XAxis dataKey="week" />
      <YAxis />
      <react.SurfaceBackdrop league="nba" />
      <Line dataKey="wins" dot={rc.logoDot({ team: "team", league: "nfl" })} />
    </LineChart>,
  );
  expect(html).toContain("recharts-wrapper"); // recharts 3 itself draws the svg on the client
});

test("bundle hygiene: the main entry never reaches recharts (Review Focus 5)", () => {
  const main = staticGraph(resolve(SRC, "index.ts"));
  expect([...main.bare].filter((b) => b.startsWith("recharts"))).toEqual([]);
  expect([...main.files].filter((f) => /recharts/.test(relative(SRC, f)))).toEqual([]);
});

test("./recharts is pure: no import of recharts, static or dynamic (Review Focus 1)", () => {
  const { bare, files } = staticGraph(resolve(SRC, "recharts.ts"));
  expect(
    [...bare].filter((b) => b.startsWith("recharts") || b.startsWith("@sportsdataverse/sporty")),
  ).toEqual([]);
  for (const f of files) expect(readFileSync(f, "utf8")).not.toMatch(/import\(\s*["']recharts["']\s*\)/);
});

test("./react loads recharts and sporty only when SurfaceBackdrop renders (Review Focus 1)", () => {
  const { bare } = staticGraph(resolve(SRC, "react/index.tsx"));
  expect(
    [...bare].filter((b) => b.startsWith("recharts") || b.startsWith("@sportsdataverse/sporty")),
  ).toEqual([]);
});

test("the ./recharts subpath is exported, with recharts an optional peer at 3.2 or later", () => {
  const pkg = JSON.parse(readFileSync(resolve(SRC, "../package.json"), "utf8"));
  expect(pkg.exports["./recharts"]).toEqual({ types: "./dist/recharts.d.ts", import: "./dist/recharts.js" });
  expect(pkg.peerDependencies.recharts).toBe(">=3.2");
  expect(pkg.peerDependenciesMeta.recharts).toEqual({ optional: true });
});
