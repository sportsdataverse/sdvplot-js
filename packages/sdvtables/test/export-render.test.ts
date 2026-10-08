import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { InputError } from "@sportsdataverse/sdvplot";
import { describe, expect, test } from "vitest";
import { defineTable } from "../src/define.js";
import { batchToPNG, gridTables, htmlToPNG, socialCrop, tableToPNG } from "../src/export/index.js";
import { many, rows, spec } from "./fixtures/engine.js";
import type { Standing } from "./fixtures/standings.js";

const dims = (b: Uint8Array): { width: number; height: number } => {
  const dv = new DataView(b.buffer, b.byteOffset, b.byteLength);
  return { width: dv.getUint32(16), height: dv.getUint32(20) };
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

describe.skipIf(!process.env.SDV_RENDER_TESTS)("playwright rendering (SDV_RENDER_TESTS=1)", () => {
  test("tableToPNG returns a PNG at deviceScaleFactor 2 and writes `file`", async () => {
    const dir = await mkdtemp(join(tmpdir(), "sdvt-"));
    const file = join(dir, "t.png");
    const out = await tableToPNG(spec, rows, { file });
    expect(Array.from(out.slice(0, 4))).toEqual([0x89, 0x50, 0x4e, 0x47]);
    expect(dims(out).width).toBeGreaterThan(400);
    expect((await readFile(file)).length).toBe(out.length);
  }, 60_000);
  test("socialCrop 1:1 is square; 16:9 is wider than tall", async () => {
    const sq = dims(await socialCrop(spec, rows, { aspect: "1:1" }));
    expect(sq.width).toBe(sq.height);
    const wide = dims(
      await socialCrop(spec, rows, { aspect: "16:9", gravity: "northwest", background: "#0C0D10" }),
    );
    expect(wide.width / wide.height).toBeCloseTo(16 / 9, 1);
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
    const out = dims(await tableToPNG(wideSpec, wideRows, { width: 600, deviceScaleFactor: 1 }));
    expect(out.width).toBeGreaterThan(600 + 2 * 50);
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
    expect(files).toEqual([join(dir, "by-afc.png")]);
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
    expect(Math.abs((widths[0] as number) - Math.max(...own))).toBeLessThanOrEqual(1);
  }, 120_000);
});
