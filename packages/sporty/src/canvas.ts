import { type Color, type Feature, type Scene, hidden, isVisiblePolygon, isVisibleText } from "./scene.js";

/**
 * Browser `CanvasRenderingContext2D` or `@napi-rs/canvas` `SKRSContext2D`; only the members below are used.
 * Structural and DOM-type-free (`fillStyle`/`strokeStyle` are `unknown`, `textAlign`/`textBaseline` are `string`),
 * so neither consumer needs the DOM lib.
 */
export interface SceneCanvasContext {
  save(): void;
  restore(): void;
  setTransform(a: number, b: number, c: number, d: number, e: number, f: number): void;
  beginPath(): void;
  moveTo(x: number, y: number): void;
  lineTo(x: number, y: number): void;
  closePath(): void;
  fill(): void;
  stroke(): void;
  fillRect(x: number, y: number, w: number, h: number): void;
  fillText(text: string, x: number, y: number): void;
  measureText(text: string): { width: number };
  translate(x: number, y: number): void;
  rotate(rad: number): void;
  scale(x: number, y: number): void;
  fillStyle: unknown;
  strokeStyle: unknown;
  lineWidth: number;
  font: string;
  textAlign: string;
  textBaseline: string;
}

export interface DrawSceneOptions {
  width?: number;
  height?: number;
  background?: Color;
  /** Pixels per scene unit; when given, the box size follows from it. */
  scale?: number;
}

/**
 * Paints `scene` into the top-left `width x height` pixels of `ctx` and returns the size used.
 * Give `width` (default 800, like `toSVG`) or `scale` (px per unit; the box size follows).
 */
export function drawScene(
  ctx: SceneCanvasContext,
  scene: Scene,
  opts: DrawSceneOptions = {},
): { width: number; height: number; scale: number } {
  const [x0, y0, x1, y1] = scene.bbox;
  const bw = x1 - x0;
  const bh = y1 - y0;
  const scale = opts.scale ?? (opts.width ?? 800) / bw;
  const width = opts.scale === undefined ? (opts.width ?? 800) : Math.round(bw * scale);
  const height = opts.height ?? Math.round(bh * scale);
  ctx.setTransform(scale, 0, 0, -scale, -x0 * scale, y1 * scale);
  const bg = opts.background ?? scene.background;
  if (bg !== undefined) {
    ctx.fillStyle = bg;
    ctx.fillRect(x0, y0, bw, bh);
  }
  const sorted: Feature[] = [...scene.features].sort((a, b) => a.zIndex - b.zIndex); // stable
  for (const f of sorted) {
    if (f.kind === "polygon") {
      if (!isVisiblePolygon(f) || f.points.length < 2) continue;
      ctx.beginPath();
      f.points.forEach(([x, y], i) => {
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.closePath();
      if (!hidden(f.fill)) {
        ctx.fillStyle = f.fill;
        ctx.fill();
      }
      if (f.stroke !== undefined) {
        ctx.strokeStyle = f.stroke;
        ctx.lineWidth = 1 / scale;
        ctx.stroke();
      }
    } else {
      if (!isVisibleText(f)) continue;
      const [fw, fh] = f.fitBox;
      ctx.save();
      ctx.translate(f.x, f.y);
      ctx.rotate((f.rotation * Math.PI) / 180);
      ctx.scale(1, -1);
      ctx.fillStyle = f.fill;
      ctx.font = `${fh}px ${f.fontFamily}`;
      const w = ctx.measureText(f.text).width;
      if (w > fw) ctx.font = `${(fh * fw) / w}px ${f.fontFamily}`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(f.text, 0, 0);
      ctx.restore();
    }
  }
  return { width, height, scale };
}
