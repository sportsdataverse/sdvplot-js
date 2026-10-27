// @vitest-environment node
import { readFileSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test, vi } from "vitest";
import "./_fixtures.js";

// Perspective is not installed: any import of it fails, as Node's resolver would.
for (const name of ["client", "viewer", "viewer-datagrid", "viewer-charts", "server"])
  vi.doMock(`@perspective-dev/${name}`, () => {
    throw Object.assign(new Error(`Cannot find package '@perspective-dev/${name}' imported from sdvplot`), {
      code: "ERR_MODULE_NOT_FOUND",
    });
  });

const SRC = resolve(dirname(fileURLToPath(import.meta.url)), "../src");

/** Every module `entry` reaches through static imports (`import type` left out), and every import text it holds. */
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
      const found = [".ts", "/index.ts"]
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

test("SSR and no Perspective: ./perspective imports in Node with no window or document, and builds both pieces", async () => {
  expect(typeof window).toBe("undefined");
  expect(typeof document).toBe("undefined");
  await expect(import("@perspective-dev/client")).rejects.toThrow();
  const p = await import("../src/perspective.js");
  // what a server component or a SvelteKit load would do: build the rows and the config, then hand them to the page
  const rows = p.perspectiveLogoColumn([{ team: "KC", wins: 15 }], "team", { league: "nfl" });
  expect(rows[0]?.team_logo).toMatch(/^https:\/\//);
  const config = p.perspectiveConfig(rows, {
    teamCol: "team",
    league: "nfl",
    logoCol: "team_logo",
    mode: "dark",
  });
  expect(config).toMatchObject({ plugin: "Datagrid", theme: "Pro Dark" });
  expect(config.columns_config.team?.bg_color).toMatch(/^linear-gradient\(to right, #[0-9a-f]{6}\)$/);
  // plain data: what crosses a server/client boundary survives JSON
  expect(JSON.parse(JSON.stringify(config))).toEqual(config);
});

test("bundle hygiene: the main entry never reaches Perspective or ./perspective", () => {
  const main = staticGraph(resolve(SRC, "index.ts"));
  expect([...main.bare].filter((b) => b.startsWith("@perspective-dev/"))).toEqual([]);
  expect([...main.files].filter((f) => /perspective/.test(relative(SRC, f)))).toEqual([]);
});

test("./perspective is pure: no import of @perspective-dev/*, static, dynamic, for side effects or for types", () => {
  const { bare, files } = staticGraph(resolve(SRC, "perspective.ts"));
  expect([...bare].filter((b) => b.startsWith("@perspective-dev/"))).toEqual([]);
  for (const f of files) expect(readFileSync(f, "utf8")).not.toMatch(/["']@perspective-dev\//);
});

test("the subpath is exported, with @perspective-dev/viewer an optional peer whose floor is the tested version", () => {
  const pkg = JSON.parse(readFileSync(resolve(SRC, "../package.json"), "utf8"));
  const examples = JSON.parse(readFileSync(resolve(SRC, "../../../examples/package.json"), "utf8"));
  expect(pkg.exports["./perspective"]).toEqual({
    types: "./dist/perspective.d.ts",
    import: "./dist/perspective.js",
  });
  expect(pkg.peerDependencies["@perspective-dev/viewer"]).toBe(">=5.5.1");
  expect(pkg.peerDependenciesMeta["@perspective-dev/viewer"]).toEqual({ optional: true });
  // every test, the parity fixture and the docs render run on exactly the floor
  for (const name of ["client", "server", "viewer"])
    expect(pkg.devDependencies[`@perspective-dev/${name}`]).toBe("5.5.1");
  for (const name of ["client", "server", "viewer", "viewer-datagrid", "viewer-charts"])
    expect(examples.devDependencies[`@perspective-dev/${name}`]).toBe("5.5.1");
  const lock = readFileSync(resolve(SRC, "../../../pnpm-lock.yaml"), "utf8");
  // one version of each in the whole install: no 5.6 server under a 5.5.1 client
  const locked = lock.matchAll(/^ {2}'@perspective-dev\/([a-z-]+)@([\d.]+)':$/gm);
  expect([...new Set([...locked].map((m) => `${m[1]}@${m[2]}`))].sort()).toEqual([
    "client@5.5.1",
    "server@5.5.1",
    "viewer-charts@5.5.1",
    "viewer-datagrid@5.5.1",
    "viewer@5.5.1",
  ]);
});
