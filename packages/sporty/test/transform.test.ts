import { expect, test } from "vitest";
import { placeFeature, rotateCoords, strokeFor } from "../src/transform.js";
test("rotateCoords 90° CCW: (0,1) → (−1,0)", () => {
  const [p] = rotateCoords([[0, 1]], 90);
  expect(p?.[0]).toBeCloseTo(-1, 12);
  expect(p?.[1]).toBeCloseTo(0, 12);
});
test("placeFeature mirrors like add_feature, shift after anchor, rotate last", () => {
  const copies = placeFeature([[1, 2]], {
    xAnchor: 10,
    yAnchor: 0,
    reflectX: true,
    reflectY: true,
    xTrans: 100,
    yTrans: 5,
  });
  expect(copies.map((c) => c[0])).toEqual([
    [111, 7],
    [89, 7],
    [89, 3],
    [111, 3],
  ]);
  expect(placeFeature([[1, 2]], { xAnchor: 0, yAnchor: 0 })).toHaveLength(1);
  expect(placeFeature([[1, 2]], { xAnchor: 0, yAnchor: 0, reflectX: true })).toHaveLength(2);
});
test("strokeFor drops partial-alpha outlines like R", () => {
  expect(strokeFor("#ffffff00")).toBeUndefined();
  expect(strokeFor("#ffffff80")).toBeUndefined();
  expect(strokeFor("#ffffffff")).toBe("#ffffff");
  expect(strokeFor("#000000")).toBe("#000000");
});
