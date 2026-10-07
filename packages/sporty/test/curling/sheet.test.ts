import { expect, test } from "vitest";
import { curlingSheet } from "../../src/curling/sheet.js";

test("WCF: vertical sheet, 30 polygons, rings coloured red/white/blue outer→inner, mirrored over x", () => {
  const s = curlingSheet("wcf");
  expect(s.bbox).toEqual([-14.29165, -81.5, 14.29165, 81.5]);
  expect(s.units).toBe("ft");
  const polys = s.features.filter((f) => f.kind === "polygon");
  expect(polys).toHaveLength(30);
  const rings = polys.filter((p) => p.name === "house_ring");
  expect(rings).toHaveLength(6);
  expect(rings.map((r) => r.fill)).toEqual([
    "#c8102e",
    "#c8102e",
    "#ffffff",
    "#ffffff",
    "#0033a0",
    "#0033a0",
  ]);
  expect(rings[0]!.points.some(([, y]) => y > 60)).toBe(true);
  expect(rings[1]!.points.some(([, y]) => y < -60)).toBe(true);
  expect(polys[0]!.name).toBe("sheet_apron");
  expect(polys[0]!.stroke).toBe("#0033a0");
  expect(polys.at(-1)!.name).toBe("hack_foothold");
});

test("house range shows the top house only; in bounds only uses the hard-coded 0.5 ft", () => {
  expect(curlingSheet("wcf", { displayRange: "house" }).bbox).toEqual([-14.29165, 32, 14.29165, 81.5]);
  expect(curlingSheet("curling canada", { displayRange: "in bounds only" }).bbox).toEqual([
    expect.closeTo(-8.29165, 9),
    -75.5,
    expect.closeTo(8.29165, 9),
    75.5,
  ]);
});

test("scalar colour for a multi-instance feature (documented divergence): all three rings", () => {
  const s = curlingSheet("wcf", { colorUpdates: { house_rings: "#ff0000" } });
  const rings = s.features.filter((f) => f.name === "house_ring");
  expect(rings).toHaveLength(6);
  expect(rings.every((r) => r.fill === "#ff0000")).toBe(true);
  const two = curlingSheet("wcf", { colorUpdates: { house_rings: ["#111111", "#222222"] } });
  expect(two.features.filter((f) => f.name === "house_ring").map((r) => r.fill)).toEqual([
    "#111111",
    "#111111",
    "#222222",
    "#222222",
    "#111111",
    "#111111",
  ]); // colorAt recycles (R: NA for ring 3)
  const four = curlingSheet("wcf", { updates: { house_ring_radii: [2, 8, 4, 6] } });
  const big = four.features.filter((f) => f.kind === "polygon").filter((f) => f.name === "house_ring");
  expect(big).toHaveLength(8);
  expect(Math.max(...big[0]!.points.map(([x]) => x))).toBeCloseTo(8, 9); // radii drawn largest-first (R sorts them)
});
