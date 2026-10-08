import { STANDINGS } from "@sportsdataverse/examples/data";
import { defineTable } from "@sportsdataverse/sdvtables";
import { renderHTMLAsync } from "@sportsdataverse/sdvtables/html";
import type { ExampleMeta } from "../../contract.js";

export const meta = {
  title: "significance: stars from a p-value column",
  tags: ["decoration", "significance", "gt_significance"],
} satisfies ExampleMeta;

// p: an exact two-sided binomial test of each record against a coin flip (no ties in these rows).
const choose = (n: number, k: number): number => (k === 0 ? 1 : (choose(n, k - 1) * (n - k + 1)) / k);
function pVs500(w: number, l: number): number {
  let tail = 0;
  for (let k = Math.max(w, l); k <= w + l; k++) tail += choose(w + l, k) / 2 ** (w + l);
  return Math.min(1, 2 * tail);
}
const rows = STANDINGS.map((r) => ({
  ...r,
  win_share: r.wins / (r.wins + r.losses),
  p: pVs500(r.wins, r.losses),
}));
const spec = defineTable<(typeof rows)[number]>()
  .columns((c) => [
    c.logo("team", { league: "nfl" }),
    c.pct("win_share", { label: "Win %" }),
    c.num("p", { label: "p vs .500", digits: 3 }),
  ])
  .significance([{ estimate: "win_share", p: "p" }], { hideP: false })
  .title("8 AFC teams, 2024: which records beat a coin flip?")
  .build();
export default await renderHTMLAsync(spec, rows);
