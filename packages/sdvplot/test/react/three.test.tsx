import ReactThreeTestRenderer from "@react-three/test-renderer";
import type { BufferGeometry, Mesh, MeshBasicMaterial } from "three";
import { DoubleSide } from "three";
import { beforeAll, expect, test, vi } from "vitest";
import { loadLeague } from "../../src/index.js";
import { Surface3D, Trajectory } from "../../src/react/index.js";
import { statcastPitchPath, surfaceMesh, teamColorPalette, trajectoryTube } from "../../src/three/index.js";

vi.setConfig({ testTimeout: 30_000 });
beforeAll(async () => {
  await loadLeague("mlb");
});

// A real pitch: a 96.3 mph four-seamer, Yankees at Red Sox, 2024-06-15 (Baseball Savant: game 746946, at-bat 48,
// pitch 4; the examples' fixture fixtures/examples/mlb_statcast_search_2024-06-15_head.csv)
const PITCH = {
  vx0: -6.245145230392043,
  vy0: -140.0548111003631,
  vz0: -4.647911601289857,
  ax: 12.681580763686934,
  ay: 32.15363682007945,
  az: -12.428443024407864,
  plate_x: 0.42927397039380755,
  plate_z: 3.546869816011372,
  release_pos_y: 54.12,
  game_year: 2024,
};
const GRASS = "#395d33"; // sporty's baseball background

/**
 * Waits, inside act, until the lazily loaded peers have drawn: React retries a suspended render when the import
 * resolves, and act flushes that retry.
 */
async function settle(r: Awaited<ReturnType<typeof ReactThreeTestRenderer.create>>): Promise<void> {
  for (let i = 0; i < 400 && r.scene.children.length === 0; i++)
    await ReactThreeTestRenderer.act(() => new Promise((ok) => setTimeout(ok, 50)));
}
/** Renders inside react-three-fiber's test canvas and waits for the lazily loaded peers to draw the one mesh. */
async function drawn(el: Parameters<typeof ReactThreeTestRenderer.create>[0]) {
  const r = await ReactThreeTestRenderer.create(el);
  await settle(r);
  const node = r.scene.children[0];
  return { r, mesh: node?.instance as unknown as Mesh<BufferGeometry, MeshBasicMaterial>, node };
}

test("<Surface3D> draws surfaceMesh as one mesh: its buffers, vertex colours, flat in order with no depth writes", async () => {
  const { r, mesh, node } = await drawn(<Surface3D sport="baseball" league="mlb" />);
  const want = surfaceMesh("baseball", "mlb");
  expect(r.scene.children).toHaveLength(1);
  expect(node?.type).toBe("Mesh");
  const g = mesh.geometry;
  expect(Array.from(g.getAttribute("position").array)).toEqual(Array.from(want.positions));
  expect(g.getAttribute("color").itemSize).toBe(4);
  expect(Array.from(g.getAttribute("color").array)).toEqual(Array.from(want.colors));
  expect(Array.from(g.getIndex()?.array ?? [])).toEqual(Array.from(want.indices));
  const m = mesh.material;
  expect(m.type).toBe("MeshBasicMaterial");
  expect([m.vertexColors, m.transparent, m.depthWrite, m.toneMapped, m.side]).toEqual([
    true,
    true,
    false,
    false,
    DoubleSide,
  ]);
  expect(mesh.renderOrder).toBe(-1);
  await r.unmount();
});

test("<Surface3D> passes sporty's options through, and frees its geometry and material when it unmounts", async () => {
  const { r, mesh } = await drawn(
    <Surface3D sport="baseball" league="mlb" options={{ colorUpdates: { infield_dirt: "#ff0000" } }} />,
  );
  const want = surfaceMesh("baseball", "mlb", { colorUpdates: { infield_dirt: "#ff0000" } });
  expect(Array.from(mesh.geometry.getAttribute("color").array)).toEqual(Array.from(want.colors));
  const freed = vi.fn();
  const freedMaterial = vi.fn();
  mesh.geometry.addEventListener("dispose", freed);
  mesh.material.addEventListener("dispose", freedMaterial);
  await r.unmount();
  expect(freed).toHaveBeenCalledTimes(1);
  expect(freedMaterial).toHaveBeenCalledTimes(1);
});

test("<Trajectory> draws trajectoryTube in the team's colour, unlit and not tone-mapped, so the colour shows as it is", async () => {
  const points = statcastPitchPath(PITCH);
  const { r, mesh } = await drawn(
    <Trajectory points={points} radius={0.121} team="NYY" league="mlb" background={GRASS} />,
  );
  const want = trajectoryTube(points, { radius: 0.121, team: "NYY", league: "mlb", background: GRASS });
  expect(want.color).toBe(teamColorPalette("mlb", ["NYY"], { background: GRASS })[0]);
  expect(Array.from(mesh.geometry.getAttribute("position").array)).toEqual(Array.from(want.positions));
  expect(Array.from(mesh.geometry.getAttribute("normal").array)).toEqual(Array.from(want.normals));
  expect(Array.from(mesh.geometry.getIndex()?.array ?? [])).toEqual(Array.from(want.indices));
  expect(mesh.material.type).toBe("MeshBasicMaterial");
  expect(`#${mesh.material.color.getHexString()}`).toBe(want.color);
  expect(mesh.material.toneMapped).toBe(false);
  await r.unmount();
});

test("<Trajectory> follows its props: a new colour re-draws it", async () => {
  const points = statcastPitchPath(PITCH);
  const r = await ReactThreeTestRenderer.create(
    <Trajectory points={points} radius={0.121} color="#003087" />,
  );
  await settle(r);
  await r.update(<Trajectory points={points} radius={0.121} color="#c4ced4" />);
  const mesh = r.scene.children[0]?.instance as unknown as Mesh<BufferGeometry, MeshBasicMaterial>;
  expect(`#${mesh.material.color.getHexString()}`).toBe("#c4ced4");
  await r.unmount();
});

test("<Trajectory> rejects a px size where world units are meant, when it renders", async () => {
  const points = statcastPitchPath(PITCH);
  vi.spyOn(console, "error").mockImplementation(() => {}); // React logs the render error
  await expect(
    ReactThreeTestRenderer.create(<Trajectory points={points} radius={0} color="#003087" />),
  ).rejects.toThrow(/world units/);
});
