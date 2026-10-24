// Writes fixtures/deckgl/shared.json, the shared deck.gl / pydeck fixture (built by deckgl-fixture.ts). Copy it
// byte-identical to sdvplot's tests/fixtures/deckgl_shared.json and update the sha256 pinned in both repos' tests.
//   pnpm --filter @sportsdataverse/sporty build && pnpm oracle:deckgl
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { deckglSharedFixture } from "./deckgl-fixture.js";

const out = resolve("fixtures/deckgl/shared.json");
const text = await deckglSharedFixture();
mkdirSync(resolve("fixtures/deckgl"), { recursive: true });
writeFileSync(out, text);
const f = JSON.parse(text);
console.log(
  `wrote ${out}: ${f.layers.length} layers, ${f.surfaces.length} surfaces, ${f.palettes.length} palettes`,
);
console.log(`warnings: ${f.warnings.length}`);
