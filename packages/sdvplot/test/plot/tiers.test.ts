// @vitest-environment jsdom
import * as Plot from "@observablehq/plot";
import { beforeAll, expect, test } from "vitest";
import { loadLeague } from "../../src/index.js";
import { teamTiers } from "../../src/plot/index.js";

beforeAll(() => loadLeague("nfl"));
test("teamTiers renders tier 1 on top with logos, separators and wrapped tier labels", () => {
  const rows = [
    { tierNo: 1, team: "KC" },
    { tierNo: 1, team: "BUF" },
    { tierNo: 2, team: "BAL" },
    { tierNo: 5, team: "NYJ" },
  ];
  const fig = Plot.plot(teamTiers(rows, { league: "nfl", caption: "data: nflverse" })) as HTMLElement;
  const imgs = Array.from(fig.querySelectorAll("image[data-sdv-id]"));
  expect(imgs).toHaveLength(4);
  const y = (el: Element) => Number(el.getAttribute("y"));
  expect(y(imgs[0] as Element)).toBeLessThan(y(imgs[3] as Element));
  expect(fig.querySelectorAll("[aria-label^='rule'] line")).toHaveLength(4);
  expect((fig.querySelector("h2") as Element).textContent).toBe("NFL Team Tiers");
  expect((fig.querySelector("figcaption") as Element).textContent).toBe("data: nflverse");
  expect(fig.querySelector("svg")?.getAttribute("style") ?? fig.getAttribute("style")).toMatch(
    /rgb\(30, 30, 30\)|#1e1e1e/,
  );
  // multi-line tick label: Plot splits "\n" into tspans
  const tick5 = Array.from(fig.querySelectorAll("[aria-label='y-axis tick label'] text")).map(
    (t) => t.innerHTML,
  );
  expect(tick5[2]).toContain("<tspan");
  expect(tick5[2]).toContain("doing?");
});
test("devel draws text instead of logos", () => {
  const fig = Plot.plot(
    teamTiers([{ tierNo: 1, team: "KC" }], { league: "nfl", devel: true }),
  ) as HTMLElement;
  expect(fig.querySelectorAll("image")).toHaveLength(0);
  expect(fig.textContent).toContain("KC");
});
