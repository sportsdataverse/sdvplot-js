// @vitest-environment jsdom
import * as Plot from "@observablehq/plot";
import { loadLeague } from "@sportsdataverse/sdvplot";
import { logos } from "@sportsdataverse/sdvplot/plot";
import { expect, test } from "vitest";
import { STANDINGS } from "../fixtures/standings.js";

test("sdvtables tests can render sdvplot's Plot marks from source under jsdom", async () => {
  await loadLeague("nfl");
  const svg = Plot.plot({ marks: [logos(STANDINGS, { league: "nfl", x: "wins", y: "pf", team: "team" })] });
  expect(svg.querySelectorAll("image[data-sdv-id]")).toHaveLength(8);
  await expect(import("@sportsdataverse/sdvplot/interact")).resolves.toBeTypeOf("object");
});
