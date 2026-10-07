import { expect, test } from "vitest";
import { tennisCourt } from "../../src/tennis/court.js";
test("ATP: 23 polygons; ad/deuce quadrants coloured separately; two sideline passes", () => {
  const s = tennisCourt("atp");
  const polys = s.features.filter((f) => f.kind === "polygon");
  expect(polys).toHaveLength(23);
  expect(s.bbox).toEqual([-65, -35, 65, 35]);
  expect(s.units).toBe("ft");
  expect(polys.slice(6, 10).map((p) => p.name)).toEqual([
    "frontcourt_half",
    "frontcourt_half",
    "frontcourt_half",
    "frontcourt_half",
  ]);
  const q = tennisCourt("atp", { colorUpdates: { ad_court: "#0000ff", deuce_court: "#ff0000" } })
    .features.slice(6, 10)
    .map((p) => (p.kind === "polygon" ? p.fill : ""));
  expect(q).toEqual(["#0000ff", "#0000ff", "#ff0000", "#ff0000"]);
  expect(polys.filter((p) => p.name === "sideline")).toHaveLength(4);
  expect(polys[0]!.stroke).toBe("#395d33");
  expect(polys.at(-1)!.name).toBe("net");
  expect(polys.at(-1)!.fill).toBe("#d3d3d3");
});
test("serve/receive halves; the R typo and the correct spelling both work (documented divergence 4)", () => {
  expect(tennisCourt("atp", { displayRange: "serve" }).bbox).toEqual([-65, -35, 1.5, 35]);
  expect(tennisCourt("atp", { displayRange: "receivicehalf" }).bbox).toEqual([-1.5, -35, 65, 35]);
  expect(tennisCourt("atp", { displayRange: "receive half" }).bbox).toEqual([-1.5, -35, 65, 35]);
  expect(tennisCourt("atp", { displayRange: "in bounds only" }).bbox).toEqual([
    -39.1667, -18.1667, 39.1667, 18.1667,
  ]);
});
test("ad court colour update applies to both ad quadrants only", () => {
  const s = tennisCourt("wta", { colorUpdates: { ad_court: "#1e90ff" } });
  expect(s.features.filter((f) => f.kind === "polygon" && f.fill === "#1e90ff")).toHaveLength(2);
});
