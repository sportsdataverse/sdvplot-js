import { SwarmPlot } from "@nivo/swarmplot";
import { NFL_TEAM_EPA_2024 } from "@sportsdataverse/examples/data";
import { loadLeague } from "@sportsdataverse/sdvplot";
import { logoNode } from "@sportsdataverse/sdvplot/nivo";
import type { ExampleMeta } from "../../contract.js";

export const meta = {
  title: "nivo: every NFL team's 2024 EPA per play on offense and on defense, each node the team's logo",
  tags: ["react", "nivo", "swarmplot", "logoNode", "nfl"],
} satisfies ExampleMeta;

await loadLeague("nfl");
// EPA per play = total EPA / plays, from nflverse's 2024 regular season; one node per team per side of the ball.
const nodes = NFL_TEAM_EPA_2024.flatMap((t) => [
  { id: `${t.team} offense`, team: t.team, side: "offense", epa: t.off_epa / t.off_plays },
  { id: `${t.team} defense`, team: t.team, side: "defense", epa: t.def_epa / t.def_plays },
]);

export default (
  <SwarmPlot
    width={640}
    height={360}
    data={nodes}
    groups={["offense", "defense"]}
    groupBy="side"
    id="id"
    value="epa"
    valueFormat=">+.3f"
    valueScale={{ type: "linear", min: -0.25, max: 0.25 }}
    layout="horizontal"
    size={22}
    animate={false}
    margin={{ top: 16, right: 24, bottom: 48, left: 72 }}
    axisTop={null}
    axisRight={null}
    axisBottom={{ legend: "EPA per play", legendPosition: "middle", legendOffset: 36 }}
    // each node is drawn as its team's logo, as tall as the node (size); the team comes from the datum's team field
    circleComponent={logoNode({ league: "nfl", team: "team" })}
  />
);
