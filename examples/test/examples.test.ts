import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { expect, test } from "vitest";
import { BROWSER } from "../src/browser.gen.js";
import type { Prerendered } from "../src/contract.js";
import { EXAMPLES } from "../src/registry.gen.js";
import { problems, runExample } from "./run.js";

/** Set by scripts/prerender.ts: the gate's outputs become the docs' static markup. Unset in `pnpm test`. */
const OUT = process.env.SDV_EXAMPLES_OUT;

test("the registry is not empty", () => {
  expect(EXAMPLES.length).toBeGreaterThan(0);
});

test.each(EXAMPLES.map((e) => [e.id, e] as const))("%s runs offline and draws", async (_id, entry) => {
  const r = await runExample(entry);
  expect(problems(entry, r)).toEqual([]);
  expect(r.browser, "a browser export, as gen.ts read it").toBe(entry.id in BROWSER);
  if (OUT === undefined) return;
  const row: Prerendered = {
    ...entry,
    kind: r.kind,
    markup: r.markup,
    ...(r.browser ? { browser: true } : {}),
  };
  const file = join(OUT, `${entry.id}.json`);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, `${JSON.stringify(row, null, 1)}\n`);
});
