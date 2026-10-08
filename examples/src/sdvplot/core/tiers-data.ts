import { STANDINGS } from "@sportsdataverse/examples/data";
import {
  TIERS_SUBTITLE,
  TIER_DESC,
  TIER_THEMES,
  loadLeague,
  prepareTiers,
  wrapLabel,
} from "@sportsdataverse/sdvplot";
import type { ExampleMeta } from "../../contract.js";

export const meta = {
  title: "Tier data without a chart library",
  tags: ["tiers", "prepareTiers", "nfl"],
} satisfies ExampleMeta;

await loadLeague("nfl");
// Tier by SRS rank (ranks 1 to 8 in tier 1, 9 to 16 in tier 2, ...): teamTiers draws exactly these numbers.
const rows = STANDINGS.map((s) => ({ team: s.team, tier_no: Math.ceil(s.srs_rank / 8) }));
const t = prepareTiers(rows, "nfl", { presort: true, theme: "light" });

export default {
  points: t.x.map((x, i) => `${t.labels[i]}: tier ${t.y[i]}, rank ${x}`),
  breakLabels: t.breakLabels,
  title: t.title,
  TIERS_SUBTITLE,
  TIER_DESC,
  "TIER_THEMES.light": TIER_THEMES.light,
  "wrapLabel('What are they doing?')": wrapLabel("What are they doing?"),
};
