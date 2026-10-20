import { AFC_WEEKS_2024 } from "@sportsdataverse/examples/data";
import { loadLeague } from "@sportsdataverse/sdvplot";
import { teamColorPalette } from "@sportsdataverse/sdvplot/svelte";
import type { ExampleMeta } from "../../contract.js";

export const meta = {
  title:
    "Svelte + LayerChart: the AFC West's 2024 standings week by week, a logo at the end of each team's line",
  tags: ["svelte", "layerchart", "LogoMark", "teamColorPalette", "nfl"],
} satisfies ExampleMeta;

await loadLeague("nfl");
// The AFC West, picked by team from the week-by-week results (a margin per week; null is the bye).
const teams = ["KC", "LAC", "DEN", "LV"];
const seasons = teams.map((team) => AFC_WEEKS_2024.find((s) => s.team === team));
// Each team's record after every week: wins (a tie counts half), then point differential for the rank. Ties in
// both are broken by name: a plain ranking, not the NFL's tiebreakers.
const rows = Array.from({ length: 18 }, (_, i) => {
  const records = seasons.map((s, t) => {
    const played = (s?.margins ?? []).slice(0, i + 1).filter((m): m is number => m !== null);
    const wins = played.reduce((n, m) => n + (m > 0 ? 1 : m === 0 ? 0.5 : 0), 0);
    return { team: teams[t] as string, wins, diff: played.reduce((n, m) => n + m, 0) };
  });
  records.sort((a, b) => b.wins - a.wins || b.diff - a.diff || a.team.localeCompare(b.team));
  return records.map((r, rank) => ({ team: r.team, week: i + 1, rank: rank + 1 }));
}).flat();

// In the browser: examples/snippets/svelte/BumpChart.svelte, mounted with these props (Svelte's mount()).
export const browser = {
  lib: "svelte",
  component: "BumpChart",
  props: { rows, teams, width: 640, height: 320 },
  label:
    "The AFC West's division rank after each week of 2024: Kansas City first from week 3 on, each line in its team's colour and ending in its logo",
} as const;

// Svelte draws only in a browser here; without JavaScript the page shows the final week and each team's colour.
const colors = teamColorPalette("nfl", teams, { background: "#ffffff" });
export default rows.filter((r) => r.week === 18).map((r) => ({ ...r, color: colors[teams.indexOf(r.team)] }));
