import { TableSpecError } from "../errors.js";
import type { ColumnSpec, SeriesHighlight, SeriesPoint, SeriesStat } from "../spec.js";
import { cssValue, escapeAttr, escapeHtml } from "./escape.js";

/** Round half to even, as Python :.0f formats. */
export const halfEven = (x: number): string => {
  const r = Math.round(x);
  return String(Math.abs(x % 1) === 0.5 && r % 2 !== 0 ? r - 1 : r);
};
/** Python _cutline_svg (_cells.py:806-817) byte for byte: uppercase label, `quote(svg, safe="")`, `;charset=utf-8`. */
export function cutlineSvg(text: string, color: string, size: number): string {
  const t = text.toUpperCase();
  const tracking = 1.1;
  const esc = t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${halfEven(t.length * (size * 0.8 + tracking) + 4)}" height="${halfEven(size + 4)}"><text x="0" y="${(size + 0.5).toFixed(1)}" font-family="Helvetica,Arial,sans-serif" font-size="${size}" font-weight="700" letter-spacing="${tracking}" fill="${color}">${esc}</text></svg>`;
  return `data:image/svg+xml;charset=utf-8,${pyQuote(svg)}`;
}
/** Python `urllib.parse.quote(s, safe="")`: encodeURIComponent also leaves `!'()*` alone. */
export const pyQuote = (x: string): string =>
  encodeURIComponent(x).replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
/** Python _watermark_svg (_layout.py:251-268): returns the data URI and whether the rotated box is taller than wide. */
export function watermarkSvg(
  text: string,
  color: string,
  opacity: number,
  angle: number,
  font: string,
): [string, boolean] {
  const label = text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const size = 100;
  const textW = Math.max(label.length * size * 0.62, size);
  const textH = size * 1.3;
  const rad = (Math.abs(angle) * Math.PI) / 180;
  const w = Math.ceil(textW * Math.cos(rad) + textH * Math.sin(rad)) + 4;
  const h = Math.ceil(textW * Math.sin(rad) + textH * Math.cos(rad)) + 4;
  const rot = angle !== 0 ? ` transform="rotate(${angle} ${w / 2} ${h / 2})"` : "";
  const attr = (v: string): string => v.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}"><text x="50%" y="50%" text-anchor="middle" dominant-baseline="central" font-family="${attr(font)}" font-size="${size}" font-weight="700" fill="${attr(color)}" fill-opacity="${opacity}"${rot}>${label}</text></svg>`;
  return [`data:image/svg+xml,${pyQuote(svg)}`, h > w];
}
/** A CSS string body: backslash-escape what could end the string or the <style> element. */
export const cssStr = (v: string): string =>
  v.replace(/[\\"\n\r<]/g, (c) => `\\${c.charCodeAt(0).toString(16)} `);

// ---- in-cell charts: reactablefmtr react_sparkline / react_sparkbar / gauge_chart as inline SVG, ported from sdvplot's
// _reactable_charts.py (the Python Tier 2) so both libraries draw the same marks: margins, scales, labels, aria-labels.

// Row-agnostic views of the three kinds: the drawing reads options, never rows
type Of<K> = Omit<Extract<ColumnSpec<never>, { kind: K }>, "key" | "compare"> & { readonly key: string };
type Sparkline = Of<"sparkline">;
type Sparkbar = Of<"sparkbar">;
type Gauge = Of<"gauge">;
type Named = "first" | "last" | "min" | "max";
type At = Readonly<Record<Named, number>>;
type Pt = readonly [number, number];
const NAMED: readonly Named[] = ["first", "last", "min", "max"];

/** A coordinate, short: two decimals at most, no trailing zeros, never "-0". */
const n2 = (v: number): string => String(Math.round(v * 100) / 100 + 0);
/** A number as people write it (12, 0.523, 0.0000125, 1234567.5): four significant figures at least, so a small value never prints as 0. */
export function plainNumber(v: number): string {
  if (Number.isInteger(v)) return String(v);
  const places = Math.max(4, 3 - Math.floor(Math.log10(Math.abs(v))));
  return v.toFixed(places).replace(/0+$/, "").replace(/\.$/, "");
}
/** A spec colour or size bound for an SVG attribute: a CSS value (cssValue names the field), escaped. */
const att = (v: string, field: string): string => escapeAttr(cssValue(v, field));
/** R type 7 (d3.quantile), as dataui's innerquartiles band. */
function quantile(xs: readonly number[], p: number): number {
  const s = [...xs].sort((a, b) => a - b);
  const h = (s.length - 1) * p;
  const lo = Math.floor(h);
  const a = s[lo] as number;
  return a + (h - lo) * ((s[Math.min(lo + 1, s.length - 1)] as number) - a);
}
const STAT: Readonly<Record<SeriesStat, (xs: readonly number[]) => number>> = {
  mean: (xs) => xs.reduce((s, x) => s + x, 0) / xs.length,
  median: (xs) => quantile(xs, 0.5),
  min: (xs) => Math.min(...xs),
  max: (xs) => Math.max(...xs),
};
/** reactablefmtr's default margins [top, right, bottom, left] and the height a default 22px chart grows to. */
function margins(labels: readonly SeriesPoint[], statline: boolean, bars: boolean): readonly number[] {
  const any = labels.length > 0;
  const endsOnly = any && !labels.some((n) => n === "min" || n === "max" || n === "all");
  if (bars) {
    if (statline) return any ? [12, 26, 3, 26, 22] : [4, 28, 3, 13, 22];
    return any ? [12, 26, 0, 26, 22] : [3, 13, 0, 13, 22];
  }
  if (statline) return !any ? [4, 28, 3, 13, 22] : endsOnly ? [5, 28, 3, 24, 22] : [14, 28, 10, 13, 28];
  return !any ? [3, 13, 2, 13, 22] : endsOnly ? [5, 24, 3, 24, 22] : [14, 13, 10, 13, 30];
}
/** The drawable box and the y scale of one sparkline / sparkbar cell. */
interface Frame {
  readonly h: number;
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
  readonly left: number;
  readonly lo: number;
  readonly hi: number;
  readonly y: (v: number) => number;
}
function frameOf(col: Sparkline | Sparkbar, present: readonly number[], bars: boolean, row: number): Frame {
  const [t = 0, r = 0, b = 0, l = 0, grown = 22] = margins(col.labels, col.statline !== undefined, bars);
  const h = col.chartHeight === 22 ? grown : col.chartHeight;
  // bars stand on zero, so the scale holds it (reactablefmtr's smallest bar would have no height)
  const lo = col.minValue ?? Math.min(...present, ...(bars ? [0] : []));
  const hi = col.maxValue ?? Math.max(...present, ...(bars ? [0] : []));
  if (lo > hi)
    throw new TableSpecError(
      `column "${col.key}" row ${row}: minValue/maxValue cross the row's data (bottom ${plainNumber(lo)} is above top ${plainNumber(hi)}); give both bounds, or one the data stays on the right side of`,
    );
  const bottom = h - b;
  const y = (v: number): number =>
    hi === lo ? (t + bottom) / 2 : t + Math.min(Math.max((hi - v) / (hi - lo), 0), 1) * (bottom - t);
  return { h, top: t, right: col.chartWidth - r, bottom, left: l, lo, hi, y };
}
function statlineSvg(col: Sparkline | Sparkbar, f: Frame, present: readonly number[]): string {
  if (col.statline === undefined) return "";
  const v = STAT[col.statline](present);
  const y = n2(f.y(v));
  const c = att(col.statlineColor, `${col.kind} statlineColor`);
  const size = att(col.statlineLabelSize, `${col.kind} statlineLabelSize`);
  return `<line class="sdvt-statline" x1="${n2(f.left)}" x2="${n2(f.right)}" y1="${y}" y2="${y}" stroke="${c}" stroke-width="1" stroke-dasharray="2,2" stroke-opacity="0.75"/><text class="sdvt-statline-label" x="${n2(f.right + 5)}" y="${y}" dominant-baseline="middle" fill="${c}" font-weight="bold" font-size="${size}">${v.toFixed(col.decimals)}</text>`;
}
function bandlineSvg(col: Sparkline | Sparkbar, f: Frame, present: readonly number[]): string {
  if (col.bandline === undefined) return "";
  const range = col.bandline === "range" || present.length < 2;
  const lo = range ? Math.min(...present) : quantile(present, 0.25);
  const hi = range ? Math.max(...present) : quantile(present, 0.75);
  const y1 = f.y(hi);
  return `<rect class="sdvt-bandline" x="${n2(f.left)}" y="${n2(y1)}" width="${n2(f.right - f.left)}" height="${n2(f.y(lo) - y1)}" fill="${att(col.bandlineColor, `${col.kind} bandlineColor`)}" fill-opacity="${col.bandlineOpacity}"/>`;
}
/** The aria-label: count, min, max and last value, then the statline and bandline when drawn. */
function summary(name: string, col: Sparkline | Sparkbar, present: readonly number[]): string {
  const n = present.length;
  let out = `${name} of ${n} value${n === 1 ? "" : "s"}: min ${plainNumber(Math.min(...present))}, max ${plainNumber(Math.max(...present))}, last ${plainNumber(present[n - 1] as number)}`;
  if (col.statline) out += `; ${col.statline} line at ${STAT[col.statline](present).toFixed(col.decimals)}`;
  if (col.bandline)
    out += `; band over the ${col.bandline === "innerquartiles" ? "inner quartiles" : "range"}`;
  return out;
}
/** The index of the first, last, min and max present value (the first of ties); `idx` lists the present indexes. */
function pointsAt(values: readonly (number | null)[], idx: readonly number[]): At {
  const v = (i: number): number => values[i] as number;
  let min = idx[0] as number;
  let max = min;
  for (const i of idx) {
    if (v(i) < v(min)) min = i;
    if (v(i) > v(max)) max = i;
  }
  return { first: idx[0] as number, last: idx.at(-1) as number, min, max };
}
/** Each marked index's colour: "all" first, then first/last/min/max, a later name winning where two coincide. */
function markColors(
  h: SeriesHighlight | undefined,
  at: At,
  idx: readonly number[],
  field: string,
): Map<number, string> {
  const named: Readonly<Partial<Record<SeriesPoint, string>>> =
    h === undefined
      ? {}
      : Array.isArray(h)
        ? Object.fromEntries((h as readonly SeriesPoint[]).map((n) => [n, "red"]))
        : (h as Readonly<Partial<Record<SeriesPoint, string>>>);
  const out = new Map<number, string>();
  const all = named.all;
  if (all !== undefined) for (const i of idx) out.set(i, att(all, field));
  for (const n of NAMED) {
    const c = named[n];
    if (c !== undefined) out.set(at[n], att(c, field));
  }
  return new Map([...out].sort((a, b) => a[0] - b[0]));
}
/** The indexes whose values are printed, in order. */
const labelled = (labels: readonly SeriesPoint[], at: At, idx: readonly number[]): number[] =>
  labels.includes("all") ? [...idx] : [...new Set(labels.map((n) => at[n as Named]))].sort((a, b) => a - b);
function chartSvg(kind: string, w: number, h: number, label: string, body: string): string {
  return `<svg class="sdvt-${kind}" xmlns="http://www.w3.org/2000/svg" width="${n2(w)}" height="${n2(h)}" viewBox="0 0 ${n2(w)} ${n2(h)}" role="img" aria-label="${escapeAttr(label)}" style="display:inline-block;vertical-align:middle;overflow:visible"><title>${escapeHtml(label)}</title>${body}</svg>`;
}
const present = (values: readonly (number | null)[]): number[] =>
  values.filter((v): v is number => v !== null);
const presentIdx = (values: readonly (number | null)[]): number[] =>
  values.flatMap((v, i) => (v === null ? [] : [i]));

/**
 * A sparkline cell. `values` holds a finite number or `null` (a gap) per point, at least one a number; `color` is the
 * line's colour (spec colours are checked here, through cssValue); `row` names the row in a bounds error.
 */
export function sparklineSvg(
  col: Sparkline,
  values: readonly (number | null)[],
  color: string,
  row: number,
): string {
  const xs = present(values);
  const idx = presentIdx(values);
  const f = frameOf(col, xs, false, row);
  const n = values.length;
  const step = n > 1 ? (f.right - f.left) / (n - 1) : 0;
  const pts = new Map<number, Pt>(
    idx.map((i) => [i, [n > 1 ? f.left + i * step : (f.left + f.right) / 2, f.y(values[i] as number)]]),
  );
  const path: string[] = [];
  for (let i = 0; i < n; i++) {
    const p = pts.get(i);
    if (!p) continue;
    const down = pts.has(i - 1);
    path.push(`${down ? "L" : "M"}${n2(p[0])},${n2(p[1])}`);
    if (!down && !pts.has(i + 1)) path.push("h0"); // an isolated point: the round cap draws it as a dot
  }
  const stroke = att(color, "sparkline lineColor");
  let body = bandlineSvg(col, f, xs);
  if (col.showArea) {
    // one closed shape per unbroken run of points, down to the chart's bottom
    const runs: Pt[][] = [];
    for (const i of idx) {
      if (pts.has(i - 1)) runs.at(-1)?.push(pts.get(i) as Pt);
      else runs.push([pts.get(i) as Pt]);
    }
    const b = n2(f.bottom);
    const d = runs
      .map(
        (r) =>
          `M${n2((r[0] as Pt)[0])},${b} ${r.map(([x, y]) => `L${n2(x)},${n2(y)}`).join(" ")} L${n2((r.at(-1) as Pt)[0])},${b} Z`,
      )
      .join(" ");
    const fill = col.areaColor === undefined ? stroke : att(col.areaColor, "sparkline areaColor");
    body += `<path class="sdvt-area" d="${d}" fill="${fill}" fill-opacity="${col.areaOpacity}"/>`;
  }
  body += `<path class="sdvt-line" d="${path.join(" ")}" fill="none" stroke="${stroke}" stroke-width="${col.lineWidth}" stroke-linejoin="round" stroke-linecap="round"/>`;
  body += statlineSvg(col, f, xs);
  const at = pointsAt(values, idx);
  for (const [i, c] of markColors(col.highlightPoints, at, idx, "sparkline highlightPoints")) {
    const [x, y] = pts.get(i) as Pt;
    body += `<circle class="sdvt-point" cx="${n2(x)}" cy="${n2(y)}" r="${col.pointSize}" fill="${c}" stroke="${c}"/>`;
  }
  // first/last labels alone sit beside their points (as reactablefmtr), any other set above them
  const endsOnly =
    col.labels.length > 0 && !col.labels.some((l) => l === "min" || l === "max" || l === "all");
  const size = att(col.labelSize, "sparkline labelSize");
  for (const i of labelled(col.labels, at, idx)) {
    const [x, y] = pts.get(i) as Pt;
    const pos =
      endsOnly && i === at.first
        ? `x="${n2(x - 6)}" y="${n2(y)}" text-anchor="end" dominant-baseline="middle"`
        : endsOnly && i === at.last
          ? `x="${n2(x + 6)}" y="${n2(y)}" text-anchor="start" dominant-baseline="middle"`
          : `x="${n2(x)}" y="${n2(y - 7)}" text-anchor="middle"`;
    body += `<text class="sdvt-label" ${pos} fill="currentColor" font-size="${size}">${(values[i] as number).toFixed(col.decimals)}</text>`;
  }
  return chartSvg("sparkline", col.chartWidth, f.h, summary("Sparkline", col, xs), body);
}

/** A sparkbar cell, as `sparklineSvg`: bars stand on zero, a gap leaves its slot empty. */
export function sparkbarSvg(
  col: Sparkbar,
  values: readonly (number | null)[],
  color: string,
  row: number,
): string {
  const xs = present(values);
  const idx = presentIdx(values);
  const f = frameOf(col, xs, true, row);
  const band = (f.right - f.left) / values.length;
  const barW = band * 0.8;
  const base = f.y(Math.min(Math.max(0, f.lo), f.hi));
  const at = pointsAt(values, idx);
  const marks = markColors(col.highlightBars, at, idx, "sparkbar highlightBars");
  const fill = att(color, "sparkbar fillColor");
  let body = bandlineSvg(col, f, xs);
  const tops = new Map<number, Pt>();
  for (const i of idx) {
    const x = f.left + i * band + (band - barW) / 2;
    const y = f.y(values[i] as number);
    tops.set(i, [x + barW / 2, Math.min(y, base)]);
    body += `<rect class="sdvt-bar" x="${n2(x)}" y="${n2(Math.min(y, base))}" width="${n2(barW)}" height="${n2(Math.abs(base - y))}" fill="${marks.get(i) ?? fill}" fill-opacity="${col.fillOpacity}"/>`;
  }
  body += statlineSvg(col, f, xs);
  const size = att(col.labelSize, "sparkbar labelSize");
  for (const i of labelled(col.labels, at, idx)) {
    const [x, y] = tops.get(i) as Pt;
    body += `<text class="sdvt-label" x="${n2(x)}" y="${n2(y - 3)}" text-anchor="middle" fill="currentColor" font-size="${size}">${(values[i] as number).toFixed(col.decimals)}</text>`;
  }
  return chartSvg("sparkbar", col.chartWidth, f.h, summary("Bar chart", col, xs), body);
}

/** The annulus path from the gauge's left end, `frac` of the way round the top towards its right end. */
function arc(c: number, outer: number, inner: number, frac: number): string {
  const t = Math.PI * (1 - frac);
  const cos = Math.cos(t);
  const sin = Math.sin(t);
  return `M${n2(c - outer)},${n2(c)} A${n2(outer)},${n2(outer)} 0 0 1 ${n2(c + outer * cos)},${n2(c - outer * sin)} L${n2(c + inner * cos)},${n2(c - inner * sin)} A${n2(inner)},${n2(inner)} 0 0 0 ${n2(c - inner)},${n2(c)} Z`;
}
/**
 * A gauge cell for the finite value `v` on the scale `lo`..`hi` (lo at most hi; equal draws an empty gauge), filled
 * in `color` (checked by the caller), its numbers printed by `fmt`. The absolute value fills the gauge.
 */
export function gaugeSvg(
  col: Gauge,
  v: number,
  lo: number,
  hi: number,
  color: string,
  fmt: (n: number) => string,
): string {
  const w = 50 * col.size;
  const r = w / 2;
  const inner = r * 0.75; // reactablefmtr's cover is 75% of the gauge's width
  const frac = hi === lo ? 0 : Math.min(Math.max((Math.abs(v) - lo) / (hi - lo), 0), 1);
  const ink = col.textColor === undefined ? "currentColor" : att(col.textColor, "gauge textColor");
  const weight = col.boldText ? ' font-weight="bold"' : "";
  const font = col.textSize === undefined ? "" : ` font-size="${att(col.textSize, "gauge textSize")}"`;
  let body = `<path class="sdvt-track" d="${arc(r, r, inner, 1)}" fill="${att(col.background, "gauge background")}"/>`;
  if (frac > 0)
    body += `<path class="sdvt-fill" d="${arc(r, r, inner, frac)}" fill="${color}" fill-opacity="${col.opacity}"/>`;
  body += `<text class="sdvt-value" x="${n2(r)}" y="${n2(r - 2)}" text-anchor="middle" fill="${ink}"${weight}${font}>${escapeHtml(fmt(v))}</text>`;
  if (col.showMinMax) {
    const y = n2(r + 10 * col.size);
    body += `<text class="sdvt-min" x="0" y="${y}" text-anchor="start" fill="${ink}" font-size="0.7em">${escapeHtml(fmt(lo))}</text><text class="sdvt-max" x="${n2(w)}" y="${y}" text-anchor="end" fill="${ink}" font-size="0.7em">${escapeHtml(fmt(hi))}</text>`;
  }
  const gauged = v < 0 ? ` (its absolute value, ${fmt(Math.abs(v))}, is gauged)` : "";
  const label = `Gauge: ${fmt(v)}${gauged} on a scale from ${fmt(lo)} to ${fmt(hi)}`;
  return chartSvg("gauge", w, r + (col.showMinMax ? 12 * col.size : 0), label, body);
}
