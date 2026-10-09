import { readFileSync } from "node:fs";
import { copyFile, mkdtemp, readFile, readdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { fileURLToPath } from "node:url";
import { inflateSync } from "node:zlib";
import { InputError, OptionalDependencyError, SdvplotError, preloadAll } from "@sportsdataverse/sdvplot";
import { afterEach, describe, expect, test, vi } from "vitest";
import { defineTable } from "../src/define.js";
import { batchToPNG, gridTables, htmlToPNG, socialCrop, tableToPNG } from "../src/export/index.js";
import { renderHTML, themePreview } from "../src/html/index.js";
import { THEME_NAMES } from "../src/index.js";
import { many, rows, spec } from "./fixtures/engine.js";
import { STANDINGS, type Standing } from "./fixtures/standings.js";

/** The theme pass's table (theme-pass.test.ts): every theme draws it, striped where the theme stripes. */
const PASS_SPEC = defineTable<Standing>()
  .columns((c) => [
    c.text("team"),
    c.text("qb", { label: "Quarterback" }),
    c.int("wins"),
    c.num("net_epa", { digits: 3 }),
  ])
  .title("AFC")
  .subtitle("2024 regular season")
  .build();

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
  // guides/export.mdx shows examples/snippets/export/standings-png.ts and the first PNG it writes, committed as
  // docs/static/img/sdvtables-export-afc.png. `pnpm --filter @sportsdataverse/examples render:export-png` regenerates
  // that image: it runs this test with SDV_EXPORT_GUIDE_PNG set to the image's path.
  test("the export guide's snippet still writes its PNGs", async () => {
    const snippet = fileURLToPath(
      new URL("../../../examples/snippets/export/standings-png.ts", import.meta.url),
    );
    // a computed specifier: tsc does not pull the examples workspace into this package's program
    const { exportStandings } = (await import(/* @vite-ignore */ snippet)) as {
      exportStandings: (rows: readonly Standing[], dir: string) => Promise<string[]>;
    };
    const dir = await mkdtemp(join(tmpdir(), "sdvt-guide-"));
    const files = await exportStandings(rows, dir); // STANDINGS, the 8 real 2024 AFC rows the docs use
    expect(files.map((f) => basename(f))).toEqual([
      "afc.png",
      "afc-post.png",
      "afc-grid.png",
      "afc-west.png",
      "afc-east.png",
    ]);
    for (const f of files)
      expect(Array.from((await readFile(f)).subarray(0, 4))).toEqual([0x89, 0x50, 0x4e, 0x47]);
    const table = files[0] as string;
    expect(dims(new Uint8Array(await readFile(table))).width).toBe(900);
    const out = process.env.SDV_EXPORT_GUIDE_PNG;
    if (out) await copyFile(table, out);
  }, 120_000);
  test("wide table is not clipped (Review Focus 5)", async () => {
    // Real rows, wide: the 32 teams of `many` (NFL_2024) pivoted to one column each, headed by team and division, and
    // one row each for their 2024 wins, losses, points for and points against (nflverse games.csv and nflseedR
    // divisions; provenance: fixtures/nfl-2024/README.md).
    type Wide = Record<string, number>;
    const wideRows: Wide[] = (["wins", "losses", "pf", "pa"] as const).map((k) =>
      Object.fromEntries(many.map((t) => [t.team, t[k]])),
    );
    const wideSpec = defineTable<Wide>()
      .columns((c) => many.map((t) => c.int(t.team, { label: `${t.team} (${t.conf} ${t.division})` })))
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
  test("I3: the hovered row's underline is on in every theme, and the documented one-rule opt-out removes it", async () => {
    // the README's and the changeset's opt-out, placed BEFORE the table's own sheet: it must win on specificity alone
    const OPT_OUT = "tr.sdvt-hover>td.sdvt-cell{background-image:none}";
    await preloadAll(); // themePreview's sdvTeam resolves KC
    const pages = themePreview(PASS_SPEC, STANDINGS, THEME_NAMES, { n: STANDINGS.length });
    const { chromium } = await import("playwright");
    const browser = await chromium.launch();
    const seen: Record<string, [string, string]> = {};
    try {
      const page = await browser.newPage();
      for (const [name, html] of Object.entries(pages)) {
        const bg: string[] = [];
        for (const head of ["", `<style>${OPT_OUT}</style>`]) {
          await page.setContent(`<!doctype html><html><head>${head}</head><body>${html}</body></html>`);
          // the second data row: striped in almanac, ncaa and savant, whose stripe rule must not drop the underline
          bg.push(
            await page.evaluate(() => {
              const tr = document.querySelectorAll("tbody tr.sdvt-row")[1] as Element;
              tr.classList.add("sdvt-hover");
              return getComputedStyle(tr.querySelector("td.sdvt-cell") as Element).backgroundImage;
            }),
          );
        }
        seen[name] = [bg[0] as string, bg[1] as string];
      }
    } finally {
      await browser.close();
    }
    for (const [name, [byDefault, optedOut]] of Object.entries(seen)) {
      expect(byDefault, `${name}: the underline by default`).toMatch(/^linear-gradient\(/);
      expect(optedOut, `${name}: after the documented opt-out`).toBe("none");
    }
  }, 120_000);
  test("a host page's global table CSS (Observable Framework, Docusaurus) changes no cell's ink, ground, font or rules", async () => {
    // Framework's td{color} and table{font} beat what a cell inherits from the table root, and Docusaurus paints its
    // stripe on every second <tr>: the notebooks' dark mode put the page's light ink on a light table
    await preloadAll(); // themePreview's sdvTeam resolves KC
    // the theme pass's table (theme-pass.test.ts): group rows and a source note too, so every kind of <tr> is probed
    const full = defineTable<Standing>()
      .columns(() => PASS_SPEC.columns)
      .title("AFC")
      .subtitle("2024 regular season")
      .groupBy("division")
      .sourceNote("Source: nflverse")
      .build();
    const pages: Record<string, string> = {
      ...themePreview(full, STANDINGS, THEME_NAMES, { n: STANDINGS.length }),
      // themePreview names the theme alone, so the dark style goes through renderHTML
      "sdv dark": renderHTML(
        { ...full, theme: { name: "sdv", density: "compact", options: { style: "dark" } } },
        STANDINGS,
      ),
    };
    // each cell's ink and the ground under it, composited to opaque #rrggbb in the page itself, plus its font
    const probe = () => {
      const cv = document.createElement("canvas");
      cv.width = cv.height = 1;
      const cx = cv.getContext("2d", { willReadFrequently: true }) as CanvasRenderingContext2D;
      const rgba = (c: string): number[] => {
        cx.clearRect(0, 0, 1, 1);
        cx.fillStyle = c;
        cx.fillRect(0, 0, 1, 1);
        return Array.from(cx.getImageData(0, 0, 1, 1).data);
      };
      const over = (top: number[], under: number[]): number[] =>
        under.map((u, k) =>
          k < 3
            ? Math.round(((top[k] as number) * (top[3] as number) + u * (255 - (top[3] as number))) / 255)
            : 255,
        );
      const hex = (c: number[]): string =>
        `#${c
          .slice(0, 3)
          .map((v) => v.toString(16).padStart(2, "0"))
          .join("")}`;
      return Array.from(document.querySelectorAll("table td, table th"), (cell) => {
        const layers: number[][] = [];
        for (let n: Element | null = cell; n; n = n.parentElement)
          layers.push(rgba(getComputedStyle(n).backgroundColor));
        const ground = layers.reduceRight((under, top) => over(top, under), [255, 255, 255, 255]);
        const cs = getComputedStyle(cell);
        const tr = getComputedStyle(cell.parentElement as Element);
        return [
          hex(over(rgba(cs.color), ground)),
          hex(ground),
          `${cs.fontFamily} ${cs.fontSize}/${cs.lineHeight}`,
          // the row's rules and the cell's own (Infima borders every cell: table th, table td { border })
          [tr, cs]
            .map(
              (x) => `${x.borderTopWidth} ${x.borderRightWidth} ${x.borderBottomWidth} ${x.borderLeftWidth}`,
            )
            .join(" / "),
        ];
      });
    };
    const { contrast } = await import("@sportsdataverse/sdvplot");
    const { HOST_TABLE_CSS } = await import("./fixtures/host-table-css.js");
    const { chromium } = await import("playwright");
    const browser = await chromium.launch();
    // one line per theme and host that changed: which properties, how many cells, the worst cell's contrast before → after
    const bad: string[] = [];
    try {
      const page = await browser.newPage();
      for (const [name, html] of Object.entries(pages)) {
        await page.setContent(`<!doctype html><html><head></head><body>${html}</body></html>`);
        const bare = await page.evaluate(probe);
        for (const [host, css] of Object.entries(HOST_TABLE_CSS)) {
          await page.setContent(
            `<!doctype html><html><head><style>${css}</style></head><body>${html}</body></html>`,
          );
          const hosted = await page.evaluate(probe);
          const what = new Set<string>();
          let [n, worst, before] = [0, Number.POSITIVE_INFINITY, 0];
          hosted.forEach(([ink, ground, font, rule], i) => {
            const [ink0, ground0, font0, rule0] = bare[i] as string[];
            if (ink === ink0 && ground === ground0 && font === font0 && rule === rule0) return;
            n++;
            if (ink !== ink0) what.add("ink");
            if (ground !== ground0) what.add("ground");
            if (font !== font0) what.add("font");
            if (rule !== rule0) what.add("rules");
            const c = contrast(ink as string, ground as string);
            if (c < worst) [worst, before] = [c, contrast(ink0 as string, ground0 as string)];
          });
          if (n > 0)
            bad.push(
              `${name} in ${host}: ${[...what].join("+")} on ${n} cells, worst ${before.toFixed(2)}:1 -> ${worst.toFixed(2)}:1`,
            );
        }
      }
      // the cell takes its ROW's ink, not the theme's outright: spotlight dims an unlit row on its <tr>
      const lit = defineTable<Standing>()
        .columns(() => PASS_SPEC.columns)
        .spotlight([0])
        .build();
      await page.setContent(
        `<!doctype html><html><head><style>${HOST_TABLE_CSS["framework-light"]}</style></head><body>${renderHTML(lit, STANDINGS)}</body></html>`,
      );
      const [rowInk, cellInk] = await page.evaluate(() => {
        const tr = document.querySelectorAll("tbody tr.sdvt-row")[1] as HTMLElement;
        return [
          getComputedStyle(tr).color,
          getComputedStyle(tr.querySelector("td.sdvt-cell") as Element).color,
        ];
      });
      bad.push(
        ...(cellInk === rowInk ? [] : [`spotlight's dimmed row: ink ${rowInk}, its cells ${cellInk}`]),
      );
      // an author's deliberate class-qualified rule still wins, from the head, before the table's own sheet
      await page.setContent(
        `<!doctype html><html><head><style>.page td{color:rgb(204, 0, 0)}</style></head><body class="page">${pages.sdv as string}</body></html>`,
      );
      const authored = await page.evaluate(
        () => getComputedStyle(document.querySelector("td.sdvt-cell") as Element).color,
      );
      bad.push(...(authored === "rgb(204, 0, 0)" ? [] : [`an author's .page td{color} lost: ${authored}`]));
    } finally {
      await browser.close();
    }
    expect(bad, bad.join("\n")).toEqual([]);
  }, 240_000);
});
