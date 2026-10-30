// @vitest-environment jsdom
import * as Plot from "@observablehq/plot";
import { beforeAll, expect, test } from "vitest";
import { InputError, loadLeague, logoUrlSync, teamColorsSync } from "../../src/index.js";
import { colorUpdates, surface } from "../../src/plot/index.js";
import { centerLogoPlacement } from "../../src/surfaces.js";

beforeAll(async () => {
  await loadLeague("nfl");
  await loadLeague("nba");
  await loadLeague("nhl");
  for (const l of ["mlb", "ncaa_softball", "soccer"] as const) await loadLeague(l);
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
  expect(() => surface("cricket")).toThrow(InputError);
  expect(() => surface("cricket")).toThrow(/nba/);
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

// sdvplotR's rule (R/sdv_surface.R surface_logo_layer; sdvplot's _surface._logo_box): a diamond's origin is home plate,
// so its logo goes in shallow centre field, x = 0, y = (baseline_distance * sqrt(2) + center_field_distance) / 2, a
// square 0.15 * center_field_distance across (feet). The expected values are sdvplot's tests/test_surface.py DIAMOND_LOGOS.
const DIAMOND_LOGOS: Record<string, readonly [y: number, size: number]> = {
  mlb: [263.6396103068, 60],
  milb: [263.6396103068, 60],
  ncaa_baseball: [263.6396103068, 60],
  nfhs_baseball: [263.6396103068, 60],
  little_league: [142.4264068712, 30],
  pony: [214.0685424949, 47.25],
  ncaa_softball: [152.4264068712, 33],
};
test.each(Object.entries(DIAMOND_LOGOS))(
  "%s: the centre logo goes in shallow centre field, as in sdvplotR",
  (league, [y, size]) => {
    expect(centerLogoPlacement(league)).toMatchObject({ x: 0, size: expect.closeTo(size, 9) });
    expect(centerLogoPlacement(league).y).toBeCloseTo(y, 9);
  },
);
test("a diamond's logo follows updates, units, translation and rotation, as sporty draws the field (sdvplotR)", () => {
  const o = {
    updates: { center_field_distance: 410 },
    units: "m",
    xTrans: 10,
    yTrans: 5,
    rotation: 90,
  } as const;
  const at = centerLogoPlacement("mlb", o);
  const offset = ((90 * Math.SQRT2 + 410) / 2) * 0.3048;
  // translate, then a quarter turn about the origin: (x, y) -> (-y, x)
  expect(at.x).toBeCloseTo(-(offset + 5), 9);
  expect(at.y).toBeCloseTo(10, 9);
  expect(at.size).toBeCloseTo(0.15 * 410 * 0.3048, 9);
  // the logo lands on the field sporty drew: inside its bbox
  const [x0, y0, x1, y1] = surface("mlb", o).scene.bbox;
  expect(at.x > x0 && at.x < x1 && at.y > y0 && at.y < y1).toBe(true);
});
test("other surfaces keep the logo at their centre, moved with xTrans / yTrans", () => {
  expect(centerLogoPlacement("nfl")).toEqual({ x: 0, y: 0, variant: "dark" });
  expect(centerLogoPlacement("nhl", { xTrans: 3, yTrans: -2 })).toMatchObject({ x: 3, y: -2 });
});
test("the MLB centre logo is drawn in shallow centre field, 60 ft across, not on home plate", () => {
  const s = surface("mlb", { team: "KC", centerLogo: true });
  const H = 600;
  const svg = Plot.plot({ ...s.scales, height: H, marginTop: 0, marginBottom: 0, marks: s.marks });
  const img = svg.querySelector("image[data-sdv-id]") as Element;
  const [, y0, , y1] = s.scene.bbox;
  const h = Number(img.getAttribute("height"));
  expect(h).toBeCloseTo((60 / (y1 - y0)) * H, 3);
  const centre = y1 - ((Number(img.getAttribute("y")) + h / 2) / H) * (y1 - y0); // back to feet from home plate
  expect(centre).toBeCloseTo(263.6396103068, 3);
});
// sdvplotR / sdvplot: the dark-background variant where white reads better than black on the sport's regulation
// surface colour (SURFACE_BASE: grass for football, soccer, baseball and softball), whatever the caller's colorUpdates
test.each([
  ["nfl", "LV", "dark"],
  ["soccer", "481", "dark"], // Germany
  ["mlb", "KC", "dark"],
  ["ncaa_softball", "1140", "dark"],
  ["nba", "BOS", "default"],
  ["nhl", "BOS", "default"],
] as const)("%s: the centre logo is the %s team's %s variant", (league, team, variant) => {
  const s = surface(league, { team, centerLogo: true, colorUpdates: { plot_background: "#ffffff" } });
  const svg = Plot.plot({ ...s.scales, marks: s.marks });
  const href = svg.querySelector("image[data-sdv-id]")?.getAttribute("href");
  expect(href).toBe(logoUrlSync(team, league, { variant }));
  if (variant === "dark") expect(href).not.toBe(logoUrlSync(team, league));
});
