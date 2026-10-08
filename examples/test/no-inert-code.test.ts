import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "vitest";
import { abs } from "../sources.js";

/** A js/ts code fence, also when indented (inside a list or a JSX block), named in full or fenced with tildes. */
const FENCE = /^[ \t]*(?:```|~~~)(?:jsx?|tsx?|javascript|typescript)\b/m;

// Hand-written docs pages show code only through <Live>, or <Snippet> for framework files the gate typechecks
// (test/snippets.test.ts): a ```ts block there would be code nothing runs or checks.
test("no hand-written docs page holds a js/ts/tsx code fence", () => {
  const offenders: string[] = [];
  const walk = (dir: string): void => {
    for (const f of readdirSync(dir, { withFileTypes: true })) {
      const p = join(dir, f.name);
      if (f.isDirectory()) {
        if (f.name !== "api" && f.name !== "gallery") walk(p);
      } else if (/\.mdx?$/.test(f.name) && FENCE.test(readFileSync(p, "utf8"))) offenders.push(p);
    }
  };
  walk(abs("docs/docs"));
  expect(offenders).toEqual([]);
});

test("the fence pattern catches indented and long-name fences, and leaves other languages alone", () => {
  for (const fence of [
    "```ts",
    '```tsx title="a.tsx"',
    "  ```ts",
    "\t```js",
    "```typescript",
    "```javascript",
    "```jsx",
    "~~~ts",
  ])
    expect(FENCE.test(`text\n${fence}\nconst a = 1;\n\`\`\`\n`), fence).toBe(true);
  for (const fence of ["```sh", "```yaml", "```json", "```bash"])
    expect(FENCE.test(`text\n${fence}\nx\n\`\`\`\n`), fence).toBe(false);
});
