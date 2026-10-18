import { NBA_STANDINGS } from "@sportsdataverse/examples/data";
import { contrast, loadLeague } from "@sportsdataverse/sdvplot";
import { withTeamSeries } from "@sportsdataverse/sdvplot/uplot";
import type { ExampleMeta } from "../../contract.js";

export const meta = {
  title:
    "uPlot: the 2023-24 Pacific's series colours on a light and a dark chart, each at 3:1 contrast or better",
  tags: ["uplot", "withTeamSeries", "contrast", "dark mode", "nba"],
} satisfies ExampleMeta;

await loadLeague("nba");
type Series = { label?: string; stroke?: string };
// one series per team (series[0] is uPlot's x), coloured from one row per team
const series: Series[] = [{ label: "Game" }, ...NBA_STANDINGS.map((s) => ({ label: `${s.city} ${s.team}` }))];
const rows = NBA_STANDINGS.map((s) => ({ team: s.team }));
const strokes = (background: string): string[] =>
  withTeamSeries({ series }, rows, { team: "team", league: "nba", background })
    .series.slice(1)
    .map((s) => s.stroke ?? "");

// uPlot draws on a transparent canvas: give withTeamSeries the colour behind it, and a team colour that would not
// read there gives way to the team's other colour, or is lightened (dark) or darkened (light) until it does.
const light = strokes("#ffffff");
const dark = strokes("#181a1b");
export default NBA_STANDINGS.map((s, i) => ({
  team: s.team,
  light: light[i],
  dark: dark[i],
  darkContrast: Math.round(contrast(dark[i] ?? "", "#181a1b") * 10) / 10,
}));
