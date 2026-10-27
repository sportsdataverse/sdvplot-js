// @vitest-environment node
import { readFileSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { renderToString } from "react-dom/server";
import { expect, test, vi } from "vitest";
import "./_fixtures.js";

// The package root of MUI X Charts is not installed: any import of it fails, as Node's resolver would.
vi.mock("@mui/x-charts", () => {
  throw Object.assign(new Error("Cannot find package '@mui/x-charts' imported from sdvplot"), {
    code: "ERR_MODULE_NOT_FOUND",
  });
});

const SRC = resolve(dirname(fileURLToPath(import.meta.url)), "../src");
const MUI = /^@mui\//;

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

test("no MUI and no DOM: ./mui and ./react import in Node, and every piece builds and draws (Review Focus 1, 3)", async () => {
  expect(typeof window).toBe("undefined");
  expect(typeof document).toBe("undefined");
  await expect(import("@mui/x-charts")).rejects.toThrow(); // the mock holds: the root package is absent
  const mui = await import("../src/mui.js");
  await import("../src/react/index.js");
  expect(mui.teamColors("nfl", ["KC", "LV"])("dark")).toHaveLength(2);
  expect(mui.teamColorGetter("nfl", ["KC"])({ dataIndex: 0 })).toMatch(/^#[0-9a-f]{6}$/);
  // the slots are plain function components: they render on the server with no chart around them
  const marker = mui.logoMarker({ league: "nfl", teams: ["KC"] });
  const mark = mui.logoMark({ league: "nfl" });
  const tick = mui.logoTickLabel({ league: "nfl" });
  const html = renderToString(
    <svg role="img" aria-label="three sdvplot slots">
      {marker({ seriesId: "s", dataIndex: 0, x: 10, y: 10, size: 8 })}
      {mark({ seriesId: "KC", dataIndex: 0, x: 10, y: 10 })}
      {tick({ x: 0, y: 9, text: "KC", style: { textAnchor: "middle", dominantBaseline: "hanging" } })}
    </svg>,
  );
  expect(html.match(/<image[^>]*data-sdv-id="12"/g)).toHaveLength(3);
});

test("SSR: a real MUI ScatterChart, LineChart and composed bar chart server-render with their logos (Review Focus 3)", async () => {
  const mui = await import("../src/mui.js");
  const { ScatterChart } = await import("@mui/x-charts/ScatterChart");
  const { LineChart } = await import("@mui/x-charts/LineChart");
  const { BarPlot } = await import("@mui/x-charts/BarChart");
  const { ChartsContainer } = await import("@mui/x-charts/ChartsContainer");
  const { ChartsXAxis } = await import("@mui/x-charts/ChartsXAxis");
  const size = { width: 400, height: 300, skipAnimation: true };
  const html = renderToString(
    <>
      <ScatterChart
        {...size}
        series={[{ data: [{ x: 1, y: 2 }], markerSize: 10 }]}
        slots={{ marker: mui.logoMarker({ league: "nfl", teams: ["KC"] }) }}
      />
      <LineChart
        {...size}
        xAxis={[{ data: [1, 2] }]}
        series={[{ id: "BUF", data: [1, 2], showMark: ({ index }) => index === 1 }]}
        slots={{ mark: mui.logoMark({ league: "nfl" }) }}
      />
      <ChartsContainer
        {...size}
        xAxis={[{ id: "t", scaleType: "band", data: ["KC", "BUF"], height: 40 }]}
        series={[{ type: "bar", data: [15, 13] }]}
      >
        <BarPlot />
        <ChartsXAxis axisId="t" slots={{ axisTickLabel: mui.logoTickLabel({ league: "nfl" }) }} />
      </ChartsContainer>
    </>,
  );
  expect(html.match(/<image[^>]*data-sdv-id="(\d+)"/g)?.map((m) => /"(\d+)"$/.exec(m)?.[1])).toEqual([
    "12",
    "2",
    "12",
    "2",
  ]);
});

test("bundle hygiene: the main entry never reaches MUI or the mui module (Review Focus 5)", () => {
  const main = staticGraph(resolve(SRC, "index.ts"));
  expect([...main.bare].filter((b) => MUI.test(b))).toEqual([]);
  expect([...main.files].filter((f) => /mui/.test(relative(SRC, f)))).toEqual([]);
});

test("./mui and ./react are pure: no import of MUI, static or dynamic (Review Focus 1)", () => {
  for (const entry of ["mui.ts", "react/index.tsx"]) {
    const { bare, files } = staticGraph(resolve(SRC, entry));
    expect(
      [...bare].filter((b) => MUI.test(b)),
      entry,
    ).toEqual([]);
    expect([...bare].sort(), entry).toEqual(expect.arrayContaining(["react"]));
    for (const f of files) expect(readFileSync(f, "utf8")).not.toMatch(/import\(\s*["']@mui/);
  }
});

test("the ./mui subpath is exported, with @mui/x-charts an optional peer at the tested 9.15.0, and no @mui/material peer", () => {
  const pkg = JSON.parse(readFileSync(resolve(SRC, "../package.json"), "utf8"));
  expect(pkg.exports["./mui"]).toEqual({ types: "./dist/mui.d.ts", import: "./dist/mui.js" });
  expect(pkg.peerDependencies["@mui/x-charts"]).toBe(">=9.15.0");
  expect(pkg.peerDependenciesMeta["@mui/x-charts"]).toEqual({ optional: true });
  expect(pkg.devDependencies["@mui/x-charts"], "the floor is the version the tests run").toBe("9.15.0");
  // MUI's own peers (material, system, emotion) are the app's: sdvplot's types never name them
  for (const p of ["@mui/material", "@mui/system", "@emotion/react", "@emotion/styled"])
    expect(pkg.peerDependencies[p], p).toBeUndefined();
  const installed = JSON.parse(
    readFileSync(resolve(SRC, "../node_modules/@mui/x-charts/package.json"), "utf8"),
  ).version;
  expect(installed).toBe("9.15.0");
});
