import { startVitest } from "vitest/node";
import { abs } from "../sources.js";

/**
 * Regenerates docs/static/img/sdvtables-export-afc.png, the image guides/export.mdx shows: runs sdvtables' render test
 * of examples/snippets/export/standings-png.ts under SDV_RENDER_TESTS=1 and copies the snippet's first PNG there. Needs
 * playwright's Chromium (`pnpm --filter @sportsdataverse/sdvtables exec playwright install chromium`).
 */
const file = abs("docs/static/img/sdvtables-export-afc.png");
process.exitCode = undefined;
const vitest = await startVitest("test", ["test/export-render.test.ts"], {
  root: abs("packages/sdvtables"),
  run: true,
  watch: false,
  testNamePattern: "export guide's snippet",
  env: { SDV_RENDER_TESTS: "1", SDV_EXPORT_GUIDE_PNG: file },
});
await vitest?.close();
if (process.exitCode) process.exit(process.exitCode);
console.log(`export-png: wrote ${file}`);
