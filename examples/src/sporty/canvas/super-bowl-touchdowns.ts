import { createCanvas } from "@napi-rs/canvas";
import { SUPER_BOWL_LIX_TDS } from "@sportsdataverse/examples/data";
import { loadLeague, teamColorsSync } from "@sportsdataverse/sdvplot";
import { surface } from "@sportsdataverse/sdvplot/plot";
import { toSurfaceFrame } from "@sportsdataverse/sporty";
import { drawScene } from "@sportsdataverse/sporty/canvas";
import type { ExampleMeta } from "../../contract.js";

export const meta = {
  title:
    "Canvas: Super Bowl LIX's touchdowns, line of scrimmage to the end zone, on an Eagles-painted field (a PNG in Node)",
  tags: [
    "node",
    "canvas",
    "drawScene",
    "surface",
    "toSurfaceFrame",
    "espn-football-0-100",
    "png",
    "football",
    "nfl",
  ],
} satisfies ExampleMeta;

await loadLeague("nfl");
// Philadelphia was the home team: both end zones in its colours.
const { scene } = surface("nfl", { team: "PHI" });
// ESPN's 0-100 yardline from Philadelphia's goal line, as yards from midfield: PHI scores at +50, KC at -50.
const tds = toSurfaceFrame(SUPER_BOWL_LIX_TDS, { from: "espn-football-0-100", x: "yardline" });

const width = 800;
const [x0, y0, x1, y1] = scene.bbox;
const height = Math.round((width * (y1 - y0)) / (x1 - x0));
const canvas = createCanvas(width, height);
const ctx = canvas.getContext("2d");
const { scale } = drawScene(ctx, scene, { width });
const px = (x: number) => (x - x0) * scale;
const py = (y: number) => (y1 - y) * scale;

// ESPN gives no lateral position, so each touchdown gets its own lane across the field, in game order.
tds.forEach((t, i) => {
  const from = Number(t.surface_x);
  const to = t.team === "PHI" ? 50 : -50;
  const lane = py(20 - (40 * i) / (tds.length - 1));
  // the arrowhead is 10px, or the whole arrow when a short touchdown (a 1-yard plunge is ~7px here) is shorter
  const head = Math.sign(to - from) * Math.min(10, Math.abs(px(to) - px(from)));
  ctx.strokeStyle = ctx.fillStyle = teamColorsSync("nfl", t.team, { which: "secondary" }) ?? "#ffffff";
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(px(from), lane);
  ctx.lineTo(px(to) - head, lane);
  ctx.stroke();
  ctx.beginPath(); // the arrowhead on the goal line
  ctx.moveTo(px(to), lane);
  ctx.lineTo(px(to) - head, lane - 7);
  ctx.lineTo(px(to) - head, lane + 7);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath(); // the line of scrimmage
  ctx.arc(px(from), lane, 6, 0, 2 * Math.PI);
  ctx.fill();
});

const png = canvas.toBuffer("image/png").toString("base64");
export default `<img src="data:image/png;base64,${png}" width="${width}" height="${height}" alt="Super Bowl LIX's six offensive touchdowns as arrows from the line of scrimmage to the goal line on an Eagles-painted field, three Philadelphia arrows to the right, three Kansas City arrows to the left, each in its team's secondary colour">`;
