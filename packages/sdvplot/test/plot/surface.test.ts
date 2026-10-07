// @vitest-environment jsdom
import * as Plot from "@observablehq/plot";
import { beforeAll, expect, test } from "vitest";
import { InputError, loadLeague, teamColorsSync } from "../../src/index.js";
import { colorUpdates, surface } from "../../src/plot/index.js";

beforeAll(async () => {
  await loadLeague("nfl");
  await loadLeague("nba");
  await loadLeague("nhl");
}, 60_000);
test("colorUpdates per sport", () => {
  expect(colorUpdates("football", "#ff0000", undefined)).toEqual({
    offensive_endzone: "#ff0000",
    defensive_endzone: "#ff0000",
  });
  const b = colorUpdates("basketball", "#000000", undefined);
  expect(b.painted_area).toBe("#000000");
  expect(b.restricted_arc).toBe("#ffffff");
  expect(b.baseline_lower_defensive_box).toBe("#ffffff");
  expect(b.lane_lower_defensive_box).toBe("#ffffff");
  const h = colorUpdates("hockey", "#ffffcc", "#003366");
  expect(h.center_line).toBe("#003366");
  expect(h.boards).toBe("#ffffcc");
  expect(colorUpdates("hockey", "#003366", "#ffffff").center_line).toBe("#003366");
});
test("surface('nba', {team}) paints the lane in the team's primary colour and draws through Plot", () => {
  const s = surface("nba", { team: "LAL" });
  const [primary] = teamColorsSync("nba", ["LAL"], { which: "primary" });
  const lane = s.scene.features.find((f) => f.kind === "polygon" && f.name === "painted_area");
  expect(lane?.kind === "polygon" && lane.fill.toLowerCase()).toBe(primary?.toLowerCase());
  const svg = Plot.plot({ ...s.scales, marks: s.marks });
  expect(svg.querySelectorAll("path[fill]").length).toBeGreaterThan(10);
});
test("football end zones: both copies painted with the primary colour", () => {
  const [primary] = teamColorsSync("nfl", ["KC"], { which: "primary" });
  const ez = surface("nfl", { team: "KC" }).scene.features.filter((f) => f.name === "endzone");
  expect(ez).toHaveLength(2);
  for (const f of ez) expect(f.kind === "polygon" && f.fill.toLowerCase()).toBe(primary?.toLowerCase());
});
test("centerLogo adds one logo at the origin at 0.25 of the frame", () => {
  const s = surface("nhl", { team: "BOS", centerLogo: true });
  const svg = Plot.plot({ ...s.scales, height: 425, marginTop: 0, marginBottom: 0, marks: s.marks });
  const img = svg.querySelector("image[data-sdv-id]") as Element;
  expect(Number(img.getAttribute("height"))).toBeCloseTo(0.25 * 425, 3);
});
test("the plain surface, rotation passes through, unsupported league lists the supported ones", () => {
  const width = (r?: number) => {
    const bb = (r === undefined ? surface("nfl") : surface("nfl", { rotation: r })).scene.bbox;
    return bb[2] - bb[0];
  };
  expect(width(90)).toBeLessThan(width());
  expect(() => surface("mls" as never)).toThrow(InputError);
  expect(() => surface("mls" as never)).toThrow(/nba/);
});
test("centerLogo without a team draws no image", () => {
  const s = surface("nhl", { centerLogo: true });
  const svg = Plot.plot({ ...s.scales, marks: s.marks });
  expect(svg.querySelector("image[data-sdv-id]")).toBeNull();
});
test("centerLogo as a number is that fraction of the frame; 0 is rejected", () => {
  const s = surface("nhl", { team: "BOS", centerLogo: 0.1 });
  const svg = Plot.plot({ ...s.scales, height: 425, marginTop: 0, marginBottom: 0, marks: s.marks });
  const img = svg.querySelector("image[data-sdv-id]") as Element;
  expect(Number(img.getAttribute("height"))).toBeCloseTo(0.1 * 425, 3);
  expect(() => surface("nhl", { team: "BOS", centerLogo: 0 })).toThrow(InputError);
});
