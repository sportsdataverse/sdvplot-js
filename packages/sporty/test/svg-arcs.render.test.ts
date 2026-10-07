// Raster parity of the two path variants (opt-in: SDV_RENDER_TESTS=1).
import { describe, expect, test } from "vitest";
import { basketballCourt } from "../src/basketball/court.js";
import { hockeyRink } from "../src/hockey/rink.js";
import { toSVG } from "../src/svg.js";

describe.skipIf(!process.env.SDV_RENDER_TESTS)("sampled vs svg arcs rasterize alike", () => {
  test.each([
    ["nba", () => basketballCourt("nba")],
    ["nhl", () => hockeyRink("nhl")],
  ])("%s: pixelmatch < 0.5%%", async (_, build) => {
    const { Resvg } = await import("@resvg/resvg-js");
    const pixelmatch = (await import("pixelmatch")).default;
    const { PNG } = await import("pngjs");
    const render = (svg: string) =>
      PNG.sync.read(new Resvg(svg, { fitTo: { mode: "width", value: 1100 } }).render().asPng());
    const scene = build();
    const A = render(toSVG(scene, { arcs: "sampled" }));
    const B = render(toSVG(scene, { arcs: "svg" }));
    expect([B.width, B.height]).toEqual([A.width, A.height]);
    const diff = pixelmatch(A.data, B.data, undefined, A.width, A.height, { threshold: 0.1 });
    expect(diff / (A.width * A.height)).toBeLessThan(0.005);
  });
});
