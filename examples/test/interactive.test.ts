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
    if (lib === "chartjs") {
      const painted = await figure.locator("canvas").evaluate((c: HTMLCanvasElement) =>
        c
          .getContext("2d")
          ?.getImageData(0, 0, c.width, c.height)
          .data.some((v, i) => i % 4 === 3 && v > 0),
      );
      expect(painted, "the canvas is painted").toBe(true);
    }
    // an accessible name: Vega names each mark in its SVG (sdvplot's images too); the others name the chart
    const named =
      lib === "vega"
        ? figure.locator('svg.marks [role="graphics-symbol"][aria-label]')
        : figure.locator('.sdv-live-output [role="img"][aria-label]');
    expect(await named.count(), "an accessible name").toBeGreaterThan(0);
    if (SHOTS !== undefined)
      await figure
        .locator(".sdv-live-output")
        .screenshot({ path: join(SHOTS, `${id.replace(/\//g, "_")}.png`) });
    expect(errors).toEqual([]);
    await page.close();
  });
});
