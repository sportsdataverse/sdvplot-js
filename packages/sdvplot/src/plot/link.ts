import * as Plot from "@observablehq/plot";
import { warn } from "../errors.js";
import { toId } from "../selection.js";
import type { Channel, Data } from "./marks.js";

/**
 * The one `data-sdv-id` stamping helper: a `render` transform that stamps the element `next` drew for each index
 * entry (a child of the mark's `<g>`, so a mark wrapped by `href` stamps its `<a>`, or the stamped `<image>` inside
 * it for sdvplot's image marks: one stamp per row, and the outer render's id wins). A mark that drew a different
 * number of elements (lines and areas draw one path per series) is left unstamped, never mislabelled; `mismatch`
 * hears about it.
 */
export function stampRender(
  idOf: (row: number) => string,
  mismatch?: (drawn: number, rows: number) => void,
): Plot.RenderFunction {
  return (index, scales, values, dimensions, context, next) => {
    const g = next?.(index, scales, values, dimensions, context) ?? null;
    if (g === null) return null;
    // walk the siblings, never `g.children`: jsdom walks a live HTMLCollection afresh for each index and again after
    // every setAttribute, which made stamping 10,000 dots O(n²) (7-12 s; this loop is linear)
    const els: Element[] = [];
    for (let el = g.firstElementChild; el !== null; el = el.nextElementSibling) els.push(el);
    if (els.length !== index.length) {
      mismatch?.(els.length, index.length);
      return g;
    }
    // an sdvplot image mark stamps its <image> (sizeRender); `href` wraps it in the <a> drawn here: restamp that image
    const at = (el: Element | undefined): Element | undefined =>
      el?.tagName === "a" ? (el.querySelector("[data-sdv-id]") ?? el) : el;
    index.forEach((i, k) => at(els[k])?.setAttribute("data-sdv-id", idOf(i)));
    return g;
  };
}

/**
 * Plot `render` transform that stamps `data-sdv-id` on every element a one-element-per-row mark draws (dot, cell,
 * rect / bar, text, tick, image), so `sdvplot/interact` can highlight it by class toggle, never a redraw. `id`
 * defaults to the row index, which is also a linked table's id when its spec has no `rowKey`. Plot hands `render`
 * the source row indexes, so a row Plot drops (a null coordinate) leaves the others aligned. A mark that draws one
 * element per series (line, area) is left unstamped, with one warning.
 *
 * @example
 * ```ts
 * import * as Plot from "@observablehq/plot";
 * import { linkIds } from "@sportsdataverse/sdvplot/plot";
 *
 * const rows = [
 *   { team: "KC", wins: 15, net_epa: 0.063 },
 *   { team: "BUF", wins: 13, net_epa: 0.19 },
 * ];
 * const svg = Plot.plot({ marks: [Plot.dot(rows, { x: "wins", y: "net_epa", render: linkIds(rows, "team") })] });
 * Array.from(svg.querySelectorAll("circle")).map((c) => c.getAttribute("data-sdv-id"));
 * ```
 */
export function linkIds<R>(data: Data<R>, id?: Channel<R>): Plot.RenderFunction {
  const ids =
    id === undefined
      ? null
      : Array.from(Plot.valueof(data as Plot.Data, id as Plot.ChannelValue) ?? [], toId);
  return stampRender(
    (i) => (ids === null ? String(i) : (ids[i] ?? "")),
    (drawn, rows) =>
      warn(
        `linkIds:${drawn}:${rows}`,
        `linkIds needs one element per row; this mark drew ${drawn} for ${rows} rows, so nothing was stamped`,
      ),
  );
}
