import { Headshot } from "@sportsdataverse/sdvplot/react";
import type { ExampleMeta } from "../../contract.js";

export const meta = {
  title: '<Headshot fallback="initials"/>: a face, and initials where there is no headshot',
  tags: ["react", "Headshot", "initials", "nfl"],
} satisfies ExampleMeta;

// Brian Thomas Jr. by ESPN athlete id: his headshot. Pete Guerrerio by nflverse gsis id: nflverse's players table
// (players.parquet, 2026-10-08) has no headshot and no ESPN id for him, so there is no URL, and fallback="initials"
// shows "PG" with nothing to download. An image that fails to load falls back the same way.
export default (
  <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
    <Headshot playerId="4432773" league="nfl" name="Brian Thomas Jr." fallback="initials" height={80} />
    <Headshot
      playerId="00-0036454"
      league="nfl"
      idSystem="gsis"
      name="Pete Guerrerio"
      fallback="initials"
      height={80}
    />
  </div>
);
