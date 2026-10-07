import type { Kind, Placement } from "./placement.js";

/**
 * Size an `<image>` to `px` tall (width from the mark's aspect), centre it on (cx, cy) and stamp the
 * `data-sdv-id/kind/frame` attributes the testing hooks read. Plot-free: shared by the Plot and d3 adapters.
 */
export function stampImage(
  img: Element,
  p: Placement,
  kind: Kind,
  px: number,
  frame: number,
  cx: number,
  cy: number,
): void {
  const w = px * (p.aspect ?? 1);
  img.setAttribute("width", String(w));
  img.setAttribute("height", String(px));
  img.setAttribute("x", String(cx - w / 2));
  img.setAttribute("y", String(cy - px / 2));
  img.setAttribute("data-sdv-id", p.id);
  img.setAttribute("data-sdv-kind", kind);
  img.setAttribute("data-sdv-frame", String(frame));
}
