// The shared deck.gl / pydeck fixture (fixtures/deckgl/shared.json, written by tools/oracle/deckgl.ts): sdvplot's
// Python sdvplot.pydeck is held to the same bytes (its tests/fixtures/deckgl_shared.json), so both languages build the
// same layer props from the same real rows. See fixtures/deckgl/README.md.
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, test, vi } from "vitest";
import { logoIconLayer, passArcLayer, surfaceLayer } from "../src/deckgl.js";
import { setWarningHandler } from "../src/index.js";
import { teamPalette } from "../src/team-palette.js";
import "./_fixtures.js"; // preloads every league

const PATH = new URL("../../../fixtures/deckgl/shared.json", import.meta.url);
const BYTES = readFileSync(PATH);
/** The same digest is pinned in sdvplot's tests/test_pydeck_shared.py: the two copies are one file. */
const SHA256 = "acb197164795e8663ccd8e139ca2e847a8f80f5549c0b30aefe18b71ca89ec08";

type Props = Record<string, unknown> & { data: Record<string, unknown>[] };
interface LayerCase {
  name: string;
  layer: "IconLayer" | "ArcLayer";
  input: "nhl_shots" | "france_passes";
  options: Record<string, unknown>;
  props: Record<string, unknown>;
  data: Record<string, unknown>[];
}
interface SurfaceCase {
  name: string;
  sport: "hockey" | "soccer";
  league: string;
  pitch?: { pitch_length: number; pitch_width: number };
  props: Record<string, unknown>;
  fills: number[][];
  extent_x: [number, number];
  extent_y: [number, number] | null;
}
interface PaletteCase {
  league: string;
  background: string;
  labels: string[];
  colors: string[];
  alts: (string | null)[];
  expected: string[];
}
const FIXTURE = JSON.parse(BYTES.toString("utf8")) as {
  warnings: string[];
  inputs: Record<"nhl_shots" | "france_passes", { rows: Record<string, unknown>[] }>;
  layers: LayerCase[];
  surfaces: SurfaceCase[];
  palettes: PaletteCase[];
};

/** Holds built props to the fixture's plain props: constants equal, and each accessor returns its named row field. */
function expectProps(built: Props, want: Record<string, unknown>): void {
  expect(
    Object.keys(built)
      .filter((k) => k !== "data")
      .sort(),
  ).toEqual(Object.keys(want).sort());
  for (const [k, v] of Object.entries(want)) {
    const got = built[k];
    if (typeof got === "function") {
      expect(typeof v, `${k} is an accessor`).toBe("string");
      for (const row of built.data) expect(got(row)).toEqual(row[v as string]);
    } else expect(got, k).toEqual(v);
  }
}
const extent = (data: { polygon: (readonly [number, number])[] }[], k: 0 | 1): [number, number] => {
  const v = data.flatMap((d) => d.polygon.map((p) => p[k]));
  return [Math.round(Math.min(...v) * 1e4) / 1e4, Math.round(Math.max(...v) * 1e4) / 1e4];
};
const sortRgba = (c: number[][]): number[][] => [...c].sort((a, b) => a.join().localeCompare(b.join()));

test("the fixture is the file sdvplot (Python) commits, byte for byte, and was written without a warning", () => {
  expect(createHash("sha256").update(BYTES).digest("hex")).toBe(SHA256);
  expect(FIXTURE.warnings).toEqual([]);
});

describe.each(FIXTURE.layers.map((c) => [c.name, c] as const))("layer %s", (_, c) => {
  test("is rebuilt exactly from the fixture's rows and options", () => {
    const rows = FIXTURE.inputs[c.input].rows;
    const spy = vi.fn();
    setWarningHandler(spy);
    const built = (c.layer === "IconLayer"
      ? logoIconLayer(rows, c.options as unknown as Parameters<typeof logoIconLayer>[1])
      : passArcLayer(rows, c.options as unknown as Parameters<typeof passArcLayer>[1])) as unknown as Props;
    setWarningHandler(null);
    expect(spy).not.toHaveBeenCalled();
    expect(built.data).toEqual(c.data);
    expectProps(built, c.props);
  });
});

describe.each(FIXTURE.surfaces.map((s) => [s.name, s] as const))("surface %s", (_, s) => {
  test("has the fixture's props, fill colours and extent", () => {
    const built = (s.pitch === undefined
      ? surfaceLayer(s.sport, s.league)
      : surfaceLayer(s.sport, s.league, { updates: s.pitch })) as unknown as Props & {
      data: { polygon: [number, number][]; fillColor: number[] }[];
    };
    expectProps(built, s.props);
    expect(
      sortRgba([...new Set(built.data.map((d) => JSON.stringify(d.fillColor)))].map((j) => JSON.parse(j))),
    ).toEqual(sortRgba(s.fills));
    expect(extent(built.data, 0)).toEqual(s.extent_x);
    if (s.extent_y !== null) expect(extent(built.data, 1)).toEqual(s.extent_y);
  });
});

test.each(FIXTURE.palettes.map((p) => [p.league, p.background, p] as const))(
  "the shared team palette, %s on %s: the fixture's colours, with no warning",
  (_, __, p) => {
    const spy = vi.fn();
    setWarningHandler(spy);
    const got = teamPalette(p.colors, p.alts, p.background, p.labels);
    setWarningHandler(null);
    expect(spy).not.toHaveBeenCalled();
    expect(got).toEqual(p.expected);
  },
);
