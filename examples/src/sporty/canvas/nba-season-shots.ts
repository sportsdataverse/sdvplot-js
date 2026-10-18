import { createCanvas } from "@napi-rs/canvas";
import { BKN_SHOTS_2026 } from "@sportsdataverse/examples/data";
import { loadLeague, teamColorsSync } from "@sportsdataverse/sdvplot";
import { surface } from "@sportsdataverse/sdvplot/plot";
import { toSurfaceFrame } from "@sportsdataverse/sporty";
import { drawScene } from "@sportsdataverse/sporty/canvas";
import type { ExampleMeta } from "../../contract.js";

export const meta = {
  title: "Canvas: 2,000 Brooklyn shots on a Nets-painted half court (a PNG in Node)",
  tags: ["node", "canvas", "drawScene", "surface", "toSurfaceFrame", "png", "basketball", "nba"],
} satisfies ExampleMeta;

await loadLeague("nba");
// sdvplot's surface paints sporty's NBA court in a team's colours; `.scene` is the plain sporty scene drawScene takes.
const { scene } = surface("nba", { team: "BKN", displayRange: "defense" });
// Release rows: x_legacy/y_legacy in tenths of a foot from the hoop, which the nba-legacy frame turns into court feet.
const shots = toSurfaceFrame(
  BKN_SHOTS_2026.map((s) => ({ ...s })),
  { from: "nba-legacy" },
);

const width = 640;
const [x0, y0, x1, y1] = scene.bbox;
const height = Math.round((width * (y1 - y0)) / (x1 - x0));
const canvas = createCanvas(width, height);
const ctx = canvas.getContext("2d");
const { scale } = drawScene(ctx, scene, { width });

// drawScene maps a scene point (x, y) to ((x - x0) * scale, (y1 - y) * scale): the same sum puts each shot on it.
// Thousands of points are where a canvas beats an SVG: one bitmap, not one element per shot.
const made = teamColorsSync("nba", "BKN", { which: "secondary" }) ?? "#ffffff";
ctx.globalAlpha = 0.55;
for (const s of shots) {
  ctx.beginPath();
  ctx.arc((Number(s.surface_x) - x0) * scale, (y1 - Number(s.surface_y)) * scale, 3, 0, 2 * Math.PI);
  ctx.fillStyle = s.shot_result === "Made" ? made : "#e15759";
  ctx.fill();
}

const png = canvas.toBuffer("image/png").toString("base64");
export default `<img src="data:image/png;base64,${png}" width="${width}" height="${height}" alt="Brooklyn's first 2,000 shots of 2025-26 on the defensive half of a Nets-painted court, made shots in the team's secondary colour, misses red">`;
