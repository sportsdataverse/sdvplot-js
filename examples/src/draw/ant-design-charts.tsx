import type { Chart } from "@antv/g2";
import { type ReactElement, cloneElement } from "react";
import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import { type Draw, figureBox } from "./index.js";

type Ready = (plot: { chart: Chart }) => void;
/**
 * The example's Ant Design Charts element in a React root, in a box of its width. Its `onReady` hands over the plot,
 * whose G2 chart is left on the box as `sdvG2` for the render test (the example's own `onReady`, if any, still runs).
 */
const draw: Draw<"ant-design-charts"> = async (el, s) => {
  const box: HTMLElement & { sdvG2?: Chart } = figureBox(el, s.label);
  box.style.width = `${s.width}px`;
  const root = createRoot(box);
  const element = s.chart() as ReactElement<{ onReady?: Ready }>;
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const plot = await new Promise<{ chart: Chart }>((resolve, reject) => {
      timer = setTimeout(() => reject(new Error(`no Ant Design Charts plot in "${s.label}"`)), 10_000);
      // the chart is built in an effect: a sync render runs it, and onReady, before flushSync returns
      flushSync(() =>
        root.render(
          cloneElement(element, {
            onReady: (p) => {
              element.props.onReady?.(p);
              resolve(p);
            },
          }),
        ),
      );
    });
    box.sdvG2 = plot.chart;
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
