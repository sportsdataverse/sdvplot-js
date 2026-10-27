import type { GridApi, GridReadyEvent } from "ag-grid-community";
import { type ReactElement, cloneElement } from "react";
import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import { type Draw, figureBox } from "./index.js";

type Ready = (e: GridReadyEvent) => void;
/**
 * The example's `<AgGridReact>` in a React root, in a box at most `width` px wide (and `height` tall, if given). Its
 * `onGridReady` hands over the grid's API, left on the box as `sdvAgGrid` for the render test (the example's own
 * `onGridReady`, if any, still runs).
 */
const draw: Draw<"ag-grid-react"> = async (el, s) => {
  const box: HTMLElement & { sdvAgGrid?: GridApi } = figureBox(el, s.label, "figure");
  box.style.maxWidth = `${s.width}px`;
  if (s.height !== undefined) box.style.height = `${s.height}px`;
  const root = createRoot(box);
  const element = s.grid() as ReactElement<{ onGridReady?: Ready }>;
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    box.sdvAgGrid = await new Promise<GridApi>((resolve, reject) => {
      timer = setTimeout(() => reject(new Error(`no AG Grid in "${s.label}"`)), 10_000);
      flushSync(() =>
        root.render(
          cloneElement(element, {
            onGridReady: (e) => {
              element.props.onGridReady?.(e);
              resolve(e.api);
            },
          }),
        ),
      );
    });
  } catch (e) {
    root.unmount();
    box.remove();
    throw e;
  } finally {
    clearTimeout(timer);
  }
  return () => {
    root.unmount();
    box.remove();
  };
};
export default draw;
