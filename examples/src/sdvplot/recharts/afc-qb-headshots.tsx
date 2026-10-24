import { STANDINGS } from "@sportsdataverse/examples/data";
import { headshotDot } from "@sportsdataverse/sdvplot/recharts";
import { CartesianGrid, Scatter, ScatterChart, XAxis, YAxis } from "recharts";
import type { ExampleMeta } from "../../contract.js";

export const meta = {
  title:
    "Recharts: points scored and allowed in 2024, each team drawn as its starting quarterback's headshot",
  tags: ["react", "recharts", "headshotDot", "nfl"],
} satisfies ExampleMeta;

// ESPN headshot URLs are built from the id alone, so no league data has to load first.
export default (
  <ScatterChart width={520} height={360} margin={{ top: 24, right: 32, bottom: 24, left: 8 }}>
    <CartesianGrid stroke="#e2e2e2" />
    <XAxis dataKey="pf" type="number" domain={[270, 540]} name="Points for" />
    <YAxis dataKey="pa" type="number" domain={[280, 450]} name="Points against" reversed />
    <Scatter
      data={[...STANDINGS]}
      isAnimationActive={false}
      shape={headshotDot({ player: "qb_espn_id", league: "nfl", size: 40 })}
    />
  </ScatterChart>
);
