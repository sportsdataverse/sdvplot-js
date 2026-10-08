import { readFileSync } from "node:fs";
import { type Canvas, createCanvas } from "@napi-rs/canvas";
import { MANIFEST_URL, resetManifestCache, resetWarnings, setWarningHandler } from "@sportsdataverse/sdvplot";
import { type ReactElement, act, isValidElement } from "react";
import { createRoot } from "react-dom/client";
import { abs } from "../sources.js";
import type { ExampleEntry, OutputKind } from "../src/contract.js";

/** Mark PNGs the archive serves under their sha256; fixtures/examples/<sha256>.png holds the same bytes. */
const CDN_SHA256 = "https://sdv.nyc3.cdn.digitaloceanspaces.com/assets/public/sha256";
export const LOGO_FIXTURES: readonly string[] = [
  "3d77958dc6373768919bb2681cbe1b143f56c07a1f013460def665a5026a7f3d", // KC logo
  "5400f85bd93129c056717a771da57a97225e15f39c0022107ce89ef993f15bb0", // LAC logo
  "c98bec2be32e27b19f79f5da86ac6ef133c78d75ab78aadb28ef36696c3213e8", // DEN logo
  "25fbb03e972ae872fa024026b73c7b63ef9f23c2f2c51f87d1614d800dcee6e7", // LV logo
  "2875f50f8b756ed5ea3866105b4683f5c603aa542e2c7f7870287e1d3d006100", // PHI logo
  "16a2c7e0cd5dcf2e6bdc646c0b22bf03e575f505aa4b843a0ebfdaf19650257b", // KC wordmark
  "ad87ef1e14816a93f9cf06e2f356c526902186abfc4c729e8e01088a84e98cb7", // LAC wordmark
  "ddced0c3708afd6977d26e85c6efd4ddf3f045fb4527dd88e940e5952653875d", // DEN wordmark
  "c22afa5471cd8e08e9c42f06df3d90f6b88b1b95fc16b4da5e610737a8fe7dac", // LV wordmark
];
/** ESPN headshots (the AFC West's starters in STANDINGS) as the combiner serves them at 96 x 70. */
const HEADSHOT_FIXTURES: readonly string[] = ["3139477", "4038941", "4426338", "4038524"];

/** The only URLs an example may fetch, and only when tagged "network": each answers from a committed fixture. */
export const FIXTURES: Readonly<Record<string, string>> = {
  [MANIFEST_URL]: "fixtures/sdvplot/manifest_sample.csv",
  ...Object.fromEntries(
    LOGO_FIXTURES.map((h) => [`${CDN_SHA256}/${h.slice(0, 2)}/${h}.png`, `fixtures/examples/${h}.png`]),
  ),
  ...Object.fromEntries(
    HEADSHOT_FIXTURES.map((id) => [
      `https://a.espncdn.com/combiner/i?img=/i/headshots/nfl/players/full/${id}.png&w=96&h=70`,
      `fixtures/examples/espn-headshot-nfl-${id}-96x70.png`,
    ]),
  ),
};
const CONTENT_TYPE: Readonly<Record<string, string>> = { csv: "text/csv", png: "image/png" };

export interface RunResult {
  readonly kind: OutputKind;
  readonly markup: string;
  readonly value: unknown;
  readonly warnings: readonly string[];
  readonly fetched: readonly string[];
  /** The module exports `browser`, a BrowserSpec. */
  readonly browser: boolean;
}

const urlOf = (input: string | URL | Request): string =>
  typeof input === "string" ? input : input instanceof URL ? input.href : input.url;

function offlineFetch(entry: ExampleEntry, fetched: string[]): typeof fetch {
  return async (input) => {
    const url = urlOf(input);
    fetched.push(url);
    const fixture = FIXTURES[url];
    if (entry.tags.includes("network") && fixture !== undefined)
      return new Response(new Uint8Array(readFileSync(abs(fixture))), {
        status: 200,
        headers: {
          "content-type": CONTENT_TYPE[fixture.split(".").pop() ?? ""] ?? "application/octet-stream",
        },
      });
    throw new Error(
      `${entry.id} fetched ${url}: examples run offline (tag it "network" and add a fixture to test/run.ts FIXTURES)`,
    );
  };
}

const escapeHtml = (s: string): string =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const isElement = (v: unknown): v is Element =>
  typeof v === "object" && v !== null && typeof (v as { outerHTML?: unknown }).outerHTML === "string";

declare global {
  // React's flag that `act` is in use (it warns without it).
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}

/** Render a React element into the jsdom document and wait (up to 30 s) for its effects to draw something. */
async function renderReact(el: ReactElement): Promise<string> {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  await act(async () => root.render(el));
  for (const until = Date.now() + 30_000; host.innerHTML === "" && Date.now() < until; )
    await act(() => new Promise<void>((r) => setTimeout(r, 25)));
  const html = host.innerHTML;
  await act(async () => root.unmount());
  host.remove();
  return html;
}

/**
 * Plot numbers clip paths, markers and patterns from process-wide counters, so a figure's ids depend on what
 * rendered before it. Renumber them per output, in order of first appearance, under the example's id: the same
 * example always prerenders to the same bytes, and two examples on one page never share an id.
 */
export function normalizeIds(markup: string, id: string): string {
  const scope = id.replace(/[^A-Za-z0-9]+/g, "-");
  const seen = new Map<string, string>();
  return markup.replace(/plot-(clip|marker|pattern)-\d+/g, (old, kind: string) => {
    let next = seen.get(old);
    if (next === undefined) {
      next = `plot-${kind}-${scope}-${seen.size + 1}`;
      seen.set(old, next);
    }
    return next;
  });
}

/** Classify an example's default export and turn it into the markup the docs serve before (or instead of) a live run. */
export async function toMarkup(out: unknown, id: string): Promise<{ kind: OutputKind; markup: string }> {
  if (isElement(out)) return { kind: "node", markup: normalizeIds(out.outerHTML, id) };
  if (typeof out === "string" && /^\s*</.test(out)) return { kind: "markup", markup: out };
  if (isValidElement(out)) return { kind: "react", markup: normalizeIds(await renderReact(out), id) };
  const text = typeof out === "string" ? out : (JSON.stringify(out, null, 2) ?? String(out));
  return { kind: "value", markup: `<pre class="sdv-value">${escapeHtml(text)}</pre>` };
}

/**
 * jsdom never loads an <img> or sends an XHR, so those paths would be silent: record them into `fetched` too
 * (problems() then flags them like a fetch). data: URIs carry their bytes and are not network. An <img> already in
 * the document is a displayed image (React 19 sets `src` on every <img> it mounts), like Plot's <image href>: the
 * output shows its URL and jsdom loads neither. A detached `new Image()` is a request, and is recorded.
 * A heuristic, not a proof: `setAttribute("src", …)` (React 19's path for <img>), `srcset` and <source> never reach
 * the property hook. jsdom loads none of them either, so nothing leaves the process; the hook only catches intent.
 */
function recordOtherNetworkPaths(fetched: string[]): () => void {
  const img = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, "src");
  const open = XMLHttpRequest.prototype.open;
  if (img?.set !== undefined && img.get !== undefined) {
    const { get, set } = img;
    Object.defineProperty(HTMLImageElement.prototype, "src", {
      ...img,
      set(this: HTMLImageElement, v: string) {
        if (!this.isConnected && !String(v).startsWith("data:")) fetched.push(String(v));
        set.call(this, v);
      },
      get,
    });
  }
  XMLHttpRequest.prototype.open = function (this: XMLHttpRequest, ...args: unknown[]) {
    fetched.push(String(args[1]));
    return (open as (...a: unknown[]) => void).apply(this, args);
  } as typeof open;
  return () => {
    if (img) Object.defineProperty(HTMLImageElement.prototype, "src", img);
    XMLHttpRequest.prototype.open = open;
  };
}

/**
 * The globals libraries sniff to choose their browser path (Chart.js, ECharts and Vega pick a DOM platform, a DOM
 * canvas, or load images through `Image`, which jsdom never completes). A `node` example loads without them, as it
 * would in Node; every other example keeps the jsdom browser.
 */
const BROWSER_GLOBALS = [
  "window",
  "self",
  "document",
  "Image",
  "HTMLElement",
  "HTMLCanvasElement",
  "HTMLImageElement",
  "XMLHttpRequest",
  "requestAnimationFrame",
  "getComputedStyle",
] as const;
function hideBrowser(): () => void {
  const saved = BROWSER_GLOBALS.map((k) => [k, Object.getOwnPropertyDescriptor(globalThis, k)] as const);
  for (const [k] of saved) Reflect.deleteProperty(globalThis, k);
  return () => {
    for (const [k, d] of saved) if (d !== undefined) Object.defineProperty(globalThis, k, d);
  };
}

/**
 * A browser has a 2D canvas and jsdom does not: Observable Plot paints a continuous legend's ramp on one
 * (`Plot.legend`). Back each jsdom `<canvas>` with an @napi-rs/canvas of its size while a browser example runs.
 */
function browserCanvas(): () => void {
  const proto = HTMLCanvasElement.prototype;
  const saved = (["getContext", "toDataURL"] as const).map(
    (k) => [k, Object.getOwnPropertyDescriptor(proto, k)] as const,
  );
  const backing = new WeakMap<HTMLCanvasElement, Canvas>();
  const of = (el: HTMLCanvasElement): Canvas => {
    const c = backing.get(el) ?? createCanvas(el.width, el.height);
    backing.set(el, c);
    return c;
  };
  const define = (k: string, value: (this: HTMLCanvasElement, type?: string) => unknown) =>
    Object.defineProperty(proto, k, { configurable: true, writable: true, value });
  define("getContext", function (type) {
    return type === "2d" ? of(this).getContext("2d") : null;
  });
  define("toDataURL", function () {
    return of(this).toDataURL("image/png");
  });
  return () => {
    for (const [k, d] of saved) if (d !== undefined) Object.defineProperty(proto, k, d);
  };
}

/**
 * Load (= run) one example offline, collecting its warnings (sdvplot's, and any console.warn: Plot reports one
 * that way) and every fetch it attempted. Per-process state is reset before and after, so an example sees the same
 * state whatever ran before it (or whether it runs alone).
 */
export async function runExample(
  entry: ExampleEntry,
  load: () => Promise<{ default: unknown }> = () => import(/* @vite-ignore */ abs(`examples/${entry.file}`)),
): Promise<RunResult> {
  const warnings: string[] = [];
  const fetched: string[] = [];
  const realFetch = globalThis.fetch;
  const realWarn = console.warn;
  globalThis.fetch = offlineFetch(entry, fetched);
  console.warn = (...args: unknown[]) => void warnings.push(args.map(String).join(" "));
  const restoreSinks = recordOtherNetworkPaths(fetched);
  resetWarnings();
  resetManifestCache();
  setWarningHandler((m) => warnings.push(m));
  try {
    const restore = entry.tags.includes("node") ? hideBrowser() : browserCanvas();
    let mod: { default: unknown };
    try {
      mod = await load();
    } finally {
      restore();
    }
    const value = mod.default;
    return { ...(await toMarkup(value, entry.id)), value, warnings, fetched, browser: "browser" in mod };
  } finally {
    globalThis.fetch = realFetch;
    console.warn = realWarn;
    restoreSinks();
    setWarningHandler(null);
    resetWarnings();
    resetManifestCache();
  }
}

/** `undefined`, "", [] and {} show nothing; an example that means to show one wraps it (`String(x)`, `{ x }`). */
const isEmpty = (v: unknown): boolean =>
  v === undefined ||
  v === "" ||
  (Array.isArray(v) && v.length === 0) ||
  (typeof v === "object" && v !== null && !Array.isArray(v) && Object.keys(v).length === 0);

const MARK = "path,circle,image,rect,polygon,polyline,line,text,img";
/** The <title> of the ⚠️ badge Plot draws on a figure that warned (its console.warn may have run outside the gate). */
const PLOT_WARNING_BADGE = /[\d,]+ warnings?\. Please check the console\./;
const FURNITURE = /^(x|y|fx|fy)-(axis|grid)( |$)|^frame$/;

/** A DATA mark: not an axis, tick, label or grid (Plot's `g[aria-label]` groups), or any non-svg table/img. */
function drewMark(markup: string): boolean {
  const host = document.createElement("div");
  host.innerHTML = markup;
  if (host.querySelector("table") !== null) return true;
  const hasSvg = host.querySelector("svg") !== null;
  for (const el of Array.from(host.querySelectorAll(MARK))) {
    let furniture = false;
    for (
      let g = el.closest("g[aria-label]");
      g !== null;
      g = g.parentElement?.closest("g[aria-label]") ?? null
    )
      if (FURNITURE.test(g.getAttribute("aria-label") ?? "")) furniture = true;
    if (!furniture || !hasSvg) return true;
  }
  return false;
}

/** The gate's notion of "rendered something": a throw is not the only failure; blank output is one too. */
export function problems(entry: ExampleEntry, r: RunResult): string[] {
  const p: string[] = [];
  if (r.markup.trim() === "" || (r.kind === "value" && isEmpty(r.value))) p.push("rendered nothing");
  if (r.kind !== "value" && !drewMark(r.markup))
    p.push("drew no mark (no path/image/circle/rect/line/polygon/text/img/table)");
  const network = entry.tags.includes("network");
  if (!network && r.fetched.length > 0) p.push(`fetched without the "network" tag: ${r.fetched.join(" | ")}`);
  if (network && r.fetched.length === 0) p.push(`has the "network" tag but did not fetch`);
  if (/\bNaN\b/.test(r.markup)) p.push("output contains NaN");
  const warns = entry.tags.includes("warns");
  if (!warns && r.warnings.length > 0) p.push(`warned without the "warns" tag: ${r.warnings.join(" | ")}`);
  if (!warns && PLOT_WARNING_BADGE.test(r.markup))
    p.push(`shows Plot's ⚠️ warning badge without the "warns" tag`);
  if (warns && r.warnings.length === 0) p.push(`has the "warns" tag but did not warn`);
  return p;
}
