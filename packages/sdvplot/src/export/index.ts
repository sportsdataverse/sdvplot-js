import { onColor, roundHalfEven } from "../contrast.js";
import { DownloadError, InputError, OptionalDependencyError, warn } from "../errors.js";

/** A canvas ratio, width to height: `"16:9"`, `"4x5"`, a number such as 1.91, or a numeric string such as `"1.91"`. */
export type Aspect = "1:1" | "16:9" | "4:5" | "9:16" | "1.91:1" | number | (string & {});
/** Where the figure sits on the canvas, as in ImageMagick (and sdvplot/sdvplotR `gt_social_crop`). */
export type Gravity =
  | "center"
  | "north"
  | "south"
  | "east"
  | "west"
  | "northwest"
  | "northeast"
  | "southwest"
  | "southeast";
/** Options for {@link toPNG}. */
export interface ToPNGOptions {
  /** output width in CSS pixels, the height following (multiplied by `scale`); absent: the SVG's own size */
  width?: number;
  /** device-pixel multiplier, a positive number; default 1 */
  scale?: number;
  /** a color painted under transparent areas; absent: transparent */
  background?: string;
  /**
   * the root `color`, which `currentColor` (Plot's axes and text) resolves to; absent: the SVG's own root `color`, else
   * black or white, whichever contrasts more with `background` (black when there is no background)
   */
  color?: string;
  /**
   * remote `<image href="http(s)://…">` (logos, headshots): `"fetch"` (default) downloads each once with the global
   * `fetch` and draws it, a failed download throwing `DownloadError`; `"skip"` leaves them out with one warning
   */
  images?: "fetch" | "skip";
}
/** Options for {@link socialCard}; defaults are Python/R `gt_social_crop`'s. */
export interface SocialCardOptions {
  /** the canvas ratio; default `"1:1"` */
  aspect?: Aspect;
  /** pixels left around the figure before the canvas grows to the ratio (truncated to an integer); default 60 */
  padding?: number;
  /** the canvas color; default `"white"` */
  background?: string;
  /** where the padded figure sits on the canvas; default `"center"` */
  gravity?: Gravity;
  /**
   * the canvas root `color`, which the figure's `currentColor` (Plot's axes and text) inherits; absent: black or white,
   * whichever contrasts more with a hex `background` (none for a named background: give `color`, or a hex)
   */
  color?: string;
}
/** An SVG's size, from its `width`/`height` attributes or else its `viewBox`. */
export interface SvgSize {
  /** user units: the width attribute, else the viewBox width */
  width: number;
  /** user units: the height attribute, else the viewBox height */
  height: number;
  /** the root viewBox, else `0 0 width height` */
  viewBox: string;
}

const GRAVITY: readonly Gravity[] = [
  "center",
  "north",
  "south",
  "east",
  "west",
  "northwest",
  "northeast",
  "southwest",
  "southeast",
];
/** Port of Python `_check_gravity`: one of the nine magick gravities, case-insensitive; anything else is an InputError. */
export function parseGravity(gravity: string): Gravity {
  const g = String(gravity).toLowerCase();
  const hit = GRAVITY.find((x) => x === g);
  if (hit === undefined)
    throw new InputError(`gravity must be one of ${GRAVITY.join(", ")}, got ${JSON.stringify(gravity)}`);
  return hit;
}
/**
 * A CSS color written into markup: names, hex, rgb()/hsl() (with `/` alpha too); never a quote, angle bracket,
 * semicolon or equals sign.
 */
export function checkColor(name: string, value: string): string {
  if (!/^[#a-zA-Z0-9(),.%/ -]+$/.test(value))
    throw new InputError(`${name} must be a CSS color, got ${JSON.stringify(value)}`);
  return value;
}

/** Python `float()` of a string: an underscore is allowed only between two digits ("1_0" is 10). */
const pyFloat = (s: string | number): number =>
  Number(typeof s === "string" ? s.replace(/(?<=\d)_(?=\d)/g, "") : s);

/** Port of Python `_ratio`: "16:9", "4x5" (exactly two parts) or a positive finite number, numeric strings included. */
export function parseAspect(aspect: Aspect): number {
  let ratio = Number.NaN;
  if (typeof aspect === "string" && /[:x]/.test(aspect)) {
    const parts = aspect.split(/[:x]/);
    if (parts.length === 2) ratio = pyFloat(parts[0] as string) / pyFloat(parts[1] as string); // Python `a, b = re.split(...)`
  } else if (typeof aspect === "number" || typeof aspect === "string") ratio = pyFloat(aspect); // Python float("1.91")
  if (!(ratio > 0 && Number.isFinite(ratio))) {
    throw new InputError(
      `aspect could not be read as a ratio: got ${String(aspect)}; use "1:1", "16:9", "4x5" or a number like 1.91`,
    );
  }
  return ratio;
}

/** Port of Python `_canvas`: expand the short side until the ratio is met; never shrink. Rounds half to even (Python/R `round`). */
export function canvasFor(width: number, height: number, ratio: number): [number, number] {
  return width / height > ratio
    ? [width, roundHalfEven(width / ratio)]
    : [roundHalfEven(height * ratio), height];
}

/** Port of Python `_extent` placement: the offset of a figure with `dx`/`dy` spare pixels around it. */
export function offsetFor(dx: number, dy: number, gravity: Gravity): [number, number] {
  const x = gravity.endsWith("west") ? 0 : gravity.endsWith("east") ? dx : Math.floor(dx / 2);
  const y = gravity.startsWith("north") ? 0 : gravity.startsWith("south") ? dy : Math.floor(dy / 2);
  return [x, y];
}

const SVG_NS = "http://www.w3.org/2000/svg";
const XLINK_NS = "http://www.w3.org/1999/xlink";
const OPEN_TAG = /<svg\b[^>]*>/i;
const attrOf = (tag: string, name: string): string | undefined =>
  new RegExp(`\\s${name}=["']([^"']+)["']`, "i").exec(tag)?.[1];
/** A plain or `px` length; a percent or relative unit (`em`) is NaN, so the size comes from the viewBox. */
const userUnits = (v: string | undefined): number => Number(v?.trim().replace(/px$/i, "") || Number.NaN);

/**
 * The root `<svg>`'s size: `width`/`height` attributes in user units or px, else the viewBox's (D3 output often has
 * only a viewBox; a `100%` size is relative to a container a standalone SVG does not have).
 */
export function svgSize(svg: string): SvgSize {
  const open = OPEN_TAG.exec(svg)?.[0];
  if (!open) throw new InputError("socialCard: no <svg> root element");
  const vb = attrOf(open, "viewBox");
  const parts = vb
    ?.trim()
    .split(/[\s,]+/)
    .map(Number);
  const w = userUnits(attrOf(open, "width"));
  const h = userUnits(attrOf(open, "height"));
  const width = Number.isFinite(w) ? w : parts?.[2];
  const height = Number.isFinite(h) ? h : parts?.[3];
  if (width === undefined || height === undefined || !(width > 0) || !(height > 0)) {
    throw new InputError("socialCard: the <svg> needs width/height attributes or a viewBox");
  }
  return { width, height, viewBox: vb ?? `0 0 ${width} ${height}` };
}

/**
 * Port of sdvplot/sdvplotR `gt_social_crop` framing for an SVG figure: pad, then extend the short side to the ratio
 * (the figure is never cropped). Arguments are checked in Python's order (ratio, gravity, background, padding) before
 * anything is built. A final rescale (`width=` in Python/R) is `toPNG(socialCard(svg), { width })`.
 */
export function socialCard(
  svg: string,
  { aspect = "1:1", padding = 60, background = "white", gravity = "center", color }: SocialCardOptions = {},
): string {
  const ratio = parseAspect(aspect);
  const place = parseGravity(gravity);
  checkColor("background", background);
  if (color !== undefined) checkColor("color", color);
  if (!(Number.isFinite(padding) && padding >= 0))
    throw new InputError(`padding must be a non-negative number of pixels, got ${String(padding)}`);
  const pad = Math.trunc(padding); // Python _pixels: int(whitespace)
  const { width, height, viewBox } = svgSize(svg);
  const [cw, ch] = canvasFor(width + 2 * pad, height + 2 * pad, ratio);
  const [ox, oy] = offsetFor(cw - (width + 2 * pad), ch - (height + 2 * pad), place);
  // ponytail: contrast is judged for an opaque hex background only; a named one needs `color` (no CSS name table here)
  const ink = color ?? (/^#(?:[0-9a-f]{3}){1,2}$/i.test(background) ? onColor(background) : undefined);
  const open = OPEN_TAG.exec(svg)?.[0] ?? "<svg>";
  const stripped = open.replace(/\s(?:x|y|width|height|viewBox)=["'][^"']*["']/gi, "");
  // replacer functions: a `$&`, `$'` or `` $` `` in the figure's own attributes is text, not a replacement pattern
  const inner = svg.replace(open, () =>
    stripped.replace(
      /^<svg/i,
      () => `<svg x="${ox + pad}" y="${oy + pad}" width="${width}" height="${height}" viewBox="${viewBox}"`,
    ),
  );
  const inked = ink === undefined ? "" : ` color="${ink}"`;
  return `<svg xmlns="${SVG_NS}"${inked} width="${cw}" height="${ch}" viewBox="0 0 ${cw} ${ch}"><rect width="${cw}" height="${ch}" fill="${background}"/>${inner}</svg>`;
}

/** Node's "cannot find" for the peer itself, on the error or under a loader's wrapper (vitest's mock error, say). */
const peerMissing = (e: unknown): boolean =>
  e instanceof Error &&
  ((/MODULE_NOT_FOUND/.test(String((e as { code?: unknown }).code)) &&
    /['"]@resvg\/resvg-js['"]/.test(e.message)) ||
    peerMissing(e.cause));

/** The bytes at `url`; a network failure or a non-2xx answer is a DownloadError. */
async function download(url: string): Promise<Uint8Array> {
  let r: Response;
  try {
    r = await fetch(url);
    if (r.ok) return new Uint8Array(await r.arrayBuffer());
  } catch (e) {
    throw Object.assign(new DownloadError(`toPNG could not download ${url}: ${String(e)}`, url), {
      cause: e,
    });
  }
  throw new DownloadError(`toPNG could not download ${url}: it answered ${r.status}`, url, r.status);
}

/** `href="url"` / `xlink:href='url'` attributes, the URL as written or with `&` escaped as `&amp;`. */
const hrefAttr = (url: string): RegExp => {
  const re = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(href=)(["'])(?:${re(url)}|${re(url.replaceAll("&", "&amp;"))})\\2`, "g");
};

/**
 * Rasterize an SVG with `@resvg/resvg-js` (optional peer; Node only). Throws OptionalDependencyError when it is missing.
 * An HTML-serialized figure (a DOM element or its `outerHTML`, as Observable Plot makes) gets the `xmlns` (and
 * `xmlns:xlink`) declarations it lacks. Remote images are downloaded and drawn unless `images` is `"skip"`.
 */
export async function toPNG(
  svg: string | { outerHTML: string },
  { width, scale = 1, background, color, images = "fetch" }: ToPNGOptions = {},
): Promise<Uint8Array> {
  if (!(Number.isFinite(scale) && scale > 0))
    throw new InputError(`scale must be a positive number, got ${String(scale)}`);
  if (width !== undefined && !(Number.isFinite(width) && width > 0))
    throw new InputError(`width must be a positive number of pixels, got ${String(width)}`);
  if (background !== undefined) checkColor("background", background);
  if (color !== undefined) checkColor("color", color);
  if (images !== "fetch" && images !== "skip")
    throw new InputError(`images must be "fetch" or "skip", got ${JSON.stringify(images)}`);
  let text = typeof svg === "string" ? svg : svg.outerHTML;
  const mod = await import("@resvg/resvg-js").catch((e: unknown) => {
    throw new OptionalDependencyError(
      peerMissing(e)
        ? "toPNG needs the optional peer @resvg/resvg-js, which is not installed: pnpm add @resvg/resvg-js"
        : `toPNG could not load the optional peer @resvg/resvg-js (installed, but it failed to load): ${String(e)}`,
      { cause: e },
    );
  });
  const fitTo =
    width !== undefined
      ? { mode: "width" as const, value: Math.round(width * scale) }
      : { mode: "zoom" as const, value: scale };
  const opts = { fitTo, ...(background !== undefined && { background }) };

  const open = OPEN_TAG.exec(text)?.[0];
  if (open !== undefined) {
    let add = "";
    if (!/\sxmlns=/i.test(open)) add += ` xmlns="${SVG_NS}"`; // resvg parses XML; HTML serialization drops xmlns
    if (/\sxlink:[\w-]+=/i.test(text) && !/\sxmlns:xlink=/i.test(open)) add += ` xmlns:xlink="${XLINK_NS}"`;
    let ink = color;
    if (
      ink === undefined &&
      background !== undefined &&
      !/\scolor=/i.test(open) &&
      /currentcolor/i.test(text)
    ) {
      // the background as resvg paints it (names and rgb() too): a 1x1 render
      // ponytail: pixels are premultiplied, so a translucent background is judged as if over black
      const p = new mod.Resvg(`<svg xmlns="${SVG_NS}" width="1" height="1"/>`, { background }).render()
        .pixels;
      ink = onColor(`#${[p[0], p[1], p[2]].map((v) => (v ?? 0).toString(16).padStart(2, "0")).join("")}`);
    }
    let tag = open;
    if (ink !== undefined) {
      tag = tag.replace(/\scolor=["'][^"']*["']/i, ""); // an explicit `color` option replaces the figure's own
      add += ` color="${ink}"`;
    }
    text = text.replace(open, () => tag.replace(/^<svg/i, () => `<svg${add}`));
  }

  let resvg = new mod.Resvg(text, opts);
  const hrefs = [...new Set(resvg.imagesToResolve())]; // remote hrefs resvg cannot load itself
  if (hrefs.length > 0 && images === "skip") {
    warn(
      `toPNG:skip:${hrefs.join(" ")}`,
      `toPNG left out ${hrefs.length} remote image(s): ${hrefs.join(", ")}`,
    );
  } else if (hrefs.length > 0) {
    const bodies = await Promise.all(hrefs.map(download));
    // resolveImage takes PNG/JPEG/GIF only; an SVG mark goes in as a data URI, which resvg draws as a nested SVG
    const vector = bodies.map((b) => new TextDecoder().decode(b.subarray(0, 64)).trimStart().startsWith("<"));
    if (vector.includes(true)) {
      for (const [i, href] of hrefs.entries()) {
        if (!vector[i]) continue;
        const uri = `data:image/svg+xml;base64,${Buffer.from(bodies[i] as Uint8Array).toString("base64")}`;
        text = text.replace(hrefAttr(href), (_m, attr: string, q: string) => `${attr}${q}${uri}${q}`);
      }
      resvg = new mod.Resvg(text, opts);
    }
    for (const [i, href] of hrefs.entries())
      if (!vector[i]) resvg.resolveImage(href, Buffer.from(bodies[i] as Uint8Array));
  }
  return new Uint8Array(resvg.render().asPng());
}
