import type { Color, Feature, Scene } from "./scene.js";

export interface SvgOptions {
  width?: number;
  height?: number;
  background?: Color;
  precision?: number;
  id?: string;
}

const esc = (s: string): string =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const hidden = (c: Color): boolean => c.length === 9 && c.endsWith("00");

/** Render a Scene to an SVG string (no DOM; Node and browser). Y is flipped via a `<g>` transform. */
export function toSVG(scene: Scene, o: SvgOptions = {}): string {
  const [x0, y0, x1, y1] = scene.bbox;
  const p = o.precision ?? 4;
  const n = (v: number): string => {
    const t = v.toFixed(p).replace(/\.?0+$/, "");
    return t === "-0" || t === "" ? "0" : t;
  };
  const w = o.width ?? 800;
  const h = o.height ?? Math.round((w * (y1 - y0)) / (x1 - x0));
  const bg = o.background ?? scene.background;
  const body: string[] = [];
  if (bg !== undefined)
    body.push(
      `<rect x="${n(x0)}" y="${n(y0)}" width="${n(x1 - x0)}" height="${n(y1 - y0)}" fill="${esc(bg)}"/>`,
    );
  const sorted: Feature[] = [...scene.features].sort((a, b) => a.zIndex - b.zIndex); // stable
  for (const f of sorted) {
    if (f.kind === "polygon") {
      if (f.points.length === 0 || f.points.some(([x, y]) => !Number.isFinite(x) || !Number.isFinite(y)))
        continue;
      const noFill = hidden(f.fill);
      if (noFill && f.stroke === undefined) continue;
      const d = `${f.points.map(([x, y], i) => `${i === 0 ? "M" : "L"} ${n(x)} ${n(y)}`).join(" ")} Z`;
      const stroke =
        f.stroke === undefined ? "" : ` stroke="${esc(f.stroke)}" vector-effect="non-scaling-stroke"`;
      body.push(`<path d="${d}" fill="${noFill ? "none" : esc(f.fill)}"${stroke}/>`);
    } else {
      if (!Number.isFinite(f.x) || !Number.isFinite(f.y) || hidden(f.fill)) continue;
      // ponytail: font-size = fit-box height, no width fitting; refine in Phase 6
      body.push(
        `<text x="${n(f.x)}" y="${n(f.y)}" font-family="${esc(f.fontFamily)}" font-size="${n(f.fitBox[1])}" fill="${esc(f.fill)}" text-anchor="middle" dominant-baseline="central" transform="scale(1,-1) rotate(${n(-f.rotation)})">${esc(f.text)}</text>`,
      );
    }
  }
  const id = o.id === undefined ? "" : ` id="${esc(o.id)}"`;
  return `<svg xmlns="http://www.w3.org/2000/svg"${id} viewBox="${n(x0)} ${n(-y1)} ${n(x1 - x0)} ${n(y1 - y0)}" width="${w}" height="${h}"><g transform="scale(1,-1)">${body.join("")}</g></svg>`;
}
