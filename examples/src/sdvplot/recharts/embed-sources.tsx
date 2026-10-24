import { STANDINGS } from "@sportsdataverse/examples/data";
import { loadLeague, logoUrlSync } from "@sportsdataverse/sdvplot";
import { embedSources, logoDot } from "@sportsdataverse/sdvplot/recharts";
import { Scatter, ScatterChart, XAxis, YAxis } from "recharts";
import type { ExampleMeta } from "../../contract.js";

export const meta = {
  title: "Recharts: logos inlined as data URIs, so a saved copy of the SVG shows them offline (embedSources)",
  tags: ["react", "network", "recharts", "embedSources", "logoDot", "nfl"],
} satisfies ExampleMeta;

await loadLeague("nfl");
// The AFC West's two playoff teams of 2024.
const rows = STANDINGS.filter((s) => s.division === "West" && s.wins >= 11).map((s) => ({ ...s }));

// embedSources fetches each distinct URL once and maps it to a data URI; with `embed`, each <image> carries its
// bytes instead of a link, so the chart's SVG is one self-contained file.
const embed = await embedSources(rows.flatMap((r) => logoUrlSync(r.team, "nfl") ?? []));

export default (
  <ScatterChart width={420} height={320} margin={{ top: 24, right: 32, bottom: 24, left: 8 }}>
    <XAxis dataKey="pf" type="number" domain={[370, 420]} name="Points for" />
    <YAxis dataKey="pa" type="number" domain={[290, 340]} name="Points against" />
    <Scatter
      data={rows}
      isAnimationActive={false}
      shape={logoDot({ team: "team", league: "nfl", size: 64, embed })}
    />
  </ScatterChart>
);
