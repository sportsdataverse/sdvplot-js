import { defineConfig } from "vitest/config";
import { ALIASES, DEFINES, abs } from "./sources.js";

/**
 * What the docs' webpack resolves for a docs component (docs/plugins/sdv-examples.ts, and Docusaurus' own modules
 * as stubs), so a test can render one (test/live.test.tsx).
 */
const DOCS = [
  { find: /^@sportsdataverse\/examples\/(loaders|browser)$/, replacement: abs("examples/src/$1.gen.ts") },
  { find: /^@(docusaurus|theme)\/.+$/, replacement: abs("examples/test/docusaurus-stub.ts") },
];

export default defineConfig({
  resolve: { alias: [...ALIASES, ...DOCS] },
  define: DEFINES,
  esbuild: { jsx: "automatic" }, // the docs' tsconfig is not react-jsx, the examples' is
  test: {
    globalSetup: ["./test/global-setup.ts"],
    environment: "jsdom",
    testTimeout: 120_000,
    hookTimeout: 120_000,
    include: ["test/**/*.test.ts", "test/**/*.test.tsx"],
  },
});
