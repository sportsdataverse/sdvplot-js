import { defineConfig } from "vitest/config";
import pkg from "./package.json" with { type: "json" };
export default defineConfig({
  define: { __SDVTABLES_VERSION__: JSON.stringify(pkg.version) },
  test: { include: ["test/**/*.test.ts"], typecheck: { enabled: true, include: ["test/**/*.test-d.ts"] } },
});
