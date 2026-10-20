// @vitest-environment node
import { readFileSync, readdirSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { render } from "svelte/server";
import { expect, test } from "vitest";

const SRC = resolve(dirname(fileURLToPath(import.meta.url)), "../../src");

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
      const base = resolve(dirname(file), spec);
      const found = [base, base.replace(/\.js$/, ".ts"), `${base.replace(/\.js$/, "")}/index.ts`].find(
        (f) => {
          try {
            return readFileSync(f) !== undefined;
          } catch {
            return false;
          }
        },
      );
      if (found !== undefined) visit(found);
    }
  };
  visit(entry);
  return { files, bare };
}

test("SSR: ./svelte imports in Node with no window or document, and a server render draws (Review Focus 3)", async () => {
  expect(typeof window).toBe("undefined");
  expect(typeof document).toBe("undefined");
  const svelte = await import("../../src/svelte/index.js");
  expect(typeof svelte.LogoMark).toBe("function");
  const { default: Bump } = await import("./fixtures/Bump.svelte");
  const { loadLeague } = await import("../../src/index.js");
  await loadLeague("nfl");
  const rows = [
    { team: "KC", week: 17, rank: 1 },
    { team: "KC", week: 18, rank: 1 },
  ];
  const { body } = render(Bump, { props: { rows, teams: ["KC"], ssr: true } });
  expect(body).toContain("lc-layout-svg"); // LayerChart drew its svg on the server, the team-coloured line in it
  expect(body).toContain('data-team="KC"');
  // the logos wait on layerchart's lazy import, so they draw once the page hydrates, never on the server
  expect(body).not.toContain("data-sdv-id");
});

test("bundle hygiene: the main entry never reaches svelte, layerchart or the svelte layer (Review Focus 5)", () => {
  const main = staticGraph(resolve(SRC, "index.ts"));
  expect([...main.bare].filter((b) => /^(svelte|layerchart)(\/|$)/.test(b))).toEqual([]);
  expect([...main.files].filter((f) => /svelte/.test(relative(SRC, f)))).toEqual([]);
});

test("./svelte imports layerchart and sporty only lazily, when a component renders (Review Focus 1)", () => {
  const { bare, files } = staticGraph(resolve(SRC, "svelte-core.ts"));
  expect([...bare].filter((b) => /^(layerchart|@sportsdataverse\/sporty)(\/|$)/.test(b))).toEqual([]);
  expect([...files].map((f) => relative(SRC, f))).not.toContain("surfaces.ts");
  for (const f of readdirSync(resolve(SRC, "svelte")))
    expect(readFileSync(resolve(SRC, "svelte", f), "utf8"), f).not.toMatch(
      /from\s+["'](layerchart|@sportsdataverse\/sporty)/,
    );
});

test("the ./svelte subpath is exported with the svelte condition, svelte and layerchart optional peers", () => {
  const pkg = JSON.parse(readFileSync(resolve(SRC, "../package.json"), "utf8"));
  expect(pkg.exports["./svelte"]).toEqual({
    types: "./dist/svelte/index.d.ts",
    svelte: "./dist/svelte/index.js",
  });
  expect(pkg.peerDependencies.svelte).toBe(">=5.57");
  expect(pkg.peerDependencies.layerchart).toBe(">=2.5.1"); // the release every test ran against
  expect(pkg.peerDependenciesMeta.svelte).toEqual({ optional: true });
  expect(pkg.peerDependenciesMeta.layerchart).toEqual({ optional: true });
});
