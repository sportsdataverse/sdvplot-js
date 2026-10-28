import { NFL_TEAM_EPA_2024 } from "@sportsdataverse/examples/data";
import { loadLeague } from "@sportsdataverse/sdvplot";
import { perspectiveConfig } from "@sportsdataverse/sdvplot/perspective";
import { tableThemeSpec } from "@sportsdataverse/sdvtables";
import type { ExampleMeta } from "../../contract.js";

export const meta = {
  title:
    "Perspective's Datagrid in a registry table theme: the 2024 NFL offences by EPA per play, numbers in the theme's sign colours and numeric face",
  tags: ["perspective", "datagrid", "perspectiveConfig", "tableThemeSpec", "table", "theme", "nfl"],
} satisfies ExampleMeta;

await loadLeague("nfl");
// nflverse's 2024 regular season, best offence first: EPA per play on offence and allowed on defence, both signed
const offence = NFL_TEAM_EPA_2024.map((t) => ({
  team: t.team,
  plays: t.off_plays,
  epa_per_play: t.off_epa / t.off_plays,
  def_epa_per_play: t.def_epa / t.def_plays,
})).sort((a, b) => b.epa_per_play - a.epa_per_play);
// the NFL Next Gen Stats look: Roboto for the grid, Roboto Mono for the numbers, its red and green for the sign. No
// font file is loaded here: a reader without the faces sees the browser's fallback, in the same colours
const config = perspectiveConfig(offence, {
  teamCol: "team",
  league: "nfl",
  theme: (m) => tableThemeSpec("nfl-next-gen-stats", m),
});

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
    const table = await worker.table(offence.map((r) => ({ ...r })));
    await viewer.load(worker);
    await viewer.restore({ table: await table.get_name(), ...config });
    return () => void table.delete();
  },
  height: 520,
  label: `The 2024 NFL offences by EPA per play in Perspective's Datagrid, in the NFL Next Gen Stats table theme, best first, negative numbers red and positive green: ${offence
    .map((r) => `${r.team} ${r.epa_per_play.toFixed(3)}`)
    .join(", ")}`,
} as const;

// Perspective draws only in a browser; without JavaScript the page shows the config sdvplot hands it
export default config;
