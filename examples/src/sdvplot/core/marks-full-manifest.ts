import { marks } from "@sportsdataverse/sdvplot";
import type { ExampleMeta } from "../../contract.js";

export const meta = {
  title: "Every archived mark for one team (the full manifest; shown here from a test fixture)",
  tags: ["marks", "network", "nfl"],
} satisfies ExampleMeta;

// `full: true` downloads the CDN manifest once per process (about 18 MB); the default reads the bundled shard.
// The output on this page was prerendered offline, where MANIFEST_URL answers from the 66-row test fixture
// (fixtures/sdvplot/manifest_sample.csv), not the real file, which may list more.
const rows = await marks("LV", "nfl", { full: true });
export default rows.map((r) => `${r.mark_type} ${r.variant} ${r.valid_from ?? "…"}-${r.valid_to ?? "…"}`);
