import { marks } from "@sportsdataverse/sdvplot";
import type { ExampleMeta } from "../../contract.js";

export const meta = {
  title: "Every archived mark for one team (the full manifest)",
  tags: ["marks", "network", "nfl"],
} satisfies ExampleMeta;

// `full: true` downloads the CDN manifest once per process (about 18 MB); the default reads the bundled shard.
const rows = await marks("LV", "nfl", { full: true });
export default rows.map((r) => `${r.mark_type} ${r.variant} ${r.valid_from ?? "…"}-${r.valid_to ?? "…"}`);
