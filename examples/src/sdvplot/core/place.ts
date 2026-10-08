import { STANDINGS } from "@sportsdataverse/examples/data";
import { place, placeSync } from "@sportsdataverse/sdvplot";
import type { ExampleMeta } from "../../contract.js";

export const meta = {
  title: "Placements: a point, its image, its aspect",
  tags: ["place", "logos", "nfl"],
} satisfies ExampleMeta;

const three = STANDINGS.slice(0, 3);
const xs = three.map((s) => s.pf);
const ys = three.map((s) => s.pa);
const ts = three.map((s) => s.team);
// What every logo mark draws: one entry per drawable row (any other renderer can use it too).
const logos = await place(xs, ys, ts, { league: "nfl" });
const wordmarks = placeSync(xs, ys, ts, { league: "nfl", kind: "wordmark" }); // loaded by place()

export default {
  logos: logos.map((p) => ({ id: p.id, x: p.x, y: p.y, aspect: p.aspect, url: p.url })),
  wordmarks: wordmarks.map((p) => ({ id: p.id, aspect: p.aspect, url: p.url })),
};
