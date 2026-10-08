import { STANDINGS } from "@sportsdataverse/examples/data";
import { loadLeague, logoUrlSync } from "@sportsdataverse/sdvplot";
import { type PlotlyLayout, embedSources, withLogos } from "@sportsdataverse/sdvplot/plotly";
import type { ExampleMeta } from "../../contract.js";

export const meta = {
  title: "Plotly: layout images as data URIs, for Plotly's static export (embedSources)",
  tags: ["network", "plotly", "embedSources", "withLogos", "nfl"],
} satisfies ExampleMeta;

await loadLeague("nfl");
// The AFC West's two playoff teams of 2024.
const rows = STANDINGS.filter((s) => s.division === "West" && s.wins >= 11).map((s) => ({ ...s }));
// A figure saved to a file (JSON, an HTML page) shows its logos offline only if their bytes travel with it.
const embed = await embedSources(rows.flatMap((r) => logoUrlSync(r.team, "nfl") ?? []));
const layout: PlotlyLayout = {};
const data = [{ type: "scatter", mode: "markers", x: rows.map((r) => r.pf), y: rows.map((r) => r.pa) }];
const figure = withLogos({ data, layout }, rows, {
  league: "nfl",
  x: "pf",
  y: "pa",
  team: "team",
  height: 0.25,
  embed,
});

// Each layout image's source is now the PNG itself (shown cut short; the full figure goes to Plotly.newPlot).
export default (figure.layout.images ?? []).map((im) => ({
  "points for, against": `${im.x}, ${im.y}`,
  source: `${im.source.slice(0, 48)}… (${im.source.length} characters)`,
}));
