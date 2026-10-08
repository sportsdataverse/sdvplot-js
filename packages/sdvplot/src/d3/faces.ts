import type { BaseType, Selection } from "d3";
import { contentId } from "../content-id.js";

/** Face options for `appendHeadshots` (blazing-the-nets `main` scatter "faces", `lib/charts/scatterChart.ts:139-191`). */
export interface FaceOptions {
  /**
   * `"circle"`: the headshot inside a circle whose diameter is `height` × `frameHeight`. The image is drawn 2.3 R tall
   * so the head fills the circle, so `drawnMarks` reports 1.15 × `height` for a face.
   */
  clip?: "circle";
  /** Ring colour per player id (e.g. the team colour; `:183-188`, 1.5 px). Default none. */
  ring?: string | ((id: string) => string);
  /** A disc behind the face at 0.35 opacity, still there if the image fails (`:169-172`). Default none. */
  placeholder?: string | ((id: string) => string);
}

const NS = "http://www.w3.org/2000/svg";
const pick = (c: FaceOptions["ring"], id: string): string | undefined =>
  typeof c === "function" ? c(id) : c;

/** Turn `appendHeadshots`' images into circular faces in place. */
export function clipFaces<D>(g: Selection<SVGGElement, D, BaseType, unknown>, o: FaceOptions): void {
  if (o.clip !== "circle") return;
  for (const img of g.selectAll<SVGImageElement, unknown>("image").nodes()) {
    const doc = img.ownerDocument;
    const id = img.getAttribute("data-sdv-id") ?? "";
    const w0 = Number(img.getAttribute("width"));
    const h0 = Number(img.getAttribute("height"));
    const cx = Number(img.getAttribute("x")) + w0 / 2;
    const cy = Number(img.getAttribute("y")) + h0 / 2;
    const r = h0 / 2;
    const h = 2.3 * r; // the head fills the circle: image 2.3 R tall, top 1.05 R above centre (:177-181)
    const w = h0 > 0 ? (h * w0) / h0 : 0;
    img.setAttribute("width", String(w));
    img.setAttribute("height", String(h));
    img.setAttribute("x", String(cx - w / 2));
    img.setAttribute("y", String(cy - 1.05 * r));
    const clipId = contentId("sdv-face", `${id}|${cx}|${cy}|${r}`);
    const clip = doc.createElementNS(NS, "clipPath");
    clip.setAttribute("id", clipId);
    const disc = doc.createElementNS(NS, "circle");
    disc.setAttribute("cx", String(cx));
    disc.setAttribute("cy", String(cy));
    disc.setAttribute("r", String(r));
    clip.appendChild(disc);
    img.setAttribute("clip-path", `url(#${clipId})`);
    img.before(clip);
    const fill = pick(o.placeholder, id);
    if (fill !== undefined) {
      const ph = disc.cloneNode() as Element;
      ph.setAttribute("fill", fill);
      ph.setAttribute("fill-opacity", "0.35");
      img.before(ph);
    }
    const stroke = pick(o.ring, id);
    if (stroke !== undefined) {
      const ring = disc.cloneNode() as Element;
      ring.setAttribute("fill", "none");
      ring.setAttribute("stroke", stroke);
      ring.setAttribute("stroke-width", "1.5");
      img.after(ring);
    }
  }
}
