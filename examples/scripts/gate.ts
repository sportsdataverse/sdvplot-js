import { mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import type { Task } from "vitest";
import { startVitest } from "vitest/node";
import type { Prerendered } from "../src/contract.js";
import { overLimit, staticFile, svgDocument } from "./remark-live.js";

export { svgDocument };

export interface PrerenderOptions {
  /** The vitest root (the examples package). */
  readonly root: string;
  /** The test files to run, relative to `root`. */
  readonly files: readonly string[];
  /** Where the gate writes `<id>.json` (`SDV_EXAMPLES_OUT`); emptied first. */
  readonly out: string;
  /** docs/static: an output over INLINE_LIMIT is written here as the file remark-live points `<Live src>` at. */
  readonly static: string;
}

const tests = (t: Task): Task[] => (t.type === "suite" ? t.tasks.flatMap(tests) : [t]);

/**
 * The gate IS the prerenderer: the same run that proves every example works writes what the docs serve. Throws
 * when any test fails (or did not run), so the docs are never built from a failing gate.
 */
export async function prerender(o: PrerenderOptions): Promise<void> {
  rmSync(o.out, { recursive: true, force: true });
  const vitest = await startVitest("test", [...o.files], {
    root: o.root,
    run: true,
    watch: false,
    env: { SDV_EXAMPLES_OUT: o.out },
  });
  if (vitest === undefined) throw new Error("prerender: vitest did not start");
  const files = vitest.state.getFiles();
  const failed = files
    .flatMap((f) => f.tasks.flatMap(tests))
    .filter((t) => t.result?.state === "fail").length;
  const broken = vitest.state.getFailedFilepaths().length;
  await vitest.close();
  if (failed > 0 || broken > 0 || process.exitCode)
    throw new Error(
      `prerender: ${failed} example(s) failed in ${broken} file(s); the docs are never built from a failing gate`,
    );
  // Over-limit outputs become static files (the directory staticFile() names); stale ones go first.
  rmSync(join(o.static, "examples"), { recursive: true, force: true });
  for (const rel of readdirSync(o.out, { recursive: true, encoding: "utf8" })) {
    if (!rel.endsWith(".json")) continue;
    const row: Prerendered = JSON.parse(readFileSync(join(o.out, rel), "utf8"));
    if (!overLimit(row.markup)) continue;
    const file = join(o.static, staticFile(row));
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, file.endsWith(".svg") ? svgDocument(row.markup) : row.markup);
  }
}
