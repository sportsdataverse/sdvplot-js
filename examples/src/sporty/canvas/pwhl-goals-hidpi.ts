import { createCanvas } from "@napi-rs/canvas";
import { PWHL_GOALS } from "@sportsdataverse/examples/data";
import { loadLeague, teamColorsSync } from "@sportsdataverse/sdvplot";
import { surface } from "@sportsdataverse/sdvplot/plot";
import { toSurfaceFrame } from "@sportsdataverse/sporty";
import { drawScene } from "@sportsdataverse/sporty/canvas";
import type { ExampleMeta } from "../../contract.js";

export const meta = {
  title:
    "Canvas: PWHL Boston at Montreal's goals on a Montreal-painted rink, drawn at 2x for HiDPI (a PNG in Node)",
  tags: [
    "node",
    "canvas",
    "drawScene",
    "surface",
    "toSurfaceFrame",
    "hockeytech",
    "hidpi",
    "png",
    "hockey",
    "pwhl",
  ],
} satisfies ExampleMeta;

await loadLeague("pwhl");
// sdvplot knows PWHL teams by their HockeyTech team id (and full name), not by an abbreviation.
const HOCKEYTECH_ID = { BOS: "1", MTL: "3" } as const;
const { scene } = surface("pwhl", { team: HOCKEYTECH_ID.MTL });
// HockeyTech's 600 x 300 pixel canvas (y down) as rink feet from centre ice.
const goals = toSurfaceFrame(PWHL_GOALS, { from: "hockeytech" });

// A sharp canvas on a 2x screen: a bitmap dpr times larger, ctx.scale(dpr, dpr), then the same calls in CSS pixels.
// drawScene composes its transform with the caller's, so the scale applies to the rink and to the goals alike.
const dpr = 2;
const width = 720;
const [x0, y0, x1, y1] = scene.bbox;
const height = Math.round((width * (y1 - y0)) / (x1 - x0));
const canvas = createCanvas(width * dpr, height * dpr);
const ctx = canvas.getContext("2d");
ctx.scale(dpr, dpr);
const { scale } = drawScene(ctx, scene, { width });

for (const g of goals) {
  ctx.beginPath();
  ctx.arc((Number(g.surface_x) - x0) * scale, (y1 - Number(g.surface_y)) * scale, 9, 0, 2 * Math.PI);
  ctx.fillStyle = teamColorsSync("pwhl", HOCKEYTECH_ID[g.team]) ?? "#555555";
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = "#ffffff";
  ctx.stroke();
}

const png = canvas.toBuffer("image/png").toString("base64");
// The 2x bitmap shown at its CSS size: twice the pixels in the same box.
export default `<img src="data:image/png;base64,${png}" width="${width}" height="${height}" alt="The four goals of PWHL Boston at Montreal, 2 March 2024, on a Montreal-painted rink, each in its scoring team's colour">`;
