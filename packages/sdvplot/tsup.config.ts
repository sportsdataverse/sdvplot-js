import { readFileSync, writeFileSync } from "node:fs";
import { defineConfig } from "tsup";
import pkg from "./package.json" with { type: "json" };

export default defineConfig({
  entry: { index: "src/index.ts", react: "src/react/index.tsx" },
  external: ["react", "react/jsx-runtime"],
  format: ["esm"],
  dts: true,
  sourcemap: true,
  clean: true,
  target: "es2022",
  splitting: true,
  treeshake: true,
  define: { __SDVPLOT_VERSION__: JSON.stringify(pkg.version) },
  // "use client" on the react entry only: esbuild's banner would also stamp index.js and the shared chunk.
  async onSuccess() {
    writeFileSync("dist/react.js", `"use client";\n${readFileSync("dist/react.js", "utf8")}`);
    const map = JSON.parse(readFileSync("dist/react.js.map", "utf8"));
    map.mappings = `;${map.mappings}`; // shift the source map down the one prepended line
    writeFileSync("dist/react.js.map", JSON.stringify(map));
  },
});
