import { expect, test } from "vitest";
import { basketballCourt } from "../src/basketball/court.js";
import { type SceneCanvasContext, drawScene } from "../src/canvas.js";
import { InputError } from "../src/errors.js";
import { isVisiblePolygon } from "../src/scene.js";

function fakeCtx() {
  const calls: string[] = [];
  const rec =
    (name: string) =>
    (...a: unknown[]) => {
      calls.push(`${name}(${a.map((v) => (typeof v === "number" ? v.toFixed(3) : String(v))).join(",")})`);
    };
  const ctx = {
    calls,
    fillStyle: "",
    strokeStyle: "",
    lineWidth: 0,
    font: "",
    textAlign: "start",
    textBaseline: "alphabetic",
    save: rec("save"),
    restore: rec("restore"),
    transform: rec("transform"),
    beginPath: rec("beginPath"),
    moveTo: rec("moveTo"),
    lineTo: rec("lineTo"),
    closePath: rec("closePath"),
    fill: rec("fill"),
    stroke: rec("stroke"),
    fillRect: rec("fillRect"),
    fillText: rec("fillText"),
    translate: rec("translate"),
    rotate: rec("rotate"),
    scale: rec("scale"),
    measureText: (t: string) => ({ width: t.length * 10 }),
  } as SceneCanvasContext & { calls: string[] };
  return ctx;
}
const paths = (c: { calls: string[] }): number => c.calls.filter((x) => x === "beginPath()").length;

test("drawScene: transform flips y and anchors the bbox; one path per visible polygon; size follows the aspect", () => {
  const scene = basketballCourt("nba");
  const ctx = fakeCtx();
  const size = drawScene(ctx, scene, { width: 1100 });
  expect(size).toEqual({ width: 1100, height: 600, scale: 10 });
  // composes with (never replaces) the caller's transform, inside save/restore
  expect(ctx.calls.slice(0, 2)).toEqual(["save()", "transform(10.000,0.000,0.000,-10.000,550.000,300.000)"]);
  expect(ctx.calls.at(-1)).toBe("restore()");
  expect(ctx.calls.filter((c) => c === "save()").length).toBe(
    ctx.calls.filter((c) => c === "restore()").length,
  );
  const visible = scene.features.filter(
    (f) => f.kind === "polygon" && isVisiblePolygon(f) && f.points.length >= 2,
  );
  expect(paths(ctx)).toBe(visible.length);
  expect(ctx.calls.filter((c) => c === "fill()").length).toBe(visible.length);
  expect(ctx.calls.filter((c) => c.startsWith("moveTo")).length).toBe(visible.length);
});

test("hidden fill is skipped; stroke is one device pixel; background paints the bbox; a scale alone sizes the box", () => {
  const ctx = fakeCtx();
  drawScene(ctx, basketballCourt("nba", { colorUpdates: { net: "#00000000" } }), {
    width: 550,
    background: "#ffffff",
  });
  expect(ctx.calls[2]).toBe("fillRect(-55.000,-30.000,110.000,60.000)");
  const full = fakeCtx();
  drawScene(full, basketballCourt("nba"), { width: 550 });
  expect(paths(ctx)).toBe(paths(full) - 2);
  const ctx2 = fakeCtx();
  const s2 = drawScene(ctx2, basketballCourt("nba"), { scale: 4 });
  expect(s2).toEqual({ width: 440, height: 240, scale: 4 });
  const ctx3 = fakeCtx();
  drawScene(
    ctx3,
    {
      ...basketballCourt("nba"),
      features: [
        {
          kind: "polygon",
          name: "x",
          zIndex: 0,
          fill: "#000000",
          stroke: "#ff0000",
          points: [
            [0, 0],
            [1, 0],
            [1, 1],
          ],
        },
      ],
    },
    { width: 110 },
  );
  expect(ctx3.lineWidth).toBeCloseTo(1, 12);
  expect(ctx3.calls.filter((c) => c === "stroke()").length).toBe(1);
});

test("text features are drawn un-flipped, rotated, centred and shrunk to the fit box", () => {
  const ctx = fakeCtx();
  drawScene(
    ctx,
    {
      sport: "football",
      league: "nfl",
      units: "yd",
      origin: "center",
      bbox: [-10, -10, 10, 10],
      features: [
        {
          kind: "text",
          name: "n",
          zIndex: 0,
          fill: "#ffffff",
          x: 1,
          y: 2,
          text: "10",
          fontFamily: "Clarendon-Regular",
          fitBox: [4, 6],
          rotation: 180,
        },
      ],
    },
    { width: 200 },
  );
  expect(ctx.calls).toContain("translate(1.000,2.000)");
  expect(ctx.calls).toContain(`rotate(${Math.PI.toFixed(3)})`);
  expect(ctx.calls).toContain("scale(1.000,-1.000)");
  expect(ctx.calls).toContain("fillText(10,0.000,0.000)");
  expect(ctx.textAlign).toBe("center");
  expect(ctx.textBaseline).toBe("middle");
  expect(ctx.font).toBe("1.2px Clarendon-Regular");
});

test("width and height together fit the scene into the box (either aspect) and report the drawn size", () => {
  const nba = basketballCourt("nba"); // 110 x 60 ft
  const wide = drawScene(fakeCtx(), nba, { width: 800, height: 100 });
  expect(wide).toEqual({ width: 183, height: 100, scale: 100 / 60 });
  const tall = drawScene(fakeCtx(), nba, { width: 100, height: 800 });
  expect(tall).toEqual({ width: 100, height: 55, scale: 100 / 110 });
  const ctx = fakeCtx();
  drawScene(ctx, nba, { width: 800, height: 100 });
  expect(ctx.calls[1]).toBe(
    `transform(${(100 / 60).toFixed(3)},0.000,0.000,${(-100 / 60).toFixed(3)},91.667,50.000)`,
  );
});

test("an empty bbox (basketball custom) throws InputError naming the sport and league instead of NaN sizes", () => {
  const custom = basketballCourt("custom");
  expect(custom.bbox).toEqual([0, 0, 0, 0]);
  expect(() => drawScene(fakeCtx(), custom)).toThrow(InputError);
  expect(() => drawScene(fakeCtx(), custom)).toThrow(/basketball "custom"/);
});
