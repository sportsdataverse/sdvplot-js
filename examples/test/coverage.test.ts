import { readFileSync, readdirSync } from "node:fs";
import { expect, test } from "vitest";
import { abs } from "../sources.js";
import { EXAMPLES } from "../src/registry.gen.js";

/**
 * Value exports no example has to show, each with its reason. A new export fails this test until an example
 * imports it or a row here says why not. `name` is a RegExp over export names of `spec`; `"*"` exempts the subpath.
 */
const HOOKS = "test hooks: what the adapter contract suite (sdvplot/testing) reads back from a spec";
/** An exact-name RegExp: a row names what it exempts, so a later export that merely looks alike is not exempt. */
const only = (names: readonly string[]): RegExp => new RegExp(`^(${names.join("|")})$`);
const SPORTS = [
  "BASEBALL",
  "BASKETBALL",
  "CURLING",
  "FOOTBALL",
  "HOCKEY",
  "LACROSSE",
  "SOCCER",
  "TENNIS",
  "VOLLEYBALL",
];
/** sporty's per-sport tables (`<SPORT>_<SUFFIX>`), less the ones an example imports by name. */
const tables = (suffixes: readonly string[], shown: readonly string[] = []): RegExp =>
  only(SPORTS.flatMap((s) => suffixes.map((x) => `${s}_${x}`)).filter((n) => !shown.includes(n)));
const EXEMPT: readonly (readonly [spec: string, name: RegExp | "*", reason: string])[] = [
  [
    "@sportsdataverse/sdvplot/testing",
    "*",
    "test-only subpath: the adapter contract suite (README, Adapter contract)",
  ],
  [
    "@sportsdataverse/sdvplot",
    /^(checkAlpha|checkHeight|warn)$/,
    "adapter-author helpers: the argument checks and the once-per-key warning every sdvplot adapter calls, for an adapter written outside sdvplot",
  ],
  [
    "@sportsdataverse/sdvplot",
    /^resetManifestCache$/,
    "test hook: forgets the fetched manifest (the gate calls it per example)",
  ],
  [
    "@sportsdataverse/sdvplot/plot",
    /^sizeRender$/,
    "the render transform logos/wordmarks/headshots are built on; every example of those marks draws through it",
  ],
  ["@sportsdataverse/sdvplot/plotly", /^(drawnMarks|drawnAxisMarks|visibleAxisLabels)$/, HOOKS],
  ["@sportsdataverse/sdvplot/vega", /^(drawnMarks|drawnAxisMarks|visibleAxisLabels)$/, HOOKS],
  ["@sportsdataverse/sdvplot/echarts", /^(drawnMarks|drawnAxisMarks|visibleAxisLabels)$/, HOOKS],
  [
    "@sportsdataverse/sdvplot/echarts",
    /^renderLogo$/,
    "the renderItem withLogos/withWordmarks/withHeadshots install on their custom series; every ECharts image example draws through it",
  ],
  [
    "@sportsdataverse/sporty",
    tables(
      ["LEAGUES", "FEATURES", "DISPLAY_RANGES", "COLOR_KEYS", "SPECS"],
      ["BASKETBALL_SPECS", "SOCCER_SPECS"],
    ),
    "the tables leagues()/features()/displayRanges()/colorKeys() and surface() read (sporty/core/discovery and spec-tables show those); the surfaces gallery draws every league",
  ],
  [
    "@sportsdataverse/sporty/specs",
    tables(["LEAGUES", "SPECS"]),
    "the same spec tables the package root exports, without the drawing code (sporty/core/spec-tables reads them from the root)",
  ],
  [
    "@sportsdataverse/sdvplot/shots",
    only(["hexbin", "hexagonPath", "squarebin", "squarePath", "binner", "cellPath", "cellPoints"]),
    "re-exports of sdvplot/bins, shown there",
  ],
  [
    "@sportsdataverse/sdvtables/html",
    /^labelOf$/,
    "the same function as columnLabel (export { labelOf as columnLabel }), which sdvtables/html examples show",
  ],
];

const PACKAGES = ["sdvplot", "sporty", "sdvtables"] as const;

/**
 * Specifier → value exports, read from the committed api-extractor reports (`etc/<pkg>[-<sub>].api.md`, one per
 * subpath; `-` in the file name is `/` in the subpath, so `sdvplot-chartjs-surface` is `sdvplot/chartjs/surface`).
 * A value is an exported function, const, let, class or enum, or an `export { local as name }` of one.
 */
function valueExports(): [string, string[]][] {
  const out: [string, string[]][] = [];
  for (const pkg of PACKAGES) {
    for (const f of readdirSync(abs(`packages/${pkg}/etc`)).filter((n) => n.endsWith(".api.md"))) {
      const sub = f.slice(pkg.length, -".api.md".length).replace(/^-/, "").replace(/-/g, "/");
      const text = readFileSync(abs(`packages/${pkg}/etc/${f}`), "utf8");
      const kind = "(?:declare )?(?:abstract )?(?:function|const|class|let|enum)";
      const names = [...text.matchAll(new RegExp(`^export ${kind} (\\w+)`, "gm"))].map((m) => m[1] ?? "");
      for (const m of text.matchAll(/^export \{ (\w+)(?: as (\w+))? \}/gm))
        if (new RegExp(`^${kind} ${m[1]}\\b`, "m").test(text)) names.push(m[2] ?? m[1] ?? "");
      out.push([sub ? `@sportsdataverse/${pkg}/${sub}` : `@sportsdataverse/${pkg}`, [...new Set(names)]]);
    }
  }
  return out;
}

/** Names `code` imports from `spec`: named imports, and `X.name` through `import * as X`. */
function usedFrom(code: string, spec: string): Set<string> {
  const used = new Set<string>();
  for (const m of code.matchAll(/import\s+(?:type\s+)?\{([^}]*)\}\s+from\s+"([^"]+)"/g))
    if (m[2] === spec)
      for (const part of (m[1] ?? "").split(","))
        used.add(
          part
            .trim()
            .replace(/^type\s+/, "")
            .split(/\s+as\s+/)[0] ?? "",
        );
  for (const m of code.matchAll(/import\s+\*\s+as\s+(\w+)\s+from\s+"([^"]+)"/g))
    if (m[2] === spec)
      for (const u of code.matchAll(new RegExp(`\\b${m[1]}\\.(\\w+)`, "g"))) used.add(u[1] ?? "");
  return used;
}

test("usedFrom reads named, renamed and namespace imports", () => {
  const code = 'import { a, b as c, type T } from "x";\nimport * as X from "y";\nX.d(); X.e;\n';
  expect([...usedFrom(code, "x")]).toEqual(["a", "b", "T"]);
  expect([...usedFrom(code, "y")]).toEqual(["d", "e"]);
});

test("the reports cover every subpath of every package, and every value export is found", () => {
  const specs = valueExports().map(([s]) => s);
  for (const pkg of PACKAGES) {
    const exp = JSON.parse(readFileSync(abs(`packages/${pkg}/package.json`), "utf8")).exports;
    const want = Object.keys(exp)
      .filter((k) => k !== "./package.json")
      .map((k) => (k === "." ? `@sportsdataverse/${pkg}` : `@sportsdataverse/${pkg}/${k.slice(2)}`));
    for (const w of want) expect(specs, `${w} has no api-extractor report`).toContain(w);
  }
  const all = new Map(valueExports());
  expect(all.get("@sportsdataverse/sdvplot/chartjs/surface")).toEqual(["surface"]);
  expect(all.get("@sportsdataverse/sdvtables/html")).toContain("columnLabel");
  expect(all.get("@sportsdataverse/sdvplot")).toContain("UnsupportedTargetError");
});

test.each(valueExports())("every value export of %s is shown by an example, or exempt", (spec, names) => {
  const exempt = EXEMPT.filter(([s]) => s === spec);
  if (exempt.some(([, n]) => n === "*")) return;
  const used = new Set(EXAMPLES.flatMap((e) => [...usedFrom(e.code, spec)]));
  const missing = names.filter((n) => !used.has(n) && !exempt.some(([, re]) => re !== "*" && re.test(n)));
  expect(missing, `add an example that imports ${missing.join(", ")} from ${spec}, or an EXEMPT row`).toEqual(
    [],
  );
});

/**
 * What is stale in the exemptions: a subpath that does not exist, a row whose RegExp names no export, and each name
 * a row exempts that an example now imports (drop that name from the row, even while the row still exempts others).
 */
function staleExemptions(
  rows: typeof EXEMPT,
  exports: ReadonlyMap<string, readonly string[]>,
  usedOf: (spec: string) => ReadonlySet<string>,
): string[] {
  const out: string[] = [];
  for (const [spec, re] of rows) {
    const names = exports.get(spec);
    if (names === undefined) out.push(`${spec}: no such subpath`);
    if (names === undefined || re === "*") continue;
    const hits = names.filter((n) => re.test(n));
    if (hits.length === 0) out.push(`${spec} ${re} exempts no export: drop the row`);
    for (const n of hits.filter((h) => usedOf(spec).has(h)))
      out.push(`${spec} ${n} is shown by an example now: drop it from its EXEMPT row`);
  }
  return out;
}

test("a stale exemption is reported per name, not only once the whole row is shown", () => {
  const exports = new Map([["p", ["a", "b", "c"]]]);
  const rows: typeof EXEMPT = [
    ["p", /^(a|b)$/, "two names, one of them shown"],
    ["p", /^z$/, "names nothing"],
    ["q", "*", "no such subpath"],
  ];
  expect(staleExemptions(rows, exports, () => new Set(["a"]))).toEqual([
    "p a is shown by an example now: drop it from its EXEMPT row",
    "p /^z$/ exempts no export: drop the row",
    "q: no such subpath",
  ]);
});

test("the sporty table rows name today's tables exactly: a look-alike export is not exempt", () => {
  const rows = EXEMPT.filter(([s]) => s.startsWith("@sportsdataverse/sporty"));
  expect(rows.length).toBe(2);
  for (const [, re] of rows) {
    if (re === "*") throw new Error("a sporty row exempts a whole subpath");
    expect(re.test("HOCKEY_LEAGUES")).toBe(true);
    for (const n of ["CRICKET_SPECS", "HOCKEY_RINK_SPECS", "XHOCKEY_LEAGUES", "HOCKEY_LEAGUES_V2"])
      expect(re.test(n), `${re} exempts ${n}`).toBe(false);
  }
});

test("every EXEMPT row exempts only names no example imports", () => {
  const used = (spec: string) => new Set(EXAMPLES.flatMap((e) => [...usedFrom(e.code, spec)]));
  expect(staleExemptions(EXEMPT, new Map(valueExports()), used)).toEqual([]);
});
