import { InputError } from "../errors.js";
import { type LogoUrlOptions, logoUrlSync } from "../marks.js";
import type { Value } from "../resolve.js";
import type { League, SeasonInput } from "../types.js";

export interface TitleImageOptions {
  /** A team (resolved in `league`), or an https image URL when `league` is not given. */
  image: Value;
  league?: League;
  season?: SeasonInput;
  /** Required when `figure` is a bare `<svg>`: it becomes the new `<h2>`. */
  title?: string;
  side?: "left" | "right";
  /** Pixels (unlike the marks' fraction of the plot height); at least 1, default 24. */
  height?: number;
}

/** Puts a team logo (or an https image) in the `<h2>` of a Plot figure and returns the `<figure>` (a bare `<svg>` is wrapped in a new one). An unknown team draws the title alone (the resolver warned once). */
export function titleImage(figure: HTMLElement | SVGSVGElement, o: TitleImageOptions): HTMLElement {
  const height = o.height ?? 24;
  if (!(typeof height === "number" && Number.isFinite(height) && height >= 1))
    throw new InputError(`height is a pixel height of at least 1, got ${String(height)}`);
  const side = o.side ?? "left";
  if (side !== "left" && side !== "right")
    throw new InputError(`side must be "left" or "right", got ${String(side)}`);
  const bare = figure.tagName.toLowerCase() === "svg";
  if (bare && !o.title)
    throw new InputError("the plot has no title; pass {title} (or render with Plot.plot({title}))");
  if (!bare && !figure.querySelector("h2"))
    throw new InputError("the figure has no <h2> title; render with Plot.plot({title}) first");
  let src: string | undefined;
  if (o.league) {
    const lo: LogoUrlOptions = o.season === undefined ? {} : { season: o.season };
    src = logoUrlSync(o.image, o.league, lo);
  } else {
    const s = String(o.image);
    if (!/^https:\/\//.test(s))
      throw new InputError(`image must be an https URL when league is not given, got ${s}`);
    src = s;
  }
  // every check has passed: only now touch the DOM
  const doc = figure.ownerDocument;
  let fig: HTMLElement;
  if (bare) {
    fig = doc.createElement("figure");
    const heading = doc.createElement("h2");
    heading.textContent = o.title as string;
    fig.append(heading, figure);
  } else fig = figure as HTMLElement;
  if (src === undefined) return fig;
  const h2 = fig.querySelector("h2") as HTMLElement;
  const img = doc.createElement("img");
  img.setAttribute("src", src);
  img.setAttribute("height", String(height));
  img.setAttribute("alt", "");
  img.style.verticalAlign = "middle";
  img.style.margin = side === "left" ? "0 0.4em 0 0" : "0 0 0 0.4em";
  if (side === "left") h2.prepend(img);
  else h2.append(img);
  return fig;
}
