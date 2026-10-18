import { createCanvas } from "@napi-rs/canvas";
import { WC2018_FINAL_FRANCE_PASSES } from "@sportsdataverse/examples/data";
import { frameBottomLeft, surface, toSurfaceFrame } from "@sportsdataverse/sporty";
import { drawScene } from "@sportsdataverse/sporty/canvas";
import type { ExampleMeta } from "../../contract.js";

export const meta = {
  title:
    "Canvas: France's completed first-half passes in the 2018 World Cup final, a pass map on a 105 x 68 pitch (a PNG in Node)",
  tags: [
    "node",
    "canvas",
    "drawScene",
    "frameBottomLeft",
    "toSurfaceFrame",
    "png",
    "soccer",
    "fifa",
    "statsbomb",
  ],
} satisfies ExampleMeta;

// SPADL metres from the bottom-left corner, France attacking left to right, onto sporty's FIFA pitch at that size.
const frame = frameBottomLeft(105, 68);
// Each pass's start and end in pitch metres from the centre spot (surface_x, surface_y), row for row.
const starts = toSurfaceFrame(WC2018_FINAL_FRANCE_PASSES, { from: frame, x: "start_x", y: "start_y" });
const ends = toSurfaceFrame(WC2018_FINAL_FRANCE_PASSES, { from: frame, x: "end_x", y: "end_y" });
const pitch = surface("soccer", "fifa", { updates: { pitch_length: 105, pitch_width: 68 } });

const width = 760;
const [x0, y0, x1, y1] = pitch.bbox;
const height = Math.round((width * (y1 - y0)) / (x1 - x0));
const canvas = createCanvas(width, height);
const ctx = canvas.getContext("2d");
// `background` replaces the scene's own turf for this call only: a darker green, so the passes read.
const { scale } = drawScene(ctx, pitch, { width, background: "#2f6b3a" });
const px = (x: number) => (x - x0) * scale;
const py = (y: number) => (y1 - y) * scale;

ctx.strokeStyle = ctx.fillStyle = "#ffd23f";
ctx.lineWidth = 1.5;
starts.forEach((s, i) => {
  const e = ends[i];
  const [ax, ay] = [px(Number(s.surface_x)), py(Number(s.surface_y))];
  const [bx, by] = [px(Number(e?.surface_x)), py(Number(e?.surface_y))];
  const angle = Math.atan2(by - ay, bx - ax);
  ctx.beginPath();
  ctx.moveTo(ax, ay);
  ctx.lineTo(bx, by);
  ctx.stroke();
  ctx.beginPath(); // a 7 px arrowhead at the receiver
  ctx.moveTo(bx, by);
  ctx.lineTo(bx - 7 * Math.cos(angle - 0.4), by - 7 * Math.sin(angle - 0.4));
  ctx.lineTo(bx - 7 * Math.cos(angle + 0.4), by - 7 * Math.sin(angle + 0.4));
  ctx.closePath();
  ctx.fill();
});

const png = canvas.toBuffer("image/png").toString("base64");
export default `<img src="data:image/png;base64,${png}" width="${width}" height="${height}" alt="France's 75 completed first-half passes in the 2018 World Cup final as yellow arrows on a dark green pitch, France attacking left to right. Data: StatsBomb open data (match 8658), as socceraction SPADL.">`;
