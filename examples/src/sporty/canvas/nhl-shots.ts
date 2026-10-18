import { createCanvas } from "@napi-rs/canvas";
import { NHL_SHOTS } from "@sportsdataverse/examples/data";
import { loadLeague, teamColorsSync } from "@sportsdataverse/sdvplot";
import { surface } from "@sportsdataverse/sdvplot/plot";
import { drawScene } from "@sportsdataverse/sporty/canvas";
import type { ExampleMeta } from "../../contract.js";

export const meta = {
  title:
    "Canvas: game 7 of the 2024 Stanley Cup Final's first-period shots on a Panthers-painted rink (a PNG in Node)",
  tags: ["node", "canvas", "drawScene", "surface", "teamColor", "png", "hockey", "nhl"],
} satisfies ExampleMeta;

await loadLeague("nhl");
// The home team's rink: boards and centre-ice markings in Florida's colours.
const { scene } = surface("nhl", { team: "FLA" });
const [x0, y0, x1, y1] = scene.bbox;
const width = 800;
const height = Math.round((width * (y1 - y0)) / (x1 - x0));
const canvas = createCanvas(width, height);
const ctx = canvas.getContext("2d");
const { scale } = drawScene(ctx, scene, { width });

// NHL api-web shots are already rink feet from centre ice, sporty's frame: only drawScene's own mapping is needed.
const color = { EDM: teamColorsSync("nhl", "EDM"), FLA: teamColorsSync("nhl", "FLA") };
for (const s of NHL_SHOTS) {
  const goal = s.type === "goal";
  ctx.beginPath();
  ctx.arc((s.x - x0) * scale, (y1 - s.y) * scale, goal ? 11 : 6, 0, 2 * Math.PI);
  ctx.fillStyle = s.type === "missed-shot" ? "#ffffff" : (color[s.team] ?? "#555555");
  ctx.fill();
  ctx.lineWidth = goal ? 3 : 1.5;
  ctx.strokeStyle = goal ? "#111111" : (color[s.team] ?? "#555555");
  ctx.stroke();
}

const png = canvas.toBuffer("image/png").toString("base64");
export default `<img src="data:image/png;base64,${png}" width="${width}" height="${height}" alt="The 27 first-period shots of Edmonton at Florida, 24 June 2024, on a Panthers-painted rink: shots on goal filled in the shooting team's colour, misses white, the goal larger and ringed">`;
