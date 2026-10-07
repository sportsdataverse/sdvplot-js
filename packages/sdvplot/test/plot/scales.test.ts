// @vitest-environment jsdom
import * as Plot from "@observablehq/plot";
import { beforeAll, beforeEach, expect, test } from "vitest";
import { InputError, loadLeague, resetWarnings, setWarningHandler, teamColorsSync } from "../../src/index.js";
import { teamColor, teamFill } from "../../src/plot/index.js";

const rows = [
  { t: "KC", v: 1 },
  { t: "BUF", v: 2 },
  { t: "ZZZ", v: 3 },
];
beforeAll(() => loadLeague("nfl"));
beforeEach(() => {
  setWarningHandler(() => {});
  resetWarnings();
});

test("values are coloured by their team's primary colour; unknown value gets naValue and the legend renders", () => {
  const fig = Plot.plot({
    color: teamColor("nfl", { values: rows.map((r) => r.t), legend: true }),
    marks: [Plot.barY(rows, { x: "t", y: "v", fill: "t" })],
  });
  const fills = Array.from(fig.querySelectorAll("[aria-label='bar'] rect")).map((r) =>
    r.getAttribute("fill"),
  );
  const [kc, buf] = teamColorsSync("nfl", ["KC", "BUF"], { which: "primary" });
  expect(fills).toEqual([kc, buf, "grey"]);
  expect(fig.tagName.toLowerCase()).toBe("figure");
});
test("secondary + alpha; naValue untouched", () => {
  const s = teamColor("nfl", { which: "secondary", alpha: 0.5, values: ["KC"], naValue: "#cccccc" });
  expect((s.range as string[])[0]).toMatch(/^#[0-9a-f]{6}80$/i);
  expect(s.unknown).toBe("#cccccc");
  const na = teamColor("nfl", { alpha: 0.5, values: ["KC", "ZZZ"] });
  expect((na.range as string[])[1]).toBe("grey");
});
test("alpha is validated", () => {
  expect(() => teamColor("nfl", { alpha: 2, values: ["KC"] })).toThrow(InputError);
});
test("without values the domain covers every team_id and abbr; teamFill is the same scale", () => {
  const s = teamColor("nfl");
  expect((s.domain as string[]).length).toBeGreaterThan(60);
  expect(teamFill).toBe(teamColor);
});
