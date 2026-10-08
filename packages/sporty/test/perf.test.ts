import { expect, test } from "vitest";
import { basketballCourt } from "../src/basketball/court.js";
import { toSVG } from "../src/svg.js";

const median = (f: () => void) => {
  for (let i = 0; i < 5; i++) f();
  const t: number[] = [];
  for (let i = 0; i < 10; i++) {
    const s = performance.now();
    f();
    t.push(performance.now() - s);
  }
  return t.sort((a, b) => a - b)[5]!;
};

test.skipIf(process.env.CI)(
  "basketballCourt(nba, 200) builds in < 50 ms and toSVG renders in < 20 ms (median of 10; local baseline only)",
  () => {
    const build = median(() => basketballCourt("nba", { arcResolution: 200 }));
    const scene = basketballCourt("nba", { arcResolution: 200 });
    const svg = median(() => toSVG(scene));
    const svgArcs = median(() => toSVG(scene, { arcs: "svg" }));
    console.info(
      `perf: build ${build.toFixed(2)} ms, toSVG ${svg.toFixed(2)} ms, toSVG(arcs:"svg") ${svgArcs.toFixed(2)} ms`,
    );
    expect(build).toBeLessThan(50);
    expect(svg).toBeLessThan(20);
  },
);
