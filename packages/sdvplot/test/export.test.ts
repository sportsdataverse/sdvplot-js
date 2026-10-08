// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { inflateSync } from "node:zlib";
import * as Plot from "@observablehq/plot";
import { afterEach, beforeAll, describe, expect, test, vi } from "vitest";
import {
  DownloadError,
  InputError,
  OptionalDependencyError,
  resetWarnings,
  setWarningHandler,
} from "../src/errors.js";
import {
  canvasFor,
  checkColor,
  offsetFor,
  parseAspect,
  parseGravity,
  socialCard,
  svgSize,
  toPNG,
} from "../src/export/index.js";
import { loadLeague } from "../src/index.js";
import { logos } from "../src/plot/index.js";

const png = (b: Uint8Array): { width: number; height: number } => {
  const dv = new DataView(b.buffer, b.byteOffset, b.byteLength);
  return { width: dv.getUint32(16), height: dv.getUint32(20) };
};
/** RGBA pixels of a resvg PNG (8-bit RGBA, non-interlaced): just enough PNG to look inside a logo's box. */
const pixels = (b: Uint8Array) => {
  const buf = Buffer.from(b);
  const w = buf.readUInt32BE(16);
  const h = buf.readUInt32BE(20);
  expect([buf[24], buf[25], buf[28]]).toEqual([8, 6, 0]); // bit depth 8, RGBA, not interlaced
  const idat: Buffer[] = [];
  for (let o = 8; o < buf.length; o += 12 + buf.readUInt32BE(o))
    if (buf.toString("latin1", o + 4, o + 8) === "IDAT")
      idat.push(buf.subarray(o + 8, o + 8 + buf.readUInt32BE(o)));
  const raw = inflateSync(Buffer.concat(idat));
  const s = w * 4;
  const px = Buffer.alloc(h * s);
  for (let y = 0; y < h; y++) {
    const f = raw[y * (s + 1)];
    for (let i = 0; i < s; i++) {
      const a = i >= 4 ? px[y * s + i - 4]! : 0;
      const u = y > 0 ? px[(y - 1) * s + i]! : 0;
      const c = y > 0 && i >= 4 ? px[(y - 1) * s + i - 4]! : 0;
      const pa = Math.abs(u - c);
      const pb = Math.abs(a - c);
      const pc = Math.abs(a + u - 2 * c);
      const paeth = pa <= pb && pa <= pc ? a : pb <= pc ? u : c;
      const pred = f === 1 ? a : f === 2 ? u : f === 3 ? (a + u) >> 1 : f === 4 ? paeth : 0;
      px[y * s + i] = (raw[y * (s + 1) + 1 + i]! + pred) & 255;
    }
  }
  const at = (x: number, y: number): number[] => [...px.subarray((y * w + x) * 4, (y * w + x) * 4 + 4)];
  return { w, h, at };
};
/** Share of pixels inside the inner 60% of `box` that are not plain white. */
const inked = (b: Uint8Array, box: { x: number; y: number; width: number; height: number }): number => {
  const { at } = pixels(b);
  let n = 0;
  let hit = 0;
  for (let y = Math.ceil(box.y + 0.2 * box.height); y < box.y + 0.8 * box.height; y++)
    for (let x = Math.ceil(box.x + 0.2 * box.width); x < box.x + 0.8 * box.width; x++) {
      n++;
      if (
        at(x, y)
          .slice(0, 3)
          .some((v) => v < 245)
      )
        hit++;
    }
  return hit / n;
};
const fixture = (name: string): Uint8Array<ArrayBuffer> =>
  // jsdom runs this file in vite web mode, where import.meta.url is a /@fs/ URL; __dirname stays a real path
  new Uint8Array(readFileSync(join(__dirname, "../../../fixtures/sdvplot/logos", name)));
const NYG = fixture("62e361850e7ba3a50dfd09cbb38429e994d1c23b0f999c74421f10e37c7067e7.png");
const MTL = fixture("1ecd86fe8f7cdf0c3e19b040525786210e3aab8ffad67ef5b6c39b4b23516eaa.svg");
/** A real Plot scatter of one team's logo, mid-frame (away from the axes), plus the drawn image's box. */
const logoScatter = (league: "nfl" | "nhl", team: string) => {
  const fig = Plot.plot({
    width: 640,
    height: 400,
    x: { domain: [0, 2] },
    y: { domain: [0, 2] },
    marks: [logos([{ x: 1, y: 1, team }], { league, x: "x", y: "y", team: "team", height: 0.3 })],
  });
  const img = fig.querySelector("image") as Element;
  const t = /translate\(([-\d.]+)[ ,]+([-\d.]+)\)/.exec(img.parentElement?.getAttribute("transform") ?? "");
  const n = (k: string) => Number(img.getAttribute(k));
  const box = {
    x: n("x") + Number(t?.[1] ?? 0),
    y: n("y") + Number(t?.[2] ?? 0),
    width: n("width"),
    height: n("height"),
  };
  return { fig, href: img.getAttribute("href") as string, box };
};
const serve = (body: Uint8Array<ArrayBuffer>, type: string) =>
  vi.fn(async (_url: string) => new Response(body, { status: 200, headers: { "content-type": type } }));
beforeAll(async () => {
  await loadLeague("nfl");
  await loadLeague("nhl");
});
afterEach(() => {
  vi.unstubAllGlobals();
  setWarningHandler(null);
  resetWarnings();
});
const sized = `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="300" viewBox="0 0 300 300"><rect width="300" height="300" fill="red"/></svg>`;
const vbOnly = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 480"><circle cx="320" cy="240" r="100"/></svg>`;

describe("pure helpers", () => {
  test("parseAspect mirrors Python _ratio", () => {
    expect(parseAspect("16:9")).toBeCloseTo(16 / 9);
    expect(parseAspect("4x5")).toBe(0.8);
    expect(parseAspect(1.91)).toBe(1.91);
    expect(parseAspect("1.91")).toBe(1.91); // Python float("1.91"); R as.numeric("1.91")
    for (const bad of ["abc", "1:0", "1:2:3", "", 0, -1, Number.NaN])
      expect(() => parseAspect(bad as never)).toThrow(InputError);
  });
  test("parseAspect reads digit underscores as Python float() does (sdvplot .venv, _ratio)", () => {
    const python: [string, number | null][] = [
      ["1_0", 10],
      ["1__0", null],
      ["_10", null],
      ["10_", null],
      ["1_0.5", 10.5],
      ["1.0_5", 1.05],
      ["1e1_0", 1e10],
      ["1_.5", null],
      ["1._5", null],
      ["16:9_0", 16 / 90],
      ["1_6:9", 16 / 9],
      ["1_6x9", 16 / 9],
      ["_1:2", null],
      ["1:2_", null],
      [" 1_0 ", 10],
      ["1_000", 1000],
    ];
    for (const [a, want] of python) {
      if (want === null) expect(() => parseAspect(a), a).toThrow(InputError);
      else expect(parseAspect(a), a).toBeCloseTo(want, 12);
    }
  });
  test("canvasFor grows the short side", () => {
    expect(canvasFor(420, 420, 16 / 9)).toEqual([747, 420]);
    expect(canvasFor(420, 420, 0.8)).toEqual([420, 525]);
    expect(canvasFor(1000, 500, 2)).toEqual([1000, 500]);
    expect(canvasFor(5, 1, 2)).toEqual([5, 2]); // round(2.5) is 2 in Python and R (half to even), not 3
  });
  test("offsetFor follows gravity", () => {
    expect(offsetFor(100, 50, "center")).toEqual([50, 25]);
    expect(offsetFor(100, 50, "northwest")).toEqual([0, 0]);
    expect(offsetFor(100, 50, "southeast")).toEqual([100, 50]);
    expect(offsetFor(100, 50, "north")).toEqual([50, 0]);
    expect(parseGravity("NorthWest")).toBe("northwest"); // Python _check_gravity lower-cases
    expect(() => parseGravity("centre")).toThrow(InputError);
  });
  test("svgSize: width/height attrs, else viewBox (Review Focus 4)", () => {
    expect(svgSize(sized)).toEqual({ width: 300, height: 300, viewBox: "0 0 300 300" });
    expect(svgSize(vbOnly)).toEqual({ width: 640, height: 480, viewBox: "0 0 640 480" });
    expect(() => svgSize("<div/>")).toThrow(InputError);
    expect(() => svgSize("<svg></svg>")).toThrow(InputError);
  });
  test("svgSize: percent (or other relative) sizes fall back to the viewBox", () => {
    const pct = `<svg width="100%" height="100%" viewBox="0 0 800 400"></svg>`;
    expect(svgSize(pct)).toEqual({ width: 800, height: 400, viewBox: "0 0 800 400" });
    expect(svgSize(`<svg width="50%" height="2em" viewBox="0 0 640 480"></svg>`)).toMatchObject({
      width: 640,
      height: 480,
    });
    expect(svgSize(`<svg width="300px" height="200" viewBox="0 0 640 480"></svg>`)).toMatchObject({
      width: 300,
      height: 200,
    });
    expect(() => svgSize(`<svg width="100%" height="100%"></svg>`)).toThrow(InputError);
  });
  test("checkColor: modern rgb()/hsl() with a slash alpha; still no quote, bracket, semicolon or equals", () => {
    for (const ok of ["rgb(0 0 0 / 50%)", "hsl(210 40% 20% / 0.5)", "#0C0D10", "white", "rgba(1, 2, 3, 0.5)"])
      expect(checkColor("c", ok)).toBe(ok);
    for (const bad of ['red"', "red'", "<b>", "a>b", "red;x", "a=b", "red\nx"])
      expect(() => checkColor("c", bad), bad).toThrow(InputError);
  });
});

describe("socialCard", () => {
  test("1:1 with default padding 60 frames a 300x300 figure on a 420x420 canvas, centered", () => {
    const out = socialCard(sized);
    expect(out).toContain(
      `<svg xmlns="http://www.w3.org/2000/svg" width="420" height="420" viewBox="0 0 420 420">`,
    );
    expect(out).toContain(`<rect width="420" height="420" fill="white"/>`);
    expect(out).toContain(`<svg x="60" y="60" width="300" height="300" viewBox="0 0 300 300"`);
    expect(out).not.toContain("NaN");
    expect(socialCard(sized, { padding: 60.9 })).toContain(`width="420" height="420"`); // Python _pixels: int()
  });
  test("16:9 widens, 4:5 heightens, gravity northwest pins the padded box", () => {
    expect(socialCard(sized, { aspect: "16:9" })).toContain(`width="747" height="420"`);
    expect(socialCard(sized, { aspect: "4:5", background: "#0C0D10" })).toContain(
      `width="420" height="525" viewBox="0 0 420 525"><rect width="420" height="525" fill="#0C0D10"/>`,
    );
    expect(socialCard(sized, { aspect: "16:9", gravity: "northwest" })).toContain(`<svg x="60" y="60"`);
    expect(socialCard(sized, { aspect: "16:9", gravity: "center" })).toContain(`<svg x="223" y="60"`);
  });
  test("viewBox-only input gets explicit size and keeps its content", () => {
    const out = socialCard(vbOnly, { padding: 0 });
    expect(out).toContain(`<svg x="0" y="80" width="640" height="480" viewBox="0 0 640 480"`); // 1:1 canvas 640x640, centered
    expect(out).toContain(`<circle cx="320"`);
    expect(() => socialCard(sized, { padding: -1 })).toThrow(InputError);
    expect(() => socialCard(sized, { background: '"/><script>' })).toThrow(InputError);
    expect(() => socialCard(sized, { gravity: "centre" as never })).toThrow(InputError);
  });
  test("root attributes holding $&, $' or $` are copied literally, not as replacement patterns", () => {
    const tricky = `<svg xmlns="http://www.w3.org/2000/svg" data-t="a$&b" data-u="c$'d" data-v="e$\`f" width="10" height="10"><rect width="10" height="10"/></svg>`;
    const out = socialCard(tricky, { padding: 0 });
    expect(out).toContain(`data-t="a$&b" data-u="c$'d" data-v="e$\`f"`);
    expect(out.match(/<svg/g)).toHaveLength(2);
    expect(out.endsWith('<rect width="10" height="10"/></svg></svg>')).toBe(true);
  });
  test("the card root carries a color that contrasts with a hex background (Plot axes use currentColor)", () => {
    expect(socialCard(sized, { background: "#0C0D10" })).toMatch(/^<svg [^>]*color="#ffffff"/);
    expect(socialCard(sized, { background: "#f5f5f5" })).toMatch(/^<svg [^>]*color="#000000"/);
    expect(socialCard(sized, { background: "#0C0D10", color: "red" })).toMatch(/^<svg [^>]*color="red"/);
    expect(() => socialCard(sized, { color: '"/><x' })).toThrow(InputError);
  });
});

describe("toPNG", () => {
  test("renders via resvg at width × scale", async () => {
    const out = await toPNG(sized, { width: 100, scale: 2 });
    expect(Array.from(out.slice(0, 4))).toEqual([0x89, 0x50, 0x4e, 0x47]);
    expect(png(out)).toEqual({ width: 200, height: 200 });
    expect(png(await toPNG(socialCard(sized, { aspect: "16:9" }))).width).toBe(747);
  });
  test("a real Plot figure (HTML-serialized, no xmlns) renders, as the element and as its outerHTML", async () => {
    const fig = Plot.plot({
      width: 640,
      height: 400,
      marks: [
        Plot.dot(
          [
            { x: 1, y: 2 },
            { x: 3, y: 1 },
          ],
          { x: "x", y: "y" },
        ),
        Plot.frame(),
      ],
    });
    expect(fig.outerHTML).toMatch(/^<svg (?![^>]*xmlns=)[^>]*>/); // the bug's precondition: Plot's root has no xmlns
    for (const input of [fig, fig.outerHTML]) {
      const out = await toPNG(input);
      expect(Array.from(out.slice(0, 4))).toEqual([0x89, 0x50, 0x4e, 0x47]);
      expect(png(out)).toEqual({ width: 640, height: 400 });
    }
  });
  test("an undeclared xlink: prefix gets its namespace", async () => {
    const href = `data:image/png;base64,${Buffer.from(NYG).toString("base64")}`;
    const svg = `<svg width="100" height="100"><image xlink:href="${href}" width="100" height="100"/></svg>`;
    const out = await toPNG(svg, { background: "white" });
    expect(inked(out, { x: 0, y: 0, width: 100, height: 100 })).toBeGreaterThan(0.1);
  });
  test("currentColor follows a contrasting root color: on a dark background the Plot axes are light", async () => {
    const fig = Plot.plot({
      width: 320,
      height: 200,
      marks: [Plot.dot([{ x: 1, y: 2 }], { x: "x", y: "y" })],
    });
    const light = (b: Uint8Array) => {
      const { w, h, at } = pixels(b);
      let n = 0;
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (at(x, y)[0]! > 160) n++;
      return n;
    };
    expect(light(await toPNG(fig, { background: "#0C0D10" }))).toBeGreaterThan(100);
    const swatch = (o: object) =>
      toPNG(`<svg width="4" height="4"><rect width="4" height="4" fill="currentColor"/></svg>`, o);
    expect(pixels(await swatch({ background: "navy" })).at(1, 1)).toEqual([255, 255, 255, 255]); // a named dark color
    expect(pixels(await swatch({ background: "#f5f5f5" })).at(1, 1)).toEqual([0, 0, 0, 255]);
    expect(pixels(await swatch({ background: "navy", color: "rgb(255 0 0)" })).at(1, 1)).toEqual([
      255, 0, 0, 255,
    ]);
    const own = `<svg width="4" height="4" color="lime"><rect width="4" height="4" fill="currentColor"/></svg>`;
    expect(pixels(await toPNG(own, { background: "navy" })).at(1, 1)).toEqual([0, 255, 0, 255]); // the figure's own color stays
    await expect(toPNG(own, { color: "red;x" })).rejects.toThrow(InputError);
  });
});

describe("toPNG remote images", () => {
  test("a logos scatter's remote PNG is fetched and drawn inside the logo's box", async () => {
    const { fig, href, box } = logoScatter("nfl", "NYG");
    expect(href).toBe(
      "https://sdv.nyc3.cdn.digitaloceanspaces.com/assets/public/sha256/62/62e361850e7ba3a50dfd09cbb38429e994d1c23b0f999c74421f10e37c7067e7.png",
    );
    const fetch = serve(NYG, "image/png");
    vi.stubGlobal("fetch", fetch);
    const out = await toPNG(fig, { background: "white" });
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch.mock.calls[0]![0]).toBe(href);
    expect(inked(out, box)).toBeGreaterThan(0.1);
    expect(pixels(out).at(5, 5)).toEqual([255, 255, 255, 255]); // outside the logo: background
  });
  test("an SVG logo (MTL, nhl) is inlined too; a repeated href is fetched once", async () => {
    const { fig, box } = logoScatter("nhl", "MTL");
    const twice = Plot.plot({
      width: 640,
      height: 400,
      x: { domain: [0, 2] },
      y: { domain: [0, 2] },
      marks: [
        logos(
          [
            { x: 1, y: 1, team: "MTL" },
            { x: 1.8, y: 1.8, team: "MTL" },
          ],
          { league: "nhl", x: "x", y: "y", team: "team", height: 0.3 },
        ),
      ],
    });
    const fetch = serve(MTL, "image/svg+xml");
    vi.stubGlobal("fetch", fetch);
    expect(inked(await toPNG(fig, { background: "white" }), box)).toBeGreaterThan(0.1);
    fetch.mockClear();
    expect(inked(await toPNG(twice, { background: "white" }), box)).toBeGreaterThan(0.1);
    expect(fetch).toHaveBeenCalledTimes(1);
  });
  test("a 404 or a network failure throws DownloadError naming the url", async () => {
    const { fig, href } = logoScatter("nfl", "NYG");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("gone", { status: 404 })),
    );
    await expect(toPNG(fig)).rejects.toSatisfy(
      (e: unknown) => e instanceof DownloadError && e.url === href && e.status === 404,
    );
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new TypeError("fetch failed");
      }),
    );
    await expect(toPNG(fig)).rejects.toSatisfy(
      (e: unknown) => e instanceof DownloadError && e.url === href && e.status === undefined,
    );
  });
  test('images: "skip" draws no logo, fetches nothing and warns once listing the hrefs', async () => {
    const { fig, href, box } = logoScatter("nfl", "NYG");
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    const warned: string[] = [];
    resetWarnings();
    setWarningHandler((m) => warned.push(m));
    const out = await toPNG(fig, { background: "white", images: "skip" });
    await toPNG(fig, { background: "white", images: "skip" });
    expect(fetch).not.toHaveBeenCalled();
    expect(inked(out, box)).toBe(0);
    expect(warned).toHaveLength(1);
    expect(warned[0]).toContain(href);
    await expect(toPNG(fig, { images: "inline" as never })).rejects.toThrow(InputError);
  });
});

describe("toPNG optional peer", () => {
  // vitest wraps a throwing mock factory's error (the original becomes `cause`), as other loaders may
  const failWith = async (boom: Error): Promise<Error & { cause?: unknown }> => {
    vi.doMock("@resvg/resvg-js", () => {
      throw boom;
    });
    vi.resetModules();
    const { toPNG: fresh } = await import("../src/export/index.js");
    const err = await fresh(sized).catch((e: Error) => e);
    vi.doUnmock("@resvg/resvg-js");
    return err as Error & { cause?: unknown };
  };
  const chain = (e: unknown): unknown[] => (e instanceof Error ? [e, ...chain(e.cause)] : []);
  test("missing peer → OptionalDependencyError naming the install command", async () => {
    const boom = Object.assign(
      new Error("Cannot find package '@resvg/resvg-js' imported from /x/export.js"),
      {
        code: "ERR_MODULE_NOT_FOUND",
      },
    );
    const err = await failWith(boom);
    // resetModules re-evaluates errors.ts too, so match the class by name, not by the top-level import's identity
    expect(err.name).toBe(OptionalDependencyError.name);
    expect(err.message).toMatch(/not installed.*pnpm add @resvg\/resvg-js/);
    expect(chain(err.cause)).toContain(boom);
  });
  test("an installed peer that fails to load (native binding) keeps its error as the cause", async () => {
    for (const boom of [
      new Error("Failed to load native binding"),
      Object.assign(new Error("Cannot find module '@resvg/resvg-js-linux-x64-musl'"), {
        code: "MODULE_NOT_FOUND",
      }),
    ]) {
      const err = await failWith(boom);
      expect(err.name).toBe(OptionalDependencyError.name);
      expect(err.message).not.toMatch(/not installed/);
      expect(err.message).toMatch(/failed to load/);
      expect(chain(err.cause)).toContain(boom);
    }
  });
});
