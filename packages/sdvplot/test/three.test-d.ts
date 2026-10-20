import { BufferAttribute, BufferGeometry, Color } from "three";
import { expectTypeOf, test } from "vitest";
import type { SurfaceMesh, TubeMesh } from "../src/three/index.js";

test("the buffers are what three.js's BufferGeometry takes, and the colour what its Color takes", () => {
  const surface = {} as SurfaceMesh;
  const tube = {} as TubeMesh;
  const g = new BufferGeometry();
  g.setAttribute("position", new BufferAttribute(surface.positions, 3));
  g.setAttribute("color", new BufferAttribute(surface.colors, 4));
  g.setIndex(new BufferAttribute(surface.indices, 1));
  g.setAttribute("normal", new BufferAttribute(tube.normals, 3));
  expectTypeOf(new Color(tube.color)).toEqualTypeOf<Color>();
});
