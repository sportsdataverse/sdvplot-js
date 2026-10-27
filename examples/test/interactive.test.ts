// @vitest-environment node
import { existsSync, mkdirSync, readFileSync, statSync } from "node:fs";
import { type Server, createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { extname, join, normalize } from "node:path";
import { createCanvas, loadImage } from "@napi-rs/canvas";
import {
  contrast,
  loadLeague,
  logoUrlSync,
  mix,
  onColor,
  resolveSync,
  solid,
} from "@sportsdataverse/sdvplot";
import { teamColorPalette, teamColors } from "@sportsdataverse/sdvplot/mui";
import { teamColorPalette as rechartsPalette } from "@sportsdataverse/sdvplot/recharts";
import { teamColorPalette as agPalette } from "@sportsdataverse/sdvplot/tanstack";
import { type Browser, type Page, chromium } from "playwright";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { pagePath } from "../scripts/pages.js";
import { abs } from "../sources.js";
import { BROWSER } from "../src/browser.gen.js";
import {
  AFC_WEEKS_2024,
  NBA_STANDINGS,
  NFL_TEAM_EPA_2024,
  NHL_STANDINGS,
  STANDINGS,
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
  ".css": "text/css",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ttf": "font/ttf",
  ".json": "application/json",
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
};

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

  // A drawing that fails (here plotly.js never arrives) shows the alert over the static copy, leaves nothing drawn,
  // and drops the note that plotly.js draws the figure here.
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
