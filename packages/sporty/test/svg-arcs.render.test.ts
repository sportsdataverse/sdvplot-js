// Raster parity of the two path variants (opt-in: SDV_RENDER_TESTS=1).
import { describe, expect, test } from "vitest";
import { basketballCourt } from "../src/basketball/court.js";
import { hockeyRink } from "../src/hockey/rink.js";
import { soccerPitch } from "../src/soccer/pitch.js";
import { toSVG } from "../src/svg.js";

const WIDTH = 1100;
/** Absolute cap: a dropped net is ~150 px and a dropped penalty mark ~7 px at this width; anti-aliasing noise is < 15 px. */
const MAX_DIFF_PX = 50;

describe.skipIf(!process.env.SDV_RENDER_TESTS)("sampled vs svg arcs rasterize alike", () => {
  test.each([
    { name: "nba", build: () => basketballCourt("nba") },
    { name: "fiba", build: () => basketballCourt("fiba") },
    { name: "nhl", build: () => hockeyRink("nhl") },
    { name: "fifa", build: () => soccerPitch("fifa") },
  ])(`$name: pixelmatch < 0.5% and <= ${MAX_DIFF_PX} px`, async ({ name, build }) => {
    const { Resvg } = await import("@resvg/resvg-js");
    const pixelmatch = (await import("pixelmatch")).default;
    const { PNG } = await import("pngjs");
    const render = (svg: string) =>
      PNG.sync.read(new Resvg(svg, { fitTo: { mode: "width", value: WIDTH } }).render().asPng());
    const scene = build();
    const A = render(toSVG(scene, { arcs: "sampled" }));
    const B = render(toSVG(scene, { arcs: "svg" }));
    expect([B.width, B.height]).toEqual([A.width, A.height]);
    const diff = pixelmatch(A.data, B.data, undefined, A.width, A.height, { threshold: 0.1 });
    console.log(`render ${name}: ${diff} differing px of ${A.width}x${A.height}`);
    expect(diff / (A.width * A.height)).toBeLessThan(0.005);
    expect(diff).toBeLessThanOrEqual(MAX_DIFF_PX);
  });
});
