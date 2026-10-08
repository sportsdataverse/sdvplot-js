import { STANDINGS } from "@sportsdataverse/examples/data";
import { useTeamColors } from "@sportsdataverse/sdvplot/react";
import type { ReactElement } from "react";
import type { ExampleMeta } from "../../contract.js";

export const meta = {
  title: "useTeamColors: swatches from a hook",
  tags: ["react", "useTeamColors", "colors", "nfl"],
} satisfies ExampleMeta;

function Swatches(): ReactElement | null {
  // { team: "#hex" } for the whole league; undefined until the league has loaded.
  const primary = useTeamColors("nfl");
  const secondary = useTeamColors("nfl", { which: "secondary" });
  if (primary === undefined || secondary === undefined) return null;
  return (
    <svg width={STANDINGS.length * 44} height={88} role="img" aria-label="AFC team colours">
      {STANDINGS.map((s, i) =>
        [primary, secondary].map((colors, row) => (
          <rect
            key={`${s.team}-${row}`}
            x={i * 44 + 2}
            y={row * 44 + 2}
            width={40}
            height={40}
            fill={colors[s.team] ?? "grey"}
          >
            <title>{`${s.team} ${colors[s.team] ?? "unknown"}`}</title>
          </rect>
        )),
      )}
    </svg>
  );
}

export default <Swatches />;
