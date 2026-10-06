import { defineConfig } from "tsup";
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
});
