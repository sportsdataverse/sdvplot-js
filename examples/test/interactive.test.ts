// @vitest-environment node
import { existsSync, mkdirSync, readFileSync, statSync } from "node:fs";
import { type Server, createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { extname, join, normalize } from "node:path";
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
  uplot: ".sdv-live-output .uplot canvas",
  // the sdvplot marks inside LayerChart's svg: Svelte mounted, and the marks' lazy import of layerchart resolved
  svelte: ".sdv-live-output svg.lc-layout-svg :is(image[data-sdv-id], g[data-sdv-surface])",
  deckgl: ".sdv-live-output canvas",
  cytoscape: ".sdv-live-output canvas",
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
      if (lib === "chartjs" || lib === "uplot") {
        const painted = await figure.locator("canvas").evaluate((c: HTMLCanvasElement) =>
          c
            .getContext("2d")
            ?.getImageData(0, 0, c.width, c.height)
            .data.some((v, i) => i % 4 === 3 && v > 0),
        );
        expect(painted, "the canvas is painted").toBe(true);
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
      // Cytoscape draws on stacked canvases. Sample where marks are known to be: the first nodes' fill (beside the
      // initials, inside the circle) and the widest edges' midpoints, from Cytoscape's own rendered positions; the
      // pixels there must be the colour Cytoscape computed for that element, not the page behind it.
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
          const k = first.width / first.clientWidth; // device pixels per CSS pixel
          const copy = document.createElement("canvas");
          [copy.width, copy.height] = [first.width, first.height];
          const ctx = copy.getContext("2d", { willReadFrequently: true }) as CanvasRenderingContext2D;
          for (const c of layers) ctx.drawImage(c, 0, 0);
          const rgb = (s: string) => (s.match(/\d+/g) ?? []).slice(0, 3).map(Number);
          /** Whether a 5 x 5 device-pixel window at (x, y) CSS px holds a pixel within 48 of `want` in every channel. */
          const holds = (x: number, y: number, want: number[]) => {
            const px = ctx.getImageData(Math.round(x * k) - 2, Math.round(y * k) - 2, 5, 5).data;
            for (let i = 0; i < px.length; i += 4)
              if ([0, 1, 2].every((c) => Math.abs((px[i + c] as number) - (want[c] as number)) <= 48))
                return true;
            return false;
          };
          const out: string[] = [];
          const nodes = cy.nodes().toArray();
          for (const n of nodes.slice(0, 5)) {
            const p = n.renderedPosition();
            const fill = rgb(n.style("background-color"));
            // below the initials, still inside the circle
            if (!holds(p.x, p.y + 0.35 * n.renderedWidth(), fill))
              out.push(`node ${n.id()}: no ${fill} drawn there`);
          }
          const edges = cy
            .edges()
            .toArray()
            .sort((a, b) => b.data("width") - a.data("width"));
          for (const e of edges.slice(0, 3)) {
            const m = e.renderedMidpoint();
            const line = rgb(e.style("line-color"));
            if (!holds(m.x, m.y, line)) out.push(`edge ${e.id()}: no ${line} drawn at its midpoint`);
          }
          return nodes.length > 0 && edges.length > 0 ? out.join("; ") : "no nodes or edges";
        });
        expect(marks, "each sampled node and edge is drawn in its colour where Cytoscape placed it").toBe("");
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
