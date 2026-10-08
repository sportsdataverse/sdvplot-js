import { defineConfig } from "vitest/config";
import { ALIASES, DEFINES } from "./sources.js";

export default defineConfig({
  resolve: { alias: ALIASES },
  define: DEFINES,
  test: {
    globalSetup: ["./test/global-setup.ts"],
    environment: "jsdom",
    testTimeout: 120_000,
    hookTimeout: 120_000,
    include: ["test/**/*.test.ts", "test/**/*.test.tsx"],
  },
});
