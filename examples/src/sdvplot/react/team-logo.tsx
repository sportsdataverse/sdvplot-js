import { STANDINGS } from "@sportsdataverse/examples/data";
import { TeamLogo } from "@sportsdataverse/sdvplot/react";
import type { ExampleMeta } from "../../contract.js";

export const meta = {
  title: "<TeamLogo/> for every AFC team",
  tags: ["react", "TeamLogo", "nfl"],
} satisfies ExampleMeta;

export default (
  <div style={{ display: "flex", gap: 8 }}>
    {STANDINGS.map((s) => (
      <TeamLogo key={s.team} team={s.team} league="nfl" size={40} />
    ))}
  </div>
);
