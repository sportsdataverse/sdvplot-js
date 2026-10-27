import { ScatterChart } from "@mui/x-charts/ScatterChart";
import { NFL_TEAM_EPA_2024 } from "@sportsdataverse/examples/data";
import { loadLeague } from "@sportsdataverse/sdvplot";
import { logoMarker } from "@sportsdataverse/sdvplot/mui";
import type { ExampleMeta } from "../../contract.js";

export const meta = {
  title: "MUI X Charts: every NFL team's 2024 offence and defence EPA per play, each point its team's logo",
  tags: ["react", "mui-x-charts", "scatter", "logoMarker", "nfl"],
} satisfies ExampleMeta;

await loadLeague("nfl");
// all 32 teams, in the data's order: point i is NFL_TEAM_EPA_2024[i], so its team is teams[i]
if (NFL_TEAM_EPA_2024.length !== 32) throw new Error(`${NFL_TEAM_EPA_2024.length} teams, not 32`);
const teams = NFL_TEAM_EPA_2024.map((t) => t.team);
const points = NFL_TEAM_EPA_2024.map((t) => ({
  x: t.off_epa / t.off_plays,
  y: t.def_epa / t.def_plays,
}));
// built once, at module scope: a new slot on every render would remount the points
const marker = logoMarker({ league: "nfl", teams });
const perPlay = (v: number | null) => (v === null ? "" : v.toFixed(3));

export default (
  <ScatterChart
    width={640}
    height={460}
    skipAnimation
    margin={{ top: 16, right: 24 }}
    xAxis={[{ label: "offence: EPA per play", valueFormatter: perPlay }]}
    // a defence wants negative EPA: the best defences sit at the top
    yAxis={[{ label: "defence: EPA per play allowed", reverse: true, valueFormatter: perPlay, width: 72 }]}
    // markerSize is the logo's half-height in px: 24 px logos
    series={[
      {
        data: points,
        markerSize: 12,
        valueFormatter: (p, { dataIndex }) =>
          `${teams[dataIndex]}: offence ${perPlay(p.x)}, defence ${perPlay(p.y)}`,
      },
    ]}
    slots={{ marker }}
  />
);
