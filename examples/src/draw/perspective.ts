import { startPerspective } from "../../snippets/perspective/start.js";
import { type Draw, figureBox } from "./index.js";

// One engine per page, started on first use and shared: compiling the WebAssembly is the slow part.
let started: ReturnType<typeof startPerspective> | undefined;

/**
 * A `<perspective-viewer>` with Perspective started from the packages' own files (examples/snippets/perspective/
 * start.ts: no CDN), in a box `height` px tall. `mount` is the example's own code: handed the worker and the viewer, it
 * loads its table and restores its config, and may keep updating the table (streaming); what it resolves to stops
 * that. The viewer stays on the box as `sdvViewer`, for the render test.
 */
const draw: Draw<"perspective"> = async (el, s) => {
  // a failed start is not cached: the next mount on the page tries again
  started ??= startPerspective().catch((e: unknown) => {
    started = undefined;
    throw e;
  });
  const worker = await started;
  const box = figureBox(el, s.label, "figure");
  Object.assign(box.style, { height: `${s.height}px`, width: "100%" });
  const viewer = box.appendChild(document.createElement("perspective-viewer"));
  viewer.style.height = "100%";
  const stop = await s.mount({ worker, viewer });
  Object.assign(box, { sdvViewer: viewer });
  return () => {
    stop?.();
    void viewer.delete();
    box.remove();
  };
};
export default draw;
