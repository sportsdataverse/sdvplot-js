import { InputError } from "./errors.js";
import { type Color, type Feature, type Scene, hidden, isVisiblePolygon, isVisibleText } from "./scene.js";

/**
 * Browser `CanvasRenderingContext2D` or `@napi-rs/canvas` `SKRSContext2D`; only the members below are used.
 * Structural and DOM-type-free (`fillStyle`/`strokeStyle` are `unknown`, `textAlign`/`textBaseline` are `string`),
 * so neither consumer needs the DOM lib.
 */
export interface SceneCanvasContext {
  save(): void;
  restore(): void;
  transform(a: number, b: number, c: number, d: number, e: number, f: number): void;
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
 * Paints `scene` at the origin of `ctx` and returns the size drawn, in the caller's current units.
 * Give `width` (default 800, like `toSVG`; the height follows the aspect), `width` and `height` (the scene
 * is fitted into the box, like `toSVG`'s viewBox, and the returned size is the fitted one), or `scale`
 * (px per unit; the box size follows). The scene transform composes with the caller's (a HiDPI
 * `ctx.scale(dpr, dpr)` survives) and the context is restored afterwards.
 * Throws `InputError` when the scene's bbox is empty (the `custom` leagues of some sports).
 */
export function drawScene(
  ctx: SceneCanvasContext,
  scene: Scene,
  opts: DrawSceneOptions = {},
): { width: number; height: number; scale: number } {
  const [x0, y0, x1, y1] = scene.bbox;
  const bw = x1 - x0;
  const bh = y1 - y0;
  if (!(bw > 0 && bh > 0 && Number.isFinite(bw + bh)))
    throw new InputError(
      `${scene.sport} "${scene.league}" has an empty bbox [${scene.bbox.join(", ")}]; nothing to draw`,
    );
  const box = opts.width ?? 800;
  const scale = opts.scale ?? (opts.height === undefined ? box / bw : Math.min(box / bw, opts.height / bh));
  const width = Math.round(bw * scale);
  const height = Math.round(bh * scale);
  ctx.save();
  ctx.transform(scale, 0, 0, -scale, -x0 * scale, y1 * scale);
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
  ctx.restore();
  return { width, height, scale };
}
