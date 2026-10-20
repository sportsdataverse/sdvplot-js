import { Canvas, useThree } from "@react-three/fiber";
import { useEffect } from "react";
import { createRoot } from "react-dom/client";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { type Draw, figureBox } from "./index.js";

type Box = HTMLElement & { sdvThree?: { get: () => unknown; THREE: typeof THREE } };

/**
 * Turns the camera round the target on drag (zoom and pan off, so the page's scroll is never trapped), and leaves the
 * scene's state on the box for the render test, which projects a mark and reads what is drawn there.
 */
function Rig({ target, box }: { target: readonly [number, number, number]; box: Box }): null {
  const camera = useThree((s) => s.camera);
  const dom = useThree((s) => s.gl.domElement);
  const invalidate = useThree((s) => s.invalidate);
  const get = useThree((s) => s.get);
  useEffect(() => {
    const controls = new OrbitControls(camera, dom);
    controls.target.set(...target);
    controls.enableZoom = false;
    controls.enablePan = false;
    controls.update();
    const redraw = (): void => invalidate();
    controls.addEventListener("change", redraw);
    redraw();
    return () => {
      controls.removeEventListener("change", redraw);
      controls.dispose();
    };
  }, [camera, dom, invalidate, target]);
  useEffect(() => {
    box.sdvThree = { get, THREE };
  }, [box, get]);
  return null;
}

/**
 * react-three-fiber draws the scene in a `<Canvas>` at the example's size, the camera z up: a frame when something
 * changes (frameloop "demand"), its drawing buffer kept so the render test can read it.
 */
const draw: Draw<"three"> = async (el, s) => {
  // a figure, not an img: dragging turns the camera
  const box: Box = figureBox(el, s.label, "figure");
  box.style.width = `${s.width}px`;
  box.style.height = `${s.height}px`;
  box.style.maxWidth = "100%";
  // Resolve once the Canvas has drawn its first frame, so Live keeps the static copy until then; a WebGL or render
  // error before that rejects, and Live shows its alert. This root is not under Live's error boundary, so an error
  // after that is shown in the box itself (and logged) rather than lost.
  let ready = false;
  let fail: (e: unknown) => void = () => {};
  const failed = new Promise<never>((_, reject) => {
    fail = reject;
  });
  const root = createRoot(box, {
    onUncaughtError: (e) => {
      if (!ready) return fail(e);
      console.error(e);
      const alert = document.createElement("p");
      alert.setAttribute("role", "alert");
      alert.textContent = `This scene threw in your browser: ${e instanceof Error ? e.message : String(e)}`;
      box.replaceChildren(alert);
    },
  });
  const remove = (): void => {
    root.unmount();
    box.remove();
  };
  const created = new Promise<void>((resolve) =>
    root.render(
      <Canvas
        frameloop="demand"
        gl={{ preserveDrawingBuffer: true }}
        camera={{ position: [...s.camera.position], up: [0, 0, 1], fov: s.camera.fov, near: 0.5, far: 2000 }}
        onCreated={() => resolve()}
      >
        <Rig target={s.camera.target} box={box} />
        {s.scene()}
      </Canvas>,
    ),
  );
  try {
    await Promise.race([created, failed]);
  } catch (e) {
    remove();
    throw e;
  }
  ready = true;
  return remove;
};
export default draw;
