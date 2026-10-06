import { defineConfig } from "tsup";
import pkg from "./package.json" with { type: "json" };

export default defineConfig({
  entry: { index: "src/index.ts", svg: "src/svg.ts", "specs/index": "src/specs/index.ts" },
  format: ["esm"],
  dts: true,
  sourcemap: true,
  clean: true,
  target: "es2022",
  splitting: true,
  treeshake: true,
  define: { __SPORTY_VERSION__: JSON.stringify(pkg.version) },
});
