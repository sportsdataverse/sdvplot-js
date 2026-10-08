// @vitest-environment jsdom
import * as Plot from "@observablehq/plot";
import { beforeAll, expect, test } from "vitest";
import { STANDINGS } from "../../../sdvtables/test/fixtures/standings.js";
import { resetWarnings, setWarningHandler } from "../../src/index.js";
import { linkIds } from "../../src/plot/index.js";

const warnings: string[] = [];
beforeAll(() => {
  resetWarnings();
  setWarningHandler((m) => warnings.push(m));
});
const stamped = (svg: Element, sel: string): (string | null)[] =>
  Array.from(svg.querySelectorAll(sel)).map((e) => e.getAttribute("data-sdv-id"));

test("linkIds stamps each dot with its row's id; a row Plot drops (NE: net_epa null) leaves the rest aligned", () => {
  const svg = Plot.plot({
    marks: [Plot.dot(STANDINGS, { x: "wins", y: "net_epa", render: linkIds(STANDINGS, "team") })],
  });
  expect(stamped(svg, "circle")).toEqual(["KC", "LAC", "DEN", "LV", "BUF", "MIA", "NYJ"]);
  // NE first: Plot's index skips row 0, so a dot's position in the <g> is no longer its row
  const rows = [...STANDINGS].reverse();
  const reversed = Plot.plot({
    marks: [Plot.dot(rows, { x: "wins", y: "net_epa", render: linkIds(rows, "team") })],
  });
  expect(stamped(reversed, "circle")).toEqual(["NYJ", "MIA", "BUF", "LV", "DEN", "LAC", "KC"]);
});
test("the default id is the row index (a linked table's id when it has no rowKey)", () => {
  const svg = Plot.plot({
    marks: [Plot.barY(STANDINGS, { x: "team", y: "wins", render: linkIds(STANDINGS) })],
  });
  expect(stamped(svg, "rect")).toEqual(["0", "1", "2", "3", "4", "5", "6", "7"]);
});
test("with href, the stamp lands on the <a> Plot wraps each element in (A27)", () => {
  const svg = Plot.plot({
    marks: [
      Plot.dot(STANDINGS, {
        x: "wins",
        y: "pf",
        href: (d: (typeof STANDINGS)[number]) => `#${d.team}`,
        render: linkIds(STANDINGS, "team"),
      }),
    ],
  });
  expect(stamped(svg, "a")).toEqual(STANDINGS.map((r) => r.team));
  expect(svg.querySelectorAll("circle[data-sdv-id]")).toHaveLength(0);
});
test("a mark that draws one path per series is left unstamped, with one warning", () => {
  const svg = Plot.plot({
    marks: [Plot.line(STANDINGS, { x: "wins", y: "pf", render: linkIds(STANDINGS, "team") })],
  });
  expect(svg.querySelectorAll("[data-sdv-id]")).toHaveLength(0);
  expect(warnings.filter((w) => w.startsWith("linkIds needs one element per row"))).toHaveLength(1);
});
