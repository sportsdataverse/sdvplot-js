import { svelte } from "@sveltejs/vite-plugin-svelte";
import { svelteTesting } from "@testing-library/svelte/vite";
import { configDefaults, defineConfig } from "vitest/config";
import base from "./vitest.config.js";

/**
 * The ./svelte layer's tests: Svelte compiles the components, and under jsdom the `browser` condition picks Svelte's
 * client runtime. Its own project (vitest.workspace.ts), so the rest of sdvplot keeps Node's resolution.
 */
export default defineConfig({
  plugins: [svelte(), svelteTesting()],
  resolve: { ...base.resolve, conditions: ["browser"] },
  ssr: { resolve: { conditions: [] } }, // a Node-environment test (svelte-env) server-renders: no browser condition
  define: base.define,
  test: {
    ...base.test,
    name: "sdvplot-svelte",
    environment: "jsdom",
    include: ["test/svelte/**/*.test.ts"],
    exclude: configDefaults.exclude,
    setupFiles: ["test/svelte/setup.ts"],
    typecheck: { enabled: false }, // the main project runs the type tests
  },
});
