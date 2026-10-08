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

/**
 * True when `e` is Node's "cannot find" (`ERR_MODULE_NOT_FOUND` / `MODULE_NOT_FOUND`) for the optional peer `name`
 * itself, on the error or under a loader's wrapper (vitest's mock error, say); a file missing inside an installed peer
 * is not.
 *
 * @example
 * ```ts
 * import { createRequire } from "node:module";
 * import { peerMissing } from "@sportsdataverse/sdvplot/export";
 *
 * // Node's resolver, asked for a package that is not installed, throws MODULE_NOT_FOUND naming it
 * const name = "@sportsdataverse/no-such-peer";
 * let error: unknown;
 * try {
 *   createRequire(import.meta.url).resolve(name);
 * } catch (e) {
 *   error = e;
 * }
 * peerMissing(error, name); // true; peerMissing(error, "@resvg/resvg-js") is false
 * ```
 */
export function peerMissing(e: unknown, name: string): boolean {
  const quoted = new RegExp(`['"]${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}['"]`);
  return (
    e instanceof Error &&
    ((/MODULE_NOT_FOUND/.test(String((e as { code?: unknown }).code)) && quoted.test(e.message)) ||
      peerMissing(e.cause, name))
  );
}

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

/** At most this many image downloads in flight at once: a figure with hundreds of logos must not open hundreds of sockets. */
const FETCH_LIMIT = 8;

/** `fn` over `xs` with at most `limit` calls in flight; results keep input order, and the first failure stops new calls. */
async function mapLimit<T, R>(xs: readonly T[], limit: number, fn: (x: T) => Promise<R>): Promise<R[]> {
  const out = new Array<R>(xs.length);
  let next = 0;
  const worker = async (): Promise<void> => {
    while (next < xs.length) {
      const i = next++;
      try {
        out[i] = await fn(xs[i] as T);
      } catch (e) {
        next = xs.length;
        throw e;
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, xs.length) }, worker));
  return out;
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
      peerMissing(e, "@resvg/resvg-js")
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

  // the remote hrefs resvg cannot load itself, from a parse without the system-font scan (text does not change them)
  const probe = new mod.Resvg(text, NO_FONTS);
  const hrefs = [...new Set(probe.imagesToResolve())];
  let bodies: Uint8Array[] = [];
  if (hrefs.length > 0 && images === "skip") {
    warn(
      `toPNG:skip:${hrefs.join(" ")}`,
      `toPNG left out ${hrefs.length} remote image(s): ${hrefs.join(", ")}`,
    );
  } else if (hrefs.length > 0) {
    bodies = await mapLimit(hrefs, FETCH_LIMIT, download);
    const zoom = fitTo.mode === "width" ? fitTo.value / probe.width : scale;
    const tags = text.match(/<image\b[^>]*>/gi) ?? [];
    // every image goes in as a data URI, so ONE Resvg draws them all: resolveImage costs ~150 ms a call
    for (const [i, href] of hrefs.entries()) {
      const b = bodies[i] as Uint8Array;
      let uri = dataURI(b);
      const re = hrefAttr(href);
      const small = shrink(
        mod,
        uri,
        tags.filter((t) => t.search(re) >= 0),
        zoom,
      );
      if (small !== undefined) uri = dataURI(small);
      text = text.replace(re, (_m, attr: string, q: string) => `${attr}${q}${uri}${q}`);
    }
  }
  const resvg = new mod.Resvg(text, opts);
  if (bodies.length > 0) {
    // an href escaped in a way hrefAttr does not match is still drawn, the slow way (resolveImage: raster only)
    const left = new Set(resvg.imagesToResolve());
    for (const [i, href] of hrefs.entries())
      if (left.has(href)) resvg.resolveImage(href, Buffer.from(bodies[i] as Uint8Array));
  }
  return new Uint8Array(resvg.render().asPng());
}

const NO_FONTS = { font: { loadSystemFonts: false } };
/** A shared image's one raster is this many times its largest box: headroom for a transform that enlarges it. */
const OVERSAMPLE = 2;

/**
 * resvg decodes an `<image>` per element, at the image's own size: 2000 uses of a 500 px logo held 2 GB for 6 s (a
 * `<use>` or resolveImage costs the same). An image used more than once is therefore drawn once, at OVERSAMPLE times its
 * largest box in output pixels, and every use inlines that small PNG. A single use keeps the original.
 */
function shrink(
  mod: typeof import("@resvg/resvg-js"),
  uri: string,
  uses: readonly string[],
  zoom: number,
): Uint8Array | undefined {
  if (uses.length < 2) return undefined;
  let side = 0;
  for (const tag of uses) {
    const w = userUnits(attrOf(tag, "width"));
    const h = userUnits(attrOf(tag, "height"));
    // ponytail: a use without a numeric size (auto, %) keeps the full image, and its per-use decode
    if (!(w > 0 && h > 0)) return undefined;
    side = Math.max(side, w, h);
  }
  // the image's own size, read from its header (an image with no width/height is drawn at it)
  const own = new mod.Resvg(
    `<svg xmlns="${SVG_NS}" width="1" height="1"><image href="${uri}"/></svg>`,
    NO_FONTS,
  ).getBBox();
  const k = own ? Math.ceil(OVERSAMPLE * zoom * side) / Math.max(own.width, own.height) : 1;
  if (!own || !(k < 1)) return undefined;
  const [w, h] = [Math.max(1, Math.round(own.width * k)), Math.max(1, Math.round(own.height * k))];
  return new mod.Resvg(
    `<svg xmlns="${SVG_NS}" width="${w}" height="${h}"><image href="${uri}" width="${w}" height="${h}" preserveAspectRatio="none"/></svg>`,
    NO_FONTS,
  )
    .render()
    .asPng();
}

const dataURI = (b: Uint8Array): string => `data:${imageType(b)};base64,${Buffer.from(b).toString("base64")}`;

/** A downloaded image's data-URI type from its first bytes: SVG markup, JPEG, GIF, else PNG. */
function imageType(b: Uint8Array): string {
  if (new TextDecoder().decode(b.subarray(0, 64)).trimStart().startsWith("<")) return "image/svg+xml";
  if (b[0] === 0xff && b[1] === 0xd8) return "image/jpeg";
  if (b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46) return "image/gif";
  return "image/png";
}
