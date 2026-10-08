import { readFileSync, writeFileSync } from "node:fs";
import { defineConfig } from "tsup";
import pkg from "./package.json" with { type: "json" };
export default defineConfig({
  entry: { index: "src/index.ts", html: "src/html/index.ts", react: "src/react/index.tsx" },
  external: ["@sportsdataverse/sdvplot", "react", "react/jsx-runtime", "react-dom"],
  format: ["esm"],
  dts: true,
  sourcemap: true,
  clean: true,
  target: "es2022",
  splitting: true,
  treeshake: true,
  define: { __SDVTABLES_VERSION__: JSON.stringify(pkg.version) },
  // "use client" on the react entry only (as sdvplot does): esbuild's banner would also stamp index.js, html.js and the shared chunks.
  async onSuccess() {
    writeFileSync("dist/react.js", `"use client";\n${readFileSync("dist/react.js", "utf8")}`);
    const map = JSON.parse(readFileSync("dist/react.js.map", "utf8"));
    map.mappings = `;${map.mappings}`; // shift the source map down the one prepended line
    writeFileSync("dist/react.js.map", JSON.stringify(map));
  },
});
