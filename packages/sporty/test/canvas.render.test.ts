import { describe, expect, test } from "vitest";
import { basketballCourt } from "../src/basketball/court.js";
import { drawScene } from "../src/canvas.js";

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
});
