import { readFileSync } from "node:fs";
import { mkdtemp, readFile, readdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { inflateSync } from "node:zlib";
import { InputError, OptionalDependencyError, SdvplotError } from "@sportsdataverse/sdvplot";
import { afterEach, describe, expect, test, vi } from "vitest";
import { defineTable } from "../src/define.js";
import { batchToPNG, gridTables, htmlToPNG, socialCrop, tableToPNG } from "../src/export/index.js";
import { many, rows, spec } from "./fixtures/engine.js";
import type { Standing } from "./fixtures/standings.js";

const dims = (b: Uint8Array): { width: number; height: number } => {
  const dv = new DataView(b.buffer, b.byteOffset, b.byteLength);
  return { width: dv.getUint32(16), height: dv.getUint32(20) };
};
/** Plain background on each side of a PNG (8-bit RGB or RGBA, not interlaced, as Chromium writes): its margins in pixels. */
const margins = (b: Uint8Array, bg: readonly number[] = [255, 255, 255]) => {
  const buf = Buffer.from(b);
  const w = buf.readUInt32BE(16);
  const h = buf.readUInt32BE(20);
  expect([buf[24], buf[28]]).toEqual([8, 0]);
  const n = buf[25] === 2 ? 3 : 4;
  const idat: Buffer[] = [];
  for (let o = 8; o < buf.length; o += 12 + buf.readUInt32BE(o))
    if (buf.toString("latin1", o + 4, o + 8) === "IDAT")
      idat.push(buf.subarray(o + 8, o + 8 + buf.readUInt32BE(o)));
  const raw = inflateSync(Buffer.concat(idat));
  const s = w * n;
  const px = Buffer.alloc(h * s);
  for (let y = 0; y < h; y++) {
    const f = raw[y * (s + 1)];
    for (let i = 0; i < s; i++) {
      const a = i >= n ? (px[y * s + i - n] as number) : 0;
      const u = y > 0 ? (px[(y - 1) * s + i] as number) : 0;
      const c = y > 0 && i >= n ? (px[(y - 1) * s + i - n] as number) : 0;
      const pa = Math.abs(u - c);
      const pb = Math.abs(a - c);
      const pc = Math.abs(a + u - 2 * c);
      const paeth = pa <= pb && pa <= pc ? a : pb <= pc ? u : c;
      const pred = f === 1 ? a : f === 2 ? u : f === 3 ? (a + u) >> 1 : f === 4 ? paeth : 0;
      px[y * s + i] = ((raw[y * (s + 1) + 1 + i] as number) + pred) & 255;
    }
  }
  let [left, top, right, bottom] = [w, h, -1, -1];
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++)
      if (bg.some((v, k) => px[y * s + x * n + k] !== v)) {
        left = Math.min(left, x);
        right = Math.max(right, x);
        top = Math.min(top, y);
        bottom = Math.max(bottom, y);
      }
  return { left, top, right: w - 1 - right, bottom: h - 1 - bottom };
};

test("argument checks need no browser", async () => {
  await expect(tableToPNG(spec, rows, { whitespace: -1 })).rejects.toThrow(InputError);
  await expect(tableToPNG(spec, rows, { deviceScaleFactor: 0 })).rejects.toThrow(InputError);
  await expect(socialCrop(spec, rows, { aspect: "0:1" })).rejects.toThrow(InputError);
  await expect(
    batchToPNG(rows, "team", (r) => ({ spec, rows: r }), "no-token.png", { dir: "." }),
  ).rejects.toThrow(InputError);
  await expect(socialCrop(spec, rows, { gravity: "centre" as never })).rejects.toThrow(InputError);
  await expect(tableToPNG(spec, rows, { file: "standings.jpg" })).rejects.toThrow(InputError);
  await expect(tableToPNG(spec, rows, { background: "red;}</style><script>" })).rejects.toThrow(InputError);
  // two group values that slug to one file name ("North / East", "north-east") fail before any browser starts
  const clash = [
    { ...(rows[0] as Standing), division: "North / East" },
    { ...(rows[1] as Standing), division: "north-east" },
  ];
  await expect(
    batchToPNG(clash, "division", (r) => ({ spec, rows: r }), "d-{group}.png", { dir: "." }),
  ).rejects.toThrow(/same file name: d-north-east\.png/);
});

describe("without a browser (a stand-in playwright)", () => {
  const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47]);
  afterEach(() => {
    vi.doUnmock("playwright");
    vi.restoreAllMocks();
  });
  /**
   * A stand-in playwright: each page records its HTML, deviceScaleFactor and the canvases it draws. `box` is the
   * content's CSS size, `trim` the in-page trim box, `drawn` what the in-page canvas encodes ("" for Chromium's "data:,").
   */
  const stub = (
    onLaunch?: () => void,
    {
      box = { width: 300.5, height: 100 },
      trim = [5, 5, 300, 100],
      drawn = "iVBORw==",
    }: { box?: { width: number; height: number }; trim?: number[]; drawn?: string } = {},
  ) => {
    const pages: { html: string; scale: number; draws: Record<string, unknown>[] }[] = [];
    const browser = {
      newPage: async (o?: { deviceScaleFactor?: number }) => {
        const rec = { html: "", scale: o?.deviceScaleFactor ?? 1, draws: [] as Record<string, unknown>[] };
        pages.push(rec);
        return {
          setContent: async (html: string) => {
            rec.html = html;
          },
          // the in-page steps: every shot trims to `trim` (300 x 100 at (5, 5)); a drawing is recorded
          evaluate: async (fn: { name: string }, arg: Record<string, unknown>) => {
            if (fn.name === "trimBox") return trim;
            if (fn.name === "drawPNG") {
              rec.draws.push(arg);
              return drawn;
            }
            return undefined;
          },
          locator: () => ({
            boundingBox: async () => ({ x: 0, y: 0, ...box }),
            screenshot: async () => PNG,
          }),
          setViewportSize: async () => undefined,
          close: async () => undefined,
        };
      },
      close: async () => undefined,
    };
    vi.doMock("playwright", () => ({
      chromium: {
        launch: async () => {
          onLaunch?.();
          return browser;
        },
      },
    }));
    return pages;
  };
  // resetModules re-evaluates sdvplot's errors too: classes are matched by name, warnings caught on console.warn
  const fresh = () => {
    vi.resetModules();
    return import("../src/export/index.js");
  };
  const chain = (e: unknown): unknown[] => (e instanceof Error ? [e, ...chain(e.cause)] : []);
  const rejection = (p: Promise<unknown>): Promise<Error> =>
    p.then(
      () => {
        throw new Error("expected a rejection");
      },
      (e: Error) => e,
    );
  test("a missing playwright names the peer; a broken install keeps its own error as the cause", async () => {
    const failWith = async (boom: Error): Promise<Error> => {
      vi.doMock("playwright", () => {
        throw boom;
      });
      const { htmlToPNG: render } = await fresh();
      return rejection(render("<p>x</p>"));
    };
    const missing = Object.assign(new Error("Cannot find package 'playwright' imported from /x/export.js"), {
      code: "ERR_MODULE_NOT_FOUND",
    });
    const err = await failWith(missing);
    expect(err.name).toBe(OptionalDependencyError.name);
    expect(err.message).toMatch(/not installed.*pnpm add -D playwright/);
    expect(chain(err.cause)).toContain(missing);
    for (const boom of [
      new Error("Unexpected token in playwright-core"),
      Object.assign(new Error("Cannot find module 'playwright-core/lib/server'"), {
        code: "MODULE_NOT_FOUND",
      }),
    ]) {
      const broken = await failWith(boom);
      expect(broken.name).toBe(OptionalDependencyError.name);
      expect(broken.message).not.toMatch(/not installed/);
      expect(broken.message).toMatch(/failed to load/);
      expect(chain(broken.cause)).toContain(boom);
    }
  });
  test("no chromium binary: its own install hint, Playwright's error kept as the cause", async () => {
    const boom = new Error(
      "browserType.launch: Executable doesn't exist at /home/u/.cache/ms-playwright/chromium-1248/chrome-linux/chrome\nLooks like Playwright was just installed or updated.",
    );
    stub(() => {
      throw boom;
    });
    const err = await rejection((await fresh()).htmlToPNG("<p>x</p>"));
    expect(err.name).toBe(OptionalDependencyError.name);
    expect(err.message).toMatch(/pnpm exec playwright install chromium/);
    expect(err.cause).toBe(boom);
    // any other launch failure is not an install problem: it propagates as it is
    const other = new Error("Browser closed unexpectedly");
    stub(() => {
      throw other;
    });
    expect(await rejection((await fresh()).htmlToPNG("<p>x</p>"))).toBe(other);
  });
  test("fontLinks are escaped into <link href>", async () => {
    const pages = stub();
    await (await fresh()).htmlToPNG("<p>x</p>", {
      fontLinks: ['https://fonts.test/css?family=A&display=swap"><script>alert(1)</script>'],
    });
    const html = pages[0]?.html ?? "";
    expect(html).toContain(
      '<link rel="stylesheet" href="https://fonts.test/css?family=A&amp;display=swap&quot;&gt;&lt;script&gt;alert(1)&lt;/script&gt;">',
    );
    expect(html).not.toContain("<script>");
  });
  test("Python's steps in image pixels: trim, pad by whitespace, social canvas, then scale to `width`", async () => {
    const pages = stub();
    const { htmlToPNG: render, socialCrop: social } = await fresh();
    const drawn = () => pages.at(-1)?.draws.at(-1);
    // the 300 x 100 trimmed content with 50 px (default) each side, at any zoom
    await render("<p>x</p>");
    expect(drawn()).toMatchObject({
      trim: [5, 5, 300, 100],
      w: 400,
      h: 200,
      dx: 50,
      dy: 50,
      fw: 400,
      fh: 200,
    });
    await render("<p>x</p>", { whitespace: 30.9, deviceScaleFactor: 3 }); // Python _pixels: int()
    expect(drawn()).toMatchObject({ w: 360, h: 160, dx: 30, dy: 30, fw: 360, fh: 160 });
    // gt_social_crop: 60 px, then a 1:1 canvas of the padded 420 x 220, centred
    await social(spec, rows);
    expect(drawn()).toMatchObject({ w: 420, h: 420, dx: 60, dy: 160 });
    await social(spec, rows, { aspect: "16:9", gravity: "southeast" });
    expect(drawn()).toMatchObject({ w: 420, h: 236, dx: 60, dy: 76 });
    // _fit_width: the finished image scaled to `width`, the height rounded half up (200 * 903 / 400 = 451.5)
    await render("<p>x</p>", { width: 903 });
    expect(drawn()).toMatchObject({ w: 400, h: 200, fw: 903, fh: 452 });
  });
  test("I1: past Chromium's canvas limit (65,535 px a side, 268,435,456 in all) it throws, naming the size; no file is written", async () => {
    const dir = await mkdtemp(join(tmpdir(), "sdvt-limit-"));
    const file = join(dir, "t.png");
    // a page 352 x 39,727.5 CSS px (as 1,200 two-column rows measure) is 704 x 79,455 image px at zoom 2
    let pages = stub(undefined, { box: { width: 352, height: 39_727.5 } });
    let err = await rejection((await fresh()).htmlToPNG("<p>x</p>", { file }));
    expect(err.name).toBe(SdvplotError.name);
    expect(err.message).toMatch(/704 × 79,455 px at deviceScaleFactor 2/);
    expect(err.message).toMatch(/fewer rows in each image/);
    expect(pages[0]?.draws).toEqual([]); // stopped before the screenshot and any canvas
    // the trimmed table fits, but a 1:1 social canvas around it would be 40,120 px square: 1.6e9 px in all
    pages = stub(undefined, { box: { width: 600, height: 40_000 }, trim: [0, 0, 600, 40_000] });
    err = await rejection((await fresh()).socialCrop(spec, rows, { deviceScaleFactor: 1, file }));
    expect(err.name).toBe(SdvplotError.name);
    expect(err.message).toMatch(/40,120 × 40,120 px at deviceScaleFactor 1/);
    expect(pages[0]?.draws).toEqual([]);
    // any canvas Chromium still refuses encodes as "data:,", i.e. no base64 at all
    pages = stub(undefined, { drawn: "" });
    err = await rejection((await fresh()).htmlToPNG("<p>x</p>", { file }));
    expect(err.name).toBe(SdvplotError.name);
    expect(err.message).toMatch(/Chromium returned an empty image for 400 × 200 px/);
    expect(await readdir(dir)).toEqual([]); // never a 0-byte file
  });
  test("batchToPNG skips a group that fails to build and names it in one warning (Python gt_save_batch)", async () => {
    stub();
    const { batchToPNG: batch } = await fresh();
    const warned = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const dir = await mkdtemp(join(tmpdir(), "sdvt-skip-"));
    const files = await batch(
      rows,
      "wins",
      (r, v) => {
        if (v === 10 || v === 4) throw new Error(`no table for ${v}`);
        return { spec, rows: r };
      },
      "w-{group}.png",
      { dir },
    );
    expect(files.map((f) => basename(f)).sort()).toEqual([
      "w-11.png",
      "w-13.png",
      "w-15.png",
      "w-5.png",
      "w-8.png",
    ]);
    expect(warned).toHaveBeenCalledTimes(1);
    const message = String(warned.mock.calls[0]?.[0]);
    expect(message).toMatch(/2 group\(s\) failed and were skipped/);
    expect(message).toContain("10: no table for 10");
    expect(message).toContain("4: no table for 4");
    // nothing built: one error naming every failure
    await expect(
      batch(
        rows,
        "wins",
        () => {
          throw new Error("nope");
        },
        "x-{group}.png",
        { dir },
      ),
    ).rejects.toThrow(/No group built successfully:\n\d+: nope/);
  });
});

describe.skipIf(!process.env.SDV_RENDER_TESTS)("playwright rendering (SDV_RENDER_TESTS=1)", () => {
  test("tableToPNG returns a PNG at deviceScaleFactor 2 and writes `file`", async () => {
    const dir = await mkdtemp(join(tmpdir(), "sdvt-"));
    const file = join(dir, "t.png");
    const out = await tableToPNG(spec, rows, { file });
    expect(Array.from(out.slice(0, 4))).toEqual([0x89, 0x50, 0x4e, 0x47]);
    expect(dims(out).width).toBeGreaterThan(400);
    expect((await readFile(file)).length).toBe(out.length);
  }, 60_000);
  test("I1: 1,200 real rows at zoom 2 pass Chromium's 65,535 px canvas side: a named error, no file; zoom 1 fits", async () => {
    // real resolver inputs from the sdvplot oracle (fixtures/sdvplot/inputs.json), the first 1,200 of 8,403
    type Input = { league: string; value: string; id_system: string };
    const inputs = JSON.parse(
      readFileSync(new URL("../../../fixtures/sdvplot/inputs.json", import.meta.url), "utf8"),
    ) as Input[];
    const tall = inputs.slice(0, 1200);
    const s = defineTable<Input>()
      .columns((c) => [c.text("league"), c.text("value", { label: "Team" }), c.text("id_system")])
      .build();
    const dir = await mkdtemp(join(tmpdir(), "sdvt-tall-"));
    await expect(tableToPNG(s, tall, { file: join(dir, "tall.png") })).rejects.toThrow(
      /^the table renders \d{3,4} × \d{2},\d{3} px at deviceScaleFactor 2, past Chromium's canvas limit/,
    );
    expect(await readdir(dir)).toEqual([]);
    const half = dims(await tableToPNG(s, tall, { deviceScaleFactor: 1 })); // the remedy the message names
    expect(half.height).toBeGreaterThan(30_000);
    expect(half.height).toBeLessThanOrEqual(65_535);
  }, 120_000);
  test("socialCrop 1:1 is square; 16:9 is wider than tall", async () => {
    const sq = dims(await socialCrop(spec, rows, { aspect: "1:1" }));
    expect(sq.width).toBe(sq.height);
    const wide = dims(
      await socialCrop(spec, rows, { aspect: "16:9", gravity: "northwest", background: "#0C0D10" }),
    );
    expect(wide.width / wide.height).toBeCloseTo(16 / 9, 1);
  }, 60_000);
  test("margins are image pixels, as Python pads after the zoom-2 render: 50 by default, 60 social", async () => {
    for (const [o, ws] of [
      [{}, 50],
      [{ whitespace: 30 }, 30],
      [{ whitespace: 45, deviceScaleFactor: 3 }, 45],
    ] as const) {
      // trimmed to the ink, then padded: exactly `whitespace` on every side
      expect(margins(await tableToPNG(spec, rows, o))).toEqual({ left: ws, top: ws, right: ws, bottom: ws });
    }
    const social = margins(
      await socialCrop(spec, rows, { aspect: "16:9", gravity: "northwest", background: "#0C0D10" }),
      [0x0c, 0x0d, 0x10],
    );
    expect([social.left, social.top]).toEqual([60, 60]);
  }, 60_000);
  test("`width` is the final image width, the height following (Python _fit_width)", async () => {
    const plain = dims(await tableToPNG(spec, rows));
    const sized = dims(await tableToPNG(spec, rows, { width: 900 }));
    expect(sized.width).toBe(900);
    expect(Math.abs(sized.height - (plain.height * 900) / plain.width)).toBeLessThanOrEqual(2);
    expect(dims(await socialCrop(spec, rows, { width: 1080 }))).toEqual({ width: 1080, height: 1080 });
    const wide = dims(await socialCrop(spec, rows, { aspect: "16:9", width: 1200 }));
    expect(wide.width).toBe(1200);
    expect(Math.abs(wide.height - 675)).toBeLessThanOrEqual(1);
  }, 60_000);
  test("wide table is not clipped (Review Focus 5)", async () => {
    type Wide = Record<string, number>;
    const wideRows: Wide[] = Array.from({ length: 3 }, (_, r) =>
      Object.fromEntries(Array.from({ length: 30 }, (_, c) => [`stat_${c}`, r * 30 + c])),
    );
    const wideSpec = defineTable<Wide>()
      .columns((c) => Array.from({ length: 30 }, (_, i) => c.int(`stat_${i}`, { label: `Statistic ${i}` })))
      .theme("sdv", { density: "comfortable" })
      .build();
    const out = dims(await tableToPNG(wideSpec, wideRows, { deviceScaleFactor: 1 }));
    // wider than the 1200 px viewport the page lays out in, plus 50 px each side
    expect(out.width).toBeGreaterThan(1200 + 2 * 50);
  }, 60_000);
  test("gridTables HTML renders; batchToPNG writes one slugged file per group, matched width", async () => {
    expect(
      dims(
        await htmlToPNG(
          gridTables(
            [
              { spec, rows },
              { spec, rows },
            ],
            { ncol: 2 },
          ),
        ),
      ).width,
    ).toBeGreaterThan(800);
    const dir = await mkdtemp(join(tmpdir(), "sdvt-batch-"));
    const files = await batchToPNG(many, "conf", (r) => ({ spec, rows: r }), "by-{group}.png", {
      dir,
      deviceScaleFactor: 1,
    });
    expect(files).toEqual([join(dir, "by-nfc.png"), join(dir, "by-afc.png")]); // first seen first: ARI is NFC
    const grouped = await batchToPNG(rows, "wins", (r) => ({ spec, rows: r }), "w-{group}.png", {
      dir,
      deviceScaleFactor: 1,
    });
    expect(grouped.map((f) => f.slice(dir.length + 1)).sort()).toEqual([
      "w-10.png",
      "w-11.png",
      "w-13.png",
      "w-15.png",
      "w-4.png",
      "w-5.png",
      "w-8.png",
    ]);
    const widthsOf = (fs: string[]) =>
      Promise.all(fs.map(async (f) => dims(new Uint8Array(await readFile(f))).width));
    const widths = await widthsOf(grouped);
    expect(new Set(widths).size).toBe(1);
    // matched to the WIDEST table, not stretched to the 1200 px viewport (a block-level flex wrapper did that)
    const own = await widthsOf(
      await batchToPNG(rows, "wins", (r) => ({ spec, rows: r }), "own-{group}.png", {
        dir,
        deviceScaleFactor: 1,
        matchWidth: false,
      }),
    );
    expect(new Set(own).size).toBeGreaterThan(1);
    expect(widths[0]).toBe(Math.max(...own)); // Python: extended to the widest trimmed table, then padded
  }, 120_000);
});
