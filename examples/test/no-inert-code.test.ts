import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "vitest";
import { abs } from "../sources.js";

// Hand-written docs pages show code only through <Live>: a ```ts block there would be code nothing runs.
test("no hand-written docs page holds a js/ts/tsx code fence", () => {
  const offenders: string[] = [];
  const walk = (dir: string): void => {
    for (const f of readdirSync(dir, { withFileTypes: true })) {
      const p = join(dir, f.name);
      if (f.isDirectory()) {
        if (f.name !== "api" && f.name !== "gallery") walk(p);
      } else if (/\.mdx?$/.test(f.name) && /^```(?:js|jsx|ts|tsx)\b/m.test(readFileSync(p, "utf8")))
        offenders.push(p);
    }
  };
  walk(abs("docs/docs"));
  expect(offenders).toEqual([]);
});
