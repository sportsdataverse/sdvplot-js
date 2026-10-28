import { startPerspective } from "../../snippets/perspective/start.js";
import { type Draw, figureBox } from "./index.js";

// One engine per page, started on first use and shared: compiling the WebAssembly is the slow part.
let started: ReturnType<typeof startPerspective> | undefined;
type Worker = Awaited<ReturnType<typeof startPerspective>>;
type Table = Awaited<ReturnType<Worker["table"]>>;

/**
 * For the render test: when the page defines `sdvPerspectiveTable`, each table an example makes is handed to it, and
 * awaited, before the example gets the table, so the test can listen for updates before the first one can happen.
 * Without it the example gets the worker itself.
 */
function watched(worker: Worker): Worker {
  const hook = (globalThis as { sdvPerspectiveTable?: (t: Table) => Promise<void> }).sdvPerspectiveTable;
  if (hook === undefined) return worker;
  return new Proxy(worker, {
    get(target, key) {
      if (key === "table")
        return async (...args: Parameters<Worker["table"]>) => {
          const t = await target.table(...args);
          await hook(t);
          return t;
        };
      const v = Reflect.get(target, key, target);
      return typeof v === "function" ? v.bind(target) : v;
    },
  });
}

/**
 * A `<perspective-viewer>` with Perspective started from the packages' own files (examples/snippets/perspective/
 * start.ts: no CDN), in a box `height` px tall. `mount` is the example's own code: handed the worker and the viewer, it
 * loads its table and restores its config, and may keep updating the table (streaming); what it resolves to stops
 * that. The viewer stays on the box as `sdvViewer`, for the render test, which may also watch the tables (`watched`).
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
  const stop = await s.mount({ worker: watched(worker), viewer });
  Object.assign(box, { sdvViewer: viewer });
  return () => {
    // the viewer's view depends on the example's table, and Perspective refuses to delete a table a view still
    // reads: the viewer goes first, then the example's own cleanup (its table.delete())
    void viewer.delete().then(() => stop?.());
    box.remove();
  };
};
export default draw;
