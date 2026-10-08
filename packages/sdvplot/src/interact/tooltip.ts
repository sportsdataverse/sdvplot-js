import { InputError } from "../errors.js";
import { hasDom } from "./highlight.js";

const SVG_NS = "http://www.w3.org/2000/svg";
/** Colours are CSS custom properties with fallbacks (A13), so a page's light/dark tokens restyle the box with no JS. */
const CSS =
  ".sdv-tip>.sdv-tip-box{fill:var(--sdv-tip-bg,rgba(34,34,34,.85))}.sdv-tip>text{fill:var(--sdv-tip-fg,#ddd)}" +
  ".sdv-tip>.sdv-tip-swatch{stroke:var(--sdv-tip-fg,#ddd)}";

/** Options for {@link tooltip}. */
export interface TooltipOptions {
  /** The width the box stays inside, in the svg's user units. Default: the svg's viewBox width. */
  readonly width?: number;
  /** The height the box stays inside. Default: the svg's viewBox height. */
  readonly height?: number;
  /** Text size in px; the box is sized from it. Default 11. */
  readonly fontSize?: number;
}
/** A live tooltip that {@link tooltip} returns. */
export interface TooltipHandle {
  /**
   * Show `lines` (the first bold) beside the point `x`, `y` in the svg's user space, with an optional colour swatch
   * at the right. Placed 12 px right of the point and above it; flipped to its left when it would pass the right
   * edge, and kept inside the top and bottom.
   */
  show(x: number, y: number, lines: readonly string[], swatch?: string): void;
  /** Hide the box; `show` brings it back. */
  hide(): void;
  /** Remove the box. */
  destroy(): void;
}

/** @internal The svg's user-space box: its viewBox, else its width and height attributes; an unstated side is unbounded. */
export function svgBox(svg: Element): { x: number; y: number; width: number; height: number } {
  const [x = Number.NaN, y = Number.NaN, width = Number.NaN, height = Number.NaN] = (
    svg.getAttribute("viewBox") ?? ""
  )
    .trim()
    .split(/[\s,]+/)
    .map(Number);
  if ([x, y, width, height].every(Number.isFinite)) return { x, y, width, height };
  const side = (name: string): number => {
    const v = svg.getAttribute(name)?.trim();
    const n = v ? Number(v) : Number.NaN; // "100%" and "" are not user units
    return Number.isFinite(n) ? n : Number.POSITIVE_INFINITY;
  };
  return { x: 0, y: 0, width: side("width"), height: side("height") };
}
/** @internal Interact visuals draw in an `<svg>`'s user space: anything else is an argument error. */
export function svgRoot(root: Element, fn: string): Element {
  if (root.namespaceURI !== SVG_NS || root.localName !== "svg")
    throw new InputError(`${fn} needs an <svg> root (got <${root.localName}>)`);
  return root;
}

const NOOP: TooltipHandle = { show: () => {}, hide: () => {}, destroy: () => {} };

/**
 * An in-SVG tooltip for d3-drawn and other non-Plot figures (a Plot figure uses its own `tip` mark): a rounded box of
 * text lines, the first bold, with an optional 12 px colour swatch, kept inside the svg. It is drawn hidden, with
 * `pointer-events="none"`, and re-appended last on each `show` so it stays above the marks. Its size is ESTIMATED from
 * the text (`0.6 * fontSize` per character, `1.35 * fontSize` per line), never measured, so it renders the same under
 * jsdom and in every browser. Colours: `--sdv-tip-bg` (default `rgba(34,34,34,.85)`) and `--sdv-tip-fg` (default
 * `#ddd`). Throws `InputError` on a non-positive `fontSize` or a negative size, in Node too, and when `root` is not an
 * `<svg>`. Returns a HANDLE (`show`, `hide`, `destroy`), not a teardown function, because it has more to do than tear
 * down. A no-op handle without a DOM: a server render never holds a tooltip.
 *
 * @example
 * ```ts
 * import { loadLeague, teamColorsSync } from "@sportsdataverse/sdvplot";
 * import { tooltip } from "@sportsdataverse/sdvplot/interact";
 * import * as d3 from "d3";
 *
 * await loadLeague("nfl");
 * const red = teamColorsSync("nfl", "KC");
 * const svg = d3.create("svg").attr("viewBox", "0 0 320 120").attr("width", 320);
 * svg.append("circle").attr("cx", 280).attr("cy", 80).attr("r", 6).attr("fill", red ?? "currentColor");
 * // Kansas City's 2024 line, as a chart shows it on hover: no room right of the dot, so the box flips to its left
 * tooltip(svg.node() as SVGSVGElement).show(280, 80, ["KC 15-2", "Net EPA/play 0.063", "QB Patrick Mahomes"], red);
 * svg.node();
 * ```
 */
export function tooltip(root: Element, o: TooltipOptions = {}): TooltipHandle {
  const { fontSize = 11 } = o;
  if (!(fontSize > 0)) throw new InputError(`tooltip: fontSize must be a number > 0 (got ${fontSize})`);
  for (const [k, v] of [
    ["width", o.width],
    ["height", o.height],
  ] as const)
    if (v !== undefined && !(v >= 0)) throw new InputError(`tooltip: ${k} must be a number >= 0 (got ${v})`);
  if (!hasDom()) return NOOP;
  const svg = svgRoot(root, "tooltip");
  const el = (name: string, attrs: Readonly<Record<string, string | number>>): Element => {
    const e = svg.ownerDocument.createElementNS(SVG_NS, name);
    for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, String(v));
    return e;
  };
  if (!svg.querySelector(':scope > style[data-sdv-interact="tip"]')) {
    const style = el("style", { "data-sdv-interact": "tip" });
    style.textContent = CSS;
    svg.append(style);
  }
  const box = el("rect", { class: "sdv-tip-box", rx: 4 });
  const text = el("text", { "font-size": fontSize });
  const swatch = el("rect", { class: "sdv-tip-swatch", width: 12, height: 12, rx: 2 });
  const g = el("g", { class: "sdv-tip", "pointer-events": "none", display: "none" });
  g.append(box, text);
  svg.append(g);
  return {
    show(x, y, lines, color) {
      const b = svgBox(svg);
      const w = Math.ceil(
        16 + 0.6 * fontSize * Math.max(0, ...lines.map((l) => l.length)) + (color ? 20 : 0),
      );
      const h = Math.ceil(10 + 1.35 * fontSize * lines.length);
      text.replaceChildren(
        ...lines.map((line, i) => {
          const t = el("tspan", { x: 8, dy: i === 0 ? "1.3em" : "1.35em" });
          if (i === 0) t.setAttribute("font-weight", "bold");
          t.textContent = line;
          return t;
        }),
      );
      box.setAttribute("width", String(w));
      box.setAttribute("height", String(h));
      if (color) {
        swatch.setAttribute("fill", color);
        swatch.setAttribute("x", String(w - 20));
        swatch.setAttribute("y", String((h - 12) / 2));
        g.append(swatch);
      } else swatch.remove();
      const right = b.x + (o.width ?? b.width);
      const bottom = b.y + (o.height ?? b.height);
      const tx = Math.max(b.x, x + 12 + w > right ? x - 12 - w : x + 12);
      const ty = Math.min(Math.max(b.y, y - h - 8), bottom - h);
      g.setAttribute("transform", `translate(${tx},${ty})`);
      g.removeAttribute("display");
      if (svg.lastElementChild !== g) svg.append(g); // above anything drawn after the tooltip was created
    },
    hide() {
      g.setAttribute("display", "none");
    },
    destroy() {
      g.remove();
    },
  };
}
