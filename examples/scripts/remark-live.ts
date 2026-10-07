// Loaded by docs/docusaurus.config.ts (jiti) as well as by tsx and vitest: keep it free of relative value imports.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { Prerendered } from "../src/contract.js";

/** Markup above this is served as a static file: an inline 450 KB rink would ship twice (page HTML + its JS chunk). */
export const INLINE_LIMIT = 65_536;
/** Where pages.ts writes a large output, under docs/static (and so its URL path). */
export const staticFile = (row: Pick<Prerendered, "id" | "markup">): string =>
  `examples/${row.id}.${/^\s*<svg\b/.test(row.markup) ? "svg" : "html"}`;

interface Attribute {
  type: string;
  name?: string;
  value?: unknown;
}
interface MdNode {
  type: string;
  name?: string | null;
  attributes?: Attribute[];
  children?: MdNode[];
}
const attr = (name: string, value: string): Attribute => ({ type: "mdxJsxAttribute", name, value });

/**
 * remark plugin: give every `<Live id="…"/>` its prerendered output (examples/out/<id>.json) as props at MDX
 * compile time, so the static HTML already holds the figure, table or value. An unknown id, a computed id or the
 * same id twice on one page fails the docs build.
 */
export default function remarkLive(o: { outDir: string }): (tree: MdNode, file: { path?: string }) => void {
  return (tree, file) => {
    const where = file.path ?? "an MDX file";
    const seen = new Set<string>();
    const visit = (n: MdNode): void => {
      if ((n.type === "mdxJsxFlowElement" || n.type === "mdxJsxTextElement") && n.name === "Live") {
        const id = n.attributes?.find((a) => a.type === "mdxJsxAttribute" && a.name === "id")?.value;
        if (typeof id !== "string") throw new Error(`${where}: <Live> needs a literal id="…"`);
        if (seen.has(id)) throw new Error(`${where}: <Live id="${id}"> appears twice; ids double as DOM ids`);
        seen.add(id);
        let row: Prerendered;
        try {
          row = JSON.parse(readFileSync(join(o.outDir, `${id}.json`), "utf8"));
        } catch {
          throw new Error(
            `${where}: no prerendered example "${id}" (run pnpm --filter @sportsdataverse/examples prerender)`,
          );
        }
        const output =
          row.markup.length > INLINE_LIMIT ? attr("src", `/${staticFile(row)}`) : attr("markup", row.markup);
        n.attributes = [
          ...(n.attributes ?? []),
          output,
          attr("kind", row.kind),
          attr("code", row.code),
          attr("lang", row.lang),
          attr("title", row.title),
        ];
      }
      for (const c of n.children ?? []) visit(c);
    };
    visit(tree);
  };
}
