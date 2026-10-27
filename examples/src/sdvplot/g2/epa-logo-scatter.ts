import { NFL_TEAM_EPA_2024 } from "@sportsdataverse/examples/data";
import { loadLeague } from "@sportsdataverse/sdvplot";
import { drawnMarks, logoMark } from "@sportsdataverse/sdvplot/g2";
import type { ExampleMeta } from "../../contract.js";

export const meta = {
  title: "G2: every NFL team's 2024 offence and defence by EPA per play, each team drawn as its logo",
  tags: ["g2", "logoMark", "drawnMarks", "nfl"],
} satisfies ExampleMeta;

await loadLeague("nfl");
// EPA per play from the season totals (nflverse play by play, rushes and passes); every team, so nothing to pick
const rows = NFL_TEAM_EPA_2024.map((t) => ({
  team: t.team,
  offense: t.off_epa / t.off_plays,
  defense: t.def_epa / t.def_plays,
}));
// one logo per team, 26 px tall, centred on its (offense, defense)
const logos = logoMark(rows, { x: "offense", y: "defense", team: "team", league: "nfl", size: 26 });

// In the browser: new Chart({ container, width: 640, height: 480 }), chart.options(spec()), chart.render().
export const browser = {
  lib: "g2",
  spec: () => ({
    type: "view",
    data: rows,
    // a defence that allows fewer EPA per play is better: up
    scale: { y: { range: [0, 1], nice: true }, x: { nice: true } },
    axis: {
      x: { title: "Offensive EPA per play" },
      y: { title: "Defensive EPA per play allowed (better is up)" },
    },
    children: [
      { type: "lineX", data: [0], style: { stroke: "#8c8c8c", lineDash: [4, 4] } },
      { type: "lineY", data: [0], style: { stroke: "#8c8c8c", lineDash: [4, 4] } },
      // an invisible point under each logo holds the tooltip
      {
        type: "point",
        encode: { x: "offense", y: "defense", size: 13 },
        style: { opacity: 0 },
        tooltip: {
          title: "team",
          items: [
            { field: "offense", valueFormatter: ".3f" },
            { field: "defense", valueFormatter: ".3f" },
          ],
        },
      },
      logos,
    ],
  }),
  width: 640,
  height: 480,
  label:
    "The 32 NFL teams of 2024 by offensive EPA per play (right is better) and defensive EPA per play allowed (up is better), each drawn as its logo: Baltimore the best offence, Denver the stingiest defence",
} as const;

// G2 draws only in a browser; without JavaScript the page shows what the logo mark draws: [team id, x, y, px, logo]
export default drawnMarks(logos).map(([id, x, y, size]) => ({
  id,
  offense: Number(x).toFixed(3),
  defense: Number(y).toFixed(3),
  size,
}));
