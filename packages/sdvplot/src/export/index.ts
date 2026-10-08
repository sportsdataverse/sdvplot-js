import { roundHalfEven } from "../contrast.js";
import { InputError, OptionalDependencyError } from "../errors.js";

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
/** A CSS color written into markup: names, hex, rgb()/hsl(); never a quote, bracket or semicolon. */
export function checkColor(name: string, value: string): string {
  if (!/^[#a-zA-Z0-9(),.% -]+$/.test(value))
    throw new InputError(`${name} must be a CSS color, got ${JSON.stringify(value)}`);
  return value;
}

/** Port of Python `_ratio`: "16:9", "4x5" (exactly two parts) or a positive finite number, numeric strings included. */
export function parseAspect(aspect: Aspect): number {
  let ratio = Number.NaN;
  if (typeof aspect === "string" && /[:x]/.test(aspect)) {
    const parts = aspect.split(/[:x]/);
    if (parts.length === 2) ratio = Number(parts[0]) / Number(parts[1]); // Python `a, b = re.split(...)`: exactly two
  } else if (typeof aspect === "number" || typeof aspect === "string") ratio = Number(aspect); // Python float("1.91")
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

const OPEN_TAG = /<svg\b[^>]*>/i;
const attrOf = (tag: string, name: string): string | undefined =>
  new RegExp(`\\s${name}=["']([^"']+)["']`, "i").exec(tag)?.[1];

/** The root `<svg>`'s size: `width`/`height` attributes, else the viewBox's (D3 output often has only a viewBox). */
export function svgSize(svg: string): SvgSize {
  const open = OPEN_TAG.exec(svg)?.[0];
  if (!open) throw new InputError("socialCard: no <svg> root element");
  const vb = attrOf(open, "viewBox");
  const parts = vb
    ?.trim()
    .split(/[\s,]+/)
    .map(Number);
  const w = Number.parseFloat(attrOf(open, "width") ?? "");
  const h = Number.parseFloat(attrOf(open, "height") ?? "");
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
  { aspect = "1:1", padding = 60, background = "white", gravity = "center" }: SocialCardOptions = {},
): string {
  const ratio = parseAspect(aspect);
  const place = parseGravity(gravity);
  checkColor("background", background);
  if (!(Number.isFinite(padding) && padding >= 0))
    throw new InputError(`padding must be a non-negative number of pixels, got ${String(padding)}`);
  const pad = Math.trunc(padding); // Python _pixels: int(whitespace)
  const { width, height, viewBox } = svgSize(svg);
  const [cw, ch] = canvasFor(width + 2 * pad, height + 2 * pad, ratio);
  const [ox, oy] = offsetFor(cw - (width + 2 * pad), ch - (height + 2 * pad), place);
  const open = OPEN_TAG.exec(svg)?.[0] ?? "<svg>";
  const stripped = open.replace(/\s(?:x|y|width|height|viewBox)=["'][^"']*["']/gi, "");
  const inner = svg.replace(
    open,
    stripped.replace(
      /^<svg/i,
      `<svg x="${ox + pad}" y="${oy + pad}" width="${width}" height="${height}" viewBox="${viewBox}"`,
    ),
  );
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${cw}" height="${ch}" viewBox="0 0 ${cw} ${ch}"><rect width="${cw}" height="${ch}" fill="${background}"/>${inner}</svg>`;
}

/** Rasterize an SVG with `@resvg/resvg-js` (optional peer; Node only). Throws OptionalDependencyError when it is missing. */
export async function toPNG(
  svg: string | { outerHTML: string },
  { width, scale = 1, background }: ToPNGOptions = {},
): Promise<Uint8Array> {
  if (!(Number.isFinite(scale) && scale > 0))
    throw new InputError(`scale must be a positive number, got ${String(scale)}`);
  if (width !== undefined && !(Number.isFinite(width) && width > 0))
    throw new InputError(`width must be a positive number of pixels, got ${String(width)}`);
  if (background !== undefined) checkColor("background", background);
  const text = typeof svg === "string" ? svg : svg.outerHTML;
  const mod = await import("@resvg/resvg-js").catch(() => {
    throw new OptionalDependencyError(
      "toPNG needs the optional peer @resvg/resvg-js: pnpm add @resvg/resvg-js",
    );
  });
  const fitTo =
    width !== undefined
      ? { mode: "width" as const, value: Math.round(width * scale) }
      : { mode: "zoom" as const, value: scale };
  const resvg = new mod.Resvg(text, { fitTo, ...(background !== undefined && { background }) });
  return new Uint8Array(resvg.render().asPng());
}
