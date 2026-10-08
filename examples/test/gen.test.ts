import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import ts from "typescript";
import { expect, test } from "vitest";
import { codeOf, docModule, extractDocExamples, metaOf } from "../scripts/lib.js";

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
