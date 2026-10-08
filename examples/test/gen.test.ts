import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import ts from "typescript";
import { expect, test } from "vitest";
import {
  browserModule,
  codeOf,
  docModule,
  extractDocExamples,
  metaOf,
  registryModules,
} from "../scripts/lib.js";
import type { ExampleEntry } from "../src/contract.js";

const MODULE = `import * as Plot from "@observablehq/plot";
import type { ExampleMeta } from "../../contract.js";

export const meta = { title: "Dots", tags: ["plot", "dot"] } satisfies ExampleMeta;

// a comment the reader keeps
const rows = [{ x: 1 }];
export default Plot.plot({ marks: [Plot.dot(rows, { x: "x" })] });
`;

test("metaOf reads the literal; codeOf shows the module minus meta, contract import and `export default`", () => {
  expect(metaOf(MODULE, "a.ts")).toEqual({ title: "Dots", tags: ["plot", "dot"] });
  expect(codeOf(MODULE, "a.ts")).toBe(`import * as Plot from "@observablehq/plot";

// a comment the reader keeps
const rows = [{ x: 1 }];
Plot.plot({ marks: [Plot.dot(rows, { x: "x" })] });
`);
  expect(() => codeOf("export const meta = { title: 'x', tags: [] };\n", "b.ts")).toThrow(/no(ne)?/);
  expect(() => metaOf("export default 1;\n", "c.ts")).toThrow("c.ts: needs `export const meta");
});

const SOURCE = `/** Not exported; its example is ignored.
 * @example
 * \`\`\`ts
 * hidden();
 * \`\`\`
 */
function hidden(): void {}
/** No example here. */
const internal = 1;
/**
 * Adds one.
 *
 * @example
 * \`\`\`ts
 * import { addOne } from "./api.js";
 *
 * addOne({ n: 1 });
 * \`\`\`
 */
export function addOne(o: { n: number }): number {
  return o.n + 1;
}
`;

test("extractDocExamples takes fenced blocks under @example of exported declarations only", () => {
  expect(extractDocExamples(SOURCE, "api.ts")).toEqual([
    { symbol: "addOne", lang: "ts", code: 'import { addOne } from "./api.js";\n\naddOne({ n: 1 });\n' },
  ]);
  expect(() =>
    extractDocExamples("/**\n * @example\n * addOne(1);\n */\nexport const a = 1;\n", "x.ts"),
  ).toThrow("must be a fenced");
});

test("docModule exports the last expression and refuses an example that ends in a declaration", () => {
  const text = docModule({
    symbol: "addOne",
    lang: "ts",
    code: 'import { addOne } from "./api.js";\n\nconst a = addOne({ n: 1 });\na * 2;\n',
    from: "api.ts",
    contract: "./contract.js",
  });
  expect(text).toContain("const a = addOne({ n: 1 });\nexport default a * 2;");
  expect(codeOf(text, "gen.ts")).toBe(
    'import { addOne } from "./api.js";\n\nconst a = addOne({ n: 1 });\na * 2;\n',
  );
  expect(() =>
    docModule({ symbol: "f", lang: "ts", code: "const a = 1;\n", from: "f.ts", contract: "./contract.js" }),
  ).toThrow("must end with the expression it shows");
});

test("Review Focus 5: a docstring example that drifts from the API fails to compile", () => {
  const dir = mkdtempSync(join(tmpdir(), "sdv-docex-"));
  const drifted = SOURCE.replace("addOne({ n: 1 });", "addOne({ count: 1 });");
  writeFileSync(join(dir, "api.ts"), drifted);
  writeFileSync(
    join(dir, "contract.ts"),
    "export interface ExampleMeta { title: string; tags: readonly string[] }\n",
  );
  const [ex] = extractDocExamples(drifted, "api.ts");
  if (ex === undefined) throw new Error("no example extracted");
  writeFileSync(join(dir, "ex.ts"), docModule({ ...ex, from: "api.ts", contract: "./contract.js" }));
  writeFileSync(join(dir, "package.json"), '{ "type": "module" }\n');
  const program = ts.createProgram([join(dir, "ex.ts")], {
    strict: true,
    noEmit: true,
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.NodeNext,
    moduleResolution: ts.ModuleResolutionKind.NodeNext,
    types: [],
  });
  const messages = ts
    .getPreEmitDiagnostics(program)
    .map((d) => ts.flattenDiagnosticMessageText(d.messageText, "\n"));
  expect(messages).toEqual([expect.stringContaining("'count' does not exist in type '{ n: number; }'")]);
});

// Phase 5's peerMissing docstring, as a synthetic source: its example imports node:module and the /export subpath.
const NODE_SOURCE = `/**
 * True when \`e\` is Node's "cannot find" for the optional peer \`name\` itself.
 *
 * @example
 * \`\`\`ts
 * import { createRequire } from "node:module";
 * import { peerMissing } from "@sportsdataverse/sdvplot/export";
 *
 * const name = "@sportsdataverse/no-such-peer";
 * let error: unknown;
 * try {
 *   createRequire(import.meta.url).resolve(name);
 * } catch (e) {
 *   error = e;
 * }
 * peerMissing(error, name);
 * \`\`\`
 */
export function peerMissing(e: unknown, name: string): boolean {
  return false;
}
`;

test("a docstring example importing node:* or an /export subpath is tagged node: re-run in Node, never bundled", () => {
  const entryOf = (code: string, id: string): ExampleEntry => {
    const text = docModule({
      symbol: id,
      lang: "ts",
      code,
      from: "export/index.ts",
      contract: "./contract.js",
    });
    return {
      id,
      package: "sdvplot",
      ...metaOf(text, `${id}.ts`),
      code: "",
      lang: "ts",
      file: `src/${id}.ts`,
    };
  };
  const [ex] = extractDocExamples(NODE_SOURCE, "export/index.ts");
  if (ex === undefined) throw new Error("no example extracted");
  const viaNode = entryOf(ex.code, "via-node");
  const viaExport = entryOf(
    'import { peerMissing } from "@sportsdataverse/sdvtables/export";\n\npeerMissing(1, "x");\n',
    "via-export",
  );
  const browser = entryOf(
    'import { diffScale } from "@sportsdataverse/sdvplot/shots";\n\ndiffScale();\n',
    "browser",
  );
  expect(viaNode.tags).toEqual(["docstring", "via-node", "node"]);
  expect(viaExport.tags).toEqual(["docstring", "via-export", "node"]);
  expect(browser.tags).toEqual(["docstring", "browser"]);
  const { loaders } = registryModules([viaNode, viaExport, browser]);
  expect(loaders).not.toContain('"via-node"');
  expect(loaders).not.toContain('"via-export"');
  expect(loaders).toContain('"browser": () => import("./browser.js")');
});

// A Chart.js example's shape: Node-only imports, the config, the browser export, then the Node render.
const ADAPTER = `import { createCanvas, loadImage } from "@napi-rs/canvas";
import { STANDINGS } from "@sportsdataverse/examples/data";
import { type PointOptions, logoPoints, pointImages } from "@sportsdataverse/sdvplot/chartjs";
import { Chart, type ChartConfiguration, registerables } from "chart.js";
import type { ExampleMeta } from "../../contract.js";

export const meta = { title: "Logos", tags: ["node", "chartjs"] } satisfies ExampleMeta;

// the config
const config = (o: Pick<PointOptions, "loadImage"> = {}): ChartConfiguration<"scatter"> => ({
  type: "scatter",
  data: { datasets: [{ data: STANDINGS.map((s) => ({ x: s.pf, y: s.pa })), ...logoPoints([], { league: "nfl", ...o }) }] },
  plugins: [pointImages],
});
export const browser = { lib: "chartjs", config, width: 640, height: 400, label: "Logos" } as const;

Chart.register(...registerables);
const canvas = createCanvas(640, 400);
new Chart(canvas.getContext("2d"), config({ loadImage }));
export default canvas.toBuffer("image/png").toString("base64");
`;

test("browserModule keeps the code up to `export const browser` and only the imports it uses", () => {
  expect(browserModule(ADAPTER, "logos.ts")).toBe(
    `// generated by examples/scripts/gen.ts from logos.ts: its code up to \`export const browser\` - do not edit
import { STANDINGS } from "@sportsdataverse/examples/data";
import { type PointOptions, logoPoints, pointImages } from "@sportsdataverse/sdvplot/chartjs";
import type { ChartConfiguration } from "chart.js";

// the config
const config = (o: Pick<PointOptions, "loadImage"> = {}): ChartConfiguration<"scatter"> => ({
  type: "scatter",
  data: { datasets: [{ data: STANDINGS.map((s) => ({ x: s.pf, y: s.pa })), ...logoPoints([], { league: "nfl", ...o }) }] },
  plugins: [pointImages],
});
export const browser = { lib: "chartjs", config, width: 640, height: 400, label: "Logos" } as const;
`,
  );
  expect(browserModule(MODULE, "plot.ts")).toBeNull(); // no browser export: no upgrade
});

test("browserModule refuses a browser part that needs Node or a relative import", () => {
  const early = ADAPTER.replace("// the config\n", "// the config\nconst c = createCanvas(1, 1);\n");
  expect(() => browserModule(early, "early.ts")).toThrow(
    'early.ts: the code before `export const browser` uses "@napi-rs/canvas"',
  );
  const local = `import { x } from "./local.js";\nexport const browser = { lib: "vega", spec: x } as const;\nexport default 1;\n`;
  expect(() => browserModule(local, "local.ts")).toThrow('uses "./local.js"');
});

test("the loaders name each browser upgrade's module, in its library's draw chunk", () => {
  const { browser } = registryModules([], ["sdvplot/vega/logos"]);
  expect(browser).toContain(
    '"sdvplot/vega/logos": () => import(/* webpackChunkName: "draw-vega" */ "./generated/browser/sdvplot/vega/logos.js")',
  );
  expect(browser).toContain('export { draw } from "./draw/index.js";');
});
