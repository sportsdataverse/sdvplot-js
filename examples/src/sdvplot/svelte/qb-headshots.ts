import { STANDINGS } from "@sportsdataverse/examples/data";
import { HEADSHOT_ASPECT, headshotUrl } from "@sportsdataverse/sdvplot";
import type { ExampleMeta } from "../../contract.js";

export const meta = {
  title:
    "Svelte + LayerChart: points scored and allowed in 2024, each team drawn as its quarterback's headshot",
  tags: ["svelte", "layerchart", "HeadshotMark", "nfl"],
} satisfies ExampleMeta;

// The STANDINGS teams' points for and against, and each starting quarterback's ESPN athlete id.
const rows = STANDINGS.map(({ team, pf, pa, qb_espn_id }) => ({ team, pf, pa, qb_espn_id }));

// In the browser: examples/snippets/svelte/QbHeadshots.svelte, mounted with these props (Svelte's mount()).
export const browser = {
  lib: "svelte",
  component: "QbHeadshots",
  props: { rows, width: 560, height: 380 },
  label:
    "Points for against points allowed for eight 2024 AFC teams, each drawn as its starting quarterback's ESPN headshot",
} as const;

// Svelte draws only in a browser here; without JavaScript the page shows each headshot the chart draws, at its aspect.
export default rows.map((r) => ({
  ...r,
  headshot: headshotUrl(r.qb_espn_id, "nfl"),
  aspect: HEADSHOT_ASPECT,
}));
