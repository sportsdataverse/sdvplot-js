import { createCanvas } from "@napi-rs/canvas";
import { surface } from "@sportsdataverse/sporty";
import { drawScene } from "@sportsdataverse/sporty/canvas";
import type { ExampleMeta } from "../../contract.js";

export const meta = {
  title: "Canvas: drawScene, here to a PNG in Node",
  tags: ["node", "canvas", "drawScene", "png", "soccer", "epl"],
} satisfies ExampleMeta;

// drawScene paints a scene on any 2D context: a browser <canvas> (canvas.getContext("2d")) or, in Node,
// @napi-rs/canvas. Size the canvas from the scene's bbox; drawScene returns the size it drew.
const pitch = surface("soccer", "epl");
const [x0, y0, x1, y1] = pitch.bbox;
const width = 640;
const height = Math.round((width * (y1 - y0)) / (x1 - x0));

const canvas = createCanvas(width, height);
// For a sharp HiDPI canvas: a canvas dpr times larger, ctx.scale(dpr, dpr), then the same call.
const drawn = drawScene(canvas.getContext("2d"), pitch, { width });

const png = canvas.toBuffer("image/png").toString("base64");
export default `<img src="data:image/png;base64,${png}" width="${drawn.width}" height="${drawn.height}" alt="An EPL pitch painted by drawScene">`;
