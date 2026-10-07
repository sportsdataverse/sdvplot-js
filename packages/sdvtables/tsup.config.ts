import { defineConfig } from "tsup";
import pkg from "./package.json" with { type: "json" };
export default defineConfig({
  entry: { index: "src/index.ts", html: "src/html/index.ts" },
  external: ["@sportsdataverse/sdvplot"],
  format: ["esm"],
  dts: true,
  sourcemap: true,
  clean: true,
  target: "es2022",
  splitting: true,
  treeshake: true,
  define: { __SDVTABLES_VERSION__: JSON.stringify(pkg.version) },
});
