import { existsSync, readFileSync, readdirSync, unlinkSync, writeFileSync } from "node:fs";
import { defineConfig } from "tsup";
import pkg from "./package.json" with { type: "json" };

export default defineConfig({
  entry: {
    index: "src/index.ts",
    react: "src/react/index.tsx",
    plot: "src/plot/index.ts",
    d3: "src/d3/index.ts",
    chartjs: "src/chartjs.ts",
    testing: "src/testing/index.ts",
  },
  external: [
    "react",
    "react/jsx-runtime",
    "@observablehq/plot",
    "d3",
    "chart.js",
    "@sportsdataverse/sporty",
    "@sportsdataverse/sporty/plot",
    "@sportsdataverse/sporty/d3",
  ],
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
    // No source maps for the generated data chunks (src/data/**): nothing to debug there, and they would be most of the tarball.
    for (const f of readdirSync("dist").filter((n) => n.endsWith(".js.map"))) {
      const sources: string[] = JSON.parse(readFileSync(`dist/${f}`, "utf8")).sources;
      if (!sources.length || !sources.every((s) => s.includes("/src/data/"))) continue;
      unlinkSync(`dist/${f}`);
      const js = `dist/${f.slice(0, -4)}`;
      // tsup appends its own copy of the comment after esbuild's, so strip every occurrence.
      writeFileSync(js, readFileSync(js, "utf8").replace(/^\/\/# sourceMappingURL=.*\n?/gm, ""));
    }
    // A dangling map reference makes every consumer's bundler warn on import: assert none survived.
    for (const f of readdirSync("dist").filter((n) => n.endsWith(".js")))
      for (const m of readFileSync(`dist/${f}`, "utf8").matchAll(/^\/\/# sourceMappingURL=(\S+)/gm))
        if (!existsSync(`dist/${m[1]}`)) throw new Error(`dist/${f} references a missing source map ${m[1]}`);
  },
});
