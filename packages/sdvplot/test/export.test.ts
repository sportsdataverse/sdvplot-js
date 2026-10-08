import { describe, expect, test, vi } from "vitest";
import { InputError, OptionalDependencyError } from "../src/errors.js";
import {
  canvasFor,
  offsetFor,
  parseAspect,
  parseGravity,
  socialCard,
  svgSize,
  toPNG,
} from "../src/export/index.js";

const png = (b: Uint8Array): { width: number; height: number } => {
  const dv = new DataView(b.buffer, b.byteOffset, b.byteLength);
  return { width: dv.getUint32(16), height: dv.getUint32(20) };
};
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
});

describe("toPNG", () => {
  test("renders via resvg at width × scale", async () => {
    const out = await toPNG(sized, { width: 100, scale: 2 });
    expect(Array.from(out.slice(0, 4))).toEqual([0x89, 0x50, 0x4e, 0x47]);
    expect(png(out)).toEqual({ width: 200, height: 200 });
    expect(png(await toPNG(socialCard(sized, { aspect: "16:9" }))).width).toBe(747);
  });
  test("missing peer → OptionalDependencyError", async () => {
    vi.doMock("@resvg/resvg-js", () => {
      throw new Error("Cannot find module");
    });
    vi.resetModules();
    const { toPNG: fresh } = await import("../src/export/index.js");
    // resetModules re-evaluates errors.ts too, so match the class by name, not by the top-level import's identity
    await expect(fresh(sized)).rejects.toMatchObject({ name: OptionalDependencyError.name });
    vi.doUnmock("@resvg/resvg-js");
  });
});
