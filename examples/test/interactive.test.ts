// @vitest-environment node
import { existsSync, mkdirSync, readFileSync, statSync } from "node:fs";
import { type Server, createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { extname, join, normalize } from "node:path";
import { createCanvas, loadImage } from "@napi-rs/canvas";
import { loadLeague } from "@sportsdataverse/sdvplot";
import { teamColors } from "@sportsdataverse/sdvplot/mui";
import { type Browser, chromium } from "playwright";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { pagePath } from "../scripts/pages.js";
import { abs } from "../sources.js";
import { BROWSER } from "../src/browser.gen.js";
import { EXAMPLES } from "../src/registry.gen.js";

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
  const MUI_LOGOS: Readonly<Record<string, number>> = {
    "sdvplot/mui-x-charts/epa-logo-scatter": 32,
    "sdvplot/mui-x-charts/afc-wins-logo-ticks": 8,
    "sdvplot/mui-x-charts/afc-west-margin-dark": 4,
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
          const logos = [...el.querySelectorAll("image[data-sdv-id]")].map((i) => {
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
          return { logos, bars, lines };
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
        expect(got.logos.length, "every team's logo is drawn").toBe(MUI_LOGOS[id]);
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
        // keyboard: focus MUI's layer, step to an item, and MUI draws its focus rect (stroke 2, no fill)
        const focusRect = 'rect[fill="none"][stroke-width="2"]';
        expect(await svg.locator(focusRect).count()).toBe(0);
        await figure.locator('.sdv-live-output [role="none"][tabindex="0"]').first().focus();
        await page.keyboard.press("ArrowRight");
        await svg.locator(focusRect).first().waitFor({ timeout: 5_000 });
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
