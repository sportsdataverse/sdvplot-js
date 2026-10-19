// @vitest-environment node
import ReactThreeTestRenderer from "@react-three/test-renderer";
import { renderToString } from "react-dom/server";
import type { BufferGeometry, Mesh, MeshBasicMaterial } from "three";
import { expect, test, vi } from "vitest";
import { resetWarnings, setWarningHandler, teamColorsSync } from "../../src/index.js";
import { Trajectory } from "../../src/react/index.js";

vi.setConfig({ testTimeout: 30_000 });
// no league is loaded in this file: each test uses its own, so their order does not matter
const PATH = [
  [0, 50, 6],
  [0, 17 / 12, 2],
] as const;

test("SSR with team= and its league not loaded: draws nothing, warns once, does not throw", () => {
  resetWarnings();
  const spy = vi.fn();
  setWarningHandler(spy);
  try {
    for (let i = 0; i < 2; i++) {
      const html = renderToString(<Trajectory points={PATH} radius={0.121} team="NYY" league="mlb" />);
      expect(html).not.toMatch(/<(mesh|bufferGeometry|meshBasicMaterial)\b/);
    }
  } finally {
    setWarningHandler(null);
  }
  expect(spy).toHaveBeenCalledTimes(1);
  expect(String(spy.mock.calls[0]?.[0])).toMatch(/league mlb is loaded: await loadLeague\("mlb"\)/);
});

test("in the browser it loads the league itself, then draws in the team's colour", async () => {
  setWarningHandler(() => {}); // the not-yet-loaded warning, asserted above
  try {
    const r = await ReactThreeTestRenderer.create(
      <Trajectory points={PATH} radius={0.121} team="KC" league="nfl" />,
    );
    for (let i = 0; i < 400 && r.scene.children.length === 0; i++)
      await ReactThreeTestRenderer.act(() => new Promise((ok) => setTimeout(ok, 50)));
    const mesh = r.scene.children[0]?.instance as unknown as Mesh<BufferGeometry, MeshBasicMaterial>;
    expect(`#${mesh.material.color.getHexString()}`).toBe(teamColorsSync("nfl", ["KC"])[0]);
    await r.unmount();
  } finally {
    setWarningHandler(null);
  }
});
