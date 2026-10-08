// @vitest-environment jsdom
import * as Plot from "@observablehq/plot";
import { loadLeague } from "@sportsdataverse/sdvplot";
import { highlight } from "@sportsdataverse/sdvplot/interact";
import { logos } from "@sportsdataverse/sdvplot/plot";
import { expect, test } from "vitest";
import { STANDINGS } from "../fixtures/standings.js";

test("sdvtables tests can render sdvplot's Plot marks from source under jsdom, and link them", async () => {
  await loadLeague("nfl");
  const svg = Plot.plot({ marks: [logos(STANDINGS, { league: "nfl", x: "wins", y: "pf", team: "team" })] });
  const ids = Array.from(svg.querySelectorAll("image[data-sdv-id]"), (img) =>
    img.getAttribute("data-sdv-id"),
  );
  expect(ids).toHaveLength(8);
  // the interact subpath resolves to sdvplot's source and lights exactly the logo it names
  expect(highlight(svg, new Set([ids[0] ?? "", "SEA"]))).toEqual(["SEA"]);
  expect(Array.from(svg.querySelectorAll(".sdv-hl"), (el) => el.getAttribute("data-sdv-id"))).toEqual([
    ids[0],
  ]);
});
