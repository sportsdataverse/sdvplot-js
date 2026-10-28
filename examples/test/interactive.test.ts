// @vitest-environment node
import { existsSync, mkdirSync, readFileSync, statSync } from "node:fs";
import { type Server, createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { extname, join, normalize } from "node:path";
import { createCanvas, loadImage } from "@napi-rs/canvas";
import {
  contrast,
  headshotUrl,
  loadLeague,
  logoUrlSync,
  mix,
  onColor,
  resolveSync,
  solid,
  teamColorsSync,
} from "@sportsdataverse/sdvplot";
import { teamColorPalette, teamColors } from "@sportsdataverse/sdvplot/mui";
import { teamColorPalette as rechartsPalette } from "@sportsdataverse/sdvplot/recharts";
import { teamColorPalette as agPalette } from "@sportsdataverse/sdvplot/tanstack";
import { tableThemeSpec } from "@sportsdataverse/sdvtables";
import { type Browser, type Page, chromium } from "playwright";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { pagePath } from "../scripts/pages.js";
import { abs } from "../sources.js";
import { BROWSER } from "../src/browser.gen.js";
import {
  AFC_WEEKS_2024,
  KC_PHI_GAMES_2024,
  NBA_STANDINGS,
  NFL_AIRPORTS,
  NFL_STADIUMS_2024,
  NFL_TEAM_EPA_2024,
  NHL_STANDINGS,
  STANDINGS,
  SUPER_BOWL_LIX_DRIVES,
  SUPER_BOWL_LIX_KC_PASSER,
  SUPER_BOWL_LIX_KC_TARGETS,
  nflPlays2024,
} from "../src/data.js";
import { EXAMPLES } from "../src/registry.gen.js";
import { MUI_PROXY_STYLE } from "./run.js";

/**
 * Real Chromium on the BUILT docs site (`pnpm docs:build` first): every browser upgrade's gallery page draws its
 * chart with the library, replaces the static copy, keeps an accessible name, and logs no console error. Needs
 * Chromium (`pnpm --filter @sportsdataverse/examples exec playwright install chromium`) and the network (logos come
 * from the CDN), so it runs only with SDV_RENDER_TESTS=1: CI's non-gating docs-render job. SDV_RENDER_SHOTS=<dir>
 * also saves a screenshot of each chart.
 */
const BUILD = abs("docs/build");
const SHOTS = process.env.SDV_RENDER_SHOTS;
const TYPES: Readonly<Record<string, string>> = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".mjs": "text/javascript",
  ".css": "text/css",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ttf": "font/ttf",
  ".json": "application/json",
  ".wasm": "application/wasm",
};

/** What the library leaves in the figure once it has drawn, by the folder the example lives in. */
const DRAWN: Readonly<Record<string, string>> = {
  plotly: ".sdv-live-output .js-plotly-plot .main-svg",
  vega: ".sdv-live-output svg.marks",
  echarts: ".sdv-live-output [_echarts_instance_] svg",
  chartjs: ".sdv-live-output canvas",
  "react-chartjs-2": ".sdv-live-output canvas",
  uplot: ".sdv-live-output .uplot canvas",
  // the sdvplot marks inside LayerChart's svg: Svelte mounted, and the marks' lazy import of layerchart resolved
  svelte: ".sdv-live-output svg.lc-layout-svg :is(image[data-sdv-id], g[data-sdv-surface])",
  deckgl: ".sdv-live-output canvas",
  cytoscape: ".sdv-live-output canvas",
  three: ".sdv-live-output canvas",
  "lightweight-charts": ".sdv-live-output .tv-lightweight-charts canvas",
  g2: ".sdv-live-output canvas",
  "ant-design-charts": ".sdv-live-output canvas",
  "ag-grid": ".sdv-live-output .ag-root-wrapper .ag-row[row-id]",
  // a TanStack Table, drawn by Svelte: its logo cells
  "tanstack-table": ".sdv-live-output table img[data-sdv-id]",
  maplibre: ".sdv-live-output canvas.maplibregl-canvas",
  // a node or a flow Unovis drew (both drawers, @unovis/ts and @unovis/react, sit in sdvplot/unovis)
  unovis: ".sdv-live-output svg :is(g[class*=g-node], path[class*=visible])",
  // the team bars: Mosaic has queried DuckDB-WASM and Observable Plot has drawn them
  mosaic: ".sdv-live-output .plot svg g[aria-label=bar] rect",
  // what Perspective drew: a Datagrid cell or a chart's WebGL canvas (Playwright's CSS sees into shadow roots)
  perspective: ".sdv-live-output perspective-viewer :is(regular-table tbody td, canvas.webgl-canvas)",
};

/** OpenFreeMap's credit, as its TileJSON gave it on 2026-10-27. */
const OPENFREEMAP_CREDIT =
  '<a href="https://openfreemap.org" target="_blank">OpenFreeMap</a> <a href="https://www.openmaptiles.org/" target="_blank">&copy; OpenMapTiles</a> Data from <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a>';
/**
 * Answers every request to OpenFreeMap here, so a MapLibre page never reaches the tile provider. Each style is a
 * stand-in with that style's own background colour (positron #f2f3f0, dark #0c0c0c, read 2026-10-27) and one empty
 * GeoJSON source carrying OpenFreeMap's credit, drawn by a layer so MapLibre shows the credit. It has no tiles: a
 * tile is fetched by MapLibre's worker, which a page route may not see. Anything else asked of OpenFreeMap is aborted.
 * Resolves to the URLs asked for.
 */
async function stubOpenFreeMap(page: Page): Promise<string[]> {
  const asked: string[] = [];
  await page.route("https://tiles.openfreemap.org/**", (r) => {
    const url = r.request().url();
    asked.push(url);
    const style = /\/styles\/(positron|dark)$/.exec(url)?.[1];
    if (style === undefined) return r.abort();
    return r.fulfill({
      status: 200,
      contentType: "application/json",
      headers: { "access-control-allow-origin": "*" },
      body: JSON.stringify({
        version: 8,
        sources: {
          openmaptiles: {
            type: "geojson",
            data: { type: "FeatureCollection", features: [] },
            attribution: OPENFREEMAP_CREDIT,
          },
        },
        layers: [
          {
            id: "background",
            type: "background",
            paint: { "background-color": style === "dark" ? "#0c0c0c" : "#f2f3f0" },
          },
          { id: "water", type: "fill", source: "openmaptiles", paint: { "fill-color": "#888888" } },
        ],
      }),
    });
  });
  return asked;
}

describe.skipIf(process.env.SDV_RENDER_TESTS !== "1")("browser upgrades on the built docs", () => {
  let server: Server;
  let browser: Browser;
  let base = "";
  beforeAll(async () => {
    if (!existsSync(join(BUILD, "index.html")))
      throw new Error(`no docs build at ${BUILD}: run pnpm docs:build`);
    // the build as Vercel serves it: a directory is its index.html
    server = createServer((req, res) => {
      let file = join(BUILD, normalize(decodeURIComponent(new URL(req.url ?? "/", "http://x").pathname)));
      if (existsSync(file) && statSync(file).isDirectory()) file = join(file, "index.html");
      if (!file.startsWith(BUILD) || !existsSync(file)) return void res.writeHead(404).end();
      res.writeHead(200, { "content-type": TYPES[extname(file)] ?? "application/octet-stream" });
      res.end(readFileSync(file));
    });
    await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    browser = await chromium.launch();
    if (SHOTS !== undefined) mkdirSync(SHOTS, { recursive: true });
  });
  afterAll(async () => {
    await browser?.close();
    server?.close();
  });

  test.each(Object.keys(BROWSER))("%s draws with its library", async (id) => {
    const entry = EXAMPLES.find((e) => e.id === id);
    if (entry === undefined) throw new Error(`${id} is not in the registry`);
    const lib = id.split("/")[1] ?? "";
    const page = await browser.newPage();
    try {
      const errors: string[] = [];
      page.on("console", (m) => void (m.type() === "error" && errors.push(m.text())));
      page.on("pageerror", (e) => void errors.push(e.message));
      await stubOpenFreeMap(page); // a MapLibre basemap never reaches the network
      await page.goto(`${base}/gallery/${pagePath(entry)}/`);
      const figure = page.locator(`figure[data-example="${id}"]`);
      await figure.scrollIntoViewIfNeeded();
      await figure
        .locator(DRAWN[lib] ?? "never")
        .first()
        .waitFor({ timeout: 30_000 });
      await page.waitForLoadState("networkidle"); // the images the chart loads, so a failed one is logged
      expect(await figure.locator(".sdv-live-static").count(), "the static copy is replaced").toBe(0);
      expect(await figure.locator(".sdv-live-error").count(), "no error alert").toBe(0);
      if (lib === "chartjs" || lib === "react-chartjs-2" || lib === "uplot") {
        const painted = await figure.locator("canvas").evaluate((c: HTMLCanvasElement) =>
          c
            .getContext("2d")
            ?.getImageData(0, 0, c.width, c.height)
            .data.some((v, i) => i % 4 === 3 && v > 0),
        );
        expect(painted, "the canvas is painted").toBe(true);
      }
      // react-chartjs-2: sample where Chart.js put each mark (the drawer leaves the chart on its box). A logo point (an
      // image point style with a radius) is mostly opaque around its centre, which a 1 px grid line under it is not; a
      // bar's middle is its own team colour.
      if (lib === "react-chartjs-2") {
        const marks = await figure
          .locator('.sdv-live-output [role="figure"]')
          .first()
          .evaluate((el) => {
            type El = { x: number; y: number; base?: number; options: Record<string, unknown> };
            type Chartish = {
              draw: () => void;
              canvas: HTMLCanvasElement;
              data: { datasets: unknown[] };
              getDatasetMeta: (i: number) => { type: string; data: El[] };
            };
            const chart = (el as HTMLElement & { sdvChart?: Chartish }).sdvChart;
            if (chart === undefined) return "no chart on the figure";
            chart.draw();
            const c = chart.canvas;
            const k = c.width / c.clientWidth; // device pixels per CSS pixel
            const g = c.getContext("2d") as CanvasRenderingContext2D;
            const px = (x: number, y: number, r: number) =>
              g.getImageData(Math.round(x * k) - r, Math.round(y * k) - r, 2 * r + 1, 2 * r + 1).data;
            const out: string[] = [];
            let checked = 0;
            chart.data.datasets.forEach((_, d) => {
              const meta = chart.getDatasetMeta(d);
              for (const [i, e] of meta.data.entries()) {
                const o = e.options;
                if (o.pointStyle instanceof HTMLImageElement && (o.radius as number) > 0) {
                  const r = Math.round(((o.radius as number) / 2) * k);
                  const a = px(e.x, e.y, r);
                  let opaque = 0;
                  for (let j = 3; j < a.length; j += 4) if ((a[j] as number) > 128) opaque++;
                  if (opaque < (a.length / 4) * 0.3) out.push(`dataset ${d} point ${i}: no logo drawn there`);
                  checked++;
                } else if (meta.type === "bar") {
                  const want = String(o.backgroundColor);
                  const rgb = [1, 3, 5].map((s) => Number.parseInt(want.slice(s, s + 2), 16));
                  const a = px(e.x, (e.y + (e.base ?? e.y)) / 2, 0);
                  if (![0, 1, 2].every((ch) => Math.abs((a[ch] as number) - (rgb[ch] as number)) <= 8))
                    out.push(`bar ${i}: not ${want} at its middle`);
                  checked++;
                }
              }
            });
            return checked > 0 ? out.join("; ") : "no logo point or bar to sample";
          });
        expect(marks, "each logo point and bar is drawn where Chart.js placed it").toBe("");
      }
      // deck.gl draws with WebGL. Sample where a mark is known to be: project the first marks (a logo's centre, an
      // arc's start) to the screen, pick there (deck.gl's own hit test: the mark layer drew at that point), and read
      // the canvas around it (its drawing buffer is kept, deck.gl's default): a pixel there must differ from the
      // surface's fill under it, so the mark is visible, not only drawn.
      if (lib === "deckgl") {
        const marks = await figure.locator('.sdv-live-output [role="figure"]').evaluate(async (el) => {
          type Picked = { layer: { id: string }; object?: { fillColor?: number[] } };
          type Deckish = {
            props: {
              layers: { id: string; isLoaded: boolean; props: { data: Record<string, unknown>[] } }[];
            };
            getViewports: () => { project: (p: number[]) => number[] }[];
            pickMultipleObjects: (o: { x: number; y: number; radius: number; depth: number }) => Picked[];
            redraw: (reason: string) => void;
          };
          const deck = (el as HTMLElement & { sdvDeck?: Deckish }).sdvDeck;
          if (deck === undefined) return "no deck on the figure";
          const frame = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
          for (let t = 0; t < 100 && !deck.props.layers.every((l) => l.isLoaded); t++) await frame(); // the logos
          deck.redraw("render test");
          await frame();
          const [surface, layer] = deck.props.layers;
          const canvas = el.querySelector("canvas") as HTMLCanvasElement;
          const k = canvas.width / canvas.clientWidth; // device pixels per CSS pixel
          const copy = document.createElement("canvas");
          [copy.width, copy.height] = [canvas.width, canvas.height];
          const ctx = copy.getContext("2d", { willReadFrequently: true }) as CanvasRenderingContext2D;
          ctx.drawImage(canvas, 0, 0);
          const out: string[] = [];
          for (const d of (layer?.props.data ?? []).slice(0, 5)) {
            const at = (d.position ?? d.source) as number[];
            const [x, y] = deck.getViewports()[0]?.project(at) ?? [Number.NaN, Number.NaN];
            const picked = deck.pickMultipleObjects({ x: x as number, y: y as number, radius: 2, depth: 20 });
            if (!picked.some((p) => p.layer.id === layer?.id)) out.push(`${at}: no ${layer?.id} picked`);
            const fill = picked.find((p) => p.layer.id === surface?.id)?.object?.fillColor ?? [0, 0, 0, 0];
            const px = ctx.getImageData(
              Math.round((x as number) * k) - 3,
              Math.round((y as number) * k) - 3,
              7,
              7,
            ).data;
            let differs = false;
            for (let i = 0; i < px.length; i += 4)
              if ([0, 1, 2].some((c) => Math.abs((px[i + c] as number) - (fill[c] as number)) > 40))
                differs = true;
            if (!differs) out.push(`${at}: nothing but the surface's ${fill} drawn there`);
          }
          return (layer?.props.data.length ?? 0) > 0 ? out.join("; ") : "no marks";
        });
        expect(marks, "each sampled mark is picked and visible where it was placed").toBe("");
      }
      // Cytoscape draws on stacked canvases. Sample where marks are known to be, from Cytoscape's own rendered
      // positions: the first nodes' fill (below the initials, inside the circle), and the midpoints of the widest edges
      // that lie clear of every node (so the pixel can only be the edge's, even when a team's nodes and edges share a
      // colour). The canvases are composited over the page's own background, and every sampled colour must differ from
      // that background, so neither a dark docs theme nor a transparent hole can pass for a mark.
      if (lib === "cytoscape") {
        const marks = await figure.locator('.sdv-live-output [role="figure"]').evaluate(async (el) => {
          type Ele = {
            id: () => string;
            style: (k: string) => string;
            renderedPosition: () => { x: number; y: number };
            renderedMidpoint: () => { x: number; y: number };
            renderedWidth: () => number;
            data: (k: string) => number;
          };
          type Cyish = { nodes: () => { toArray: () => Ele[] }; edges: () => { toArray: () => Ele[] } };
          const cy = (el as HTMLElement & { sdvCy?: Cyish }).sdvCy;
          if (cy === undefined) return "no graph on the figure";
          const frame = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
          for (let t = 0; t < 5; t++) await frame();
          const layers = [...el.querySelectorAll("canvas")];
          const first = layers[0];
          if (first === undefined) return "no canvas";
          const rgb = (s: string) => (s.match(/[\d.]+/g) ?? []).map(Number);
          // the page behind the graph: the nearest ancestor that paints a background
          let page = [255, 255, 255];
          for (let a: Element | null = el; a !== null; a = a.parentElement) {
            const c = rgb(getComputedStyle(a).backgroundColor);
            if (c.length === 3 || (c[3] ?? 0) > 0) {
              page = c.slice(0, 3);
              break;
            }
          }
          const k = first.width / first.clientWidth; // device pixels per CSS pixel
          const copy = document.createElement("canvas");
          [copy.width, copy.height] = [first.width, first.height];
          const ctx = copy.getContext("2d", { willReadFrequently: true }) as CanvasRenderingContext2D;
          ctx.fillStyle = `rgb(${page.join(",")})`;
          ctx.fillRect(0, 0, copy.width, copy.height);
          for (const c of layers) ctx.drawImage(c, 0, 0);
          const near = (a: number[], b: number[]) =>
            [0, 1, 2].every((c) => Math.abs((a[c] ?? 0) - (b[c] ?? 0)) <= 48);
          /** Whether a 5 x 5 device-pixel window at (x, y) CSS px holds a pixel within 48 of `want` in every channel. */
          const holds = (x: number, y: number, want: number[]) => {
            const px = ctx.getImageData(Math.round(x * k) - 2, Math.round(y * k) - 2, 5, 5).data;
            for (let i = 0; i < px.length; i += 4)
              if (near([px[i], px[i + 1], px[i + 2]] as number[], want)) return true;
            return false;
          };
          const out: string[] = [];
          const check = (what: string, x: number, y: number, want: number[]) => {
            if (near(want, page))
              out.push(`${what}: its colour ${want} cannot be told from the page's ${page}`);
            else if (!holds(x, y, want)) out.push(`${what}: no ${want} drawn there`);
          };
          const nodes = cy.nodes().toArray();
          for (const n of nodes.slice(0, 5)) {
            const p = n.renderedPosition();
            check(
              `node ${n.id()}`,
              p.x,
              p.y + 0.35 * n.renderedWidth(),
              rgb(n.style("background-color")).slice(0, 3),
            );
          }
          const clear = (m: { x: number; y: number }) =>
            nodes.every((n) => {
              const p = n.renderedPosition();
              return Math.hypot(m.x - p.x, m.y - p.y) > n.renderedWidth() / 2 + 6;
            });
          const edges = cy
            .edges()
            .toArray()
            .sort((a, b) => b.data("width") - a.data("width"))
            .filter((e) => clear(e.renderedMidpoint()))
            .slice(0, 3);
          for (const e of edges) {
            const m = e.renderedMidpoint();
            check(`edge ${e.id()}`, m.x, m.y, rgb(e.style("line-color")).slice(0, 3));
          }
          return nodes.length > 0 && edges.length > 0
            ? out.join("; ")
            : "no nodes, or no edge clear of the nodes";
        });
        expect(marks, "each sampled node and edge is drawn in its colour where Cytoscape placed it").toBe("");
      }
      // Three.js draws with WebGL (the drawer keeps its drawing buffer: copy it onto a 2D canvas to read it). Sample
      // where a mark is known to be: project a point 85% along each tube to the screen, check by raycast that the tube
      // is what is in front there, and read its pixel: the tube's own colour (unlit and not tone-mapped, so the team
      // colour exactly). Then raycast points low in the frame onto the field and read the colour of the loop on top there:
      // the field's vertex colours, back in sRGB.
      if (lib === "three") {
        const marks = await figure.locator('.sdv-live-output [role="figure"]').evaluate(async (el) => {
          // biome-ignore lint/suspicious/noExplicitAny: three.js objects, read through the drawer's handle
          type Any = any;
          const box = el as HTMLElement & { sdvThree?: { get: () => Any; THREE: Any } };
          const frame = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
          const meshes = (): Any[] =>
            (box.sdvThree?.get().scene.children ?? []).filter((o: Any) => o.isMesh === true);
          for (let t = 0; t < 300 && meshes().length < 2; t++) await frame(); // the lazy peers and meshes
          const three = box.sdvThree;
          if (three === undefined) return "no three.js handle on the figure";
          const { THREE } = three;
          const { scene, camera, invalidate } = three.get();
          invalidate();
          await frame();
          await frame();
          const canvas = el.querySelector("canvas") as HTMLCanvasElement;
          const k = canvas.width / canvas.clientWidth; // device pixels per CSS pixel
          const copy = document.createElement("canvas");
          [copy.width, copy.height] = [canvas.width, canvas.height];
          const ctx = copy.getContext("2d", { willReadFrequently: true }) as CanvasRenderingContext2D;
          ctx.drawImage(canvas, 0, 0);
          const ray = new THREE.Raycaster();
          const front = (ndc: Any): Any => {
            ray.setFromCamera(new THREE.Vector2(ndc.x, ndc.y), camera);
            return ray.intersectObjects(scene.children, true)[0];
          };
          /** Whether a pixel within `r` of the NDC point is within 24 per channel of `rgb`. */
          const shows = (ndc: Any, rgb: number[], r: number): boolean => {
            const x = Math.round(((ndc.x + 1) / 2) * canvas.clientWidth * k);
            const y = Math.round(((1 - ndc.y) / 2) * canvas.clientHeight * k);
            const px = ctx.getImageData(x - r, y - r, 2 * r + 1, 2 * r + 1).data;
            for (let i = 0; i < px.length; i += 4)
              if ([0, 1, 2].every((c) => Math.abs((px[i + c] as number) - (rgb[c] as number)) <= 24))
                return true;
            return false;
          };
          const out: string[] = [];
          const surface = meshes().find((m) => m.material.vertexColors === true);
          const tubes = meshes().filter((m) => m.material.vertexColors !== true);
          if (surface === undefined || tubes.length === 0) return "no field or no tubes in the scene";
          let checked = 0;
          for (const tube of tubes) {
            const pos = tube.geometry.getAttribute("position");
            const ring = Math.floor((pos.count / 12) * 0.85); // <Trajectory>'s 12 vertices a ring
            const c = new THREE.Vector3();
            for (let j = 0; j < 12; j++) c.add(new THREE.Vector3().fromBufferAttribute(pos, ring * 12 + j));
            const ndc = c.divideScalar(12).project(camera);
            if (front(ndc)?.object !== tube) continue; // another tube in front of it there
            checked++;
            const hex: string = tube.material.color.getHexString();
            const rgb = [0, 2, 4].map((i) => Number.parseInt(hex.slice(i, i + 2), 16));
            if (!shows(ndc, rgb, 2)) out.push(`tube #${hex}: not drawn in its colour where it is`);
          }
          if (checked < tubes.length / 2)
            out.push(`only ${checked} of ${tubes.length} tubes in front to sample`);
          const colour = surface.geometry.getAttribute("color");
          const srgb = (v: number): number =>
            Math.round(255 * (v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055));
          let field = 0;
          for (const [x, y] of [
            [0, -0.85],
            [-0.6, -0.8],
            [0.6, -0.8],
            [-0.3, -0.6],
            [0.3, -0.6],
          ] as const) {
            if (front({ x, y })?.object !== surface) continue;
            // every loop is at z = 0, so the ray meets each loop under the point at one distance: the one drawn on top is
            // the last in drawing order (the highest triangle)
            const top = ray
              .intersectObject(surface)
              .reduce((m: Any, h: Any) => (m === undefined || h.faceIndex > m.faceIndex ? h : m), undefined);
            field++;
            const rgb = [colour.getX(top.face.a), colour.getY(top.face.a), colour.getZ(top.face.a)].map(srgb);
            if (!shows({ x, y }, rgb, 1)) out.push(`field at ${x}, ${y}: not its loop's colour ${rgb}`);
          }
          if (field < 3) out.push(`only ${field} field points hit`);
          return out.join("; ");
        });
        expect(marks, "each tube and the field show their own colours where they are").toBe("");
      }
      if (lib === "lightweight-charts") {
        // Each line's middle point holds its team colour (exact, within anti-aliasing), and each line's logo is painted
        // where logoMarkers puts it: detaching the primitive changes the pixels of the logo's box. Then the
        // attribution: TradingView's logo links to tradingview.com, and attributionNotice put the notice on the page once.
        const got = await figure.evaluate(async (f) => {
          type Point = { time: number; value: number };
          type Series = {
            data(): Point[];
            options(): { color: string };
            priceToCoordinate(price: number): number;
            detachPrimitive(p: object): void;
            attachPrimitive(p: object): void;
          };
          type Chart = {
            panes(): { getHTMLElement(): HTMLElement }[];
            paneSize(): { height: number };
            timeScale(): { timeToCoordinate(time: number): number };
          };
          const box = f.querySelector(".sdv-live-output [role='figure']") as unknown as {
            sdvLwc: { chart: Chart; series: Series[]; primitives: object[][] };
          };
          const { chart, series, primitives } = box.sdvLwc;
          const canvas = chart.panes()[0]?.getHTMLElement().querySelector("canvas") as HTMLCanvasElement;
          const ratio = canvas.width / canvas.clientWidth;
          // the pixels of the square of half-side r (CSS px) centred on (x, y), as [r, g, b, a]
          const read = (x: number, y: number, r: number): number[][] => {
            const [x0, y0, side] = [x - r, y - r, 2 * r].map((v) => Math.round(v * ratio)) as [
              number,
              number,
              number,
            ];
            const d =
              canvas.getContext("2d")?.getImageData(x0, y0, side, side).data ?? new Uint8ClampedArray();
            return Array.from({ length: d.length / 4 }, (_, i) => [...d.subarray(4 * i, 4 * i + 4)]);
          };
          const near = (a: readonly number[], b: readonly number[]) =>
            a.every((v, i) => Math.abs(v - (b[i] ?? 0)) <= 24);
          const lines = series.map((s) => {
            const data = s.data();
            const mid = data[Math.floor(data.length / 2)] as Point;
            const color = s.options().color;
            const want = [1, 3, 5].map((i) => Number.parseInt(color.slice(i, i + 2), 16));
            const px = read(chart.timeScale().timeToCoordinate(mid.time), s.priceToCoordinate(mid.value), 2);
            return { color, match: px.some((p) => (p[3] ?? 0) > 200 && near(p.slice(0, 3), want)) };
          });
          const ends = series.map((s) => {
            const last = s.data().at(-1) as Point;
            return [chart.timeScale().timeToCoordinate(last.time), s.priceToCoordinate(last.value)] as const;
          });
          const r = (0.12 * chart.paneSize().height) / 3; // inside the logo, which is 0.12 of the pane tall
          const before = ends.map(([x, y]) => read(x, y, r));
          series.forEach((s, i) => {
            for (const p of primitives[i] ?? []) s.detachPrimitive(p);
          });
          await new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)));
          const changed = ends.map(([x, y], i) => {
            const after = read(x, y, r);
            return after.filter((p, k) => !near(p, before[i]?.[k] ?? [])).length / after.length;
          });
          series.forEach((s, i) => {
            for (const p of primitives[i] ?? []) s.attachPrimitive(p); // back, for the screenshot
          });
          await new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)));
          return { lines, changed };
        });
        for (const l of got.lines) expect(l.match, `a pixel of the ${l.color} line is its colour`).toBe(true);
        expect(got.changed.length).toBeGreaterThan(0);
        for (const c of got.changed) expect(c, "the logo painted its box").toBeGreaterThan(0.2);
        const link = figure.locator(
          ".sdv-live-output .tv-lightweight-charts a[href^='https://www.tradingview.com']",
        );
        expect(await link.count(), "TradingView's link on the chart").toBe(1);
        const notices = figure.locator(".sdv-live-output p[data-sdv-attribution='tradingview']");
        expect(await notices.count(), "one TradingView notice on the page").toBe(1);
        expect(
          await notices.locator("a[href='https://www.tradingview.com/']").count(),
          "its URL is a link",
        ).toBe(1);
        expect(await notices.textContent(), "TradingView's notice, verbatim").toBe(
          "TradingView Lightweight Charts™\nCopyright (с) 2025 TradingView, Inc. https://www.tradingview.com/",
        );
      }
      // G2, and Ant Design Charts (G2 underneath), on G2's canvas renderer. Where G2 put each mark is read from its scene
      // graph, then the canvas is sampled there: hiding sdvplot's image elements must change the pixels of each logo's
      // box (the logo painted it), a column's centre is its team colour, and each line holds its colour at its middle
      // point. Axis logos are G2 HTML labels: each <img> loads and sits centred under its column.
      if (lib === "g2" || lib === "ant-design-charts") {
        const got = await figure.evaluate(async (f) => {
          type GNode = {
            markType?: string;
            style: Record<string, unknown> & { visibility?: string };
            getBounds(): { center: number[]; halfExtents: number[] };
            getPosition(): number[];
            __data__?: { points?: number[][] };
          };
          const box = f.querySelector(".sdv-live-output [role='img']") as
            | (HTMLElement & {
                sdvG2?: { getContext(): { canvas?: { document: { querySelectorAll(s: string): GNode[] } } } };
              })
            | null;
          const doc = box?.sdvG2?.getContext().canvas?.document;
          const canvas = box?.querySelector("canvas");
          if (doc === undefined || canvas == null) return { error: "no G2 chart on the figure" };
          const frame = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
          const marks = (type: string) => doc.querySelectorAll(".element").filter((e) => e.markType === type);
          for (let t = 0; t < 100 && marks("image").length + marks("interval").length === 0; t++)
            await frame();
          await new Promise((r) => setTimeout(r, 1500)); // G2's enter animations, and the logos loading
          const ratio = canvas.width / canvas.clientWidth;
          const ctx = canvas.getContext("2d") as CanvasRenderingContext2D;
          // the pixels of the box of half-sides (rx, ry) CSS px centred on (x, y), as [r, g, b, a]
          const read = (x: number, y: number, rx: number, ry = rx): number[][] => {
            const [x0, y0, w, h] = [x - rx, y - ry, 2 * rx, 2 * ry].map((v) =>
              Math.max(1, Math.round(v * ratio)),
            );
            const d = ctx.getImageData(x0 as number, y0 as number, w as number, h as number).data;
            return Array.from({ length: d.length / 4 }, (_, i) => Array.from(d.slice(4 * i, 4 * i + 4)));
          };
          const rgb = (c: unknown) => [1, 3, 5].map((i) => Number.parseInt(String(c).slice(i, i + 2), 16));
          const near = (a: readonly number[], b: readonly number[], tol = 24) =>
            b.every((v, i) => Math.abs((a[i] ?? 0) - v) <= tol);
          const images = marks("image");
          const boxes = images.map((i) => {
            const { center, halfExtents } = i.getBounds();
            return [
              center[0],
              center[1],
              0.6 * (halfExtents[0] ?? 0),
              0.6 * (halfExtents[1] ?? 0),
            ] as number[];
          });
          const before = boxes.map(([x, y, rx, ry]) => read(x ?? 0, y ?? 0, rx ?? 0, ry));
          for (const i of images) i.style.visibility = "hidden";
          await frame();
          const changed = boxes.map(([x, y, rx, ry], k) => {
            const after = read(x ?? 0, y ?? 0, rx ?? 0, ry);
            return after.filter((p, j) => !near(p, before[k]?.[j] ?? [], 8)).length / after.length;
          });
          for (const i of images) i.style.visibility = "visible"; // back, for the screenshot
          await frame();
          const columns = marks("interval").map((b) => {
            const [x = 0, y = 0] = b.getBounds().center;
            return { color: String(b.style.fill), match: near(read(x, y, 1)[0] ?? [], rgb(b.style.fill), 4) };
          });
          // a mark's points are in the plot area's frame, whose origin is the mark element's own position
          const lines = marks("line").map((l) => {
            const pts = l.__data__?.points ?? [];
            const [x = 0, y = 0] = pts[Math.floor(pts.length / 2)] ?? [];
            const [ox = 0, oy = 0] = l.getPosition();
            const want = rgb(l.style.stroke);
            return {
              color: String(l.style.stroke),
              match: read(x + ox, y + oy, 3).some((p) => (p[3] ?? 0) > 200 && near(p, want)),
            };
          });
          // the axis logos, page elements over the canvas: loaded, each centred over its own column
          const left = canvas.getBoundingClientRect().left;
          const centres = marks("interval").map((b) => left + (b.getBounds().center[0] ?? 0));
          const axis = Array.from(
            f.querySelectorAll<HTMLImageElement>(".sdv-live-output img[data-sdv-id]"),
          ).map((img) => {
            const r = img.getBoundingClientRect();
            const x = r.left + r.width / 2;
            return {
              id: img.dataset.sdvId,
              loaded: img.complete && img.naturalWidth > 0,
              off: Math.min(...centres.map((c) => Math.abs(c - x))),
            };
          });
          return { images: images.length, changed, columns, lines, axis };
        });
        if ("error" in got) throw new Error(got.error);
        // the axis example draws its logos as labels; every other one as image marks
        if (id.endsWith("axis-logos")) expect(got.axis.length, "axis logos").toBeGreaterThan(0);
        else expect(got.images, "sdvplot's logo marks").toBeGreaterThan(0);
        for (const c of got.changed) expect(c, "the logo painted its box").toBeGreaterThan(0.2);
        // the examples that draw columns or lines have them: neither check may pass on an empty list
        if (id.endsWith("axis-logos")) expect(got.columns.length, "columns drawn").toBeGreaterThan(0);
        if (id.endsWith("margin-dark")) expect(got.lines.length, "lines drawn").toBeGreaterThan(0);
        for (const c of got.columns) expect(c.match, `a ${c.color} column's centre is its colour`).toBe(true);
        for (const l of got.lines) expect(l.match, `a pixel of the ${l.color} line is its colour`).toBe(true);
        for (const a of got.axis) {
          expect(a.loaded, `${a.id}'s axis logo loaded`).toBe(true);
          expect(a.off, `${a.id}'s axis logo is centred over its column`).toBeLessThan(1.5);
        }
      }
      // ECharts draws the server's SVG, tag for tag: init() alone already leaves an <svg>, and a series that drew nothing
      // would still leave its axes
      if (lib === "echarts") {
        const [server, drawn] = await figure.evaluate(async (f, id) => {
          const html = new DOMParser().parseFromString(
            await (await fetch(location.href)).text(),
            "text/html",
          );
          const marks = (svg: Element | null | undefined) =>
            ["path", "image", "text"].map((t) => `${t} ${svg?.querySelectorAll(t).length}`).join(", ");
          return [
            marks(html.querySelector(`figure[data-example="${id}"] .sdv-live-static svg`)),
            marks(f.querySelector(".sdv-live-output svg")),
          ];
        }, id);
        expect(drawn, "the server's marks, tag for tag").toBe(server);
      }
      // an accessible name: Vega names each mark in its SVG (sdvplot's images too); the others name the chart
      const named =
        lib === "vega"
          ? figure.locator('svg.marks [role="graphics-symbol"][aria-label]')
          : figure.locator('.sdv-live-output :is([role="img"], [role="figure"])[aria-label]');
      expect(await named.count(), "an accessible name").toBeGreaterThan(0);
      const nested =
        '.sdv-live-output [role="img"] :is(button, a[href], summary, input, [tabindex]:not([tabindex="-1"]))';
      expect(
        await figure.locator(nested).count(),
        "no control inside an img (its children are presentational)",
      ).toBe(0);
      // a menu's disclosure button (vega-embed's actions) is named: its <summary> holds only an icon
      const unnamed = await figure
        .locator(".sdv-live-output summary")
        .evaluateAll((s) => s.filter((e) => !e.getAttribute("aria-label") && !e.textContent?.trim()).length);
      expect(unnamed, "every menu button has a name").toBe(0);
      if (SHOTS !== undefined)
        await figure
          .locator(".sdv-live-output")
          .screenshot({ path: join(SHOTS, `${id.replace(/\//g, "_")}.png`) });
      // A Plotly bar's hover names its category: withAxisLogos hides the tick labels rather than blanking them, since
      // plotly.js reads a category's hover label from its tick text (blanked, hovering KC read "(, 15)").
      const bar = figure.locator(".js-plotly-plot .bars path").first();
      if (lib === "plotly" && (await bar.count()) > 0) {
        const name = await figure
          .locator(".js-plotly-plot")
          .evaluate((gd) => String((gd as unknown as { data: { x: unknown[] }[] }).data[0]?.x[0]));
        const box = await bar.boundingBox();
        if (box === null) throw new Error(`${id}: the first bar has no box`);
        await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
        const hover = figure.locator(".hoverlayer .hovertext").first();
        await hover.waitFor({ timeout: 5_000 });
        expect(await hover.textContent(), "the hover names the bar's category").toContain(name);
        if (SHOTS !== undefined)
          await figure
            .locator(".sdv-live-output")
            .screenshot({ path: join(SHOTS, `${id.replace(/\//g, "_")}_hover.png`) });
      }
      expect(errors).toEqual([]);
    } finally {
      await page.close();
    }
  });

  // shadcn/ui charts are React examples (no browser upgrade): the docs re-run each live through the vendored chart.tsx.
  // Sample real mark pixels: points along each line and each bar's centre must show the colour Chromium resolves for
  // the mark's var(--color-<key>), and that colour must be the chart's own <style> value for the theme it sits in
  // (its `.dark` block under a .dark ancestor). Each logo (legend <img>, axis <image>) is loaded and paints its box.
  test.each(EXAMPLES.filter((e) => e.id.startsWith("sdvplot/shadcn/")).map((e) => e.id))(
    "%s re-runs live and paints its theme's team colours",
    async (id) => {
      const entry = EXAMPLES.find((e) => e.id === id);
      if (entry === undefined) throw new Error(`${id} is not in the registry`);
      const page = await browser.newPage();
      try {
        const errors: string[] = [];
        page.on("console", (m) => void (m.type() === "error" && errors.push(m.text())));
        page.on("pageerror", (e) => void errors.push(e.message));
        await page.goto(`${base}/gallery/${pagePath(entry)}/`);
        const figure = page.locator(`figure[data-example="${id}"]`);
        await figure.scrollIntoViewIfNeeded();
        const chart = figure.locator(".sdv-live-output [data-slot='chart']");
        // a mark, not any layer: a horizontal reference line is a zero-height box, which Playwright calls hidden
        await chart
          .locator(".recharts-line-curve, .recharts-bar-rectangle path")
          .first()
          .waitFor({ timeout: 30_000 });
        await page.waitForLoadState("networkidle"); // the logos
        // the sticky navbar would sit over the top of the chart in its screenshot, and over the pixels sampled there
        await page.addStyleTag({ content: ".navbar { display: none !important; }" });
        expect(await figure.locator(".sdv-live-static").count(), "the static copy is replaced").toBe(0);
        expect(await figure.locator(".sdv-live-error").count(), "no error alert").toBe(0);
        const got = await chart.evaluate((el) => {
          const box = el.getBoundingClientRect();
          const dark = el.closest(".dark") !== null;
          const css = el.querySelector("style")?.textContent ?? "";
          const block = css.split("}").find((b) => b.trim().startsWith(dark ? ".dark" : "[data-chart")) ?? "";
          const theme = Object.fromEntries(
            [...block.matchAll(/--color-([^:]+):\s*([^;]+);/g)].map((m) => [m[1], (m[2] ?? "").trim()]),
          );
          const at = (x: number, y: number) => [x - box.left, y - box.top];
          const marks = [...el.querySelectorAll(".recharts-line-curve, .recharts-bar-rectangle path")].map(
            (m) => {
              const line = m.classList.contains("recharts-line-curve");
              const paint = line ? "stroke" : "fill";
              const key = /var\(--color-(.+)\)/.exec(m.getAttribute(paint) ?? "")?.[1] ?? "";
              const path = m as SVGPathElement;
              let points: number[][];
              if (line) {
                const ctm = path.getScreenCTM() as DOMMatrix;
                const len = path.getTotalLength();
                points = [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9].map((f) => {
                  const p = path.getPointAtLength(f * len);
                  return at(ctm.a * p.x + ctm.c * p.y + ctm.e, ctm.b * p.x + ctm.d * p.y + ctm.f);
                });
              } else {
                const r = m.getBoundingClientRect();
                points = [at(r.x + r.width / 2, r.y + r.height / 2)];
              }
              return { key, want: theme[key] ?? "", resolved: getComputedStyle(m)[paint], points };
            },
          );
          const logos = [...el.querySelectorAll("img, image")].map((i) => {
            const r = i.getBoundingClientRect();
            return {
              loaded: !(i instanceof HTMLImageElement) || (i.complete && i.naturalWidth > 0),
              box: [...at(r.x, r.y), r.width, r.height].map(Math.round) as [number, number, number, number],
            };
          });
          const bg = getComputedStyle(el.closest(".dark") ?? el).backgroundColor;
          return { dark, marks, logos, bg };
        });
        const shot = await loadImage(await chart.screenshot());
        const ctx = createCanvas(shot.width, shot.height).getContext("2d");
        ctx.drawImage(shot, 0, 0);
        const rgb = (s: string) => (s.match(/[\d.]+/g) ?? []).slice(0, 3).map(Number);
        const hex = (s: string) => [1, 3, 5].map((i) => Number.parseInt(s.slice(i, i + 2), 16));
        const near = (a: number[], b: number[], d: number) =>
          [0, 1, 2].every((c) => Math.abs((a[c] ?? 0) - (b[c] ?? 0)) <= d);
        /** The pixels of the w x h box at (x, y), as [r, g, b]. */
        const pixels = (x: number, y: number, w: number, h: number) => {
          const d = ctx.getImageData(Math.round(x), Math.round(y), Math.max(1, w), Math.max(1, h)).data;
          return Array.from(
            { length: d.length / 4 },
            (_, i) => [d[4 * i], d[4 * i + 1], d[4 * i + 2]] as number[],
          );
        };
        expect(got.marks.length, "the chart has lines or bars").toBeGreaterThan(0);
        for (const m of got.marks) {
          expect(m.want, `--color-${m.key} is in the chart's ${got.dark ? "dark" : "light"} block`).toMatch(
            /^#/,
          );
          expect(rgb(m.resolved), `var(--color-${m.key}) resolves to the theme's colour`).toEqual(
            hex(m.want),
          );
          const painted = m.points.some(([x, y]) =>
            pixels((x as number) - 2, (y as number) - 2, 5, 5).some((p) => near(p, hex(m.want), 24)),
          );
          expect(painted, `a pixel of the ${m.key} mark is ${m.want}`).toBe(true);
        }
        // every shadcn example charts the four AFC West teams, so each draws at least one logo per team
        expect(got.logos.length, "a logo per team in the legend or on the axis").toBeGreaterThanOrEqual(4);
        for (const { loaded, box } of got.logos) {
          expect(loaded, "the logo loaded").toBe(true);
          const [x, y, w, h] = box;
          const px = pixels(x, y, w, h);
          const inked = px.filter((p) => !near(p, rgb(got.bg), 40)).length / px.length;
          expect(inked, "the logo paints its box").toBeGreaterThan(0.1);
        }
        if (SHOTS !== undefined)
          await figure
            .locator(".sdv-live-output")
            .screenshot({ path: join(SHOTS, `${id.replace(/\//g, "_")}.png`) });
        expect(errors).toEqual([]);
      } finally {
        await page.close();
      }
    },
  );

  // MUI X Charts examples are React examples (no browser upgrade): the docs re-run each live. Sample real mark pixels:
  // hiding sdvplot's logos must change each logo's box (the image painted there), each bar's centre and points along
  // each line must show the colour MUI wrote on the mark, and the dark example's lines must be the dark-mode palette.
  // Tabbing into the chart and pressing an arrow key must show MUI's own focus mark (why the gate lets MUI's keyboard
  // layer set outline:none).
  /** The teams each example draws a logo for, in the order MUI draws them (points, ticks, series). */
  const MUI_LOGOS: Readonly<Record<string, readonly string[]>> = {
    "sdvplot/mui-x-charts/epa-logo-scatter": NFL_TEAM_EPA_2024.map((t) => t.team),
    "sdvplot/mui-x-charts/afc-wins-logo-ticks": ["KC", "BUF", "LAC", "DEN", "MIA", "LV", "NYJ", "NE"],
    "sdvplot/mui-x-charts/afc-west-margin-dark": ["KC", "LAC", "DEN", "LV"],
  };
  test.each(EXAMPLES.filter((e) => e.id.startsWith("sdvplot/mui-x-charts/")).map((e) => e.id))(
    "%s re-runs live: real logo, bar and line pixels, and MUI's keyboard focus mark",
    async (id) => {
      const entry = EXAMPLES.find((e) => e.id === id);
      if (entry === undefined) throw new Error(`${id} is not in the registry`);
      const page = await browser.newPage();
      try {
        const errors: string[] = [];
        page.on("console", (m) => void (m.type() === "error" && errors.push(m.text())));
        page.on("pageerror", (e) => void errors.push(e.message));
        await page.goto(`${base}/gallery/${pagePath(entry)}/`);
        const figure = page.locator(`figure[data-example="${id}"]`);
        await figure.scrollIntoViewIfNeeded();
        const svg = figure.locator(".sdv-live-output svg.MuiChartsSvgLayer-root");
        await svg.locator("image[data-sdv-id]").first().waitFor({ timeout: 30_000 });
        await page.waitForLoadState("networkidle"); // the logos
        await page.addStyleTag({ content: ".navbar { display: none !important; }" });
        expect(await figure.locator(".sdv-live-static").count(), "the static copy is replaced").toBe(0);
        expect(await figure.locator(".sdv-live-error").count(), "no error alert").toBe(0);
        const got = await svg.evaluate((el) => {
          const box = el.getBoundingClientRect();
          const at = (x: number, y: number) => [x - box.left, y - box.top];
          const images = [...el.querySelectorAll("image[data-sdv-id]")];
          const ids = images.map((i) => i.getAttribute("data-sdv-id"));
          const logos = images.map((i) => {
            const r = i.getBoundingClientRect();
            return [...at(r.x, r.y), r.width, r.height].map(Math.round) as [number, number, number, number];
          });
          const bars = [...el.querySelectorAll("rect.MuiBarChart-element")].map((b) => {
            const r = b.getBoundingClientRect();
            return {
              want: b.getAttribute("fill") ?? "",
              points: [at(r.x + r.width / 2, r.y + r.height / 2)],
            };
          });
          const lines = [...el.querySelectorAll("path.MuiLineChart-line")].map((m) => {
            const path = m as SVGPathElement;
            const ctm = path.getScreenCTM() as DOMMatrix;
            const len = path.getTotalLength();
            const points = [0.15, 0.3, 0.45, 0.6, 0.75].map((f) => {
              const p = path.getPointAtLength(f * len);
              return at(ctm.a * p.x + ctm.c * p.y + ctm.e, ctm.b * p.x + ctm.d * p.y + ctm.f);
            });
            return { want: path.getAttribute("stroke") ?? "", points };
          });
          return { ids, logos, bars, lines };
        });
        const shoot = async () => {
          const shot = await loadImage(await svg.screenshot());
          const ctx = createCanvas(shot.width, shot.height).getContext("2d");
          ctx.drawImage(shot, 0, 0);
          return (x: number, y: number, w: number, h: number) => {
            const d = ctx.getImageData(Math.round(x), Math.round(y), Math.max(1, w), Math.max(1, h)).data;
            return Array.from(
              { length: d.length / 4 },
              (_, i) => [d[4 * i], d[4 * i + 1], d[4 * i + 2]] as number[],
            );
          };
        };
        const hex = (s: string) => [1, 3, 5].map((i) => Number.parseInt(s.slice(i, i + 2), 16));
        const near = (a: number[], b: number[], d: number) =>
          [0, 1, 2].every((c) => Math.abs((a[c] ?? 0) - (b[c] ?? 0)) <= d);
        const pixels = await shoot();
        // each team's own logo, in MUI's order: 32 copies of one logo cannot pass
        await loadLeague("nfl");
        expect(got.ids, "every team's logo is drawn").toEqual(
          (MUI_LOGOS[id] ?? []).map((t) => resolveSync(t, "nfl")),
        );
        for (const m of [...got.bars, ...got.lines]) {
          expect(m.want, "MUI wrote a hex colour on the mark").toMatch(/^#[0-9a-f]{6}$/i);
          const painted = m.points.some(([x, y]) =>
            pixels((x as number) - 2, (y as number) - 2, 5, 5).some((p) => near(p, hex(m.want), 24)),
          );
          expect(painted, `a pixel of the mark is ${m.want}`).toBe(true);
        }
        if (id.endsWith("logo-ticks")) expect(got.bars.length, "a bar per team").toBe(8);
        if (id.endsWith("margin-dark")) {
          expect(got.lines.length, "a line per team").toBe(4);
          // the ThemeProvider's dark mode reached teamColors: the lines are the palette for MUI's #121212
          await loadLeague("nfl");
          const dark = teamColors("nfl", ["KC", "LAC", "DEN", "LV"])("dark");
          expect(got.lines.map((l) => l.want.toLowerCase())).toEqual(dark);
          expect(dark).not.toEqual(teamColors("nfl", ["KC", "LAC", "DEN", "LV"])("light"));
        }
        // the logos' own pixels: with them hidden, each logo's box changes (a logo's box is its full image, transparent
        // margins included, so a slim logo inks a small share of it: over 10%, the bar shadcn's logos meet)
        await svg.evaluate((el) => {
          for (const i of el.querySelectorAll("image[data-sdv-id]")) i.setAttribute("visibility", "hidden");
        });
        const without = await shoot();
        const changed = got.logos.map(([x, y, w, h]) => {
          const a = pixels(x, y, w, h);
          const b = without(x, y, w, h);
          return a.filter((p, i) => !near(p, b[i] ?? [], 8)).length / a.length;
        });
        console.log(
          `${id}: logo boxes changed ${Math.min(...changed).toFixed(2)} to ${Math.max(...changed).toFixed(2)}`,
        );
        changed.forEach((c, i) => expect(c, `logo ${i} paints its box`).toBeGreaterThan(0.1));
        await svg.evaluate((el) => {
          for (const i of el.querySelectorAll("image[data-sdv-id]")) i.removeAttribute("visibility");
        });
        // keyboard: focus MUI's own keyboard layer (its exact style, the one the gate exempts), step to an item, and MUI
        // draws its focus mark there: the scatter's MuiScatterChart-focusedMark; for bars and lines (FocusedBar and
        // FocusedLineMark carry no class in 9.15) the rect MUI's code draws, 3 px round a bar or 12 px on a line's point
        const proxy = await figure.evaluate((f, style) => {
          const re = new RegExp(`^${style}$`);
          const hits = [...f.querySelectorAll('.sdv-live-output div[role="none"][tabindex]')].filter((d) =>
            re.test(d.getAttribute("style") ?? ""),
          );
          for (const d of hits) d.setAttribute("data-sdv-test", "mui-proxy");
          return hits.length;
        }, MUI_PROXY_STYLE);
        expect(proxy, "one MUI keyboard layer").toBe(1);
        const kind = id.endsWith("scatter") ? "scatter" : id.endsWith("ticks") ? "bar" : "line";
        const focusMark = (el: Element, k: string): boolean => {
          if (k === "scatter") return el.querySelector(".MuiScatterChart-focusedMark") !== null;
          const rects = [...el.querySelectorAll('rect[fill="none"][stroke-width="2"]')] as SVGRectElement[];
          const n = (r: Element, a: string) => Number(r.getAttribute(a));
          if (k === "bar") {
            const bars = [...el.querySelectorAll("rect.MuiBarChart-element")];
            return rects.some((f) =>
              bars.some((b) =>
                [
                  [n(f, "x") + 3, n(b, "x")],
                  [n(f, "y") + 3, n(b, "y")],
                  [n(f, "width") - 6, n(b, "width")],
                  [n(f, "height") - 6, n(b, "height")],
                ].every(([a, c]) => Math.abs((a as number) - (c as number)) < 0.5),
              ),
            );
          }
          const paths = [...el.querySelectorAll("path.MuiLineChart-line")] as SVGPathElement[];
          return rects.some((f) => {
            if (n(f, "width") !== 12 || n(f, "height") !== 12) return false;
            const [cx, cy] = [n(f, "x") + 6, n(f, "y") + 6];
            return paths.some((p) => {
              const len = p.getTotalLength();
              return Array.from({ length: 401 }, (_, i) => p.getPointAtLength((i / 400) * len)).some(
                (q) => Math.hypot(q.x - cx, q.y - cy) < 1.5,
              );
            });
          });
        };
        expect(await svg.evaluate(focusMark, kind), "no focus mark before the keyboard").toBe(false);
        await figure.locator('[data-sdv-test="mui-proxy"]').focus();
        await page.keyboard.press("ArrowRight");
        await expect.poll(() => svg.evaluate(focusMark, kind), { timeout: 5_000 }).toBe(true);
        if (SHOTS !== undefined)
          await figure
            .locator(".sdv-live-output")
            .screenshot({ path: join(SHOTS, `${id.replace(/\//g, "_")}.png`) });
        expect(errors).toEqual([]);
      } finally {
        await page.close();
      }
    },
  );

  // TanStack Charts examples are React examples (no browser upgrade): the docs re-run each live. TanStack has no image
  // mark: each logo is a dot filled with an SVG pattern of it, written into the chart's own svg by withPatterns. Every
  // expectation comes from outside the dots: each team's centre from its data through the chart's own axes (two tick
  // rules give each axis' data-to-pixel line), and each line found by TanStack's series key (`margin:string:2:KC`, the
  // examples' line mark being "margin"), not by order. Then the logos' own pixels (hiding the dots' fill changes each logo box round that expected centre) and
  // points along each line in its team's colour, the dark palette on the dark card.
  const lastDiff = (team: string) => {
    const s = AFC_WEEKS_2024.find((w) => w.team === team);
    if (s === undefined) throw new Error(`no 2024 weeks for ${team}`);
    return s.margins.reduce<number>((a, m) => a + (m ?? 0), 0);
  };
  /** Each example's teams (in mark order), logo variant, and where each team's logo belongs in data units. */
  const TANSTACK: Readonly<
    Record<
      string,
      { teams: readonly string[]; variant: "default" | "dark"; at: (team: string) => [x: number, y: number] }
    >
  > = {
    "sdvplot/tanstack-charts/epa-logo-scatter": {
      teams: NFL_TEAM_EPA_2024.map((t) => t.team),
      variant: "default",
      at: (team) => {
        const t = NFL_TEAM_EPA_2024.find((r) => r.team === team);
        if (t === undefined) throw new Error(`no EPA row for ${team}`);
        return [t.off_epa / t.off_plays, t.def_epa / t.def_plays];
      },
    },
    "sdvplot/tanstack-charts/afc-east-margin-lines": {
      teams: ["BUF", "MIA", "NYJ", "NE"],
      variant: "default",
      at: (team) => [18, lastDiff(team)],
    },
    "sdvplot/tanstack-charts/afc-west-margin-dark": {
      teams: ["KC", "LAC", "DEN", "LV"],
      variant: "dark",
      at: (team) => [18, lastDiff(team)],
    },
  };
  test.each(EXAMPLES.filter((e) => e.id.startsWith("sdvplot/tanstack-charts/")).map((e) => e.id))(
    "%s re-runs live: each team's logo where its data puts it, real logo and line pixels",
    async (id) => {
      const entry = EXAMPLES.find((e) => e.id === id);
      const spec = TANSTACK[id];
      if (entry === undefined || spec === undefined) throw new Error(`${id} is not in the registry`);
      const { teams, variant, at } = spec;
      const page = await browser.newPage();
      try {
        const errors: string[] = [];
        page.on("console", (m) => void (m.type() === "error" && errors.push(m.text())));
        page.on("pageerror", (e) => void errors.push(e.message));
        await page.goto(`${base}/gallery/${pagePath(entry)}/`);
        const figure = page.locator(`figure[data-example="${id}"]`);
        await figure.scrollIntoViewIfNeeded();
        const svg = figure.locator(".sdv-live-output svg.ts-chart");
        await svg.locator("pattern image").first().waitFor({ state: "attached", timeout: 30_000 });
        await page.waitForLoadState("networkidle"); // the logos
        await page.addStyleTag({ content: ".navbar { display: none !important; }" });
        expect(await figure.locator(".sdv-live-static").count(), "the static copy is replaced").toBe(0);
        expect(await figure.locator(".sdv-live-error").count(), "no error alert").toBe(0);
        const got = await svg.evaluate((el, ts) => {
          const box = el.getBoundingClientRect();
          const m = (el as SVGSVGElement).getScreenCTM() as DOMMatrix;
          // svg user units -> px from the svg's top left (what its screenshot is indexed by)
          const toBox = (x: number, y: number) => [
            m.a * x + m.c * y + m.e - box.left,
            m.b * x + m.d * y + m.f - box.top,
          ];
          // the axes' tick rules: [value, px] along each axis, keyed by TanStack as x-tick-rule:number:<value>
          const ticks = (axis: "x" | "y") =>
            [...el.querySelectorAll(`line[data-ts-key^="${axis}-tick-rule:number:"]`)].map((l) => [
              Number((l.getAttribute("data-ts-key") ?? "").split(":").at(-1)),
              Number(l.getAttribute(`${axis}1`)),
            ]);
          // every dot filled with a pattern sdvplot wrote (its <defs data-ts-key="sdv-patterns">)
          const dots = [...el.querySelectorAll("circle")].flatMap((c) => {
            const pid = /^url\(#(.+)\)$/.exec(c.getAttribute("fill") ?? "")?.[1];
            const image =
              pid === undefined
                ? null
                : el.querySelector(`defs[data-ts-key="sdv-patterns"] > pattern[id="${pid}"] > image`);
            if (!image) return [];
            const n = (e: Element, a: string) => Number(e.getAttribute(a));
            return [
              {
                href: image.getAttribute("href") ?? "",
                cx: n(c, "cx"),
                cy: n(c, "cy"),
                // the logo's size: its share of the dot's 2r box, in user units
                w: n(image, "width") * 2 * n(c, "r"),
                h: n(image, "height") * 2 * n(c, "r"),
              },
            ];
          });
          // each team's line by TanStack's series key, so a line in another team's colour cannot pass
          const lines = Object.fromEntries(
            ts.flatMap((team) => {
              const path = el.querySelector(
                `g[data-ts-key="margin:string:${team.length}:${team}"] path`,
              ) as SVGPathElement | null;
              if (path === null) return [];
              const len = path.getTotalLength();
              const points = [0.15, 0.3, 0.45, 0.6, 0.75].map((f) => {
                const p = path.getPointAtLength(f * len);
                return toBox(p.x, p.y);
              });
              return [[team, { stroke: path.getAttribute("stroke") ?? "", points }]];
            }),
          ) as Record<string, { stroke: string; points: number[][] }>;
          return { xt: ticks("x"), yt: ticks("y"), dots, lines, scale: [m.a, m.d], origin: toBox(0, 0) };
        }, teams);
        const shoot = async () => {
          const shot = await loadImage(await svg.screenshot());
          const ctx = createCanvas(shot.width, shot.height).getContext("2d");
          ctx.drawImage(shot, 0, 0);
          return (x: number, y: number, w: number, h: number) => {
            const d = ctx.getImageData(Math.round(x), Math.round(y), Math.max(1, w), Math.max(1, h)).data;
            return Array.from(
              { length: d.length / 4 },
              (_, i) => [d[4 * i], d[4 * i + 1], d[4 * i + 2]] as number[],
            );
          };
        };
        const hex = (s: string) => [1, 3, 5].map((i) => Number.parseInt(s.slice(i, i + 2), 16));
        const near = (a: number[], b: number[], d: number) =>
          [0, 1, 2].every((c) => Math.abs((a[c] ?? 0) - (b[c] ?? 0)) <= d);
        /** An axis' data-to-pixel line, through its first and last tick rule. */
        const axisMap = (t: number[][]) => {
          expect(t.length, "the axis has tick rules").toBeGreaterThanOrEqual(2);
          const [v0, p0] = t[0] as [number, number];
          const [v1, p1] = t.at(-1) as [number, number];
          return (v: number) => p0 + ((v - v0) * (p1 - p0)) / (v1 - v0);
        };
        const [px, py] = [axisMap(got.xt), axisMap(got.yt)];
        await loadLeague("nfl");
        // each team's own logo, in mark order: 32 copies of one logo cannot pass
        expect(
          got.dots.map((d) => d.href),
          "every team's logo is drawn",
        ).toEqual(teams.map((t) => logoUrlSync(t, "nfl", { variant })));
        // and each sits where its team's data puts it on the chart's own axes; its logo box, round that centre
        const [sx, sy] = got.scale as [number, number];
        const [ox, oy] = got.origin as [number, number];
        const boxes = teams.map((team, i) => {
          const d = got.dots[i];
          const [x, y] = at(team);
          expect.soft(d?.cx ?? Number.NaN, `${team}'s logo x`).toBeCloseTo(px(x), 0);
          expect.soft(d?.cy ?? Number.NaN, `${team}'s logo y`).toBeCloseTo(py(y), 0);
          const [w, h] = [(d?.w ?? 0) * sx, (d?.h ?? 0) * sy];
          return [ox + px(x) * sx - w / 2, oy + py(y) * sy - h / 2, w, h].map(Math.round) as [
            number,
            number,
            number,
            number,
          ];
        });
        const pixels = await shoot();
        if (!id.endsWith("scatter")) {
          // each team's line is its colour in the shared team palette (for the dark card, the palette on #111827),
          // taken from the recharts adapter: independent of the tanstack module under test
          const want = rechartsPalette("nfl", teams, variant === "dark" ? { background: "#111827" } : {});
          if (variant === "dark") expect(want).not.toEqual(rechartsPalette("nfl", teams));
          teams.forEach((team, i) => {
            const line = got.lines[team];
            expect.soft(line?.stroke.toLowerCase(), `${team}'s line colour`).toBe(want[i]?.toLowerCase());
            const painted = (line?.points ?? []).some(([x, y]) =>
              pixels((x as number) - 2, (y as number) - 2, 5, 5).some((p) => near(p, hex(want[i] ?? ""), 24)),
            );
            expect.soft(painted, `a pixel of ${team}'s line is ${want[i]}`).toBe(true);
          });
        }
        // the logos' own pixels: with the dots' fill hidden, each logo box changes (over 10%, the bar MUI's logos meet)
        await svg.evaluate((el) => {
          for (const c of el.querySelectorAll('circle[fill^="url("]')) c.setAttribute("fill-opacity", "0");
        });
        const without = await shoot();
        const changed = boxes.map(([x, y, w, h]) => {
          const a = pixels(x, y, w, h);
          const b = without(x, y, w, h);
          return a.filter((p, i) => !near(p, b[i] ?? [], 8)).length / a.length;
        });
        console.log(
          `${id}: logo boxes changed ${Math.min(...changed).toFixed(2)} to ${Math.max(...changed).toFixed(2)}`,
        );
        changed.forEach((c, i) => expect.soft(c, `${teams[i]}'s logo paints its box`).toBeGreaterThan(0.1));
        if (SHOTS !== undefined)
          await figure
            .locator(".sdv-live-output")
            .screenshot({ path: join(SHOTS, `${id.replace(/\//g, "_")}.png`) });
        expect(errors).toEqual([]);
      } finally {
        await page.close();
      }
    },
  );

  // MUI X Data Grid examples (sdvtables/mui) are React examples too, re-run live by the docs. The grid shows exactly the
  // example's rows, in its sort order; each row's image is its own team's or player's (by id); hiding the images changes
  // each image's box (real logo pixels); and a team-coloured row paints the fill dataGridProps worked out from the
  // palette, under text that reads on it. The dark example's grid paints midnight's background and header.
  const byWins = [...STANDINGS].sort((a, b) => b.wins - a.wins);
  const byEpa = [...STANDINGS].sort(
    (a, b) => (b.net_epa ?? Number.NEGATIVE_INFINITY) - (a.net_epa ?? Number.NEGATIVE_INFINITY),
  );
  const GRIDS: Readonly<
    Record<
      string,
      {
        rows: readonly string[];
        field: string;
        images: () => (string | undefined)[];
        fills?: () => (string | undefined)[];
      }
    >
  > = {
    "sdvtables/mui-x-data-grid/afc-standings-team-rows": {
      rows: byWins.map((s) => s.team),
      field: "team",
      images: () => byWins.map((s) => resolveSync(s.team, "nfl")),
      fills: () => {
        // the palette is worked out over the rows as passed (STANDINGS order), laid over sdv's white at 0.4
        const pal = teamColorPalette(
          "nfl",
          STANDINGS.map((s) => s.team),
          { background: "#FFFFFF" },
        );
        const of = new Map(STANDINGS.map((s, i) => [s.team, solid(`${pal[i]}66`, "#FFFFFF")]));
        return byWins.map((s) => of.get(s.team));
      },
    },
    "sdvtables/mui-x-data-grid/afc-quarterbacks-headshots": {
      rows: byEpa.map((s) => s.qb_espn_id),
      field: "qb_espn_id",
      images: () => byEpa.map((s) => s.qb_espn_id),
    },
    "sdvtables/mui-x-data-grid/pacific-nba-midnight": {
      rows: NBA_STANDINGS.map((s) => String(s.team_id)),
      field: "team_id",
      // stats.nba.com's numeric TeamID, resolved to the ESPN id the logo is stored under
      images: () => NBA_STANDINGS.map((s) => resolveSync(s.team_id, "nba")),
      fills: () => {
        const ids = NBA_STANDINGS.map((s) => resolveSync(s.team_id, "nba"));
        const pal = teamColorPalette("nba", ids, { background: "#0C0D10", idSystem: "team_id" });
        return pal.map((c) => solid(`${c}4d`, "#0C0D10"));
      },
    },
  };
  test.each(EXAMPLES.filter((e) => e.id.startsWith("sdvtables/mui-x-data-grid/")).map((e) => e.id))(
    "%s re-runs live: the example's rows, each image in its own row, real image pixels and team fills",
    async (id) => {
      const entry = EXAMPLES.find((e) => e.id === id);
      const want = GRIDS[id];
      if (entry === undefined || want === undefined)
        throw new Error(`${id} has no registry entry or no expectations`);
      await Promise.all([loadLeague("nfl"), loadLeague("nba")]);
      const page = await browser.newPage();
      try {
        const errors: string[] = [];
        page.on("console", (m) => void (m.type() === "error" && errors.push(m.text())));
        page.on("pageerror", (e) => void errors.push(e.message));
        await page.goto(`${base}/gallery/${pagePath(entry)}/`);
        const figure = page.locator(`figure[data-example="${id}"]`);
        await figure.scrollIntoViewIfNeeded();
        const grid = figure.locator(".sdv-live-output .MuiDataGrid-root");
        await grid.locator("img[data-sdv-id]").first().waitFor({ timeout: 30_000 });
        await page.waitForLoadState("networkidle"); // the images
        await page.addStyleTag({ content: ".navbar { display: none !important; }" });
        expect(await figure.locator(".sdv-live-static").count(), "the static copy is replaced").toBe(0);
        expect(await figure.locator(".sdv-live-error").count(), "no error alert").toBe(0);
        const got = await grid.evaluate((el, field) => {
          const box = el.getBoundingClientRect();
          const rows = [...el.querySelectorAll(".MuiDataGrid-row")].map((r) => {
            const img = r.querySelector(`.MuiDataGrid-cell[data-field="${field}"] img[data-sdv-id]`);
            const ib = img?.getBoundingClientRect();
            const rb = r.getBoundingClientRect();
            const text = r.querySelector(".MuiDataGrid-cell:last-child") as HTMLElement | null;
            return {
              id: r.getAttribute("data-id"),
              image: img?.getAttribute("data-sdv-id") ?? null,
              loaded: img instanceof HTMLImageElement && img.complete && img.naturalWidth > 0,
              box:
                ib === undefined
                  ? null
                  : [ib.x - box.left, ib.y - box.top, ib.width, ib.height].map(Math.round),
              // a spot of the row clear of text: 3 px in from its visible right end, mid-height
              spot: [Math.min(rb.right, box.right) - box.left - 4, rb.top - box.top + rb.height / 2].map(
                Math.round,
              ),
              fill: getComputedStyle(r).backgroundColor,
              ink: text === null ? "" : getComputedStyle(text).color,
            };
          });
          const head = el.querySelector(".MuiDataGrid-columnHeader");
          const scroller = el.querySelector(".MuiDataGrid-virtualScroller");
          return {
            rows,
            overflow: scroller === null ? -1 : scroller.scrollWidth - scroller.clientWidth,
            images: el.querySelectorAll("img[data-sdv-id]").length,
            root: getComputedStyle(el).backgroundColor,
            header: head === null ? "" : getComputedStyle(head).backgroundColor,
          };
        }, want.field);
        // a computed colour: rgb(r, g, b), or color(srgb r g b) in 0-1 (what Chromium gives a color-mix)
        const rgb = (s: string) => {
          const n = (s.match(/[\d.]+/g) ?? []).map(Number);
          return (s.startsWith("color(srgb") ? n.map((v) => Math.round(v * 255)) : n).slice(0, 3);
        };
        const hex = (s: string) => [1, 3, 5].map((i) => Number.parseInt(s.slice(i, i + 2), 16));
        const near = (a: number[], b: number[], d: number) =>
          [0, 1, 2].every((c) => Math.abs((a[c] ?? 0) - (b[c] ?? 0)) <= d);
        expect(
          got.rows.map((r) => r.id),
          "exactly the example's rows, in its order",
        ).toEqual(want.rows);
        expect(got.images, "one image per row, no more").toBe(want.rows.length);
        expect(got.overflow, "the columns fit the docs column: no horizontal scroll").toBe(0);
        expect(
          got.rows.map((r) => r.image),
          "each row's image is its own team's or player's",
        ).toEqual(want.images());
        expect(
          got.rows.map((r) => r.loaded),
          "every image loaded",
        ).toEqual(want.rows.map(() => true));
        const shoot = async () => {
          const shot = await loadImage(await grid.screenshot());
          const ctx = createCanvas(shot.width, shot.height).getContext("2d");
          ctx.drawImage(shot, 0, 0);
          return (x: number, y: number, w: number, h: number) => {
            const d = ctx.getImageData(Math.round(x), Math.round(y), Math.max(1, w), Math.max(1, h)).data;
            return Array.from(
              { length: d.length / 4 },
              (_, i) => [d[4 * i], d[4 * i + 1], d[4 * i + 2]] as number[],
            );
          };
        };
        const pixels = await shoot();
        if (want.fills !== undefined) {
          const fills = want.fills();
          got.rows.forEach((r, i) => {
            const f = fills[i] ?? "";
            expect(rgb(r.fill), `row ${r.id} is filled with ${f}`).toEqual(hex(f));
            const [x, y] = r.spot as [number, number];
            expect(near(pixels(x, y, 1, 1)[0] ?? [], hex(f), 3), `a pixel of row ${r.id} is ${f}`).toBe(true);
            expect(
              contrast(
                `#${rgb(r.ink)
                  .map((c) => c.toString(16).padStart(2, "0"))
                  .join("")}`,
                f,
              ),
            ).toBeGreaterThanOrEqual(4.5);
          });
        }
        if (id.endsWith("midnight")) {
          expect(rgb(got.root), "midnight's background").toEqual(hex("#0C0D10"));
          expect(rgb(got.header), "midnight's header").toEqual(hex("#16181D"));
        }
        // the images' own pixels: with them hidden, each image's box changes (over 10%, as the chart libraries' logos)
        await grid.evaluate((el) => {
          for (const i of el.querySelectorAll("img[data-sdv-id]"))
            (i as HTMLElement).style.visibility = "hidden";
        });
        const without = await shoot();
        const changed = got.rows.map((r) => {
          const [x, y, w, h] = r.box as [number, number, number, number];
          const a = pixels(x, y, w, h);
          const b = without(x, y, w, h);
          return a.filter((p, i) => !near(p, b[i] ?? [], 8)).length / a.length;
        });
        console.log(
          `${id}: image boxes changed ${Math.min(...changed).toFixed(2)} to ${Math.max(...changed).toFixed(2)}`,
        );
        changed.forEach((c, i) => expect(c, `image ${i} paints its box`).toBeGreaterThan(0.1));
        await grid.evaluate((el) => {
          for (const i of el.querySelectorAll("img[data-sdv-id]")) (i as HTMLElement).style.visibility = "";
        });
        if (want.fills !== undefined) {
          // MUI's own :hover and .Mui-selected rules must not replace a team fill: a hovered row and a selected row (the
          // class MUI puts on it) keep a shade of their fill, within 36 per channel (the shade moves at most 14% toward
          // its text colour; MUI's own grey sat 57 to 82 away before the fix), with text at 4.5:1 or better
          const fills = want.fills();
          const state = async (i: number) =>
            grid
              .locator(".MuiDataGrid-row")
              .nth(i)
              .evaluate((r) => {
                const cell = r.querySelector(".MuiDataGrid-cell:last-child") as HTMLElement;
                return { fill: getComputedStyle(r).backgroundColor, ink: getComputedStyle(cell).color };
              });
          const check = (s: { fill: string; ink: string }, f: string, what: string) => {
            expect(near(rgb(s.fill), hex(f), 36), `${what}: ${s.fill} keeps a shade of ${f}`).toBe(true);
            const css = (c: string) =>
              `#${rgb(c)
                .map((v) => v.toString(16).padStart(2, "0"))
                .join("")}`;
            expect(contrast(css(s.ink), css(s.fill)), `${what}: text on the fill`).toBeGreaterThanOrEqual(
              4.5,
            );
          };
          await grid.locator(".MuiDataGrid-row").nth(0).hover();
          check(await state(0), fills[0] ?? "", `hovered row ${want.rows[0]}`);
          await grid
            .locator(".MuiDataGrid-row")
            .nth(1)
            .evaluate((r) => r.classList.add("Mui-selected"));
          check(await state(1), fills[1] ?? "", `selected row ${want.rows[1]}`);
          await grid.locator(".MuiDataGrid-row").nth(1).hover();
          check(await state(1), fills[1] ?? "", `selected, hovered row ${want.rows[1]}`);
          await grid
            .locator(".MuiDataGrid-row")
            .nth(1)
            .evaluate((r) => r.classList.remove("Mui-selected"));
          await page.mouse.move(0, 0);
        }
        if (SHOTS !== undefined)
          await figure
            .locator(".sdv-live-output")
            .screenshot({ path: join(SHOTS, `${id.replace(/\//g, "_")}.png`) });
        expect(errors).toEqual([]);
      } finally {
        await page.close();
      }
    },
  );

  // AG Grid examples (sdvtables/aggrid): the grid shows exactly the example's rows (by AG Grid's row-id), in its sort
  // order; each row's image is its own team's (by id); hiding the images changes each image's box (real logo pixels); a
  // team-coloured row paints the fill gridOptions worked out from the palette, to the grid's right edge, under text that
  // reads on it, and AG Grid's hover and selected overlays paint exactly its shades of that fill.
  const agByWins = [...STANDINGS].sort((a, b) => b.wins - a.wins);
  const AG_GRIDS: Readonly<
    Record<
      string,
      {
        rows: readonly string[];
        field: string;
        images: () => (string | undefined)[];
        fills: () => (string | undefined)[];
        bg: string;
        /** The theme stripes odd rows: the team fill must cover the stripe there. */
        stripe?: string;
      }
    >
  > = {
    "sdvtables/ag-grid/afc-standings-team-rows": {
      rows: agByWins.map((s) => s.team),
      field: "team",
      images: () => agByWins.map((s) => resolveSync(s.team, "nfl")),
      fills: () => {
        // the palette is worked out over the rows as passed (STANDINGS order), laid over sdv's white at 0.4
        const pal = agPalette(
          "nfl",
          STANDINGS.map((s) => s.team),
          { background: "#FFFFFF" },
        );
        const of = new Map(STANDINGS.map((s, i) => [s.team, solid(`${pal[i]}66`, "#FFFFFF")]));
        return agByWins.map((s) => of.get(s.team));
      },
      bg: "#ffffff",
    },
    "sdvtables/ag-grid/pacific-nba-midnight": {
      rows: NBA_STANDINGS.map((s) => String(s.team_id)),
      field: "team_id",
      // stats.nba.com's numeric TeamID, resolved to the ESPN id the logo is stored under
      images: () => NBA_STANDINGS.map((s) => resolveSync(s.team_id, "nba")),
      fills: () => {
        const ids = NBA_STANDINGS.map((s) => resolveSync(s.team_id, "nba"));
        const pal = agPalette("nba", ids, { background: "#0C0D10", idSystem: "team_id" });
        return pal.map((c) => solid(`${c}4d`, "#0C0D10"));
      },
      bg: "#0c0d10",
    },
    "sdvtables/ag-grid/atlantic-nhl-savant": {
      rows: NHL_STANDINGS.map((s) => s.team),
      field: "team",
      images: () => NHL_STANDINGS.map((s) => resolveSync(s.team, "nhl")),
      fills: () => {
        const pal = agPalette(
          "nhl",
          NHL_STANDINGS.map((s) => s.team),
          { background: "#FFFFFF" },
        );
        return pal.map((c) => solid(`${c}66`, "#FFFFFF"));
      },
      bg: "#ffffff",
      stripe: "#f4f4f4", // savant's odd-row stripe
    },
  };
  // a computed colour as [r, g, b]: rgb(r, g, b), or color(srgb r g b) in 0-1
  const agRgb = (s: string) => {
    const n = (s.match(/[\d.]+/g) ?? []).map(Number);
    return (s.startsWith("color(srgb") ? n.map((v) => Math.round(v * 255)) : n).slice(0, 3);
  };
  const agHex = (s: string) => [1, 3, 5].map((i) => Number.parseInt(s.slice(i, i + 2), 16));
  const agCss = (c: number[]) => `#${c.map((v) => v.toString(16).padStart(2, "0")).join("")}`;
  const agNear = (a: number[], b: number[], d: number) =>
    [0, 1, 2].every((c) => Math.abs((a[c] ?? 0) - (b[c] ?? 0)) <= d);
  /** A screenshot of `loc` as a pixel reader: the [r, g, b] of each pixel of a box, row by row. */
  const agShoot = async (loc: ReturnType<Page["locator"]>) => {
    const shot = await loadImage(await loc.screenshot());
    const ctx = createCanvas(shot.width, shot.height).getContext("2d");
    ctx.drawImage(shot, 0, 0);
    return (x: number, y: number, w = 1, h = 1) => {
      const d = ctx.getImageData(Math.round(x), Math.round(y), Math.max(1, w), Math.max(1, h)).data;
      return Array.from(
        { length: d.length / 4 },
        (_, i) => [d[4 * i], d[4 * i + 1], d[4 * i + 2]] as number[],
      );
    };
  };
  test.each(Object.keys(AG_GRIDS))(
    "%s draws with AG Grid: the example's rows, each logo in its own row, real image pixels, team fills kept on hover and selection",
    async (id) => {
      const entry = EXAMPLES.find((e) => e.id === id);
      const want = AG_GRIDS[id];
      if (entry === undefined || want === undefined) throw new Error(`${id} has no registry entry`);
      await Promise.all([loadLeague("nfl"), loadLeague("nba"), loadLeague("nhl")]);
      const page = await browser.newPage();
      try {
        const errors: string[] = [];
        page.on("console", (m) => void (m.type() === "error" && errors.push(m.text())));
        page.on("pageerror", (e) => void errors.push(e.message));
        await page.goto(`${base}/gallery/${pagePath(entry)}/`);
        const figure = page.locator(`figure[data-example="${id}"]`);
        await figure.scrollIntoViewIfNeeded();
        const grid = figure.locator(".sdv-live-output .ag-root-wrapper");
        await grid.locator("img[data-sdv-id]").first().waitFor({ timeout: 30_000 });
        await page.waitForLoadState("networkidle"); // the images
        await page.addStyleTag({ content: ".navbar { display: none !important; }" });
        expect(await figure.locator(".sdv-live-static").count(), "the static copy is replaced").toBe(0);
        expect(await figure.locator(".sdv-live-error").count(), "no error alert").toBe(0);
        const got = await grid.evaluate((el, field) => {
          const box = el.getBoundingClientRect();
          const rows = [...el.querySelectorAll<HTMLElement>(".ag-row[row-id]")]
            .sort((a, b) => Number(a.getAttribute("row-index")) - Number(b.getAttribute("row-index")))
            .map((r) => {
              const img = r.querySelector(`.ag-cell[col-id="${field}"] img[data-sdv-id]`);
              const ib = img?.getBoundingClientRect();
              const rb = r.getBoundingClientRect();
              // a spot in the "wins" cell clear of its right-aligned number: 4 px in from the cell's left edge
              const wb = (r.querySelector('.ag-cell[col-id="wins"]') as HTMLElement).getBoundingClientRect();
              const mid = rb.top - box.top + rb.height / 2;
              return {
                id: r.getAttribute("row-id"),
                image: img?.getAttribute("data-sdv-id") ?? null,
                loaded: img instanceof HTMLImageElement && img.complete && img.naturalWidth > 0,
                box:
                  ib === undefined
                    ? null
                    : [ib.x - box.left, ib.y - box.top, ib.width, ib.height].map(Math.round),
                cell: [wb.left - box.left + 4, mid].map(Math.round),
                // past the last column: the filler AG Grid paints in --ag-data-background-color
                tail: [box.width - 4, mid].map(Math.round),
                fill: getComputedStyle(r).backgroundColor,
                ink: getComputedStyle(r).color,
                hover: r.style.getPropertyValue("--ag-row-hover-color"),
                selected: r.style.getPropertyValue("--ag-selected-row-background-color"),
                odd: r.classList.contains("ag-row-odd"),
              };
            });
          const viewport = el.querySelector(".ag-grid-viewport") as HTMLElement;
          return {
            rows,
            overflow: viewport.scrollWidth - viewport.clientWidth,
            columnsWidth: Math.max(
              ...[...el.querySelectorAll(".ag-header-cell")].map(
                (h) => h.getBoundingClientRect().right - box.left,
              ),
            ),
            width: box.width,
            images: el.querySelectorAll("img[data-sdv-id]").length,
            root: getComputedStyle(el).backgroundColor,
            // AG Grid paints the header's background on its row's cell container
            header: getComputedStyle(el.querySelector(".ag-header-row .ag-grid-scrolling-cells") as Element)
              .backgroundColor,
          };
        }, want.field);
        expect(
          got.rows.map((r) => r.id),
          "exactly the example's rows, by id, in its order",
        ).toEqual(want.rows);
        expect(got.images, "one image per row, no more").toBe(want.rows.length);
        expect(got.overflow, "the columns fit the docs column: no horizontal scroll").toBe(0);
        expect(got.columnsWidth, "room after the last column, for the filler check").toBeLessThan(
          got.width - 8,
        );
        expect(
          got.rows.map((r) => r.image),
          "each row's image is its own team's",
        ).toEqual(want.images());
        expect(
          got.rows.map((r) => r.loaded),
          "every image loaded",
        ).toEqual(want.rows.map(() => true));
        expect(agRgb(got.root), "the theme's background").toEqual(agHex(want.bg));
        if (id.endsWith("midnight")) expect(agRgb(got.header), "midnight's header").toEqual(agHex("#16181D"));
        const fills = want.fills();
        const pixels = await agShoot(grid);
        got.rows.forEach((r, i) => {
          const f = fills[i] ?? "";
          expect(agRgb(r.fill), `row ${r.id} is filled with ${f}`).toEqual(agHex(f));
          const [cx, cy] = r.cell as [number, number];
          const [tx, ty] = r.tail as [number, number];
          expect(agNear(pixels(cx, cy)[0] ?? [], agHex(f), 3), `a pixel of row ${r.id} is ${f}`).toBe(true);
          expect(
            agNear(pixels(tx, ty)[0] ?? [], agHex(f), 3),
            `row ${r.id}'s fill reaches the grid's edge`,
          ).toBe(true);
          expect(contrast(agCss(agRgb(r.ink)), f), `row ${r.id}'s text`).toBeGreaterThanOrEqual(4.5);
        });
        if (want.stripe !== undefined) {
          // a striped theme: AG Grid's odd rows carry its stripe colour, and each odd team row's painted pixel above is
          // its team fill, not the stripe (checked against both: the fill is the expected one, and it is not the stripe)
          const odd = got.rows.filter((r) => r.odd);
          expect(odd.length, "AG Grid striped the odd rows").toBe(Math.floor(got.rows.length / 2));
          for (const r of odd) {
            const [cx, cy] = r.cell as [number, number];
            expect(
              agNear(pixels(cx, cy)[0] ?? [], agHex(want.stripe), 3),
              `odd row ${r.id} shows its team fill, not the stripe ${want.stripe}`,
            ).toBe(false);
          }
        }
        // the images' own pixels: with them hidden, each image's box changes (over 10%, as the other grids' logos)
        await grid.evaluate((el) => {
          for (const i of el.querySelectorAll("img[data-sdv-id]"))
            (i as HTMLElement).style.visibility = "hidden";
        });
        const without = await agShoot(grid);
        const changed = got.rows.map((r) => {
          const [x, y, w, h] = r.box as [number, number, number, number];
          const a = pixels(x, y, w, h);
          const b = without(x, y, w, h);
          return a.filter((p, i) => !agNear(p, b[i] ?? [], 8)).length / a.length;
        });
        console.log(
          `${id}: image boxes changed ${Math.min(...changed).toFixed(2)} to ${Math.max(...changed).toFixed(2)}`,
        );
        changed.forEach((c, i) => expect(c, `image ${i} paints its box`).toBeGreaterThan(0.1));
        await grid.evaluate((el) => {
          for (const i of el.querySelectorAll("img[data-sdv-id]")) (i as HTMLElement).style.visibility = "";
        });
        // AG Grid's hover and selected overlays: a hovered row, a selected one (the class AG Grid puts on it) and a
        // selected, hovered one paint exactly the opaque shades gridOptions set on the row (its accent tint would not),
        // each the fill moved away from the text colour, so the text reads at least as well
        const row = (i: number) => grid.locator(`.ag-row[row-index="${i}"]`);
        const spot = async (i: number) => {
          const r = got.rows[i];
          const [x, y] = r?.cell as [number, number];
          return (await agShoot(grid))(x, y)[0] ?? [];
        };
        const check = (px: number[], i: number, shade: string, what: string) => {
          const r = got.rows[i];
          const f = fills[i] ?? "";
          const ink = onColor(f);
          const want = mix(f, ink === "#000000" ? "#ffffff" : "#000000", shade === "hover" ? 0.08 : 0.16);
          // the painted pixel first, so a missing or wrong shade fails here, on what the reader sees
          expect(agNear(px, agHex(want), 3), `${what}: ${agCss(px)} is the shade ${want} of ${f}`).toBe(true);
          expect(shade === "hover" ? r?.hover : r?.selected, `${what}: the row's shade`).toBe(want);
          expect(
            contrast(agCss(agRgb(r?.ink ?? "")), want),
            `${what}: text on the shade`,
          ).toBeGreaterThanOrEqual(Math.max(4.5, contrast(ink, f) - 0.01));
        };
        await row(0).locator('.ag-cell[col-id="wins"]').hover();
        check(await spot(0), 0, "hover", `hovered row ${want.rows[0]}`);
        // a real selection: the example turns on AG Grid Community's row selection, and the test selects through the
        // grid's own API (the drawer leaves it on the box), so AG Grid itself marks the row selected
        const select = (rowId: string, on: boolean) =>
          figure.locator('.sdv-live-output [role="figure"]').evaluate(
            (el, [k, v]) => {
              type Node = { setSelected: (s: boolean) => void };
              const api = (el as HTMLElement & { sdvAgGrid: { getRowNode: (k: string) => Node | undefined } })
                .sdvAgGrid;
              const node = api.getRowNode(k as string);
              if (node === undefined) throw new Error(`no row ${String(k)}`);
              node.setSelected(v as boolean);
            },
            [rowId, on] as const,
          );
        const second = want.rows[1] ?? "";
        await select(second, true);
        await page.mouse.move(0, 0);
        expect(await row(1).getAttribute("class"), "AG Grid marks the row selected").toMatch(
          /\bag-row-selected\b/,
        );
        check(await spot(1), 1, "selected", `selected row ${second}`);
        await row(1).locator('.ag-cell[col-id="wins"]').hover();
        check(await spot(1), 1, "selected", `selected, hovered row ${second}`);
        await select(second, false);
        await page.mouse.move(0, 0);
        expect(await row(1).getAttribute("class")).not.toMatch(/\bag-row-selected\b/);
        if (SHOTS !== undefined)
          await figure
            .locator(".sdv-live-output")
            .screenshot({ path: join(SHOTS, `${id.replace(/\//g, "_")}.png`) });
        expect(errors).toEqual([]);
      } finally {
        await page.close();
      }
    },
  );

  // The 11,778-play grid is virtualised: only the rows in view (and AG Grid's buffer) are in the page, each with its own
  // play's logos; scrolling far down brings exactly the plays at those positions of the sort; a filter and the pinned
  // column work on all the rows, not only the drawn ones.
  test("sdvtables/ag-grid/nfl-plays-2024: 11,778 rows, only those in view drawn; scrolling, sorting, filtering and the pinned column", async () => {
    const id = "sdvtables/ag-grid/nfl-plays-2024";
    const entry = EXAMPLES.find((e) => e.id === id);
    if (entry === undefined) throw new Error(`${id} is not in the registry`);
    await loadLeague("nfl");
    const plays = await nflPlays2024();
    // the example's sort, worked out here: EPA high to low, ties in file order (AG Grid's sort is stable)
    const sorted = plays.map((p, i) => [p, i] as const).sort((a, b) => b[0].epa - a[0].epa || a[1] - b[1]);
    const page = await browser.newPage();
    try {
      const errors: string[] = [];
      page.on("console", (m) => void (m.type() === "error" && errors.push(m.text())));
      page.on("pageerror", (e) => void errors.push(e.message));
      await page.goto(`${base}/gallery/${pagePath(entry)}/`);
      const figure = page.locator(`figure[data-example="${id}"]`);
      await figure.scrollIntoViewIfNeeded();
      const grid = figure.locator(".sdv-live-output .ag-root-wrapper");
      await grid.locator("img[data-sdv-id]").first().waitFor({ timeout: 30_000 });
      await page.waitForLoadState("networkidle");
      expect(await figure.locator(".sdv-live-static").count(), "the static copy is replaced").toBe(0);
      const drawn = () =>
        grid.evaluate((el) =>
          [...el.querySelectorAll<HTMLElement>(".ag-row[row-id]")]
            .map((r) => ({
              index: Number(r.getAttribute("row-index")),
              id: r.getAttribute("row-id") ?? "",
              pinned: r
                .querySelector('.ag-grid-pinned-left-cells .ag-cell[col-id="posteam"] img')
                ?.getAttribute("data-sdv-id"),
              defence: r.querySelector('.ag-cell[col-id="defteam"] img')?.getAttribute("data-sdv-id"),
              epa: r.querySelector('.ag-cell[col-id="epa"]')?.textContent ?? "",
            }))
            .sort((a, b) => a.index - b.index),
        );
      const api = <T>(f: string, arg?: unknown) =>
        figure.locator('.sdv-live-output [role="figure"]').evaluate(
          (el, [fn, a]) => {
            const g = (el as HTMLElement & { sdvAgGrid: Record<string, (x?: unknown) => unknown> }).sdvAgGrid;
            return g[fn as string]?.(a) as T;
          },
          [f, arg] as const,
        );
      expect(await api<number>("getDisplayedRowCount"), "every play is in the grid").toBe(11_778);
      const check = async (where: string) => {
        const rows = await drawn();
        expect(rows.length, `${where}: only the rows in view are drawn`).toBeLessThan(80);
        expect(rows.length, `${where}: the rows in view are drawn`).toBeGreaterThan(10);
        // the rows drawn are a run of the sort, each its own play, its own teams' logos (offence pinned left)
        const first = rows[0]?.index ?? -1;
        expect(
          rows.map((r) => r.index),
          where,
        ).toEqual(rows.map((_, k) => first + k));
        for (const r of rows) {
          const p = sorted[r.index]?.[0];
          expect(r.id, `${where}: row ${r.index}`).toBe(p?.play);
          expect(r.pinned, `${where}: ${r.id}'s offence logo, pinned left`).toBe(
            resolveSync(p?.posteam, "nfl"),
          );
          expect(r.defence, `${where}: ${r.id}'s defence logo`).toBe(resolveSync(p?.defteam, "nfl"));
        }
        return rows;
      };
      const top = await check("on load");
      expect(top[0]?.index).toBe(0);
      expect(top[0]?.epa, "the highest EPA first, in sdvtables' format").toMatch(/^\+\d+\.\d\d$/);
      // scroll two thirds of the way down: the rows there are drawn, the first ones are gone
      await api("ensureIndexVisible", 8000);
      await page.waitForFunction(
        (sel) => [...document.querySelectorAll(sel)].some((r) => r.getAttribute("row-index") === "8000"),
        `figure[data-example="${id}"] .ag-row[row-id]`,
      );
      await page.waitForLoadState("networkidle");
      const far = await check("scrolled to row 8000");
      expect(
        far.some((r) => r.index === 0),
        "the first rows left the page",
      ).toBe(false);
      // a filter on the offence keeps Kansas City's plays only, over all 11,778 rows
      await api("setFilterModel", { posteam: { filterType: "text", type: "equals", filter: "KC" } });
      expect(await api<number>("getDisplayedRowCount")).toBe(plays.filter((p) => p.posteam === "KC").length);
      await api("setFilterModel", null);
      expect(errors).toEqual([]);
    } finally {
      await page.close();
    }
  });

  // MapLibre GL JS examples (sdvplot/maplibre). The basemap never reaches the network: every OpenFreeMap request is
  // answered here (`stubOpenFreeMap`), a stand-in style with the style's own background colour and an empty source
  // carrying OpenFreeMap's credit, no tiles. On it: each team's logo sits at its own stadium or airport, projected
  // through the map (`map.project`) and read back from the map (`queryRenderedFeatures`); hiding the logos changes each
  // logo's box (real logo pixels), and the pixels there are that team's logo image, not another's; each route leg is
  // found by its feature id at its midpoint and painted in its team's colour there; each deck.gl arc, drawn alone,
  // leaves home in its team's source colour and lands in its target colour; the credit shows.
  const STADIUM_IDS = new Set(EXAMPLES.filter((e) => e.id.startsWith("sdvplot/maplibre/")).map((e) => e.id));
  const airportOf = (team: string) =>
    NFL_AIRPORTS.find((a) => a.team === team) as (typeof NFL_AIRPORTS)[number];
  // the road trips the two route examples draw, worked out here from the games and airports, in row order
  const TRIPS = KC_PHI_GAMES_2024.filter((g) => g.away_team === "KC" || g.away_team === "PHI").map((g) => ({
    team: g.away_team,
    from: [airportOf(g.away_team).lon, airportOf(g.away_team).lat] as [number, number],
    to: [airportOf(g.home_team).lon, airportOf(g.home_team).lat] as [number, number],
  }));
  const MAPS: Readonly<
    Record<
      string,
      { style: "positron" | "dark"; logos: readonly { team: string; at: [number, number] }[]; px: number }
    >
  > = {
    "sdvplot/maplibre/nfl-stadiums": {
      style: "positron",
      logos: NFL_STADIUMS_2024.map((s) => ({ team: s.team, at: [s.lon, s.lat] })),
      px: 34,
    },
    "sdvplot/maplibre/road-trips": {
      style: "positron",
      logos: ["KC", "PHI"].map((t) => ({ team: t, at: [airportOf(t).lon, airportOf(t).lat] })),
      px: 40,
    },
    "sdvplot/maplibre/deckgl-arcs-dark": {
      style: "dark",
      logos: ["KC", "PHI"].map((t) => ({ team: t, at: [airportOf(t).lon, airportOf(t).lat] })),
      px: 40,
    },
  };

  /** Every NFL team's logo image in a variant, fetched once per run from the URL sdvplot gives: what a drawn logo is compared with. */
  const LOGO_IMAGES = new Map<string, Promise<Map<string, Awaited<ReturnType<typeof loadImage>>>>>();
  const logoImages = (variant: "default" | "dark") => {
    const cached = LOGO_IMAGES.get(variant);
    if (cached !== undefined) return cached;
    const load = (async () => {
      await loadLeague("nfl");
      const teams = NFL_STADIUMS_2024.map((s) => s.team);
      const images = await Promise.all(
        teams.map(async (t) => {
          const url = logoUrlSync(t, "nfl", { variant }) as string;
          const res = await fetch(url);
          if (!res.ok) throw new Error(`${url} answered ${res.status}`);
          return [t, await loadImage(Buffer.from(await res.arrayBuffer()))] as const;
        }),
      );
      return new Map(images);
    })();
    LOGO_IMAGES.set(variant, load);
    return load;
  };

  test("every MapLibre example has its render check", () => {
    expect([...STADIUM_IDS].sort()).toEqual(Object.keys(MAPS).sort());
  });

  test.each(Object.keys(MAPS))(
    "%s re-runs live on a local basemap: logos at their venues, real logo pixels, route colours by feature id",
    async (id) => {
      const entry = EXAMPLES.find((e) => e.id === id);
      const spec = MAPS[id];
      if (entry === undefined || spec === undefined) throw new Error(`${id} is not in the registry`);
      const page = await browser.newPage();
      try {
        const errors: string[] = [];
        page.on("console", (m) => void (m.type() === "error" && errors.push(m.text())));
        page.on("pageerror", (e) => void errors.push(e.message));
        const asked = await stubOpenFreeMap(page);
        await page.goto(`${base}/gallery/${pagePath(entry)}/`);
        const figure = page.locator(`figure[data-example="${id}"]`);
        await figure.scrollIntoViewIfNeeded();
        await figure.locator(".sdv-live-output canvas.maplibregl-canvas").waitFor({ timeout: 30_000 });
        await page.addStyleTag({ content: ".navbar { display: none !important; }" });
        const box = figure.locator('.sdv-live-output [role="figure"]').first();
        // the mount has resolved (the map is on the box) and the map has drawn everything it has
        await box.evaluate(
          (el) =>
            new Promise<void>((done) => {
              const wait = () => {
                const map = (el as HTMLElement & { sdvMap?: { loaded(): boolean } }).sdvMap;
                if (map?.loaded()) done();
                else setTimeout(wait, 50);
              };
              wait();
            }),
        );
        await page.waitForLoadState("networkidle"); // MapLibre's logos are in already: mount awaits addLogoImages
        const deck = id.endsWith("deckgl-arcs-dark");
        // deck.gl's IconLayer fetches its logos itself, after the map has loaded: "networkidle" above has long been
        // reached by then and waits for nothing. Wait for each overlay layer's public `isLoaded` (its icons fetched
        // and packed), up to 30 s; the frame below then has the logos in it.
        if (deck)
          expect(
            await box.evaluate(async (el) => {
              const layers = (el as HTMLElement & { sdvDeckLayers: readonly { isLoaded: boolean }[] })
                .sdvDeckLayers;
              for (const end = Date.now() + 30_000; Date.now() < end; ) {
                if (layers.every((l) => l.isLoaded)) return true;
                await new Promise((r) => setTimeout(r, 50));
              }
              return false;
            }),
            "deck.gl's layers have loaded their logos",
          ).toBe(true);
        // a fresh frame, after deck.gl's own (it draws on the frame after the map's)
        const settle = () =>
          box.evaluate(
            (el) =>
              new Promise<void>((done) => {
                const map = (
                  el as HTMLElement & {
                    sdvMap: { triggerRepaint(): void; once(t: string, f: () => void): void };
                  }
                ).sdvMap;
                map.once("idle", () => requestAnimationFrame(() => requestAnimationFrame(() => done())));
                map.triggerRepaint();
              }),
          );
        await settle();
        expect(await figure.locator(".sdv-live-static").count(), "the static copy is replaced").toBe(0);
        expect(await figure.locator(".sdv-live-error").count(), "no error alert").toBe(0);
        // the basemap the example asked for, answered here: no tile request left the machine
        expect(asked, `only OpenFreeMap's ${spec.style} style was asked for`).toEqual([
          `https://tiles.openfreemap.org/styles/${spec.style}`,
        ]);
        // OpenFreeMap's credit, shown by MapLibre from the style's source
        const credit = await box.locator(".maplibregl-ctrl-attrib-inner").innerText();
        expect(credit).toContain("OpenFreeMap");
        expect(credit).toContain("OpenStreetMap");

        await loadLeague("nfl");
        const project = (pts: readonly (readonly [number, number])[]) =>
          box.evaluate(
            (el, ps) =>
              ps.map((p) => {
                const q = (
                  el as HTMLElement & { sdvMap: { project(p: unknown): { x: number; y: number } } }
                ).sdvMap.project(p);
                return [q.x, q.y] as [number, number];
              }),
            pts as [number, number][],
          );
        const size = await box.evaluate((el) => [el.clientWidth, el.clientHeight]);
        // a screenshot of the map: its pixels in a box, and its canvas
        const shoot = async () => {
          const shot = await loadImage(await box.screenshot());
          const canvas = createCanvas(shot.width, shot.height);
          const ctx = canvas.getContext("2d");
          ctx.drawImage(shot, 0, 0);
          const read = (x: number, y: number, w: number, h: number) => {
            const d = ctx.getImageData(Math.round(x), Math.round(y), Math.max(1, w), Math.max(1, h)).data;
            return Array.from(
              { length: d.length / 4 },
              (_, i) => [d[4 * i], d[4 * i + 1], d[4 * i + 2]] as number[],
            );
          };
          return Object.assign(read, { canvas });
        };
        const near = (a: number[], b: number[], d: number) =>
          [0, 1, 2].every((c) => Math.abs((a[c] ?? 0) - (b[c] ?? 0)) <= d);
        const hex = (s: string) => [1, 3, 5].map((i) => Number.parseInt(s.slice(i, i + 2), 16));

        const at = await project(spec.logos.map((l) => l.at));
        at.forEach(([x, y], i) => {
          expect.soft(x, `${spec.logos[i]?.team} on the map`).toBeGreaterThan(0);
          expect.soft(x, `${spec.logos[i]?.team} on the map`).toBeLessThan(size[0] as number);
          expect.soft(y, `${spec.logos[i]?.team} on the map`).toBeGreaterThan(0);
          expect.soft(y, `${spec.logos[i]?.team} on the map`).toBeLessThan(size[1] as number);
        });
        if (!deck) {
          // what the map itself drew under each venue: that team's logo feature (two teams share SoFi and MetLife)
          const teamsAt = await box.evaluate(
            (el, pts) =>
              pts.map((p) =>
                (
                  el as HTMLElement & {
                    sdvMap: {
                      queryRenderedFeatures(p: unknown, o: object): { properties: { team: string } }[];
                    };
                  }
                ).sdvMap
                  .queryRenderedFeatures(p, { layers: ["sdvplot-logos"] })
                  .map((f) => f.properties.team),
              ),
            at,
          );
          spec.logos.forEach((l, i) =>
            expect.soft(teamsAt[i], `${l.team}'s logo is at its venue`).toContain(resolveSync(l.team, "nfl")),
          );
        }
        // real logo pixels: with the logos hidden, the middle of each logo's box changes
        const half = Math.round(spec.px / 3);
        const boxes = at.map(([x, y]) => [x - half, y - half, 2 * half, 2 * half] as const);
        const pixels = await shoot();
        if (SHOTS !== undefined) await box.screenshot({ path: join(SHOTS, `${id.replace(/\//g, "_")}.png`) });
        await box.evaluate((el, isDeck) => {
          const host = el as HTMLElement & {
            sdvMap: { setLayoutProperty(l: string, p: string, v: string): void };
            sdvDeck?: { setProps(p: object): void };
            sdvDeckLayers?: readonly { id: string }[];
          };
          // the overlay's own layers, as the example built them: drop the logos, keep the arcs
          if (isDeck && host.sdvDeck)
            host.sdvDeck.setProps({
              layers: (host.sdvDeckLayers ?? []).filter((l) => l.id !== "sdvplot-logos"),
            });
          else host.sdvMap.setLayoutProperty("sdvplot-logos", "visibility", "none");
        }, deck);
        await settle();
        const without = await shoot();
        const changed = boxes.map(([x, y, w, h]) => {
          const a = pixels(x, y, w, h);
          const b = without(x, y, w, h);
          return a.filter((p, i) => !near(p, b[i] ?? [], 8)).length / a.length;
        });
        console.log(
          `${id}: logo boxes changed ${Math.min(...changed).toFixed(2)} to ${Math.max(...changed).toFixed(2)}`,
        );
        changed.forEach((c, i) =>
          expect.soft(c, `${spec.logos[i]?.team}'s logo paints its box`).toBeGreaterThan(0.1),
        );
        // and which logo: each logo's box, `px` tall at its image's aspect round the projected venue, against the logo
        // image of every team the example draws, laid over what the map shows there without the logos. The nearest must
        // be the venue's own team (either of two teams sharing a stadium), so a logo drawn under another team's image id
        // fails. A logo another venue's logo overlaps (BAL under WAS at this zoom) is not compared: what shows there is
        // partly the other logo.
        const variant = spec.style === "dark" ? "dark" : "default";
        const all = await logoImages(variant);
        const templates = new Map(spec.logos.map((l) => [l.team, all.get(l.team)] as const));
        let identified = 0;
        spec.logos.forEach((l, i) => {
          const [cx, cy] = at[i] as [number, number];
          const own = templates.get(l.team);
          if (own === undefined) throw new Error(`no logo image for ${l.team}`);
          const w = Math.round((spec.px * own.width) / own.height);
          const overlapped = spec.logos.some(
            (o, j) =>
              (o.at[0] !== l.at[0] || o.at[1] !== l.at[1]) &&
              Math.abs((at[j]?.[0] ?? 0) - cx) < w &&
              Math.abs((at[j]?.[1] ?? 0) - cy) < spec.px,
          );
          if (overlapped) return;
          identified++;
          const [x0, y0] = [Math.round(cx - w / 2), Math.round(cy - spec.px / 2)];
          // compared at a quarter of the size, and over offsets of up to 2 px: the logo's own colours decide, not where
          // MapLibre or deck.gl rounded its edge to
          const S = 4;
          const [sw, sh] = [Math.ceil(w / S), Math.ceil(spec.px / S)];
          const shrink = (draw: (g: ReturnType<ReturnType<typeof createCanvas>["getContext"]>) => void) => {
            const full = createCanvas(w, spec.px).getContext("2d");
            draw(full);
            const g = createCanvas(sw, sh).getContext("2d");
            g.drawImage(full.canvas, 0, 0, w, spec.px, 0, 0, sw, sh);
            return g.getImageData(0, 0, sw, sh).data;
          };
          const drawn = shrink((g) => g.drawImage(pixels.canvas, x0, y0, w, spec.px, 0, 0, w, spec.px));
          const distance = (img: Awaited<ReturnType<typeof loadImage>>) => {
            let best = Number.POSITIVE_INFINITY;
            for (let dx = -2; dx <= 2; dx++)
              for (let dy = -2; dy <= 2; dy++) {
                const d = shrink((g) => {
                  g.drawImage(without.canvas, x0, y0, w, spec.px, 0, 0, w, spec.px);
                  g.drawImage(img, dx, dy, w, spec.px);
                });
                let sum = 0;
                for (let k = 0; k < d.length; k += 4)
                  for (let ch = 0; ch < 3; ch++) sum += Math.abs((drawn[k + ch] ?? 0) - (d[k + ch] ?? 0));
                best = Math.min(best, sum / (d.length / 4));
              }
            return best;
          };
          const ranked = [...templates]
            .map(([t, img]) => [t, distance(img as Awaited<ReturnType<typeof loadImage>>)] as const)
            .sort((a, b) => a[1] - b[1]);
          const sameVenue = spec.logos
            .filter((o) => o.at[0] === l.at[0] && o.at[1] === l.at[1])
            .map((o) => o.team);
          expect
            .soft(
              sameVenue,
              `the logo drawn at ${l.team}'s venue looks like ${ranked[0]?.[0]}'s (${ranked
                .slice(0, 3)
                .map(([t, d]) => `${t} ${d.toFixed(1)}`)
                .join(", ")})`,
            )
            .toContain(ranked[0]?.[0]);
        });
        console.log(`${id}: ${identified} of ${spec.logos.length} logos identified by their pixels`);
        expect(identified, "the logos are identified").toBeGreaterThanOrEqual(
          Math.min(spec.logos.length, 16),
        );

        if (id.endsWith("road-trips")) {
          // each leg by its feature id, at the middle of its line (a straight line on the flat map): the map has that
          // feature there, and the pixel is the colour of the leg drawn on top there, its team's primary colour
          const ends = await project(TRIPS.flatMap((t) => [t.from, t.to]));
          const homes = at;
          let checked = 0;
          for (const [i, trip] of TRIPS.entries()) {
            const [a, b] = [ends[2 * i] as [number, number], ends[2 * i + 1] as [number, number]];
            const mid: [number, number] = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
            if (homes.some(([x, y]) => Math.hypot(x - mid[0], y - mid[1]) < spec.px)) continue; // under a home logo
            const ids = await box.evaluate(
              (el, m) =>
                (
                  el as HTMLElement & {
                    sdvMap: { queryRenderedFeatures(p: unknown, o: object): { id: number }[] };
                  }
                ).sdvMap
                  .queryRenderedFeatures(
                    [
                      [m[0] - 1, m[1] - 1],
                      [m[0] + 1, m[1] + 1],
                    ],
                    { layers: ["sdvplot-routes"] },
                  )
                  .map((f) => f.id),
              mid,
            );
            expect.soft(ids, `leg ${i} (${trip.team}) is drawn at its middle`).toContain(i);
            const top = TRIPS[ids[0] ?? i] ?? trip;
            const want = teamColorsSync("nfl", [top.team])[0] as string;
            const painted = without(mid[0] - 1, mid[1] - 1, 3, 3).some((p) => near(p, hex(want), 24));
            expect.soft(painted, `leg ${i}: a pixel at its middle is ${top.team}'s ${want}`).toBe(true);
            checked++;
          }
          expect(checked, "most legs are checked").toBeGreaterThanOrEqual(12);
          // and the two teams' colours differ, so a leg in the other team's colour fails
          expect(teamColorsSync("nfl", ["KC"])[0]).not.toBe(teamColorsSync("nfl", ["PHI"])[0]);
        }
        if (deck) {
          // the arcs paint: removing them changes the map
          await box.evaluate((el) => {
            const d = (el as HTMLElement & { sdvDeck: { setProps(p: object): void } }).sdvDeck;
            d.setProps({ layers: [] });
          });
          await settle();
          const bare = await shoot();
          const all = without(0, 0, size[0] as number, size[1] as number);
          const none = bare(0, 0, size[0] as number, size[1] as number);
          const arcPx = all.filter((p, i) => !near(p, none[i] ?? [], 8)).length;
          expect(arcPx, "the arcs paint").toBeGreaterThan(2000);
          // and the dark basemap's background is what is left where nothing is drawn (the bottom left corner)
          const corner = bare(4, (size[1] as number) - 5, 1, 1)[0] ?? [];
          expect(near(corner, hex("#0c0c0c"), 2), `the dark basemap, got ${corner}`).toBe(true);
          // each arc alone (the example's own layer, cloned with that one row, through the overlay's setProps): where it
          // leaves its home airport it is its team's source colour, where it lands its target colour, both from the
          // shared palette on the dark background (worked out here through the recharts adapter, not ./deckgl)
          const src = rechartsPalette("nfl", ["KC", "PHI"], { background: "#0c0c0c" });
          const tgt = rechartsPalette("nfl", ["KC", "PHI"], { background: "#0c0c0c", which: "secondary" });
          const colorOf = (team: string, end: string[]) => end[team === "KC" ? 0 : 1] as string;
          const ends = await project(TRIPS.flatMap((t) => [t.from, t.to]));
          const bg = hex("#0c0c0c");
          const far = (p: number[]) =>
            Math.max(...[0, 1, 2].map((c) => Math.abs((p[c] ?? 0) - (bg[c] ?? 0))));
          let checked = 0;
          for (const [i, trip] of TRIPS.entries()) {
            await box.evaluate((el, k) => {
              const host = el as HTMLElement & {
                sdvDeck: { setProps(p: object): void };
                sdvDeckLayers: readonly {
                  id: string;
                  props: { data: readonly unknown[] };
                  clone(p: object): unknown;
                }[];
              };
              const arcs = host.sdvDeckLayers.find((l) => l.id === "sdvplot-arcs");
              if (arcs === undefined) throw new Error("no arc layer");
              host.sdvDeck.setProps({ layers: [arcs.clone({ data: [arcs.props.data[k]] })] });
            }, i);
            await settle();
            const one = await shoot();
            // the arc's most saturated pixel within 8 px of an end (its own colour, not an edge blended into the map)
            const endColor = ([x, y]: [number, number]) => {
              const near8 = one(x - 8, y - 8, 17, 17).filter((p, k) => {
                const q = bare(x - 8, y - 8, 17, 17)[k] ?? [];
                return !near(p, q, 8);
              });
              return near8.sort((a, b) => far(b) - far(a))[0];
            };
            const [home, host] = [ends[2 * i] as [number, number], ends[2 * i + 1] as [number, number]];
            if (Math.hypot(home[0] - host[0], home[1] - host[1]) < 40) continue; // too short to tell its ends apart
            const [atHome, atHost] = [endColor(home), endColor(host)];
            const [wantHome, wantHost] = [colorOf(trip.team, src), colorOf(trip.team, tgt)];
            expect
              .soft(
                atHome !== undefined && near(atHome, hex(wantHome), 40),
                `arc ${i} (${trip.team}) leaves home in ${wantHome}, got ${atHome}`,
              )
              .toBe(true);
            expect
              .soft(
                atHost !== undefined && near(atHost, hex(wantHost), 40),
                `arc ${i} (${trip.team}) lands in ${wantHost}, got ${atHost}`,
              )
              .toBe(true);
            checked++;
          }
          console.log(`${id}: ${checked} of ${TRIPS.length} arcs checked at both ends`);
          expect(checked, "most arcs are checked").toBeGreaterThanOrEqual(12);
          // the palette did its work: PHI's midnight green does not read on the dark map, so it is not what is drawn
          expect(colorOf("PHI", src)).not.toBe(teamColorsSync("nfl", ["PHI"])[0]);
        }
        expect(errors).toEqual([]);
      } finally {
        await page.close();
      }
    },
  );

  // TanStack Table v9 examples (sdvtables/tanstack-table): the React one re-runs live, the Svelte one is a browser
  // upgrade. Each table shows exactly the example's rows (by TanStack's row id, the spec's rowKey) in its starting sort;
  // each row's logo is its own team's (by id, the NBA's from stats.nba.com's numeric TeamID); hiding the logos changes
  // each logo's box (real image pixels); and a click on a number header sorts by it, descending then ascending.
  const tsByWins = [...STANDINGS].sort((a, b) => b.wins - a.wins); // stable: LV before NE on 4-4
  const tsByPct = [...NBA_STANDINGS].sort(
    (a, b) => b.wins / (b.wins + b.losses) - a.wins / (a.wins + a.losses),
  ); // stable: the Kings before the Warriors
  const netEpa = (dir: 1 | -1) => [
    ...STANDINGS.filter((s) => s.net_epa !== null)
      .sort((a, b) => dir * ((a.net_epa ?? 0) - (b.net_epa ?? 0)))
      .map((s) => s.team),
    "NE", // New England's net EPA is blank: last both ways
  ];
  const TABLES: Readonly<
    Record<
      string,
      {
        rows: readonly string[];
        images: () => (string | undefined)[];
        league: "nfl" | "nba";
        /** A header to click, and the row ids after one click (descending) and two (ascending). */
        sort: { th: string; desc: readonly string[]; asc: readonly string[] };
        bg: string;
      }
    >
  > = {
    "sdvtables/tanstack-table/afc-standings-react": {
      rows: tsByWins.map((s) => s.team),
      images: () => tsByWins.map((s) => resolveSync(s.team, "nfl")),
      league: "nfl",
      sort: { th: "Net EPA/play", desc: netEpa(-1), asc: netEpa(1) },
      bg: "#FFFFFF",
    },
    "sdvtables/tanstack-table/pacific-nba-svelte": {
      rows: tsByPct.map((s) => String(s.team_id)),
      images: () => tsByPct.map((s) => resolveSync(s.team_id, "nba")),
      league: "nba",
      sort: {
        th: "L",
        desc: [...NBA_STANDINGS].sort((a, b) => b.losses - a.losses).map((s) => String(s.team_id)),
        asc: [...NBA_STANDINGS].sort((a, b) => a.losses - b.losses).map((s) => String(s.team_id)),
      },
      bg: "#0C0D10",
    },
  };
  test("every TanStack Table example has its render check", () => {
    expect(
      EXAMPLES.filter((e) => e.id.startsWith("sdvtables/tanstack-table/"))
        .map((e) => e.id)
        .sort(),
    ).toEqual(Object.keys(TABLES).sort());
  });
  test.each(Object.keys(TABLES))(
    "%s draws live: the example's rows, each logo in its own row, real logo pixels, sorting by a click",
    async (id) => {
      const entry = EXAMPLES.find((e) => e.id === id);
      const want = TABLES[id];
      if (entry === undefined || want === undefined)
        throw new Error(`${id} has no registry entry or no expectations`);
      await Promise.all([loadLeague("nfl"), loadLeague("nba")]);
      const page = await browser.newPage();
      try {
        const errors: string[] = [];
        page.on("console", (m) => void (m.type() === "error" && errors.push(m.text())));
        page.on("pageerror", (e) => void errors.push(e.message));
        await page.goto(`${base}/gallery/${pagePath(entry)}/`);
        const figure = page.locator(`figure[data-example="${id}"]`);
        await figure.scrollIntoViewIfNeeded();
        const table = figure.locator(".sdv-live-output table");
        await table.locator("img[data-sdv-id]").first().waitFor({ timeout: 30_000 });
        await page.waitForLoadState("networkidle"); // the logos
        await page.addStyleTag({ content: ".navbar { display: none !important; }" });
        expect(await figure.locator(".sdv-live-static").count(), "the static copy is replaced").toBe(0);
        expect(await figure.locator(".sdv-live-error").count(), "no error alert").toBe(0);
        const read = () =>
          table.evaluate((el) => {
            const box = el.getBoundingClientRect();
            return {
              rows: [...el.querySelectorAll("tbody tr")].map((r) => {
                const img = r.querySelector("img[data-sdv-id]");
                const ib = img?.getBoundingClientRect();
                return {
                  id: r.getAttribute("data-row-id"),
                  image: img?.getAttribute("data-sdv-id") ?? null,
                  src: img?.getAttribute("src") ?? null,
                  loaded: img instanceof HTMLImageElement && img.complete && img.naturalWidth > 0,
                  box:
                    ib === undefined
                      ? null
                      : [ib.x - box.left, ib.y - box.top, ib.width, ib.height].map(Math.round),
                };
              }),
              images: el.querySelectorAll("img[data-sdv-id]").length,
              bg: getComputedStyle(el.parentElement as Element).backgroundColor,
            };
          });
        const got = await read();
        expect(
          got.rows.map((r) => r.id),
          "exactly the example's rows, in its order",
        ).toEqual(want.rows);
        expect(got.images, "one logo per row, no more").toBe(want.rows.length);
        expect(
          got.rows.map((r) => r.image),
          "each row's logo is its own team's",
        ).toEqual(want.images());
        // and its image is that team's logo: the URL sdvplot gives for the expected id, not only the id it is stamped with
        expect(
          got.rows.map((r) => r.src),
          "each row draws its own team's logo URL",
        ).toEqual(
          want
            .images()
            .map((id) => logoUrlSync(id as string, want.league, { markType: "logo", idSystem: "team_id" })),
        );
        expect(
          got.rows.map((r) => r.loaded),
          "every logo loaded",
        ).toEqual(want.rows.map(() => true));
        // the sdvtables theme's background, from its scoped stylesheet, on the table's wrapper
        const hex = (s: string) => [1, 3, 5].map((i) => Number.parseInt(s.slice(i, i + 2), 16));
        expect((got.bg.match(/\d+/g) ?? []).slice(0, 3).map(Number), "the theme's background").toEqual(
          hex(want.bg),
        );
        const shoot = async () => {
          const shot = await loadImage(await table.screenshot());
          const ctx = createCanvas(shot.width, shot.height).getContext("2d");
          ctx.drawImage(shot, 0, 0);
          return (x: number, y: number, w: number, h: number) => {
            const d = ctx.getImageData(Math.round(x), Math.round(y), Math.max(1, w), Math.max(1, h)).data;
            return Array.from(
              { length: d.length / 4 },
              (_, i) => [d[4 * i], d[4 * i + 1], d[4 * i + 2]] as number[],
            );
          };
        };
        const near = (a: number[], b: number[], d: number) =>
          [0, 1, 2].every((c) => Math.abs((a[c] ?? 0) - (b[c] ?? 0)) <= d);
        // the logos' own pixels: with them hidden, each logo's box changes (over 10%, as the grids' logos)
        const pixels = await shoot();
        await table.evaluate((el) => {
          for (const i of el.querySelectorAll("img[data-sdv-id]"))
            (i as HTMLElement).style.visibility = "hidden";
        });
        const without = await shoot();
        const changed = got.rows.map((r) => {
          const [x, y, w, h] = r.box as [number, number, number, number];
          const a = pixels(x, y, w, h);
          const b = without(x, y, w, h);
          return a.filter((p, i) => !near(p, b[i] ?? [], 8)).length / a.length;
        });
        console.log(
          `${id}: logo boxes changed ${Math.min(...changed).toFixed(2)} to ${Math.max(...changed).toFixed(2)}`,
        );
        changed.forEach((c, i) => expect(c, `logo ${i} paints its box`).toBeGreaterThan(0.1));
        await table.evaluate((el) => {
          for (const i of el.querySelectorAll("img[data-sdv-id]")) (i as HTMLElement).style.visibility = "";
        });
        // a click on a number header: TanStack sorts it descending first, then ascending; missing values stay last
        const th = table.locator("th", { hasText: new RegExp(`^${want.sort.th}( [▲▼])?$`) });
        await th.locator("button").click();
        expect(await th.getAttribute("aria-sort")).toBe("descending");
        expect(
          (await read()).rows.map((r) => r.id),
          `sorted by ${want.sort.th}, descending`,
        ).toEqual(want.sort.desc);
        await th.locator("button").click();
        expect(await th.getAttribute("aria-sort")).toBe("ascending");
        expect(
          (await read()).rows.map((r) => r.id),
          `sorted by ${want.sort.th}, ascending`,
        ).toEqual(want.sort.asc);
        if (SHOTS !== undefined)
          await figure
            .locator(".sdv-live-output")
            .screenshot({ path: join(SHOTS, `${id.replace(/\//g, "_")}.png`) });
        expect(errors).toEqual([]);
      } finally {
        await page.close();
      }
    },
  );

  // Mosaic: DuckDB-WASM runs in the page from the site's own files, and nothing leaves the docs server (this check
  // caught DuckDB fetching its Parquet reader from extensions.duckdb.org: the example now hands DuckDB CSV). Brushing
  // the EPA histogram (a real drag) filters the team bars and the table to exactly the plays a plain filter of
  // nflPlays2024() gives for the brushed range, and every bar is drawn at its count, in its team's palette colour.
  test("sdvplot/mosaic/nfl-plays-epa-crossfilter: local files only; the brush filters the bars and the table to the plays in its range; team-coloured bars", async () => {
    const id = "sdvplot/mosaic/nfl-plays-epa-crossfilter";
    const entry = EXAMPLES.find((e) => e.id === id);
    if (entry === undefined) throw new Error(`${id} is not in the registry`);
    await loadLeague("nfl");
    const plays = await nflPlays2024();
    const teams = [...new Set(plays.map((p) => p.posteam))].sort();
    const palette = rechartsPalette("nfl", teams, { background: "#ffffff" });
    const colorOf = new Map(teams.map((t, i) => [t, palette[i] ?? ""]));
    const countBy = (rows: readonly { posteam: string }[]) => {
      const n = new Map<string, number>();
      for (const p of rows) n.set(p.posteam, (n.get(p.posteam) ?? 0) + 1);
      return Object.fromEntries([...n].sort(([a], [b]) => (a < b ? -1 : 1)));
    };
    // every request of the context, the worker's included (DuckDB's worker fetches the WebAssembly module itself).
    // The docs' own analytics script (docusaurus.config.ts, on every page) is answered here with an empty script.
    const context = await browser.newContext();
    const asked: string[] = [];
    await context.route("**/*", (r) => {
      const url = r.request().url();
      if (url.startsWith("https://plausible.io/js/"))
        return r.fulfill({ contentType: "text/javascript", body: "" });
      asked.push(url);
      return new URL(url).origin === base ? r.continue() : r.abort();
    });
    const page = await context.newPage();
    try {
      const errors: string[] = [];
      page.on("console", (m) => void (m.type() === "error" && errors.push(m.text())));
      page.on("pageerror", (e) => void errors.push(e.message));
      const started = Date.now();
      await page.goto(`${base}/gallery/${pagePath(entry)}/`);
      const figure = page.locator(`figure[data-example="${id}"]`);
      await figure.scrollIntoViewIfNeeded();
      const views = figure.locator(".sdv-live-output .plot svg");
      const hist = views.nth(0);
      const bars = views.nth(1);
      await bars.locator("g[aria-label=bar] rect").first().waitFor({ timeout: 60_000 });
      console.log(`${id}: drawn ${Date.now() - started} ms after navigation`);
      // the drawn bars: each rect's team (where the y scale puts it), its geometry and fill, and the width a bar of
      // 0..n plays would have on the x scale
      const drawn = () =>
        bars.evaluate((svg) => {
          type Scale = {
            domain: unknown[];
            range: number[];
            bandwidth?: number;
            apply: (v: unknown) => number;
          };
          const s = svg as unknown as { scale: (n: string) => Scale };
          const [x, y] = [s.scale("x"), s.scale("y")];
          const x0 = x.apply(0);
          const widths = Array.from(
            { length: Math.ceil(Number(x.domain[1])) + 1 },
            (_, n) => x.apply(n) - x0,
          );
          return [...svg.querySelectorAll("g[aria-label=bar] rect")].map((r) => {
            const top = Number(r.getAttribute("y"));
            const team = y.domain.find(
              (t) => top >= y.apply(t) - 0.5 && top < y.apply(t) + (y.bandwidth ?? 0),
            );
            const width = Number(r.getAttribute("width"));
            return {
              team: String(team),
              x: Number(r.getAttribute("x")),
              y: top,
              width,
              height: Number(r.getAttribute("height")),
              fill: r.getAttribute("fill") ?? "",
              // the count the bar is drawn for: the n whose bar is exactly this wide (Plot does not round x)
              count: widths.findIndex((w) => Math.abs(w - width) < 1e-6),
            };
          });
        });
      const counts = (rows: Awaited<ReturnType<typeof drawn>>) =>
        Object.fromEntries(rows.map((r) => [r.team, r.count] as const).sort(([a], [b]) => (a < b ? -1 : 1)));
      const tableIds = () =>
        figure
          .locator(".sdv-live-output table tbody tr")
          .evaluateAll((trs) => trs.map((tr) => tr.querySelector("td")?.textContent ?? ""));
      const hex = (s: string) => [1, 3, 5].map((i) => Number.parseInt(s.slice(i, i + 2), 16));
      /** Every bar's fill is its team's palette colour; each at least `min` px wide is painted so at its middle. */
      const colours = async (rows: Awaited<ReturnType<typeof drawn>>, min: number) => {
        const shot = await loadImage(await bars.screenshot());
        const ctx = createCanvas(shot.width, shot.height).getContext("2d");
        ctx.drawImage(shot, 0, 0);
        let checked = 0;
        for (const r of rows) {
          const want = colorOf.get(r.team) ?? "";
          expect(r.fill, `${r.team}'s bar is its palette colour`).toBe(want);
          if (r.width < min) continue;
          const px = ctx.getImageData(
            Math.round(r.x + r.width / 2),
            Math.round(r.y + r.height / 2),
            1,
            1,
          ).data;
          const rgb = hex(want);
          expect(
            [0, 1, 2].map((c) => Math.abs((px[c] as number) - (rgb[c] as number)) <= 2),
            `${r.team}'s bar is painted ${want} at its middle (got ${[...px.slice(0, 3)]})`,
          ).toEqual([true, true, true]);
          checked++;
        }
        return checked;
      };

      // before brushing: a bar per offence, each drawn at that team's number of plays
      await expect.poll(async () => counts(await drawn()), { timeout: 15_000 }).toEqual(countBy(plays));
      expect(await colours(await drawn(), 4), "all 32 bars sampled").toBe(32);

      // brush the histogram with the mouse, from EPA 4.5 to the end of its x axis
      const box = await hist.boundingBox();
      if (box === null) throw new Error("no histogram");
      const ends = await hist.evaluate((svg) => {
        type Scale = { range: number[]; apply: (v: number) => number };
        const s = svg as unknown as { scale: (n: string) => Scale };
        const [x, y] = [s.scale("x"), s.scale("y")];
        return {
          from: x.apply(4.5),
          to: Math.max(...x.range) - 1,
          mid: ((y.range[0] ?? 0) + (y.range[1] ?? 0)) / 2,
        };
      });
      await page.mouse.move(box.x + ends.from, box.y + ends.mid);
      await page.mouse.down();
      await page.mouse.move(box.x + ends.to, box.y + ends.mid, { steps: 8 });
      await page.mouse.up();
      const brushed = await figure.locator('.sdv-live-output [role="figure"]').evaluate((el) => {
        const b = (el as HTMLElement & { sdvBrush: { value: unknown; predicate: (c: null) => unknown } })
          .sdvBrush;
        return { value: b.value as number[], sql: String(b.predicate(null)) };
      });
      const [lo, hi] = brushed.value as [number, number];
      expect(brushed.sql, "the brush filters plays by EPA, ends included").toMatch(/"epa" BETWEEN/);
      expect(Math.abs(lo - 4.5), "the brush starts where the mouse went down").toBeLessThan(0.2);
      const inBrush = plays.filter((p) => p.epa >= lo && p.epa <= hi);
      console.log(`${id}: brushed EPA ${lo.toFixed(3)} to ${hi.toFixed(3)}, ${inBrush.length} plays`);
      expect(inBrush.length, "some plays, fewer than the table's first batch of 100").toBeGreaterThan(5);
      expect(inBrush.length).toBeLessThan(100);
      // the bars and the table now hold exactly the brushed plays
      await expect.poll(async () => counts(await drawn()), { timeout: 15_000 }).toEqual(countBy(inBrush));
      await expect
        .poll(async () => (await tableIds()).sort(), { timeout: 15_000 })
        .toEqual(inBrush.map((p) => p.play).sort());
      expect(await colours(await drawn(), 4), "brushed bars wide enough to sample").toBeGreaterThan(0);

      // nothing left the docs server: the page and DuckDB's worker and WebAssembly module all came from it
      expect(asked.filter((u) => new URL(u).origin !== base)).toEqual([]);
      for (const want of [/\/[0-9a-f]{16}\.wasm$/, /\/[0-9a-f]{16}\.js$/])
        expect(
          asked.some((u) => want.test(u)),
          `asked for ${want}`,
        ).toBe(true);
      if (SHOTS !== undefined)
        await figure
          .locator(".sdv-live-output")
          .screenshot({ path: join(SHOTS, `${id.replace(/\//g, "_")}_brushed.png`) });
      expect(errors).toEqual([]);
    } finally {
      await context.close();
    }
  });

  // Perspective (sdvplot/perspective): the engine and the viewer are WebAssembly served from the docs' own files, and
  // nothing leaves the docs server. Every expectation is worked out here from the shared data, with the colours from
  // the Recharts adapter's palette (the shared palette by another path: every team here resolves, none repeats), and
  // checked against what Perspective painted: the grid's computed cell fills and screenshot pixels, the chart's WebGL
  // pixels, and the streamed table's own size and aggregates.
  /** A fresh context whose every request is recorded and any request off the docs server is aborted. */
  async function localOnly(): Promise<{
    page: Page;
    asked: string[];
    errors: string[];
    close: () => Promise<void>;
  }> {
    const context = await browser.newContext();
    const asked: string[] = [];
    await context.route("**/*", (r) => {
      const url = r.request().url();
      // the docs' own analytics script (docusaurus.config.ts, on every page) is answered here with an empty script
      if (url.startsWith("https://plausible.io/js/"))
        return r.fulfill({ contentType: "text/javascript", body: "" });
      asked.push(url);
      return new URL(url).origin === base ? r.continue() : r.abort();
    });
    const page = await context.newPage();
    const errors: string[] = [];
    page.on("console", (m) => void (m.type() === "error" && errors.push(m.text())));
    page.on("pageerror", (e) => void errors.push(e.message));
    return { page, asked, errors, close: () => context.close() };
  }
  /** The engine's and the viewer's WebAssembly came from the docs server, and nothing was asked of anyone else. */
  function servedLocally(asked: readonly string[]): void {
    expect(asked.filter((u) => new URL(u).origin !== base)).toEqual([]);
    expect(asked.filter((u) => /\.wasm$/.test(u)).length, "both modules, from the docs server").toBe(2);
  }
  async function openPerspective(page: Page, id: string) {
    const entry = EXAMPLES.find((e) => e.id === id);
    if (entry === undefined) throw new Error(`${id} is not in the registry`);
    await page.goto(`${base}/gallery/${pagePath(entry)}/`);
    const figure = page.locator(`figure[data-example="${id}"]`);
    await figure.scrollIntoViewIfNeeded();
    await figure.locator("perspective-viewer").waitFor({ timeout: 60_000 });
    // an element screenshot scrolls it to the window's top edge, under the docs' sticky navbar: hide the navbar, so a
    // screenshot is of the chart alone
    await page.addStyleTag({ content: ".navbar { display: none !important; }" });
    return figure;
  }
  const rgbHex = (css: string) =>
    `#${(css.match(/\d+/g) ?? [])
      .slice(0, 3)
      .map((v) => Number(v).toString(16).padStart(2, "0"))
      .join("")}`;
  const channels = (h: string) => [1, 3, 5].map((i) => Number.parseInt(h.slice(i, i + 2), 16));
  const offence = NFL_TEAM_EPA_2024.map((t) => ({
    team: t.team,
    plays: t.off_plays,
    epa: t.off_epa / t.off_plays,
  }));

  test("sdvplot/perspective/nfl-offense-datagrid: local files only; each team's cell is filled with its colour, computed and painted, in the rows' order; EPA to 3 decimals; logos as links", async () => {
    const id = "sdvplot/perspective/nfl-offense-datagrid";
    await loadLeague("nfl");
    const order = [...offence].sort((a, b) => b.epa - a.epa);
    const sorted = order.map((r) => r.team).sort();
    const palette = rechartsPalette("nfl", sorted, { background: "#ffffff" }); // Pro Light's background
    const colorOf = new Map(sorted.map((t, i) => [t, palette[i] ?? ""]));
    const { page, asked, errors, close } = await localOnly();
    try {
      const figure = await openPerspective(page, id);
      const viewer = figure.locator("perspective-viewer");
      /** The grid's drawn rows: each cell's text, the team cell's computed fill and the logo link. */
      const drawn = () =>
        viewer.evaluate((v) => {
          const grid = v.querySelector("perspective-viewer-datagrid");
          const table =
            grid?.querySelector("regular-table") ?? grid?.shadowRoot?.querySelector("regular-table");
          const head = [...(table?.querySelectorAll("thead tr:last-child th") ?? [])].map(
            (c) => c.textContent,
          );
          return [...(table?.querySelectorAll("tbody tr") ?? [])].map((tr) => {
            const td = [...tr.querySelectorAll("td")];
            const at = (name: string) => td[head.indexOf(name)];
            return {
              team: at("team")?.textContent ?? "",
              plays: at("plays")?.textContent ?? "",
              epa: at("epa_per_play")?.textContent ?? "",
              fill: getComputedStyle(at("team") ?? tr).backgroundColor,
              href: at("team_logo")?.querySelector("a")?.getAttribute("href") ?? null,
            };
          });
        });
      await expect.poll(async () => (await drawn()).length, { timeout: 30_000 }).toBeGreaterThan(10);
      const seen = new Map<string, Awaited<ReturnType<typeof drawn>>[number]>();
      // the first screen, then the grid scrolled to its end: every team drawn once
      for (const end of [false, true]) {
        if (end)
          await viewer.evaluate((v) => {
            const grid = v.querySelector("perspective-viewer-datagrid");
            const table = (grid?.querySelector("regular-table") ??
              grid?.shadowRoot?.querySelector("regular-table")) as HTMLElement;
            table.scrollTop = table.scrollHeight;
          });
        const first = (await drawn()).length;
        await expect
          .poll(async () => (await drawn()).at(-1)?.team, { timeout: 15_000 })
          .toBe(end ? order.at(-1)?.team : order[first - 1]?.team);
        for (const r of await drawn()) seen.set(r.team, r);
      }
      expect([...seen.keys()].sort(), "every team's row").toEqual(sorted);
      for (const t of order) {
        const r = seen.get(t.team);
        expect(rgbHex(r?.fill ?? ""), `${t.team}'s cell is filled with its colour`).toBe(colorOf.get(t.team));
        // plays as typed, EPA per play to 3 decimals, and the logo's URL as a link
        expect([r?.plays, r?.epa]).toEqual([String(t.plays), t.epa.toFixed(3)]);
        expect(r?.href).toBe(logoUrlSync(t.team, "nfl"));
      }
      // painted: a pixel inside each drawn team cell, in its padding left of the text, is the cell's colour
      const cells = viewer.locator("perspective-viewer-datagrid regular-table tbody tr td:first-of-type");
      let painted = 0;
      for (let i = 0; i < (await cells.count()); i++) {
        const cell = cells.nth(i);
        if (!(await cell.isVisible())) continue;
        const team = (await cell.textContent()) ?? "";
        const shot = await loadImage(await cell.screenshot());
        const ctx = createCanvas(shot.width, shot.height).getContext("2d");
        ctx.drawImage(shot, 0, 0);
        const px = ctx.getImageData(2, Math.floor(shot.height / 2), 1, 1).data;
        const want = channels(colorOf.get(team) ?? "");
        expect(
          [0, 1, 2].map((c) => Math.abs((px[c] as number) - (want[c] as number)) <= 2),
          `${team}'s cell is painted ${colorOf.get(team)} (got ${[...px.slice(0, 3)]})`,
        ).toEqual([true, true, true]);
        painted++;
      }
      expect(painted, "team cells sampled").toBeGreaterThan(10);
      servedLocally(asked);
      if (SHOTS !== undefined)
        await figure
          .locator(".sdv-live-output")
          .screenshot({ path: join(SHOTS, `${id.replace(/\//g, "_")}.png`) });
      expect(errors).toEqual([]);
    } finally {
      await close();
    }
  });

  test("sdvplot/perspective/nfl-offense-datagrid-themed: local files only; each number painted in the theme's sign colour (its gradient's ends), in its numeric face; the grid in the body face; each team's cell keeps its colour", async () => {
    const id = "sdvplot/perspective/nfl-offense-datagrid-themed";
    // expected from the registry, not from the config under test: Perspective 5.5.1 paints a positive number in the
    // fg_color gradient's last stop and a negative one in its first (viewer-datagrid's restore.ts end_records and
    // numeric.ts), so with the theme's neg-to-pos gradient, neg and pos themselves
    const spec = tableThemeSpec("nfl-next-gen-stats", "light");
    const { neg, pos } = spec.palette;
    const { body, numeric } = spec.fonts;
    expect(numeric, "a numeric face of its own, so the number columns carry one").not.toBe(body);
    await loadLeague("nfl");
    const order = [...offence].sort((a, b) => b.epa - a.epa);
    const sorted = order.map((r) => r.team).sort();
    const palette = rechartsPalette("nfl", sorted, { background: "#ffffff" }); // Pro Light's background
    const colorOf = new Map(sorted.map((t, i) => [t, palette[i] ?? ""]));
    const byTeam = new Map(NFL_TEAM_EPA_2024.map((t) => [t.team, t]));
    const value = (team: string, col: string): number => {
      const t = byTeam.get(team);
      if (t === undefined) throw new Error(`no row for ${team}`);
      return col === "plays"
        ? t.off_plays
        : col === "epa_per_play"
          ? t.off_epa / t.off_plays
          : t.def_epa / t.def_plays;
    };
    const signColour = (v: number) => (v > 0 ? pos : neg);
    const NUMBERS = ["plays", "epa_per_play", "def_epa_per_play"] as const;
    /** A CSS font-family list's first family, unquoted. */
    const firstFace = (css: string) => (css.split(",")[0] ?? "").trim().replace(/^["']|["']$/g, "");
    const { page, asked, errors, close } = await localOnly();
    try {
      const figure = await openPerspective(page, id);
      const viewer = figure.locator("perspective-viewer");
      /** The grid's font, and its drawn rows: the team cell's fill and face, each number cell's colour and face. */
      const drawn = () =>
        viewer.evaluate((v, numbers) => {
          const grid = v.querySelector("perspective-viewer-datagrid");
          const table =
            grid?.querySelector("regular-table") ?? grid?.shadowRoot?.querySelector("regular-table");
          const head = [...(table?.querySelectorAll("thead tr:last-child th") ?? [])].map(
            (c) => c.textContent,
          );
          const rows = [...(table?.querySelectorAll("tbody tr") ?? [])].map((tr) => {
            const td = [...tr.querySelectorAll("td")];
            const at = (name: string) => td[head.indexOf(name)];
            const team = at("team");
            return {
              team: team?.textContent ?? "",
              fill: getComputedStyle(team ?? tr).backgroundColor,
              teamFace: getComputedStyle(team ?? tr).fontFamily,
              numbers: numbers.map((n) => {
                const cell = at(n);
                return {
                  col: n,
                  text: cell?.textContent ?? "",
                  color: cell ? getComputedStyle(cell).color : "",
                  face: cell ? getComputedStyle(cell).fontFamily : "",
                };
              }),
            };
          });
          return {
            gridFace: table ? getComputedStyle(table).fontFamily : "",
            gridSize: table ? getComputedStyle(table).fontSize : "",
            rows,
          };
        }, NUMBERS);
      await expect.poll(async () => (await drawn()).rows.length, { timeout: 30_000 }).toBeGreaterThan(10);
      expect(firstFace((await drawn()).gridFace), "the grid's face is the theme's body face").toBe(body);
      expect((await drawn()).gridSize, "the grid's size is the theme's body size").toBe(
        `${spec.sizes.body}px`,
      );
      const seen = new Map<string, Awaited<ReturnType<typeof drawn>>["rows"][number]>();
      const signs = { neg: 0, pos: 0 };
      // the first screen, then the grid scrolled to its end: every team drawn once
      for (const end of [false, true]) {
        if (end)
          await viewer.evaluate((v) => {
            const grid = v.querySelector("perspective-viewer-datagrid");
            const table = (grid?.querySelector("regular-table") ??
              grid?.shadowRoot?.querySelector("regular-table")) as HTMLElement;
            table.scrollTop = table.scrollHeight;
          });
        const first = (await drawn()).rows.length;
        await expect
          .poll(async () => (await drawn()).rows.at(-1)?.team, { timeout: 15_000 })
          .toBe(end ? order.at(-1)?.team : order[first - 1]?.team);
        for (const r of (await drawn()).rows) seen.set(r.team, r);
        // painted: each visible number cell's inkiest pixel (the one farthest from the cell's padding) is its sign's
        // colour, and nearer it than the other sign's
        const rows = viewer.locator("perspective-viewer-datagrid regular-table tbody tr");
        for (let i = 0; i < (await rows.count()); i++) {
          const tr = rows.nth(i);
          const team = (await tr.locator("td").first().textContent()) ?? "";
          for (const [j, col] of NUMBERS.entries()) {
            const cell = tr.locator("td").nth(j + 1);
            // only a cell the grid shows whole: below the header, above the table's bottom edge
            const whole = await cell.evaluate((td) => {
              const table = td.closest("regular-table");
              const head = table?.querySelector("thead")?.getBoundingClientRect();
              const t = table?.getBoundingClientRect();
              const c = td.getBoundingClientRect();
              return t !== undefined && head !== undefined && c.top >= head.bottom && c.bottom <= t.bottom;
            });
            if (!whole) continue;
            const shot = await loadImage(await cell.screenshot());
            const ctx = createCanvas(shot.width, shot.height).getContext("2d");
            ctx.drawImage(shot, 0, 0);
            // 3 px in from each edge: the cell's box can take in an edge of the team cell's fill beside it
            const px = ctx.getImageData(3, 3, shot.width - 6, shot.height - 6).data;
            const bg = [...px.slice(0, 3)]; // the cell's padding (a number is right-aligned)
            const dist = (k: number, c: number[]) =>
              Math.max(...[0, 1, 2].map((ch) => Math.abs((px[k + ch] as number) - (c[ch] as number))));
            let ink = 0;
            for (let k = 0; k < px.length; k += 4) if (dist(k, bg) > dist(ink, bg)) ink = k;
            const v = value(team, col);
            const want = signColour(v);
            const other = v > 0 ? neg : pos;
            const got = [...px.slice(ink, ink + 3)];
            expect(
              dist(ink, channels(want)) <= 8 && dist(ink, channels(want)) < dist(ink, channels(other)),
              `${team} ${col} (${v}) is painted ${want} (inkiest pixel ${got})`,
            ).toBe(true);
            signs[v > 0 ? "pos" : "neg"]++;
          }
        }
      }
      expect(signs.neg, "negative numbers painted").toBeGreaterThan(5);
      expect(signs.pos, "positive numbers painted").toBeGreaterThan(5);
      expect([...seen.keys()].sort(), "every team's row").toEqual(sorted);
      for (const t of order) {
        const r = seen.get(t.team);
        expect(rgbHex(r?.fill ?? ""), `${t.team}'s cell is filled with its colour`).toBe(colorOf.get(t.team));
        expect(firstFace(r?.teamFace ?? ""), `${t.team}'s cell is in the body face`).toBe(body);
        for (const n of r?.numbers ?? []) {
          const v = value(t.team, n.col);
          expect(rgbHex(n.color), `${t.team} ${n.col} (${n.text}) is coloured by its sign`).toBe(
            signColour(v),
          );
          expect(firstFace(n.face), `${t.team} ${n.col} is in the numeric face`).toBe(numeric);
        }
      }
      servedLocally(asked);
      if (SHOTS !== undefined)
        await figure
          .locator(".sdv-live-output")
          .screenshot({ path: join(SHOTS, `${id.replace(/\//g, "_")}.png`) });
      expect(errors).toEqual([]);
    } finally {
      await close();
    }
  });

  type Box = { x0: number; x1: number; y0: number; y1: number };
  /**
   * A Perspective bar chart split by team, checked by its WebGL pixels: each palette colour's pixels are boxed (the
   * legend's columns left out); the theme's background fills most of the canvas; pixels per unit come from all the
   * bars, and each team's bar of at least 8 px must be its own value tall at that scale (within 3 px), in its own
   * colour; the bars stand on one zero line; and left to right they are the teams in sorted order.
   */
  async function checkTeamBars(
    canvas: ReturnType<Page["locator"]>,
    o: {
      sorted: readonly string[];
      palette: readonly string[];
      value: ReadonlyMap<string, number>;
      background: string;
      minChecked: number;
    },
  ): Promise<void> {
    const { sorted, palette, value } = o;
    const bg = channels(o.background).join(",");
    const bars = async () => {
      const shot = await loadImage(await canvas.screenshot());
      const ctx = createCanvas(shot.width, shot.height).getContext("2d");
      ctx.drawImage(shot, 0, 0);
      const d = ctx.getImageData(0, 0, shot.width, shot.height).data;
      const index = new Map(palette.map((h, i) => [channels(h).join(","), i]));
      const rgb = (x: number, y: number) => [0, 1, 2].map((c) => d[(y * shot.width + x) * 4 + c] as number);
      const box = new Map<number, Box>();
      let background = 0;
      for (let x = 0; x < shot.width; x++) {
        const here = new Map<number, number[]>();
        for (let y = 0; y < shot.height; y++) {
          const px = rgb(x, y).join(",");
          const i = index.get(px);
          if (i !== undefined) here.set(i, [...(here.get(i) ?? []), y]);
          else if (px === bg) background++;
        }
        if (here.size > 2) continue; // a legend column: a swatch of each team, stacked
        for (const [i, ys] of here) {
          const b = box.get(i) ?? { x0: x, x1: x, y0: Number.POSITIVE_INFINITY, y1: -1 };
          box.set(i, { x0: b.x0, x1: x, y0: Math.min(b.y0, ...ys), y1: Math.max(b.y1, ...ys) });
        }
      }
      return { box, background, area: shot.width * shot.height };
    };
    await expect
      .poll(async () => (await bars()).box.size, { timeout: 30_000 })
      .toBeGreaterThanOrEqual(o.minChecked);
    const { box, background, area } = await bars();
    expect(background / area, `the theme's background ${o.background}`).toBeGreaterThan(0.5);
    const height = (b: Box) => b.y1 - b.y0 + 1;
    // the scale, pixels per unit, from all the bars; then each team's bar is as tall as its own value at that scale
    const drawnTeams = sorted.filter((_, i) => box.has(i));
    let px = 0;
    let total = 0;
    for (const t of drawnTeams) {
      px += height(box.get(sorted.indexOf(t)) as Box);
      total += Math.abs(value.get(t) ?? 0);
    }
    const k = px / total;
    const tops: number[] = [];
    const bottoms: number[] = [];
    let checked = 0;
    for (const [i, t] of sorted.entries()) {
      const v = value.get(t) ?? 0;
      if (Math.abs(v) * k < 8) continue; // a bar a few pixels tall is not measured
      const b = box.get(i);
      expect(b, `${t}'s bar is drawn in ${palette[i]}`).toBeDefined();
      if (b === undefined) continue;
      expect(
        Math.abs(height(b) - Math.abs(v) * k),
        `${t}'s bar is ${height(b)} px for ${v.toFixed(3)} (${(Math.abs(v) * k).toFixed(1)} px)`,
      ).toBeLessThanOrEqual(3);
      if (v > 0) bottoms.push(b.y1);
      else tops.push(b.y0);
      checked++;
    }
    expect(checked, "teams measured").toBeGreaterThanOrEqual(o.minChecked);
    // the bars stand on one zero line, positive above it and negative below
    expect(Math.max(...bottoms) - Math.min(...bottoms)).toBeLessThanOrEqual(1);
    expect(Math.max(...tops) - Math.min(...tops)).toBeLessThanOrEqual(1);
    expect(Math.abs(Math.min(...tops) - Math.max(...bottoms))).toBeLessThanOrEqual(3);
    // and left to right in the axis' order: the teams sorted
    const byX = [...box.entries()].sort((a, b) => a[1].x0 - b[1].x0).map(([i]) => sorted[i]);
    expect(byX).toEqual(drawnTeams);
  }
  test("sdvplot/perspective/nfl-epa-split-bars-dark: local files only; each team's bar is drawn in its colour on Pro Dark, at its place on the axis, as tall as its EPA per play", async () => {
    const id = "sdvplot/perspective/nfl-epa-split-bars-dark";
    await loadLeague("nfl");
    const sorted = offence.map((r) => r.team).sort();
    const palette = rechartsPalette("nfl", sorted, { background: "#242526" }); // Pro Dark's background
    const value = new Map(offence.map((r) => [r.team, r.epa]));
    const { page, asked, errors, close } = await localOnly();
    try {
      const figure = await openPerspective(page, id);
      const canvas = figure.locator("perspective-viewer canvas.webgl-canvas");
      await canvas.waitFor({ timeout: 30_000 });
      await checkTeamBars(canvas, { sorted, palette, value, background: "#242526", minChecked: 28 });
      servedLocally(asked);
      if (SHOTS !== undefined)
        await figure
          .locator(".sdv-live-output")
          .screenshot({ path: join(SHOTS, `${id.replace(/\//g, "_")}.png`) });
      expect(errors).toEqual([]);
    } finally {
      await close();
    }
  });

  test("sdvplot/perspective/nfl-plays-streaming: local files only; every week's batch lands whole, the table growing to each running total and ending at every play; each offence's bar is its EPA total, in its colour", async () => {
    const id = "sdvplot/perspective/nfl-plays-streaming";
    await loadLeague("nfl");
    const plays = await nflPlays2024();
    const weeks = [...new Set(plays.map((p) => p.week))].sort((a, b) => a - b);
    let total = 0;
    const running = weeks.map((w) => {
      total += plays.filter((p) => p.week === w).length;
      return total;
    });
    const epaBy = new Map<string, number>();
    for (const p of plays) epaBy.set(p.posteam, (epaBy.get(p.posteam) ?? 0) + p.epa);
    const sorted = [...epaBy.keys()].sort();
    const palette = rechartsPalette("nfl", sorted, { background: "#ffffff" }); // Pro Light's background
    const { page, asked, errors, close } = await localOnly();
    type Sized = { sdvSizes: number[] };
    // before the page runs: the drawer hands each table the example makes to this hook, and waits for it, before the
    // example gets the table, so every update is heard, however slowly Perspective started
    await page.addInitScript(() => {
      type View = { on_update: (cb: () => void) => Promise<unknown> };
      type T = { size: () => Promise<number>; view: () => Promise<View> };
      const w = window as unknown as Sized & { sdvPerspectiveTable: (t: T) => Promise<void> };
      w.sdvSizes = [];
      w.sdvPerspectiveTable = async (table) => {
        w.sdvSizes.push(await table.size());
        // a view of the table hears each update (the table handle has no on_update of its own)
        const view = await table.view();
        await view.on_update(async () => void w.sdvSizes.push(await table.size()));
      };
    });
    try {
      const figure = await openPerspective(page, id);
      const viewer = figure.locator("perspective-viewer");
      const sizes = () => page.evaluate(() => [...(window as unknown as Sized).sdvSizes]);
      await expect.poll(async () => (await sizes()).at(-1), { timeout: 30_000 }).toBe(plays.length);
      const seen = [...new Set(await sizes())];
      console.log(`${id}: sizes ${seen.join(", ")} (running totals ${running.join(", ")})`);
      // the empty table, then every batch whole, in order: each size a running total and none missed
      expect(seen).toEqual([0, ...running]);
      expect(running.at(-1)).toBe(11_778);
      // the view the bars draw: each offence's EPA, summed over all its plays
      const sums = await viewer.evaluate(async (v) => {
        type View = { to_columns: () => Promise<Record<string, unknown[]>> };
        const view = await (v as HTMLElement & { getView: () => Promise<View> }).getView();
        const cols = await view.to_columns();
        // a row per offence (its group path), and in it the offence's own split column holds its EPA total
        const paths = (cols.__ROW_PATH__ ?? []) as unknown[][];
        const out: Record<string, number> = {};
        paths.forEach((path, i) => {
          const team = path.length === 1 ? String(path[0]) : undefined;
          if (team !== undefined) out[team] = (cols[`${team}|epa`]?.[i] as number | undefined) ?? Number.NaN;
        });
        return out;
      });
      expect(Object.keys(sums).sort()).toEqual(sorted);
      for (const [team, want] of epaBy) expect(Math.abs((sums[team] ?? 0) - want), team).toBeLessThan(1e-6);
      // drawn: each offence's bar in its own colour, as tall as its EPA total
      const canvas = figure.locator("perspective-viewer canvas.webgl-canvas");
      await checkTeamBars(canvas, { sorted, palette, value: epaBy, background: "#ffffff", minChecked: 24 });
      servedLocally(asked);
      if (SHOTS !== undefined)
        await figure
          .locator(".sdv-live-output")
          .screenshot({ path: join(SHOTS, `${id.replace(/\//g, "_")}.png`) });
      expect(errors).toEqual([]);
    } finally {
      await close();
    }
  });

  // A drawing that fails (here plotly.js never arrives) shows the alert over the static copy, leaves nothing drawn,
  // and drops the note that plotly.js draws the figure here.
  // Unovis examples (sdvplot/unovis): Unovis itself draws each node and flow. What each drew is matched to the datum d3
  // bound to it, so every flow and link is checked by its own ids. Every expectation here is worked out in the test
  // from the shared data, with colours from the recharts adapter's palette (independent of the unovis module), and
  // checked against REAL pixels: a flow's or a link's middle, a node's ring, and each image's box with the images
  // hidden and shown.
  const SANKEY_BAND = (y: number) =>
    y >= 80 ? "Own 1-20" : y >= 60 ? "Own 21-40" : y >= 41 ? "Own 41 to opp. 41" : "Opp. 40 and in";
  const kcGames = KC_PHI_GAMES_2024.filter((g) => g.home_team === "KC" || g.away_team === "KC");
  const UNOVIS: Readonly<
    Record<
      string,
      {
        background?: string;
        /** The teams in the order the example gives them to teamColorScale: with a background, the palette depends on it. */
        palette: readonly string[];
        /** source>target>team for each link (a flow per team, a pass, a game), with its count. */
        links: readonly [key: string, team: string][];
        /** Graph nodes: each node's id and the image its icon must show. */
        images?: () => readonly [id: string, href: string][];
        /** Graph nodes: each node's id and team (its ring's colour). */
        rings?: readonly [id: string, team: string][];
        /** Sankey nodes in a team's colour: each node's id and team. */
        teamNodes?: readonly [id: string, team: string][];
      }
    >
  > = {
    "sdvplot/unovis/super-bowl-drives-sankey": {
      palette: ["KC", "PHI"],
      teamNodes: [
        ["team:KC", "KC"],
        ["team:PHI", "PHI"],
      ],
      links: [
        ...new Set(
          SUPER_BOWL_LIX_DRIVES.flatMap((d) => [
            `team:${d.team}>band:${SANKEY_BAND(d.yardline_100)}>${d.team}`,
            `band:${SANKEY_BAND(d.yardline_100)}>result:${d.result}>${d.team}`,
          ]),
        ),
      ].map((k) => [k, k.split(">")[2] as string]),
    },
    "sdvplot/unovis/chiefs-passing-network": {
      palette: ["KC"],
      links: SUPER_BOWL_LIX_KC_TARGETS.map((r) => [`${SUPER_BOWL_LIX_KC_PASSER}>${r.player}>KC`, "KC"]),
      images: () =>
        [SUPER_BOWL_LIX_KC_PASSER, ...SUPER_BOWL_LIX_KC_TARGETS.map((r) => r.player)].map((p) => [
          p,
          headshotUrl(p, "nfl") as string,
        ]),
      rings: [SUPER_BOWL_LIX_KC_PASSER, ...SUPER_BOWL_LIX_KC_TARGETS.map((r) => r.player)].map((p) => [
        p,
        "KC",
      ]),
    },
    "sdvplot/unovis/chiefs-2024-results-dark": {
      background: "#111827",
      // winner then loser, game by game
      palette: [
        ...new Set(
          kcGames.flatMap((g) =>
            g.home_score > g.away_score ? [g.home_team, g.away_team] : [g.away_team, g.home_team],
          ),
        ),
      ],
      links: kcGames.map((g) => {
        const [w, l] = g.home_score > g.away_score ? [g.home_team, g.away_team] : [g.away_team, g.home_team];
        return [`${w}>${l}>${w}`, w];
      }),
      images: () =>
        [...new Set(kcGames.flatMap((g) => [g.away_team, g.home_team]))].map((t) => [
          t,
          logoUrlSync(t, "nfl", { variant: "dark" }) as string,
        ]),
      rings: [...new Set(kcGames.flatMap((g) => [g.away_team, g.home_team]))].map((t) => [t, t]),
    },
  };
  test.each(EXAMPLES.filter((e) => e.id.startsWith("sdvplot/unovis/")).map((e) => e.id))(
    "%s re-runs live: Unovis draws exactly its nodes and flows, each in its team's colour, with real image pixels",
    async (id) => {
      const entry = EXAMPLES.find((e) => e.id === id);
      const spec = UNOVIS[id];
      if (entry === undefined || spec === undefined) throw new Error(`${id} is not in the registry`);
      await loadLeague("nfl");
      const teams = spec.palette;
      const want = rechartsPalette(
        "nfl",
        teams,
        spec.background === undefined ? {} : { background: spec.background },
      );
      const colorOf = (t: string) => (want[teams.indexOf(t)] ?? "").toLowerCase();
      // the oracle and the module both go through colorPalette: a background that changed nothing would pass both
      if (spec.background !== undefined)
        expect(want, "the dark palette differs from the light one").not.toEqual(
          rechartsPalette("nfl", teams),
        );
      const page = await browser.newPage();
      try {
        const errors: string[] = [];
        page.on("console", (m) => void (m.type() === "error" && errors.push(m.text())));
        page.on("pageerror", (e) => void errors.push(e.message));
        await page.goto(`${base}/gallery/${pagePath(entry)}/`);
        const figure = page.locator(`figure[data-example="${id}"]`);
        await figure.scrollIntoViewIfNeeded();
        const svg = figure.locator(".sdv-live-output svg").first();
        const n = spec.links.length;
        // Unovis lays a graph out over a few frames: wait for every link to have its path and stroke or fill
        await page.waitForFunction(
          ([sel, count]) => {
            const ps = [...document.querySelectorAll(sel as string)] as SVGPathElement[];
            return (
              ps.length === count &&
              ps.every((p) => (p.getAttribute("d") ?? "") !== "" && (p.style.stroke || p.style.fill))
            );
          },
          [
            `figure[data-example="${id}"] .sdv-live-output svg path[class*=visible], figure[data-example="${id}"] .sdv-live-output svg g[class*=g-link] > path[class*=-link]:not([class*=support]):not([class*=band])`,
            n,
          ] as const,
          { timeout: 30_000 },
        );
        await page.waitForLoadState("networkidle"); // the images
        await page.waitForTimeout(1500); // a force layout's last ticks (Unovis fits the view when it settles)
        await page.addStyleTag({ content: ".navbar { display: none !important; }" });
        expect(await figure.locator(".sdv-live-static").count(), "the static copy is replaced").toBe(0);
        expect(await figure.locator(".sdv-live-error").count(), "no error alert").toBe(0);
        const got = await svg.evaluate((el) => {
          type D = {
            id?: string;
            source?: { id: string };
            target?: { id: string };
            team?: string;
            value?: number;
          };
          const box = el.getBoundingClientRect();
          // a point in an element's own user units -> px from the svg's top left (what its screenshot is indexed by)
          const at = (e: SVGGraphicsElement, x: number, y: number) => {
            const m = e.getScreenCTM() as DOMMatrix;
            const sx = m.a * x + m.c * y + m.e;
            const sy = m.b * x + m.d * y + m.f;
            return { x: sx - box.left, y: sy - box.top };
          };
          const data = (e: Element) => (e as unknown as { __data__: D }).__data__;
          // Chromium reads a style colour back as rgb(r, g, b): as #rrggbb
          const toHex = (c: string) => {
            const m = /^rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(c);
            return m === null
              ? c.toLowerCase()
              : `#${m
                  .slice(1, 4)
                  .map((v) => Number(v).toString(16).padStart(2, "0"))
                  .join("")}`;
          };
          // flows (Sankey) and links (Graph): ids, colour, and five points along the middle
          const links = [
            ...el.querySelectorAll(
              "path[class*=visible], g[class*=g-link] > path[class*=-link]:not([class*=support]):not([class*=band])",
            ),
          ].map((p) => {
            const path = p as SVGPathElement;
            const d = data(path);
            const sankey = path.getAttribute("class")?.includes("visible") ?? false;
            const s = getComputedStyle(path);
            let points: { x: number; y: number }[];
            if (sankey) {
              // the ribbon's centre line: a cubic from (x0, y0) to (x1, y1) with controls at their middle x
              const l = d as unknown as {
                y0: number;
                y1: number;
                source: { x1: number };
                target: { x0: number };
              };
              const [x0, x1, y0, y1] = [l.source.x1, l.target.x0, l.y0, l.y1];
              const cx = (x0 + x1) / 2;
              points = [0.5, 0.35, 0.65, 0.25, 0.75].map((t) => {
                const u = 1 - t;
                const x = u ** 3 * x0 + 3 * u * u * t * cx + 3 * u * t * t * cx + t ** 3 * x1;
                const y = u ** 3 * y0 + 3 * u * u * t * y0 + 3 * u * t * t * y1 + t ** 3 * y1;
                return at(path, x, y);
              });
            } else {
              const len = path.getTotalLength();
              points = [0.5, 0.4, 0.6, 0.3, 0.7].map((f) => {
                const q = path.getPointAtLength(f * len);
                return at(path, q.x, q.y);
              });
            }
            return {
              key: `${d.source?.id}>${d.target?.id}>${d.team}`,
              color: toHex(sankey ? path.style.fill : path.style.stroke),
              alpha: Number(s.opacity) * Number(sankey ? s.fillOpacity : s.strokeOpacity),
              points,
            };
          });
          // graph nodes: id, ring colour and a point on the ring, the icon's image and its box
          const nodes = [...el.querySelectorAll("g[class*=g-node]")].map((g) => {
            const shape = g.querySelector("circle[class*=node-shape]") as SVGCircleElement;
            const use = g.querySelector("use") as SVGUseElement | null;
            const href = use?.getAttribute("href") ?? null;
            const image = href === null ? null : el.querySelector(`symbol[id="${href.slice(1)}"] > image`);
            const r = Number(shape.getAttribute("r"));
            const ring = [0, 45, 90, 135, 180, 225, 270, 315].map((deg) => {
              const a = (deg * Math.PI) / 180;
              return at(shape, r * Math.cos(a), r * Math.sin(a)); // the middle of the ring
            });
            const ub = use?.getBoundingClientRect();
            return {
              id: data(g).id ?? "",
              stroke: toHex(shape.style.stroke),
              ring,
              image: image?.getAttribute("href") ?? null,
              icon: ub === undefined ? null : [ub.left - box.left, ub.top - box.top, ub.width, ub.height],
            };
          });
          // Sankey nodes: id, fill, opacity and points down the middle of the bar
          const bars = [...el.querySelectorAll("rect[class*=-node]:not([class*=selection])")].map((r) => {
            const rect = r as SVGRectElement;
            const [w, h] = [Number(rect.getAttribute("width")), Number(rect.getAttribute("height"))];
            return {
              id: data(rect).id ?? "",
              fill: toHex(rect.style.fill),
              alpha: Number(getComputedStyle(rect).opacity) * Number(getComputedStyle(rect).fillOpacity),
              points: [0.25, 0.5, 0.75].map((f) => at(rect, w / 2, f * h)),
            };
          });
          return { links, nodes, bars };
        });
        const shoot = async () => {
          const shot = await loadImage(await svg.screenshot());
          const ctx = createCanvas(shot.width, shot.height).getContext("2d");
          ctx.drawImage(shot, 0, 0);
          return (x: number, y: number, w = 1, h = 1) => {
            const d = ctx.getImageData(Math.round(x), Math.round(y), Math.max(1, w), Math.max(1, h)).data;
            return Array.from(
              { length: d.length / 4 },
              (_, i) => [d[4 * i], d[4 * i + 1], d[4 * i + 2]] as number[],
            );
          };
        };
        const hex = (s: string) => [1, 3, 5].map((i) => Number.parseInt(s.slice(i, i + 2), 16));
        const near = (a: number[], b: number[], d: number) =>
          [0, 1, 2].every((c) => Math.abs((a[c] ?? 0) - (b[c] ?? 0)) <= d);
        // exactly the example's links, each once, each in its own team's colour (the shared palette)
        expect(got.links.map((l) => l.key).sort(), "every flow or link, by its ids, and no other").toEqual(
          spec.links.map(([k]) => k).sort(),
        );
        for (const l of got.links)
          expect.soft(l.color, `${l.key}'s colour`).toBe(colorOf(l.key.split(">")[2] as string));
        // real pixels: at one of five points along a link's middle, its pixel is its colour over what is under it
        // (Unovis draws flows half transparent), what is under it read with the links hidden
        const shown = await shoot();
        await svg.evaluate((el) => {
          for (const p of el.querySelectorAll("g[class*=-link], path[class*=visible]"))
            (p as SVGElement).style.visibility = "hidden";
        });
        const under = await shoot();
        await svg.evaluate((el) => {
          for (const p of el.querySelectorAll("g[class*=-link], path[class*=visible]"))
            (p as SVGElement).style.visibility = "";
        });
        let painted = 0;
        for (const l of got.links) {
          // the expected team's colour, not the attribute read back: a link painted in another team's colour fails
          const c = hex(colorOf(l.key.split(">")[2] as string));
          const seen = l.points.map((p) => {
            const [a] = shown(p.x, p.y);
            const [b] = under(p.x, p.y);
            // one, two or three layers of this team's colour: half-transparent flows of one team stack where they
            // overlap (two PHI flows read 0.75 PHI on CI), and that is still this team's colour, not another's
            const blends = [1, 2, 3].map((k) => {
              const w = 1 - (1 - l.alpha) ** k;
              return c.map((v, i) => w * v + (1 - w) * ((b ?? [])[i] ?? 0));
            });
            const blend = blends[0];
            return { a, b, blend, ok: blends.some((x) => near(a ?? [], x, 14)) };
          });
          if (seen.some((s) => s.ok)) painted += 1;
          else
            console.log(
              `${id}: ${l.key} has no pixel of ${l.color}: ${JSON.stringify(seen[0])} alpha ${l.alpha}`,
            );
        }
        console.log(`${id}: ${painted} of ${got.links.length} links painted in their colour`);
        // a link can cross under a node, a label or another link at all five points. In every run so far exactly one
        // link per example missed (27/28, 8/9, 16/17), each under a node or a label: all but one must show. Two wrong
        // links in the dark example (its background dropped: BUF and DEN) already fail this. Soft, so the node checks
        // below still run and report.
        expect
          .soft(painted, "links whose middle pixels are their team's colour")
          .toBeGreaterThanOrEqual(got.links.length - 1);
        if (spec.rings !== undefined && spec.images !== undefined) {
          // exactly the example's nodes; each ring its team's colour, in its pixels; each icon its own image
          expect(got.nodes.map((v) => v.id).sort(), "every node, by id").toEqual(
            spec.rings.map(([v]) => v).sort(),
          );
          const ringOf = new Map(spec.rings);
          const imageOf = new Map(spec.images());
          for (const v of got.nodes) {
            const team = ringOf.get(v.id) ?? "";
            expect.soft(v.stroke, `${v.id}'s ring`).toBe(colorOf(team));
            expect.soft(v.image, `${v.id}'s image`).toBe(imageOf.get(v.id));
            const ring = v.ring.some((p) => near(shown(p.x, p.y)[0] ?? [], hex(colorOf(team)), 14));
            expect.soft(ring, `a pixel of ${v.id}'s ring is ${colorOf(team)}`).toBe(true);
          }
          // the images' own pixels: hiding every icon changes each icon's box (over 10%)
          await svg.evaluate((el) => {
            for (const u of el.querySelectorAll("g[class*=g-node] use"))
              (u as SVGElement).style.visibility = "hidden";
          });
          const bare = await shoot();
          const changed = got.nodes.map((v) => {
            const [x, y, w, h] = (v.icon ?? [0, 0, 0, 0]).map(Math.round) as [number, number, number, number];
            const a = shown(x, y, w, h);
            const b = bare(x, y, w, h);
            return a.filter((p, i) => !near(p, b[i] ?? [], 8)).length / a.length;
          });
          console.log(
            `${id}: image boxes changed ${Math.min(...changed).toFixed(2)} to ${Math.max(...changed).toFixed(2)}`,
          );
          changed.forEach((c, i) =>
            expect.soft(c, `${got.nodes[i]?.id}'s image paints its box`).toBeGreaterThan(0.1),
          );
          await svg.evaluate((el) => {
            for (const u of el.querySelectorAll("g[class*=g-node] use"))
              (u as SVGElement).style.visibility = "";
          });
        }
        if (spec.teamNodes !== undefined) {
          // each team's node bar: its fill, and its pixels, are the expected team colour over what is under it
          await svg.evaluate((el) => {
            for (const r of el.querySelectorAll("rect[class*=-node]"))
              (r as SVGElement).style.visibility = "hidden";
          });
          const bare = await shoot();
          await svg.evaluate((el) => {
            for (const r of el.querySelectorAll("rect[class*=-node]"))
              (r as SVGElement).style.visibility = "";
          });
          for (const [nid, team] of spec.teamNodes) {
            const bar = got.bars.find((b) => b.id === nid);
            expect.soft(bar?.fill, `${nid}'s fill`).toBe(colorOf(team));
            const c = hex(colorOf(team));
            const ok = (bar?.points ?? []).every((p) => {
              const [a] = shown(p.x, p.y);
              const [b] = bare(p.x, p.y);
              const blend = c.map(
                (v, i) => (bar?.alpha ?? 1) * v + (1 - (bar?.alpha ?? 1)) * ((b ?? [])[i] ?? 0),
              );
              return near(a ?? [], blend, 14);
            });
            expect.soft(ok, `${nid}'s bar is painted ${colorOf(team)}`).toBe(true);
          }
        }
        if (spec.background !== undefined) {
          // the card: an empty corner is its background
          const [bg] = shown(4, 4);
          expect(near(bg ?? [], hex(spec.background), 2), `the card is ${spec.background}`).toBe(true);
        }
        if (SHOTS !== undefined)
          await figure
            .locator(".sdv-live-output")
            .screenshot({ path: join(SHOTS, `${id.replace(/\//g, "_")}.png`) });
        expect(errors).toEqual([]);
      } finally {
        await page.close();
      }
    },
  );

  test("a Plotly chart whose library fails keeps its static copy, under the alert", async () => {
    const id = "sdvplot/plotly/axis-logos";
    const entry = EXAMPLES.find((e) => e.id === id);
    if (entry === undefined) throw new Error(`${id} is not in the registry`);
    const page = await browser.newPage();
    try {
      await page.route("**/lib-plotly.*.js", (r) => r.abort());
      await page.goto(`${base}/gallery/${pagePath(entry)}/`);
      const figure = page.locator(`figure[data-example="${id}"]`);
      await figure.scrollIntoViewIfNeeded();
      await figure.locator(".sdv-live-error").waitFor({ timeout: 30_000 });
      expect(await figure.locator(".sdv-live-static").count(), "the static copy is back").toBe(1);
      expect(await figure.locator(".sdv-live-output > *").count(), "nothing drawn is left").toBe(0);
      expect(await figure.locator(".sdv-live-note").count(), "no note promising a drawing").toBe(0);
    } finally {
      await page.close();
    }
  });
});
