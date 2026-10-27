import { nflPlays2024 } from "@sportsdataverse/examples/data";
import { loadLeague } from "@sportsdataverse/sdvplot";
import { type PerspectiveSchema, perspectiveConfig } from "@sportsdataverse/sdvplot/perspective";
import type { ExampleMeta } from "../../contract.js";

export const meta = {
  title:
    "Streaming into Perspective: 11,778 plays of the 2024 NFL season replayed a week at a time with table.update, each offence's total EPA growing in its colour",
  tags: ["perspective", "streaming", "table.update", "play-by-play", "perspectiveConfig", "nfl"],
} satisfies ExampleMeta;

await loadLeague("nfl");
// nflverse's 2024 play-by-play, weeks 1 to 6: the rush and pass plays, a batch per week
const plays = (await nflPlays2024()).map((p) => ({
  play: p.play,
  week: p.week,
  posteam: p.posteam,
  defteam: p.defteam,
  epa: p.epa,
}));
const weeks = [...new Set(plays.map((p) => p.week))].sort((a, b) => a - b);
const batches = weeks.map((w) => plays.filter((p) => p.week === w));
// the table starts empty, so its types are given: the same schema goes to Perspective and to sdvplot
const schema: PerspectiveSchema = {
  play: "string",
  week: "integer",
  posteam: "string",
  defteam: "string",
  epa: "float",
};
const config = {
  ...perspectiveConfig(plays, { teamCol: "posteam", league: "nfl", plugin: "Y Bar", schema }),
  group_by: ["posteam"],
  split_by: ["posteam"],
  columns: ["epa"],
  aggregates: { epa: "sum" as const },
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
    const table = await worker.table(schema, { index: "play" });
    await viewer.load(worker);
    await viewer.restore({ table: await table.get_name(), ...config });
    // a week's plays every 0.8 s, as a live feed would send them: the bars grow as each batch lands
    let next = 0;
    const timer = setInterval(() => {
      const batch = batches[next++];
      if (batch === undefined) return clearInterval(timer);
      void table.update(batch.map((p) => ({ ...p })));
    }, 800);
    return () => {
      clearInterval(timer);
      void table.delete();
    };
  },
  height: 480,
  label: `The 2024 NFL season's first ${weeks.length} weeks replayed into Perspective a week at a time: each offence's total EPA as a bar in its colour, growing with each batch of plays (${batches
    .map((b, i) => `week ${weeks[i]}: ${b.length} plays`)
    .join(", ")})`,
} as const;

// Perspective draws only in a browser; without JavaScript the page shows each batch and the config
export default { batches: batches.map((b, i) => ({ week: weeks[i], plays: b.length })), config };
