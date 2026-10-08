import { describe, expect, test } from "vitest";
import { basketballCourt } from "../src/basketball/court.js";
import { drawScene } from "../src/canvas.js";
import type { Scene } from "../src/scene.js";

const napi = await import("@napi-rs/canvas").catch(() => undefined);

describe.skipIf(napi === undefined)("drawScene on @napi-rs/canvas", () => {
  test("renders the NBA court: wood off the lines, black inside the division line, opaque background", () => {
    if (napi === undefined) return;
    const canvas = napi.createCanvas(2200, 1200);
    const ctx = canvas.getContext("2d");
    drawScene(ctx, basketballCourt("nba"), { width: 2200, background: "#ffffff" });
    const px = (x: number, y: number) => [...ctx.getImageData(x, y, 1, 1).data];
    expect(px(900, 200).slice(0, 3)).toEqual([0xd2, 0xab, 0x6f]); // (-10, 20) ft: half-court wood, clear of every line
    expect(px(1100, 600).slice(0, 3)).toEqual([0x00, 0x00, 0x00]); // inside the division line
    expect(px(10, 10)[3]).toBe(255);
  });

  test("composes with the caller's transform: scale(2,2) + width 1100 paints the same pixels as width 2200, and the transform is restored", () => {
    if (napi === undefined) return;
    // strokes are one CALLER pixel (1/scale), so two device pixels here; drop them to compare fills exactly
    const nba = basketballCourt("nba");
    const unstroked = ({ stroke: _s, ...rest }: Extract<Scene["features"][number], { kind: "polygon" }>) =>
      rest;
    const scene: Scene = {
      ...nba,
      features: nba.features.map((f) => (f.kind === "polygon" ? unstroked(f) : f)),
    };
    const ref = napi.createCanvas(2200, 1200).getContext("2d");
    drawScene(ref, scene, { width: 2200, background: "#ffffff" });
    const canvas = napi.createCanvas(2200, 1200);
    const ctx = canvas.getContext("2d");
    ctx.scale(2, 2);
    const size = drawScene(ctx, scene, { width: 1100, background: "#ffffff" });
    expect(size).toEqual({ width: 1100, height: 600, scale: 10 }); // in the caller's units
    const m = ctx.getTransform();
    expect([m.a, m.b, m.c, m.d, m.e, m.f]).toEqual([2, 0, 0, 2, 0, 0]); // the caller's transform, restored
    const a = ref.getImageData(0, 0, 2200, 1200).data;
    const b = ctx.getImageData(0, 0, 2200, 1200).data;
    let diff = 0;
    for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) diff++;
    expect(diff).toBe(0);
  });
});
