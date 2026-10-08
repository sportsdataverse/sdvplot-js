import { expect, test } from "vitest";
import { basketballCourt } from "../src/basketball/court.js";
import { type SceneCanvasContext, drawScene } from "../src/canvas.js";
import { soccerPitch } from "../src/soccer/pitch.js";
import { toSVG } from "../src/svg.js";

test("toSVG and drawScene draw the same polygons", () => {
  for (const scene of [basketballCourt("nba"), soccerPitch("fifa")]) {
    let fills = 0;
    const noop = () => undefined;
    const ctx = new Proxy({} as SceneCanvasContext, {
      get: (_t, k) => (k === "fill" ? () => fills++ : noop),
      set: () => true,
    });
    drawScene(ctx, scene);
    expect(fills).toBe((toSVG(scene).match(/<path /g) ?? []).length);
    expect(fills).toBeGreaterThan(0);
  }
});
