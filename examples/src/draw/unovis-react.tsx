import * as unovisReact from "@unovis/react";
import { type ComponentType, type PropsWithChildren, createElement } from "react";
import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import { type Draw, figureBox } from "./index.js";

/** What the drawer takes from `@unovis/react`, typed here for the reason draw/unovis.ts gives. */
interface UnovisReact {
  VisSingleContainer: ComponentType<PropsWithChildren<{ data: object; height: number; svgDefs?: string }>>;
  VisGraph: ComponentType<object>;
  VisSankey: ComponentType<object>;
}
const { VisSingleContainer, VisGraph, VisSankey } = unovisReact as unknown as UnovisReact;

/**
 * The example's Unovis config through `@unovis/react`: `<VisSingleContainer data svgDefs><VisGraph {...config} />
 * </VisSingleContainer>` (or `<VisSankey>`), in a React root, in a box `width` px wide with the example's `style`.
 */
const draw: Draw<"unovis-react"> = async (el, s) => {
  const box = figureBox(el, s.label, "figure");
  Object.assign(box.style, { width: `${s.width}px`, maxWidth: "100%" });
  for (const [k, v] of Object.entries(s.style ?? {})) box.style.setProperty(k, v);
  const root = createRoot(box);
  flushSync(() =>
    root.render(
      createElement(
        VisSingleContainer,
        { data: s.data(), height: s.height, ...(s.svgDefs === undefined ? {} : { svgDefs: s.svgDefs }) },
        createElement(s.component === "Graph" ? VisGraph : VisSankey, s.config()),
      ),
    ),
  );
  return () => {
    root.unmount();
    box.remove();
  };
};
export default draw;
