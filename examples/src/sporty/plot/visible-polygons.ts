import { SPORTS, leagues, surface } from "@sportsdataverse/sporty";
import { isVisiblePolygon } from "@sportsdataverse/sporty/plot";
import type { ExampleMeta } from "../../contract.js";

export const meta = {
  title: "Which features a renderer draws: isVisiblePolygon",
  tags: ["plot", "isVisiblePolygon"],
} satisfies ExampleMeta;

// A feature with a transparent fill and no stroke (or no finite points) is skipped by every renderer.
// isVisiblePolygon is that rule, for code that draws a scene itself.
export default Object.fromEntries(
  SPORTS.map((sport) => {
    const league = leagues(sport).find((l) => l !== "custom") ?? "";
    const polygons = surface(sport, league).features.filter((f) => f.kind === "polygon");
    const drawn = polygons.filter(isVisiblePolygon).length;
    return [`${sport} ${league}`, `${drawn} of ${polygons.length} polygons drawn`];
  }),
);
