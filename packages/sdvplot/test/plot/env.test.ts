// @vitest-environment jsdom
import * as Plot from "@observablehq/plot";
import { SPORTY_D3_SUBPATH } from "@sportsdataverse/sporty/d3";
import { SPORTY_PLOT_SUBPATH } from "@sportsdataverse/sporty/plot";
import { expect, test } from "vitest";
import { PLOT_SUBPATH } from "../../src/plot/index.js";

test("Plot renders an image mark under jsdom and the subpath resolves", () => {
  const svg = Plot.plot({
    marks: [Plot.image([{ x: 1, y: 2, u: "https://example.test/a.png" }], { x: "x", y: "y", src: "u" })],
  });
  expect(svg.querySelectorAll("image")).toHaveLength(1);
  expect(svg.querySelector("image")?.getAttribute("href")).toBe("https://example.test/a.png");
  expect(PLOT_SUBPATH).toBe("@sportsdataverse/sdvplot/plot");
});

test("sporty subpaths resolve to source without a sporty build", () => {
  expect(SPORTY_PLOT_SUBPATH).toBe("@sportsdataverse/sporty/plot");
  expect(SPORTY_D3_SUBPATH).toBe("@sportsdataverse/sporty/d3");
});
