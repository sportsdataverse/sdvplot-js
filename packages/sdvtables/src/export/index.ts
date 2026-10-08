import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { InputError, OptionalDependencyError } from "@sportsdataverse/sdvplot";
import {
  type Aspect,
  type Gravity,
  canvasFor,
  checkColor,
  parseAspect,
  parseGravity,
} from "@sportsdataverse/sdvplot/export";
import type { Browser } from "playwright";
import { renderHTML } from "../html/index.js";
import type { TableSpec } from "../spec.js";
import { type TableItem, slug } from "./compose.js";

export { gridTables, stackTables, composePage, slug } from "./compose.js";
export type { ComposeOptions, GridOptions, StackOptions, TableItem } from "./compose.js";

export interface RenderOptions {
  /** viewport width; the screenshot grows past it when the table is wider */
  width?: number;
  /** zoom — gt_save_crop's `zoom = 2` */
  deviceScaleFactor?: number;
  background?: string;
  /** padding around the table, px at scale 1 — gt_save_crop's `whitespace = 50` */
  whitespace?: number;
  /** stylesheet URLs (Google Fonts) awaited via document.fonts.ready */
  fontLinks?: readonly string[];
  /** also write the PNG here (must end in .png) */
  file?: string;
}
export interface SocialCropOptions extends RenderOptions {
  aspect?: Aspect;
  gravity?: Gravity;
}
export interface BatchOptions extends RenderOptions {
  dir: string;
  matchWidth?: boolean;
}

interface Resolved {
  width: number;
  deviceScaleFactor: number;
  background: string;
  whitespace: number;
  fontLinks: readonly string[];
  file: string | undefined;
}

const checkPng = (file: string): void => {
  // Python _check_file: the extension must be a format the writer produces; here that is PNG only
  if (!/\.png$/i.test(file)) throw new InputError(`file must end in .png, got ${JSON.stringify(file)}`);
};

function resolve({
  width = 1200,
  deviceScaleFactor = 2,
  background = "white",
  whitespace = 50,
  fontLinks = [],
  file,
}: RenderOptions): Resolved {
  if (!(Number.isInteger(width) && width > 0))
    throw new InputError(`width must be a positive integer of pixels, got ${String(width)}`);
  if (!(Number.isFinite(deviceScaleFactor) && deviceScaleFactor > 0))
    throw new InputError(`deviceScaleFactor must be a positive number, got ${String(deviceScaleFactor)}`);
  if (!(Number.isFinite(whitespace) && whitespace >= 0))
    throw new InputError(`whitespace must be a non-negative number of pixels, got ${String(whitespace)}`);
  checkColor("background", background);
  if (file !== undefined) checkPng(file);
  return { width, deviceScaleFactor, background, whitespace, fontLinks, file };
}

async function launch(): Promise<Browser> {
  const pw = await import("playwright").catch(() => {
    throw new OptionalDependencyError(
      "sdvtables/export needs the optional peer playwright — pnpm add -D playwright && pnpm exec playwright install chromium",
    );
  });
  return pw.chromium.launch();
}

function page(body: string, o: Resolved, wrapperCss: string): string {
  const links = o.fontLinks.map((href) => `<link rel="stylesheet" href="${href}">`).join("");
  return `<!doctype html><html><head><meta charset="utf-8">${links}<style>html,body{margin:0;background:${o.background}}#sdv-root{background:${o.background};${wrapperCss}}</style></head><body><div id="sdv-root">${body}</div></body></html>`;
}

// ponytail: one chromium per call; pass a shared Browser through here if batches get slow.
async function shoot(body: string, o: Resolved, wrapperCss: string, browser?: Browser): Promise<Uint8Array> {
  const own = browser ?? (await launch());
  try {
    const p = await own.newPage({
      viewport: { width: o.width, height: 800 },
      deviceScaleFactor: o.deviceScaleFactor,
    });
    await p.setContent(page(body, o, wrapperCss), { waitUntil: "load" });
    await p.evaluate(() => document.fonts.ready);
    const root = p.locator("#sdv-root");
    const box = await root.boundingBox();
    if (box && box.width > o.width) await p.setViewportSize({ width: Math.ceil(box.width), height: 800 }); // never clip a wide table
    const png = new Uint8Array(await root.screenshot({ type: "png" }));
    await p.close();
    if (o.file !== undefined) await writeFile(o.file, png);
    return png;
  } finally {
    if (browser === undefined) await own.close();
  }
}

/** gt_save_crop for any HTML: the content tightly framed with `whitespace` padding on `background`. */
export async function htmlToPNG(html: string, options: RenderOptions = {}): Promise<Uint8Array> {
  const o = resolve(options);
  return shoot(html, o, `display:inline-block;padding:${o.whitespace}px`);
}

export function tableToPNG<Row>(
  spec: TableSpec<Row>,
  rows: readonly Row[],
  options: RenderOptions = {},
): Promise<Uint8Array> {
  return htmlToPNG(renderHTML(spec, rows), options);
}

/** gt_social_crop: the padded table on a fixed-ratio canvas; the table is never cropped. */
export async function socialCrop<Row>(
  spec: TableSpec<Row>,
  rows: readonly Row[],
  { aspect = "1:1", gravity = "center", ...rest }: SocialCropOptions = {},
): Promise<Uint8Array> {
  const ratio = parseAspect(aspect);
  const place = parseGravity(gravity);
  const o = resolve({ whitespace: 60, ...rest });
  const html = renderHTML(spec, rows);
  const browser = await launch();
  try {
    const measure = await browser.newPage({ viewport: { width: o.width, height: 800 } });
    await measure.setContent(
      page(
        `<div style="display:inline-block;padding:${o.whitespace}px">${html}</div>`,
        o,
        "display:inline-block",
      ),
      { waitUntil: "load" },
    );
    await measure.evaluate(() => document.fonts.ready);
    const box = await measure.locator("#sdv-root").boundingBox();
    await measure.close();
    if (!box) throw new InputError("socialCrop: the table rendered with no size");
    const [cw, ch] = canvasFor(Math.ceil(box.width), Math.ceil(box.height), ratio);
    const justify = place.endsWith("west") ? "flex-start" : place.endsWith("east") ? "flex-end" : "center";
    const alignItems = place.startsWith("north")
      ? "flex-start"
      : place.startsWith("south")
        ? "flex-end"
        : "center";
    const wrapper = `display:flex;box-sizing:border-box;width:${cw}px;height:${ch}px;justify-content:${justify};align-items:${alignItems}`;
    return await shoot(
      // await: without it `finally` closes the browser before the screenshot runs
      `<div style="padding:${o.whitespace}px">${html}</div>`,
      { ...o, width: Math.max(o.width, cw) },
      wrapper,
      browser,
    );
  } finally {
    await browser.close();
  }
}

/** gt_save_batch: one image per group value, `{group}` in the file name replaced by `slug(value)`. */
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
  await mkdir(dir, { recursive: true });
  const items = [...groups].map(([v, rs], i) => {
    const built = build(rs, v);
    return {
      file: join(dir, names[i] as string),
      html: typeof built === "string" ? built : renderHTML(built.spec, built.rows),
    };
  });
  const browser = await launch();
  try {
    let minWidth = 0;
    if (matchWidth) {
      const p = await browser.newPage({ viewport: { width: o.width, height: 800 } });
      for (const it of items) {
        await p.setContent(page(it.html, o, "display:inline-block"), { waitUntil: "load" });
        const box = await p.locator("#sdv-root").boundingBox();
        minWidth = Math.max(minWidth, Math.ceil(box?.width ?? 0));
      }
      await p.close();
    }
    // inline-flex shrinks to the widest table; a block-level flex box would stretch every image to the viewport
    const wrapper = `display:inline-flex;justify-content:center;padding:${o.whitespace}px;box-sizing:content-box;min-width:${minWidth}px`;
    const out: string[] = [];
    for (const it of items) {
      await shoot(it.html, { ...o, file: it.file }, wrapper, browser);
      out.push(it.file);
    }
    return out;
  } finally {
    await browser.close();
  }
}
