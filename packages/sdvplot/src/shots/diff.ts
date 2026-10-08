// diffScale reproduces blazing-the-nets' diff colours with no d3 at runtime. "rdbu" = main lib/charts/theme.ts:47-64;
// "master" = master src/components/HexShotchart/index.js:57-64. The RdBu ramp ports d3-scale-chromatic 3.1.0
// src/diverging/RdBu.js:13 + src/ramp.js:3 and d3-interpolate 3.0.1 src/basis.js:1-19 + src/rgb.js:28-52 (ISC,
// Mike Bostock; notice in NOTICE.md). Strings match d3-color's `rgb(r, g, b)` exactly.
import { InputError } from "../errors.js";

type Rgb = readonly [number, number, number];
const hex = (s: string): Rgb => [
  Number.parseInt(s.slice(0, 2), 16),
  Number.parseInt(s.slice(2, 4), 16),
  Number.parseInt(s.slice(4, 6), 16),
];
const RDBU: readonly Rgb[] = (
  "67001fb2182bd6604df4a582fddbc7f7f7f7d1e5f092c5de4393c32166ac053061".match(/.{6}/g) ?? []
).map(hex);
const MASTER: readonly Rgb[] = ["8d0801", "bf0603", "f4d58d", "708d81", "195943"].map(hex);
const MASTER_DOMAIN = [-0.99, -0.15, 0, 0.15, 0.99] as const;
const DARK_NEUTRAL: Rgb = [0x30, 0x30, 0x30]; // theme.ts:54

/** d3-color's formatter: each channel rounded and clamped to 0-255. */
const clampi = (v: number): number => Math.max(0, Math.min(255, Math.round(v) || 0));
const fmt = (c: Rgb): string => `rgb(${clampi(c[0])}, ${clampi(c[1])}, ${clampi(c[2])})`;

function basis(t1: number, v0: number, v1: number, v2: number, v3: number): number {
  const t2 = t1 * t1;
  const t3 = t2 * t1;
  return (
    ((1 - 3 * t1 + 3 * t2 - t3) * v0 +
      (4 - 6 * t2 + 3 * t3) * v1 +
      (1 + 3 * t1 + 3 * t2 - 3 * t3) * v2 +
      t3 * v3) /
    6
  );
}
function spline(values: readonly number[], tIn: number): number {
  const n = values.length - 1;
  let t = tIn;
  let i: number;
  if (t <= 0) {
    t = 0;
    i = 0;
  } else if (t >= 1) {
    t = 1;
    i = n - 1;
  } else i = Math.floor(t * n);
  const v1 = values[i] as number;
  const v2 = values[i + 1] as number;
  const v0 = i > 0 ? (values[i - 1] as number) : 2 * v1 - v2;
  const v3 = i < n - 1 ? (values[i + 2] as number) : 2 * v2 - v1;
  return basis((t - i / n) * n, v0, v1, v2, v3);
}
const channel = (k: 0 | 1 | 2): number[] => RDBU.map((c) => c[k]);
const R = channel(0);
const G = channel(1);
const B = channel(2);
/** d3.interpolateRdBu(t), unrounded. */
const rdbu = (t: number): Rgb => [spline(R, t), spline(G, t), spline(B, t)];
/** d3.interpolateRgb(a, b)(t). */
const lerp = (a: Rgb, b: Rgb, t: number): Rgb => [
  a[0] + t * (b[0] - a[0]),
  a[1] + t * (b[1] - a[1]),
  a[2] + t * (b[2] - a[2]),
];
/** A d3 piecewise scaleLinear over colours: bisectRight segment, unclamped t unless the input was clamped. */
function piecewise(domain: readonly number[], range: readonly Rgb[], x: number): Rgb {
  let i = 1;
  while (i < domain.length - 1 && (domain[i] as number) <= x) i++;
  const a = domain[i - 1] as number;
  const b = domain[i] as number;
  return lerp(range[i - 1] as Rgb, range[i] as Rgb, (x - a) / (b - a));
}

export type DiffPalette = "rdbu" | "master";
export interface DiffScaleOptions {
  /**
   * `"rdbu"` (default): RdBu reversed, above league red (blazing-the-nets `main`), clamped at `±domain`.
   * `"master"`: the 2021 five-stop red-yellow-green, UNCLAMPED like master's d3 `scaleLinear`: a diff past the end
   * stops (±0.99) extrapolates, each channel then clamped to 0-255. An infinite diff takes the end colour (d3 gives
   * `rgb(0, 0, 0)` for `Infinity` and `rgb(0, 255, 0)` for `-Infinity`).
   */
  palette?: DiffPalette;
  /** `"dark"` swaps RdBu's near-white centre for `#303030` so an average mark recedes (`theme.ts:52-58`). Ignored by `"master"`. */
  theme?: "light" | "dark";
  /** Saturation in FG% fraction; default 0.15 (`theme.ts:29`). `"master"` keeps its own stops. */
  domain?: number;
  /** Colour for `null` (no league figure); default `var(--sdv-muted, #525252)`. */
  nullColor?: string;
}
/** A diff colour function plus the equivalent Plot colour-scale options (for fills and `Plot.legend`). */
export interface DiffScale {
  (diff: number | null): string;
  /** Diffs to place gradient stops at: 5 across [-D, D] (`theme.ts:127-130`), or `master`'s own 5 stops. */
  readonly stops: readonly number[];
  readonly plot: {
    readonly type: "diverging" | "linear";
    readonly domain: readonly number[];
    readonly range?: readonly string[];
    readonly scheme?: "RdBu";
    readonly reverse?: boolean;
    readonly pivot?: number;
    readonly interpolate?: "rgb";
    readonly clamp: boolean;
  };
}

/**
 * The FG%-vs-league colour: `diffScale()(0.05)`. Light RdBu, dark RdBu, or `master`'s palette; `null` is
 * `nullColor`. `.plot` is the same scale as Observable Plot `color` options, so `Plot.legend({ color: s.plot })`
 * draws the matching key.
 *
 * @example
 * ```ts
 * import { diffScale } from "@sportsdataverse/sdvplot/shots";
 *
 * diffScale({ theme: "dark" })(0.05);
 * ```
 */
export function diffScale(o: DiffScaleOptions = {}): DiffScale {
  const palette = o.palette ?? "rdbu";
  const D = o.domain ?? 0.15;
  if (!(D > 0)) throw new InputError(`diffScale domain must be > 0, got ${String(D)}`);
  const nullColor = o.nullColor ?? "var(--sdv-muted, #525252)";
  let colour: (d: number) => string;
  let plot: DiffScale["plot"];
  let stops: readonly number[] = [0, 0.25, 0.5, 0.75, 1].map((t) => (t * 2 - 1) * D);
  if (palette === "master") {
    const range = MASTER.map(fmt);
    // Deliberate divergence from d3: ±Infinity takes the end colour, where d3 gives black (+) or green (-).
    colour = (d) =>
      Number.isFinite(d)
        ? fmt(piecewise(MASTER_DOMAIN, MASTER, d))
        : (range[d > 0 ? range.length - 1 : 0] as string);
    plot = { type: "linear", domain: MASTER_DOMAIN, range, interpolate: "rgb", clamp: false };
    stops = MASTER_DOMAIN;
  } else if (o.theme === "dark") {
    // theme.ts:55-58: the ends are d3's ROUNDED rgb() strings, re-parsed, so round before interpolating.
    const ends: readonly Rgb[] = [rdbu(0.85), DARK_NEUTRAL, rdbu(0.15)].map(
      (c): Rgb => [clampi(c[0]), clampi(c[1]), clampi(c[2])],
    );
    const domain = [-D, 0, D];
    colour = (d) => fmt(piecewise(domain, ends, Math.max(-D, Math.min(D, d))));
    plot = { type: "linear", domain, range: ends.map(fmt), interpolate: "rgb", clamp: true };
  } else {
    // theme.ts:49-51: scaleDiverging(t => interpolateRdBu(1 - t)).domain([-D, 0, D]).clamp(true).
    const k = 0.5 / D;
    colour = (d) => fmt(rdbu(1 - Math.max(0, Math.min(1, 0.5 + d * k))));
    plot = { type: "diverging", scheme: "RdBu", reverse: true, domain: [-D, D], pivot: 0, clamp: true };
  }
  const scale = (diff: number | null): string =>
    diff === null || Number.isNaN(diff) ? nullColor : colour(diff);
  return Object.assign(scale, { plot, stops });
}
