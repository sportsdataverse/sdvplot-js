import { readFileSync, statSync } from "node:fs";
import { describe, expect, it } from "vitest";

// Checks the committed brand assets (written by `pnpm brand`) without re-rendering or touching the network.
const img = (name: string): URL => new URL(`../../docs/static/img/${name}`, import.meta.url);
const PNG_SIG = "89504e470d0a1a0a";

/** Width and height from a PNG's IHDR, which always follows the 8-byte signature. */
function pngSize(bytes: Buffer): [number, number] {
  expect(bytes.subarray(0, 8).toString("hex")).toBe(PNG_SIG);
  expect(bytes.subarray(12, 16).toString("latin1")).toBe("IHDR");
  return [bytes.readUInt32BE(16), bytes.readUInt32BE(20)];
}

describe("brand assets", () => {
  it.each([
    ["sdvplot-js-logo.png", 1036, 1200],
    ["social-card.png", 1280, 640],
    ["favicon-192.png", 192, 192],
    ["favicon-512.png", 512, 512],
    ["apple-touch-icon.png", 180, 180],
  ])("%s is %i x %i", (name, w, h) => {
    expect(pngSize(readFileSync(img(name)))).toEqual([w, h]);
  });

  it("favicon.ico holds 16, 32 and 48 px PNGs", () => {
    const ico = readFileSync(img("favicon.ico"));
    expect(ico.readUInt16LE(0)).toBe(0);
    expect(ico.readUInt16LE(2)).toBe(1);
    expect(ico.readUInt16LE(4)).toBe(3);
    const sizes = [0, 1, 2].map((i) => {
      const e = 6 + 16 * i;
      const png = ico.subarray(ico.readUInt32LE(e + 12), ico.readUInt32LE(e + 12) + ico.readUInt32LE(e + 8));
      expect(pngSize(png)).toEqual([ico[e], ico[e + 1]]);
      return ico[e];
    });
    expect(sizes).toEqual([16, 32, 48]);
  });

  it("/favicon.ico is the same icon, for pages that declare none (notebooks, iframe examples)", () => {
    const root = readFileSync(new URL("../../docs/static/favicon.ico", import.meta.url));
    expect(root.equals(readFileSync(img("favicon.ico")))).toBe(true);
  });

  it("the mark SVG stays small enough for a favicon / navbar logo", () => {
    expect(statSync(img("sdvplot-js-mark.svg")).size).toBeLessThan(20 * 1024);
  });
});
