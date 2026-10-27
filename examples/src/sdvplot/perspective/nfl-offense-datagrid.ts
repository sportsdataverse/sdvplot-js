import { NFL_TEAM_EPA_2024 } from "@sportsdataverse/examples/data";
import { loadLeague } from "@sportsdataverse/sdvplot";
import { perspectiveConfig, perspectiveLogoColumn } from "@sportsdataverse/sdvplot/perspective";
import type { ExampleMeta } from "../../contract.js";

export const meta = {
  title:
    "Perspective's Datagrid: the 2024 NFL offences by EPA per play, each team's cell in its own colour and its logo as a link",
  tags: ["perspective", "datagrid", "perspectiveConfig", "perspectiveLogoColumn", "table", "nfl"],
} satisfies ExampleMeta;

await loadLeague("nfl");
// nflverse's 2024 regular season, best offence first: the grid hands each team its colour in this order
const offence = NFL_TEAM_EPA_2024.map((t) => ({
  team: t.team,
  plays: t.off_plays,
  epa_per_play: t.off_epa / t.off_plays,
  def_epa_per_play: t.def_epa / t.def_plays,
})).sort((a, b) => b.epa_per_play - a.epa_per_play);
// a logo URL column right after the team (the Datagrid draws no images: it shows a URL as a link)
const rows = perspectiveLogoColumn(offence, "team", { league: "nfl" });
const config = perspectiveConfig(rows, { teamCol: "team", league: "nfl", logoCol: "team_logo" });

// In the browser: the rows as a Perspective table, the viewer bound to it, and sdvplot's config restored
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
    // the logo links last: a URL is wide, and the numbers stay in view
    await viewer.restore({
      table: await table.get_name(),
      ...config,
      columns: ["team", "plays", "epa_per_play", "def_epa_per_play", "team_logo"],
    });
    return () => void table.delete();
  },
  height: 520,
  label: `The 2024 NFL offences by EPA per play in Perspective's Datagrid, best first, each team's cell in its own colour: ${rows
    .map((r) => `${r.team} ${r.epa_per_play.toFixed(3)}`)
    .join(", ")}`,
} as const;

// Perspective draws only in a browser; without JavaScript the page shows the config sdvplot hands it
export default config;
