import { NFL_TEAM_EPA_2024 } from "@sportsdataverse/examples/data";
import { loadLeague } from "@sportsdataverse/sdvplot";
import { perspectiveConfig } from "@sportsdataverse/sdvplot/perspective";
import type { ExampleMeta } from "../../contract.js";

export const meta = {
  title:
    "Perspective on Pro Dark: EPA per play of every 2024 NFL offence as bars split by team, each in its colour made to read on the dark theme",
  tags: ["perspective", "y bar", "split_by", "perspectiveConfig", "dark mode", "nfl"],
} satisfies ExampleMeta;

await loadLeague("nfl");
// nflverse's 2024 regular season: each offence's EPA per play
const rows = NFL_TEAM_EPA_2024.map((t) => ({ team: t.team, epa_per_play: t.off_epa / t.off_plays }));
// a chart splits by team in sorted order and colours each series from the value column's palette; on Pro Dark
// (#242526) every team colour keeps 3:1 contrast and stays apart from the others
const config = {
  ...perspectiveConfig(rows, { teamCol: "team", league: "nfl", plugin: "Y Bar", mode: "dark" }),
  group_by: ["team"],
  split_by: ["team"],
  columns: ["epa_per_play"],
};

export const browser = {
  lib: "perspective",
  mount: async ({
    worker,
    viewer,
  }: {
    worker: import("@perspective-dev/client").Client;
    viewer: import("@perspective-dev/viewer").HTMLPerspectiveViewerElement;
  }) => {
    const table = await worker.table(rows.map((r) => ({ ...r })));
    await viewer.load(worker);
    await viewer.restore({ table: await table.get_name(), ...config });
    return () => void table.delete();
  },
  height: 480,
  label: `EPA per play of every 2024 NFL offence, a bar per team in its colour on a dark background: ${rows
    .map((r) => `${r.team} ${r.epa_per_play.toFixed(3)}`)
    .join(", ")}`,
} as const;

// Perspective draws only in a browser; without JavaScript the page shows the config sdvplot hands it
export default config;
