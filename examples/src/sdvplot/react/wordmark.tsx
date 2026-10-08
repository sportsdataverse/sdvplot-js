import { STANDINGS } from "@sportsdataverse/examples/data";
import { Wordmark } from "@sportsdataverse/sdvplot/react";
import type { ExampleMeta } from "../../contract.js";

export const meta = {
  title: "<Wordmark/> for every AFC team",
  tags: ["react", "Wordmark", "nfl"],
} satisfies ExampleMeta;

export default (
  <div style={{ display: "flex", flexWrap: "wrap", gap: 16, alignItems: "center" }}>
    {STANDINGS.map((s) => (
      <Wordmark key={s.team} team={s.team} league="nfl" size={28} />
    ))}
  </div>
);
