import { readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";
import ts from "typescript";
import { expect, test } from "vitest";
import { abs } from "../sources.js";

/**
 * examples/snippets holds the framework files the guides show through <Snippet file="…">, code the docs cannot run
 * under jsdom (an Astro page, a Svelte island, a Next client component). `pnpm typecheck` covers the .ts/.tsx ones
 * (tsconfig include); this typechecks the TypeScript inside the .astro and .svelte ones, so none of them can rot.
 */
const DIR = abs("examples/snippets");
const files = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((f) =>
    f.isDirectory() ? files(join(dir, f.name)) : [join(dir, f.name)],
  );

/** The TypeScript of a framework file: an Astro component's frontmatter, a Svelte component's `<script lang="ts">`. */
function scriptOf(file: string, text: string): string | undefined {
  if (file.endsWith(".astro")) return /^---\r?\n([\s\S]*?)\r?\n---/.exec(text)?.[1];
  if (file.endsWith(".svelte")) return /<script lang="ts">([\s\S]*?)<\/script>/.exec(text)?.[1];
  return undefined;
}

// What the frameworks declare for these files: Astro's global, Svelte 5's runes and component modules.
const AMBIENT = `
declare const Astro: { props: any; params: Record<string, string | undefined> };
declare function $props(): any;
declare function $state<T>(initial: T): T;
declare function $state<T>(): T | undefined;
declare function $effect(fn: () => void | (() => void)): void;
declare module "*.svelte" { const component: unknown; export default component; }
`;

test("the TypeScript in every .astro and .svelte snippet typechecks", () => {
  const config = ts.getParsedCommandLineOfConfigFile(
    abs("examples/tsconfig.json"),
    {},
    {
      ...ts.sys,
      onUnRecoverableConfigFileDiagnostic: (d) => {
        throw new Error(ts.flattenDiagnosticMessageText(d.messageText, "\n"));
      },
    },
  );
  if (config === undefined) throw new Error("no examples/tsconfig.json");
  // each script becomes <file>.ts beside the original, so its relative imports resolve as they would in the app
  const slash = (p: string): string => p.replace(/\\/g, "/"); // TypeScript names files with forward slashes
  const virtual = new Map<string, string>([[slash(join(DIR, "__ambient.d.ts")), AMBIENT]]);
  for (const f of files(DIR)) {
    const script = scriptOf(f, readFileSync(f, "utf8"));
    if (script !== undefined) virtual.set(slash(`${f}.ts`), `${script}\nexport {};\n`);
  }
  expect(virtual.size).toBeGreaterThan(2);
  const host = ts.createCompilerHost(config.options);
  const { getSourceFile, fileExists, readFile } = host;
  const at = (p: string): string | undefined => virtual.get(slash(p));
  host.fileExists = (p) => at(p) !== undefined || fileExists(p);
  host.readFile = (p) => at(p) ?? readFile(p);
  host.getSourceFile = (p, v, ...rest) => {
    const text = at(p);
    return text === undefined ? getSourceFile(p, v, ...rest) : ts.createSourceFile(p, text, v);
  };
  const program = ts.createProgram([...virtual.keys()], { ...config.options, noEmit: true }, host);
  const errors = ts
    .getPreEmitDiagnostics(program)
    .filter((d) => d.file === undefined || at(d.file.fileName) !== undefined)
    .map((d) => {
      const where = d.file
        ? `${relative(DIR, d.file.fileName)}:${d.file.getLineAndCharacterOfPosition(d.start ?? 0).line + 1}`
        : "";
      return `${where} ${ts.flattenDiagnosticMessageText(d.messageText, " ")}`;
    });
  expect(errors).toEqual([]);
});

test("every snippet is shown by a docs page, and every <Snippet file> names a snippet", () => {
  const pages = files(abs("docs/docs")).filter((p) => /\.mdx$/.test(p) && !/[\\/](api|gallery)[\\/]/.test(p));
  const named = pages.flatMap((p) =>
    [...readFileSync(p, "utf8").matchAll(/<Snippet\b[^>]*?\bfile=(["'])(.+?)\1/g)].map((m) => m[2] ?? ""),
  );
  const have = files(DIR).map((f) => relative(DIR, f).replace(/\\/g, "/"));
  expect([...new Set(named)].sort()).toEqual(have.sort());
});
