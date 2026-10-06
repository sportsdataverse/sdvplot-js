import type { Value } from "../resolve.js";

export const TESTING_SUBPATH = "@sportsdataverse/sdvplot/testing";

export interface DrawnMark {
  id: string;
  x: Value;
  y: Value;
  /** Drawn image height as a fraction of the frame height the render saw. */
  height: number;
  url: string;
  kind: string;
}
const num = (s: string | null): Value =>
  s === null || s === "" ? null : Number.isNaN(Number(s)) ? s : Number(s);

/** Every `<image data-sdv-id>` under `node`, in document order. */
export function drawnMarks(node: ParentNode): DrawnMark[] {
  return Array.from(node.querySelectorAll("image[data-sdv-id]")).map((img) => ({
    id: img.getAttribute("data-sdv-id") ?? "",
    x: num(img.getAttribute("data-sdv-x")),
    y: num(img.getAttribute("data-sdv-y")),
    height: Number(img.getAttribute("height")) / Number(img.getAttribute("data-sdv-frame")),
    url: img.getAttribute("href") ?? "",
    kind: img.getAttribute("data-sdv-kind") ?? "",
  }));
}
