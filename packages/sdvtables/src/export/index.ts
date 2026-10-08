import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { InputError, OptionalDependencyError, SdvplotError, warn } from "@sportsdataverse/sdvplot";
import {
  type Aspect,
  type Gravity,
  canvasFor,
  checkColor,
  offsetFor,
  parseAspect,
  parseGravity,
  peerMissing,
} from "@sportsdataverse/sdvplot/export";
import type { Browser, Page } from "playwright";
import { escapeAttr } from "../html/escape.js";
import { renderHTML } from "../html/index.js";
import type { TableSpec } from "../spec.js";
import { type TableItem, slug } from "./compose.js";

export { gridTables, stackTables, composePage, slug } from "./compose.js";
export type { ComposeOptions, GridOptions, StackOptions, TableItem } from "./compose.js";

/**
 * Options for {@link htmlToPNG} and {@link tableToPNG}; defaults are Python `gt_save_crop`'s. Its `expand` (the page
 * captured before trimming) is fixed here, as it only has to leave background around the content.
 */
export interface RenderOptions {
  /** the final image width in pixels, the height following (Python `width`); absent: the rendered width */
  width?: number;
  /** the rendering zoom (Python `zoom`); default 2, a sharp (retina) image */
  deviceScaleFactor?: number;
  /** the color around the content; default "white" */
  background?: string;
  /** image pixels of `background` left around the trimmed content (Python `whitespace`, truncated to an integer); default 50 */
  whitespace?: number;
  /** stylesheet URLs (Google Fonts) awaited via document.fonts.ready */
  fontLinks?: readonly string[];
  /** also write the PNG here (must end in .png) */
  file?: string;
}
/** Options for {@link socialCrop}; defaults are Python `gt_social_crop`'s (whitespace 60). */
export interface SocialCropOptions extends RenderOptions {
  aspect?: Aspect;
  gravity?: Gravity;
}
/** Options for {@link batchToPNG}, as Python `gt_save_batch` (no `width`; each file is named by its group). */
export interface BatchOptions extends Omit<RenderOptions, "width" | "file"> {
  dir: string;
  matchWidth?: boolean;
}

interface Resolved {
  width: number | undefined;
  deviceScaleFactor: number;
  background: string;
  whitespace: number;
  fontLinks: readonly string[];
  file: string | undefined;
}

/** The page width tables lay out in; a wider table grows the page rather than being clipped. */
const VIEWPORT = 1200;
/** CSS px of page captured around the content, so the trim finds plain background on every side. */
const EXPAND = 5;
/**
 * Chromium's canvas limits (Blink: 65,535 px a side, 32,768 x 8,192 px in all; measured in playwright 1.64's
 * chromium). Past either, `toDataURL` returns "data:," and `getImageData` reads blank, without an error.
 */
const MAX_SIDE = 65_535;
const MAX_AREA = 32_768 * 8_192;
const REMEDY =
  "put fewer rows in each image (rows.slice() a page at a time, batchToPNG by a group column, or gridTables to set tables side by side), or lower deviceScaleFactor";
const n = (v: number): string => v.toLocaleString("en-US");

/** I1: a canvas past Chromium's limits draws nothing; say so, with the size, before drawing it. */
function checkCanvas(what: string, w: number, h: number, o: Resolved): void {
  if (w <= MAX_SIDE && h <= MAX_SIDE && w * h <= MAX_AREA) return;
  throw new SdvplotError(
    `${what} ${n(w)} × ${n(h)} px at deviceScaleFactor ${o.deviceScaleFactor}, past Chromium's canvas limit of ${n(MAX_SIDE)} px a side and ${n(MAX_AREA)} px in all; ${REMEDY}`,
  );
}

const checkPng = (file: string): void => {
  // Python _check_file: the extension must be a format the writer produces; here that is PNG only
  if (!/\.png$/i.test(file)) throw new InputError(`file must end in .png, got ${JSON.stringify(file)}`);
};

function resolve({
  width,
  deviceScaleFactor = 2,
  background = "white",
  whitespace = 50,
  fontLinks = [],
  file,
}: RenderOptions): Resolved {
  if (width !== undefined && !(Number.isInteger(width) && width > 0))
    throw new InputError(`width must be a positive integer of pixels, got ${String(width)}`);
  if (!(Number.isFinite(deviceScaleFactor) && deviceScaleFactor > 0))
    throw new InputError(`deviceScaleFactor must be a positive number, got ${String(deviceScaleFactor)}`);
  if (!(Number.isFinite(whitespace) && whitespace >= 0))
    throw new InputError(`whitespace must be a non-negative number of pixels, got ${String(whitespace)}`);
  checkColor("background", background);
  if (file !== undefined) checkPng(file);
  // Python _pixels: int()
  return { width, deviceScaleFactor, background, whitespace: Math.trunc(whitespace), fontLinks, file };
}

async function launch(): Promise<Browser> {
  const pw = await import("playwright").catch((e: unknown) => {
    throw new OptionalDependencyError(
      peerMissing(e, "playwright")
        ? "sdvtables/export needs the optional peer playwright, which is not installed: pnpm add -D playwright && pnpm exec playwright install chromium"
        : `sdvtables/export could not load the optional peer playwright (installed, but it failed to load): ${String(e)}`,
      { cause: e },
    );
  });
  try {
    return await pw.chromium.launch();
  } catch (e) {
    if (e instanceof Error && /Executable doesn't exist/.test(e.message))
      throw new OptionalDependencyError(
        "sdvtables/export found playwright but not its chromium browser: pnpm exec playwright install chromium",
        { cause: e },
      );
    throw e;
  }
}

function page(body: string, o: Resolved): string {
  const links = o.fontLinks.map((href) => `<link rel="stylesheet" href="${escapeAttr(href)}">`).join("");
  return `<!doctype html><html><head><meta charset="utf-8">${links}<style>html,body{margin:0;background:${o.background}}#sdv-root{display:inline-block;padding:${EXPAND}px;background:${o.background}}</style></head><body><div id="sdv-root">${body}</div></body></html>`;
}

/** A screenshot (base64 PNG) and its trim box: x, y, width, height in image pixels. */
interface Shot {
  png: string;
  trim: [number, number, number, number];
}

/** In the page: Python `_trim` (ImageMagick, fuzz 0), the box of the pixels unlike the top-left one; all one color: the whole image. */
async function trimBox(png: string): Promise<[number, number, number, number]> {
  const img = new Image();
  img.src = `data:image/png;base64,${png}`;
  await img.decode();
  const c = document.createElement("canvas");
  c.width = img.width;
  c.height = img.height;
  const g = c.getContext("2d") as CanvasRenderingContext2D;
  g.drawImage(img, 0, 0);
  const px = new Uint32Array(g.getImageData(0, 0, c.width, c.height).data.buffer);
  const bg = px[0];
  let [x0, y0, x1, y1] = [c.width, c.height, -1, -1];
  for (let y = 0, i = 0; y < c.height; y++)
    for (let x = 0; x < c.width; x++, i++)
      if (px[i] !== bg) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        y1 = y;
      }
  return x1 < 0 ? [0, 0, c.width, c.height] : [x0, y0, x1 - x0 + 1, y1 - y0 + 1];
}

/** In the page: the trimmed shot placed at dx, dy on a w x h canvas of `bg`, then scaled to fw x fh; a base64 PNG. */
async function drawPNG(a: {
  png: string;
  trim: [number, number, number, number];
  w: number;
  h: number;
  dx: number;
  dy: number;
  fw: number;
  fh: number;
  bg: string;
}): Promise<string> {
  const img = new Image();
  img.src = `data:image/png;base64,${a.png}`;
  await img.decode();
  const c = document.createElement("canvas");
  c.width = a.w;
  c.height = a.h;
  const g = c.getContext("2d") as CanvasRenderingContext2D;
  g.fillStyle = a.bg;
  g.fillRect(0, 0, a.w, a.h);
  const [x, y, tw, th] = a.trim;
  g.drawImage(img, x, y, tw, th, a.dx, a.dy, tw, th);
  let out = c;
  if (a.fw !== a.w || a.fh !== a.h) {
    out = document.createElement("canvas");
    out.width = a.fw;
    out.height = a.fh;
    const s = out.getContext("2d") as CanvasRenderingContext2D;
    s.imageSmoothingQuality = "high";
    s.drawImage(c, 0, 0, a.fw, a.fh);
  }
  return out.toDataURL("image/png").slice("data:image/png;base64,".length);
}

/** `html` rendered at the zoom (a wide table is never clipped) and trimmed: Python `_trim(_render_gt(...))`. */
async function snap(p: Page, html: string, o: Resolved): Promise<Shot> {
  await p.setViewportSize({ width: VIEWPORT, height: 800 });
  await p.setContent(page(html, o), { waitUntil: "load" });
  await p.evaluate(() => document.fonts.ready);
  const root = p.locator("#sdv-root");
  const box = await root.boundingBox();
  if (box) {
    const z = o.deviceScaleFactor;
    checkCanvas("the table renders", Math.ceil(box.width * z), Math.ceil(box.height * z), o);
  }
  if (box && box.width > VIEWPORT) await p.setViewportSize({ width: Math.ceil(box.width), height: 800 });
  const png = Buffer.from(await root.screenshot({ type: "png" })).toString("base64");
  return { png, trim: await p.evaluate(trimBox, png) };
}

/**
 * Python's finishing steps, in image pixels: `_extent` to `minWidth` (centred), `_pad` by `whitespace`, the social
 * `_canvas` + `_extent` by gravity, `_fit_width` to `width`. Writes `o.file` when set.
 */
async function finish(
  p: Page,
  shot: Shot,
  o: Resolved,
  { minWidth = 0, ratio, gravity = "center" }: { minWidth?: number; ratio?: number; gravity?: Gravity } = {},
): Promise<Uint8Array> {
  const [, , tw, th] = shot.trim;
  const ws = o.whitespace;
  let [w, h] = [Math.max(tw, minWidth) + 2 * ws, th + 2 * ws];
  let [dx, dy] = [Math.floor((w - 2 * ws - tw) / 2) + ws, ws];
  if (ratio !== undefined) {
    const [cw, ch] = canvasFor(w, h, ratio);
    const [ox, oy] = offsetFor(cw - w, ch - h, gravity);
    [w, h, dx, dy] = [cw, ch, dx + ox, dy + oy];
  }
  // Python _fit_width: the height rounded half up, as ImageMagick
  const [fw, fh] =
    o.width === undefined ? [w, h] : [o.width, Math.max(1, Math.floor((h * o.width) / w + 0.5))];
  checkCanvas("the image would be", w, h, o);
  checkCanvas("the image scaled to `width` would be", fw, fh, o);
  const b64 = await p.evaluate(drawPNG, {
    png: shot.png,
    trim: shot.trim,
    w,
    h,
    dx,
    dy,
    fw,
    fh,
    bg: o.background,
  });
  // "data:," (no base64): a canvas Chromium would not allocate; never return or write an empty image
  if (b64 === "")
    throw new SdvplotError(`Chromium returned an empty image for ${n(fw)} × ${n(fh)} px; ${REMEDY}`);
  const png = new Uint8Array(Buffer.from(b64, "base64"));
  if (o.file !== undefined) await writeFile(o.file, png);
  return png;
}

async function withPage<T>(o: Resolved, fn: (p: Page) => Promise<T>): Promise<T> {
  const browser = await launch();
  try {
    return await fn(await browser.newPage({ deviceScaleFactor: o.deviceScaleFactor }));
  } finally {
    await browser.close();
  }
}

/**
 * gt_save_crop for any HTML: rendered at `deviceScaleFactor`, trimmed to its content, `whitespace` image pixels of
 * `background` put back around it, then scaled to `width` when given. An image past Chromium's canvas limit (65,535
 * px a side, 268,435,456 px in all; near 1,000 plain rows at zoom 2) throws `SdvplotError` naming its size, before
 * anything is drawn or written.
 */
export async function htmlToPNG(html: string, options: RenderOptions = {}): Promise<Uint8Array> {
  const o = resolve(options);
  return withPage(o, async (p) => finish(p, await snap(p, html, o), o));
}

/** gt_save_crop: {@link htmlToPNG} of the rendered table. */
export function tableToPNG<Row>(
  spec: TableSpec<Row>,
  rows: readonly Row[],
  options: RenderOptions = {},
): Promise<Uint8Array> {
  return htmlToPNG(renderHTML(spec, rows), options);
}

/** gt_social_crop: the trimmed, padded table on a fixed-ratio canvas placed by `gravity`; the table is never cropped. */
export async function socialCrop<Row>(
  spec: TableSpec<Row>,
  rows: readonly Row[],
  { aspect = "1:1", gravity = "center", ...rest }: SocialCropOptions = {},
): Promise<Uint8Array> {
  const ratio = parseAspect(aspect);
  const place = parseGravity(gravity);
  const o = resolve({ whitespace: 60, ...rest });
  const html = renderHTML(spec, rows);
  return withPage(o, async (p) => finish(p, await snap(p, html, o), o, { ratio, gravity: place }));
}

/**
 * gt_save_batch: one image per group value, `{group}` in the file name replaced by `slug(value)`. A group whose table
 * fails to build (`build` or the spec throws) is skipped and named in one warning at the end; when none builds, the
 * error lists every failure. Python's `quiet` progress lines are not ported.
 */
export async function batchToPNG<Row, G extends keyof Row>(
  rows: readonly Row[],
  group: G,
  build: (groupRows: Row[], value: Row[G]) => TableItem<Row>,
  filePattern: string,
  { dir, matchWidth = true, ...rest }: BatchOptions,
): Promise<string[]> {
  if (!filePattern.includes("{group}"))
    throw new InputError(`filePattern must contain "{group}", got ${filePattern}`);
  checkPng(filePattern);
  const o = resolve(rest);
  const groups = new Map<Row[G], Row[]>();
  for (const r of rows) {
    const v = r[group];
    if (v === null || v === undefined) continue;
    const bucket = groups.get(v);
    if (bucket) bucket.push(r);
    else groups.set(v, [r]);
  }
  if (groups.size === 0) throw new InputError(`no non-missing values in column ${String(group)}`);
  const names = [...groups.keys()].map((v) => filePattern.replace("{group}", slug(v)));
  const shared = [...new Set(names.filter((n, i) => names.indexOf(n) !== i))].sort();
  if (shared.length > 0)
    // Python gt_save_batch: two values must never write one file
    throw new InputError(
      `group values write to the same file name: ${shared.join(", ")}; rename the values first`,
    );
  const items: { file: string; html: string }[] = [];
  const failed: string[] = [];
  [...groups].forEach(([v, rs], i) => {
    try {
      const built = build(rs, v);
      items.push({
        file: join(dir, names[i] as string),
        html: typeof built === "string" ? built : renderHTML(built.spec, built.rows),
      });
    } catch (e) {
      failed.push(`${String(v)}: ${e instanceof Error ? e.message : String(e)}`);
    }
  });
  if (items.length === 0) throw new SdvplotError(`No group built successfully:\n${failed.join("\n")}`);
  await mkdir(dir, { recursive: true });
  const out = await withPage(o, async (p) => {
    const shots: Shot[] = [];
    for (const it of items) shots.push(await snap(p, it.html, o));
    // Python: every trimmed image extended (centred) to the widest one's width, then padded
    const minWidth = matchWidth ? Math.max(...shots.map((s) => s.trim[2])) : 0;
    for (const [i, it] of items.entries())
      await finish(p, shots[i] as Shot, { ...o, file: it.file }, { minWidth });
    return items.map((it) => it.file);
  });
  if (failed.length > 0)
    warn(
      `sdvtables:batch:${filePattern}:${failed.join("|")}`,
      `${failed.length} group(s) failed and were skipped:\n${failed.join("\n")}`,
    );
  return out;
}
