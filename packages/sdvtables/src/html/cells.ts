// src/html/cells.ts — Task 5 version: the context types + dispatcher + text; Tasks 6–8 add the other kinds in this file
import {
  contrast,
  headshotUrl,
  hex6,
  logoUrlSync,
  mix,
  onColor,
  resolveSync,
  solid,
  teamColorsSync,
} from "@sportsdataverse/sdvplot";
import type { EspnHeadshotLeague, League, SeasonInput, Which } from "@sportsdataverse/sdvplot";
import { TableSpecError } from "../errors.js";
import { formatNumber, formatValue, isBlank, naturalDigits, ordinal, toNumber } from "../format.js";
import { matches } from "../predicate.js";
import { averageRanks, domainOf, ntile, ramp } from "../scale.js";
import type { ColumnSpec, IconName, MarkOpts, NumberFormat, TableSpec } from "../spec.js";
import { teamNameSync } from "../team-name.js";
import type { Theme } from "../themes/tokens.js";
import { checkPx, cssValue, escapeAttr, escapeHtml, styleAttr } from "./escape.js";
import { ICON_NAMES, iconSvg } from "./icons.js";
/** One scaled column (pills, ranks, percentile), computed once per column by Task 8's columnScales. */
export interface ColumnScale {
  readonly domain: readonly [number, number];
  readonly palette: readonly string[];
  readonly reverse: boolean;
  readonly values: readonly (number | null)[];
  readonly color: (v: number) => string | null;
  /** colorPills: the widest label in `ch`, computed once per column (gt_color_pills); 1 otherwise. */
  readonly labelWidth: number;
}
/** Decided once here; Tasks 7, 8 and 10 fill the maps (index.ts passes them empty until then). */
export interface RenderContext<Row> {
  readonly spec: TableSpec<Row>;
  readonly rows: readonly Row[];
  /** J31 (A4): the rows scale and legend domains come from (`RenderOptions.domainRows`, default `rows`). */
  readonly domainRows: readonly Row[];
  readonly theme: Theme;
  readonly id: string;
  readonly sel: string;
  readonly columns: readonly ColumnSpec<Row>[];
  readonly groupKey: string | undefined;
  readonly warn: (key: string, message: string) => void;
  /** Task 7: team ids per team column, ONE resolveSync per column (J28), keyed by the column key. */
  readonly teamIds: ReadonlyMap<string, readonly (string | undefined)[]>;
  /** Task 8: scales per pills/ranks/percentile column, keyed by column key. */
  readonly scales: ReadonlyMap<string, ColumnScale>;
  /** Task 8: the last scale in column order — what gt_legend_continuous reads back as `_sdvplot_scale`. */
  readonly recorded: ColumnScale | undefined;
  /** Task 10: scaleNote divisor + decimals per num/int column; applyDecorations fills it before the row loop. */
  readonly scaled: Map<string, { readonly divisor: number; readonly decimals: number }>;
}
export const cellValue = <Row>(row: Row, key: string): unknown => (row as Record<string, unknown>)[key];
/** Cell text: null/undefined/NaN/blank string render empty, never "NaN". */
const blankOr = (v: unknown): string => (isBlank(v) ? "" : escapeHtml(v));
const tableBg = <Row>(ctx: RenderContext<Row>): string =>
  ctx.theme.tokens.bg === "transparent" ? "#ffffff" : hex6(ctx.theme.tokens.bg);

// ---- Task 7 helpers
export function markImg(src: string, alt: string, heightPx: number, teamId?: string): string {
  return `<img class="sdvt-mark" src="${escapeAttr(src)}" alt="${escapeAttr(alt)}" style="height:${heightPx}px"${teamId ? ` data-sdvplot-team="${escapeAttr(teamId)}"` : ""}>`;
}
/** sdvplotR sdv_readable_ink() = Python readable_ink (_marks.py:373-386): primary, else secondary, else primary blended toward onColor(bg), weights 0.95 -> 0. */
export function readableInk(
  primary: string,
  secondary: string | undefined,
  background: string,
  target = 4.5,
): string {
  const toward = onColor(background);
  for (const c of [primary, secondary]) if (c !== undefined && contrast(c, background) >= target) return c;
  for (let i = 0; i < 20; i++) {
    const c = mix(toward, primary, Math.max(0.95 + i * -0.05, 0)); // R seq(0.95, 0, by = -0.05), unrounded
    if (contrast(c, background) >= target) return c;
  }
  return toward;
}
function checkHeight(h: number, kind: string): number {
  if (!(Number.isFinite(h) && h >= 1))
    throw new TableSpecError(`${kind} height must be a number of pixels >= 1, got ${String(h)}`);
  return h;
}
/** ONE resolveSync per team-aware column (J28: one warning per call listing every unresolved value; strict throws once). */
export function teamIdsOf<Row>(
  spec: TableSpec<Row>,
  rows: readonly Row[],
): Map<string, (string | undefined)[]> {
  const out = new Map<string, (string | undefined)[]>();
  for (const c of spec.columns) {
    checkRefs(c);
    // the reactablefmtr-style kinds join in when they name a team column (team colours, or a logo/wordmark mark)
    const optIn = "team" in c && c.kind !== "mergeStackTeamColor" && c.team !== undefined;
    if (
      !optIn &&
      c.kind !== "logo" &&
      c.kind !== "wordmark" &&
      c.kind !== "mergeStackTeamColor" &&
      c.kind !== "teamColorBar" &&
      c.kind !== "teamColorBg"
    )
      continue;
    if (c.league === undefined)
      throw new TableSpecError(`column "${c.key}" names a team column, so it needs a league`);
    const from = "team" in c && c.team !== undefined ? c.team : c.key;
    const values = rows.map((r) => {
      const v = cellValue(r, from);
      return isBlank(v) ? null : String(v).trim(); // the raw value, never the escaped one (Review Focus 1)
    });
    out.set(
      c.key,
      resolveSync(values, c.league, {
        ...(c.season !== undefined ? { season: c.season } : {}),
        ...(c.idSystem ? { idSystem: c.idSystem } : {}),
        strict: c.strict ?? false,
      }),
    );
  }
  return out;
}

type PillsCol = Pick<
  Extract<ColumnSpec<never>, { kind: "colorPills" }>,
  "formatType" | "scalePercent" | "digits" | "suffix"
>;
const pillLabel = (col: PillsCol, v: number | null): string =>
  formatValue(
    v !== null && col.formatType === "percent" && col.scalePercent ? v * 100 : v,
    col.digits,
    col.formatType,
    col.suffix,
  );
type HighlightNaCol = Extract<ColumnSpec<never>, { kind: "highlightNa" }>;
const isNa = (col: HighlightNaCol, v: unknown): boolean =>
  isBlank(v) ||
  col.naStrings.some((n) => (col.ignoreCase ? n.toLowerCase() === String(v).toLowerCase() : n === String(v)));

// ---- reactablefmtr-style kinds (dataBar, iconSet, iconAssign, mergeStack, bubble) and the colorRef / extreme options

/** reactablefmtr `number_fmt`, as data: scale, digits, type, prefix and suffix (formatValue prints the plain "-"). */
const fmtNum = (n: number, f: NumberFormat | undefined): string =>
  `${f?.prefix ?? ""}${formatValue(n * (f?.scale ?? 1), f?.digits, f?.type ?? "number", f?.suffix ?? "")}`;
const clamp01 = (x: number): number => (x < 0 ? 0 : x > 1 ? 1 : x);
/** grDevices::adjustcolor(alpha.f): a hex colour with its alpha replaced; opacity 1 leaves the colour as given. */
function withAlpha(color: string, opacity: number, field: string): string {
  if (!(opacity >= 0 && opacity <= 1))
    throw new TableSpecError(`${field} must be between 0 and 1, got ${opacity}`);
  if (opacity === 1) return cssValue(color, field);
  const a = Math.round(opacity * 255)
    .toString(16)
    .padStart(2, "0");
  return `${hex6(color, { dropAlpha: true })}${a}`;
}

/** One numeric column over `domainRows`, computed once per render (keyed by the domainRows array). */
interface Stats {
  readonly nums: readonly (number | null)[];
  readonly min: number;
  readonly max: number;
  readonly maxAbs: number;
  readonly index: ReadonlyMap<unknown, number>;
  readonly tiles: Map<number, readonly (number | null)[]>;
}
// ponytail: keyed by the domainRows array, so rows are treated as immutable — mutating a row between renders of the
// same array serves stale stats; pass a new array after changing rows.
const STATS = new WeakMap<readonly unknown[], Map<string, Stats>>();
function statsOf<Row>(ctx: RenderContext<Row>, key: string): Stats {
  let byKey = STATS.get(ctx.domainRows);
  if (!byKey) {
    byKey = new Map();
    STATS.set(ctx.domainRows, byKey);
  }
  const hit = byKey.get(key);
  if (hit) return hit;
  const nums = ctx.domainRows.map((r) => toNumber(cellValue(r, key)));
  const present = nums.filter((n): n is number => n !== null);
  const st: Stats = {
    nums,
    min: present.length ? Math.min(...present) : Number.NaN,
    max: present.length ? Math.max(...present) : Number.NaN,
    maxAbs: present.length ? Math.max(...present.map(Math.abs)) : Number.NaN,
    index: new Map(ctx.domainRows.map((r, j) => [r, j] as const)),
    tiles: new Map(),
  };
  byKey.set(key, st);
  return st;
}
/** Row `i`'s dplyr::ntile bucket (1..n) among the column's domain rows; a row outside them is ranked as if appended. */
function tileOf<Row>(ctx: RenderContext<Row>, key: string, row: Row, i: number, n: number): number | null {
  const st = statsOf(ctx, key);
  const j = ctx.domainRows === ctx.rows ? i : st.index.get(row);
  if (j === undefined) return ntile([...st.nums, toNumber(cellValue(row, key))], n).at(-1) ?? null;
  let t = st.tiles.get(n);
  if (!t) {
    t = ntile(st.nums, n);
    st.tiles.set(n, t);
  }
  return t[j] ?? null;
}
/** reactablefmtr data_bars / bubble_grid size: `|v| / max|v|`, or scaled between minValue and maxValue; clamped to [0, 1]. */
function sizeOf(v: number, st: Stats, minValue: number | undefined, maxValue: number | undefined): number {
  const top = maxValue ?? st.maxAbs;
  const r = minValue === undefined ? Math.abs(v) / top : (Math.abs(v) - minValue) / (top - minValue);
  return Number.isFinite(r) ? clamp01(r) : 0;
}
/** reactablefmtr's colour position: (v - min) / (max - min) over the column, 1 when every value is the same. */
const normalized = (v: number, lo: number, hi: number): number =>
  hi === lo ? 1 : clamp01((v - lo) / (hi - lo));
/**
 * A row's colour value (`colorRef`, `iconColorRef`): the trimmed string when it is a hex colour `solid()` can read
 * (`#rgb`, `#rgba`, `#rrggbb`, `#rrggbbaa`), else undefined. Data never reaches CSS unchecked and never throws: a
 * blank, named (`"red"`) or hostile (`url(...)`) value is treated as blank.
 */
function dataColor(v: unknown): string | undefined {
  if (isBlank(v)) return undefined;
  const s = String(v).trim();
  try {
    hex6(s, { dropAlpha: true });
    return s;
  } catch {
    return undefined;
  }
}
/** The row's own colour: `colorRef`'s value, else `team`'s `which` colour; undefined when neither gives one. */
function refColor<Row>(
  col: {
    readonly key: string;
    readonly colorRef?: string;
    readonly team?: string;
    readonly league?: League;
    readonly which?: Which;
  },
  row: Row,
  i: number,
  ctx: RenderContext<Row>,
): string | undefined {
  if (col.colorRef !== undefined) {
    const c = dataColor(cellValue(row, col.colorRef));
    if (c !== undefined) return c;
  }
  if (col.team === undefined || col.league === undefined) return undefined;
  const id = ctx.teamIds.get(col.key)?.[i];
  return id === undefined
    ? undefined
    : teamColorsSync(col.league, id, { which: col.which ?? "primary", idSystem: "team_id" });
}
/** Spec errors a reactablefmtr-style column can only show once rendered: a mark without what it reads. */
function checkRefs<Row>(c: ColumnSpec<Row>): void {
  if (!("mark" in c) || c.mark === undefined) return;
  if ((c.mark === "logo" || c.mark === "wordmark") && (c.team === undefined || c.league === undefined))
    throw new TableSpecError(
      `column "${c.key}": mark "${c.mark}" reads the team column, so set team and league`,
    );
  if (c.mark === "headshot" && (c.markKey === undefined || c.league === undefined))
    throw new TableSpecError(
      `column "${c.key}": mark "headshot" reads an ESPN athlete id, so set markKey and league`,
    );
}
/** The column's logo, wordmark or headshot for row `i`, or "" (blank or unknown: the column's resolveSync warned once). */
function markOf<Row>(
  col: MarkOpts<Row> & {
    readonly key: string;
    readonly kind: string;
    readonly league?: League;
    readonly season?: SeasonInput;
  },
  row: Row,
  i: number,
  ctx: RenderContext<Row>,
): string {
  if (col.mark === undefined || col.league === undefined) return "";
  const h = checkHeight(col.markHeight ?? 20, `${col.kind} mark`);
  if (col.mark === "headshot") {
    const raw = col.markKey === undefined ? null : cellValue(row, col.markKey);
    if (isBlank(raw)) return "";
    const url = headshotUrl(String(raw).trim(), col.league as EspnHeadshotLeague, { idSystem: "espn" });
    return url ? markImg(url, String(raw).trim(), h) : "";
  }
  const id = ctx.teamIds.get(col.key)?.[i];
  if (id === undefined) return "";
  const url = logoUrlSync(id, col.league, {
    ...(col.season !== undefined ? { season: col.season } : {}),
    markType: col.mark,
    idSystem: "team_id",
  });
  return url ? markImg(url, teamNameSync(col.league, id) ?? id, h, id) : "";
}

type DataBarCol<Row> = Extract<ColumnSpec<Row>, { kind: "dataBar" }>;
/** reactablefmtr data_bars (2.1.0 source): track, fill, text position, diverging bars around a #666666 centre line. */
function dataBar<Row>(col: DataBarCol<Row>, row: Row, i: number, ctx: RenderContext<Row>): string {
  const raw = cellValue(row, col.key);
  const v = toNumber(raw);
  if (v === null) return blankOr(raw);
  if (col.fill.length === 0) throw new TableSpecError("dataBar fill needs at least one colour");
  if (col.gradient && col.fill.length < 2)
    throw new TableSpecError("dataBar gradient needs at least two colours in fill");
  const st = statsOf(ctx, col.key);
  const pos = col.textPosition;
  const h =
    col.barHeight !== undefined ? checkPx(col.barHeight, "dataBar barHeight") : pos === "above" ? 5 : 18;
  const radius = col.roundEdges ? h / 2 : 0;
  const posNeg = col.posNeg ?? st.min < 0;
  const ref = refColor(col, row, i, ctx);
  const fill =
    ref ??
    (posNeg && col.fill.length === 2
      ? (col.fill[v < 0 ? 0 : 1] as string)
      : col.fill.length === 1
        ? (col.fill[0] as string)
        : (ramp(
            col.fill.map((c) => hex6(c)),
            [0, 1],
            col.bias,
          )(normalized(v, st.min, st.max)) as string)); // reactablefmtr data_bars: colour over the column's range, minValue/maxValue set width only (bubble_grid uses them for both)
  const gradient = col.gradient ? `linear-gradient(to right, ${col.fill.join(", ")})` : undefined;
  const inside = pos === "inside-end" || pos === "inside-base" || pos === "center";
  const inkOn = col.gradient ? (col.fill.at(v < 0 ? 0 : -1) as string) : fill;
  const ink =
    pos === "none" ? "transparent" : (col.textColor ?? (inside ? onColor(solid(inkOn)) : undefined));
  const label = escapeHtml(fmtNum(v, col.numberFormat));
  const m = markOf(col, row, i, ctx);
  const mark = m ? `<span style="display:inline-flex;margin:0 4px">${m}</span>` : "";
  const right = col.align === "right";
  const width = Number((sizeOf(v, st, col.minValue, col.maxValue) * 100).toFixed(4));
  // one bar: its text inside (inside-*/center/none) or empty; `dir` sets which way it grows
  const bar = (dir: "row" | "row-reverse", text: boolean, gap: boolean): string =>
    `<div style="${styleAttr({
      display: "flex",
      "align-items": "center",
      "flex-direction": dir,
      "justify-content": pos === "center" ? "center" : pos === "inside-base" ? "flex-start" : "flex-end",
      background: gradient ? undefined : fill,
      "background-image": gradient,
      "border-radius": `${radius}px`,
      color: text ? ink : undefined,
      width: `${width}%`,
      height: `${h}px`,
      "white-space": "nowrap",
      [dir === "row" ? "margin-right" : "margin-left"]: gap ? "6px" : undefined,
    })}">${text ? `<span>${label}</span>` : ""}</div>`;
  const textSpan = `<span${ink ? ` style="color:${escapeAttr(cssValue(ink, "dataBar textColor"))}"` : ""}>${label}</span>`;
  const group = (dir: "row" | "row-reverse"): string =>
    inside || pos === "none"
      ? `<div style="display:flex;align-items:center;flex-direction:${dir};width:100%">${bar(dir, true, false)}${mark}</div>`
      : `<div style="display:flex;align-items:center;flex-direction:${dir};width:100%">${bar(dir, false, true)}${mark}${textSpan}</div>`;
  if (posNeg) {
    const half = (side: "neg" | "pos"): string =>
      `<div style="flex:1 1 0;display:flex;align-items:center${side === "neg" ? ";justify-content:flex-end" : ""}">${(v < 0) === (side === "neg") ? group(side === "neg" ? "row-reverse" : "row") : ""}</div>`;
    return `<div class="sdvt-databar" style="display:flex;align-items:stretch;min-height:${h}px">${half("neg")}<div style="width:1px;background:#666666"></div>${half("pos")}</div>`;
  }
  const dir = right ? "row-reverse" : "row";
  const track = (inner: string, gap = false): string =>
    `<div style="${styleAttr({ "flex-grow": 1, "border-radius": `${radius}px`, background: col.background, [right ? "margin-right" : "margin-left"]: gap ? "6px" : undefined })}">${inner}</div>`;
  if (pos === "above")
    return `<div class="sdvt-databar"><div style="text-align:${right ? "right" : "left"}${ink ? `;color:${escapeAttr(cssValue(ink, "dataBar textColor"))}` : ""}">${label}</div>${track(`<div style="display:flex;align-items:center;flex-direction:${dir}">${bar(dir, false, false)}${mark}</div>`)}</div>`;
  if (pos === "outside-base") {
    const chars = Math.max(
      1,
      ...st.nums.filter((n): n is number => n !== null).map((n) => fmtNum(n, col.numberFormat).length),
    );
    return `<div class="sdvt-databar" style="display:flex;align-items:center;flex-direction:${dir}"><span style="${styleAttr({ "min-width": `${chars}ch`, "text-align": right ? "left" : "right", "font-variant-numeric": "tabular-nums", color: ink })}">${label}</span>${track(`<div style="display:flex;align-items:center;flex-direction:${dir}">${bar(dir, false, false)}${mark}</div>`, true)}</div>`;
  }
  return `<div class="sdvt-databar" style="display:flex">${track(group(dir))}</div>`;
}

type IconSetCol<Row> = Extract<ColumnSpec<Row>, { kind: "iconSet" }>;
/** reactablefmtr icon_sets: icon and colour by equal-count bucket (or per row), beside the value. */
function iconSet<Row>(col: IconSetCol<Row>, row: Row, i: number, ctx: RenderContext<Row>): string {
  const raw = cellValue(row, col.key);
  const v = toNumber(raw);
  if (v === null) return blankOr(raw);
  // a blank or unknown iconRef / iconColorRef value falls back to the row's bucket icon / colour (one bad row never throws)
  const named = col.iconRef === undefined ? undefined : cellValue(row, col.iconRef);
  const icon: IconName =
    !isBlank(named) && ICON_NAMES.includes(String(named).trim() as IconName)
      ? (String(named).trim() as IconName)
      : (col.icons[(tileOf(ctx, col.key, row, i, col.icons.length) ?? 1) - 1] as IconName);
  const color =
    (col.iconColorRef === undefined ? undefined : dataColor(cellValue(row, col.iconColorRef))) ??
    (col.colors[(tileOf(ctx, col.key, row, i, col.colors.length) ?? 1) - 1] as string);
  const svg = iconSvg(
    icon,
    withAlpha(color, col.opacity, "iconSet colors"),
    checkPx(col.iconSize, "iconSet iconSize"),
  );
  const label = escapeHtml(fmtNum(v, col.numberFormat));
  switch (col.iconPosition) {
    case "left":
      return `<span style="display:inline-block;margin-right:8px">${svg}</span>${label}`;
    case "above":
      return `<div>${svg}</div><div>${label}</div>`;
    case "below":
      return `<div>${label}</div><div>${svg}</div>`;
    case "over":
      return `${svg}<span style="font-size:0;color:transparent">${label}</span>`;
    default:
      return `${label}<span style="display:inline-block;margin-left:8px">${svg}</span>`;
  }
}

type IconAssignCol<Row> = Extract<ColumnSpec<Row>, { kind: "iconAssign" }>;
/** reactablefmtr icon_assign: one icon per unit up to the column maximum, filled up to the rounded value (or by bucket). */
function iconAssign<Row>(col: IconAssignCol<Row>, row: Row, i: number, ctx: RenderContext<Row>): string {
  const raw = cellValue(row, col.key);
  const v = toNumber(raw);
  if (v === null) return blankOr(raw);
  const size = checkPx(col.iconSize, "iconAssign iconSize");
  const on = withAlpha(col.fill, col.fillOpacity, "iconAssign fill");
  const off = withAlpha(col.empty, col.emptyOpacity, "iconAssign empty");
  const half = (x: number): number => Math.floor(x + 0.5);
  let steps: number[];
  let filled: (s: number) => boolean;
  let title: string;
  if (col.buckets !== undefined) {
    const b = tileOf(ctx, col.key, row, i, col.buckets) ?? 0;
    steps = Array.from({ length: col.buckets }, (_, k) => k + 1);
    filled = (s) => s <= half(b);
    title = `${b} out of ${col.buckets}`;
  } else {
    if (!(col.seqBy > 0)) throw new TableSpecError(`iconAssign seqBy must be positive, got ${col.seqBy}`);
    const top = half(statsOf(ctx, col.key).max);
    const n = half(v);
    steps = [];
    // ponytail: an all-negative column (top < 0) draws no icons, only the value; R's seq(1, top) errors there
    if (top === 0) steps.push(0);
    else for (let s = 1; s <= top; s += col.seqBy) steps.push(s);
    if (steps.length > 1000)
      throw new TableSpecError(`iconAssign would draw ${steps.length} icons per cell; set buckets or seqBy`);
    filled = top === 0 ? (s) => s < n : (s) => s <= n;
    title = `${naturalDigits(v)} out of ${top}`;
  }
  const icons = steps.map((s) => iconSvg(col.icon, filled(s) ? on : off, size)).join("");
  const box = `<span title="${escapeAttr(title)}" aria-label="${escapeAttr(title)}" role="img">${icons}</span>`;
  const label = escapeHtml(fmtNum(v, col.numberFormat));
  switch (col.showValues) {
    case "right":
      return `${box}<span style="margin-left:6px">${label}</span>`;
    case "left":
      return `<span style="margin-right:6px">${label}</span>${box}`;
    case "above":
      return `<div>${label}</div><div>${box}</div>`;
    case "below":
      return `<div>${box}</div><div>${label}</div>`;
    default:
      return box;
  }
}

type MergeStackCol<Row> = Extract<ColumnSpec<Row>, { kind: "mergeStack" }>;
/** reactablefmtr merge_column: the value and a second column's value, `spacing + 3` px apart, optional mark first. */
function mergeStack<Row>(col: MergeStackCol<Row>, row: Row, i: number, ctx: RenderContext<Row>): string {
  const main = `font-size:${checkPx(col.size, "mergeStack size")}px;${styleAttr({ color: col.color, "font-weight": col.weight, "font-style": col.style })}`;
  const sub = `font-size:${checkPx(col.stackSize, "mergeStack stackSize")}px;${styleAttr({ color: col.stackColor, "font-weight": col.stackWeight, "font-style": col.stackStyle })}`;
  const gap = checkPx(col.spacing, "mergeStack spacing") + 3;
  const a = blankOr(cellValue(row, col.key));
  const b = blankOr(cellValue(row, col.stack));
  const body =
    col.position === "below"
      ? `<div><div style="${main};margin-bottom:${gap}px">${a}</div><div style="${sub}">${b}</div></div>`
      : col.position === "above"
        ? `<div><div style="${sub};margin-bottom:${gap}px">${b}</div><div style="${main}">${a}</div></div>`
        : col.position === "left"
          ? `<span style="${sub};margin-right:${gap}px">${b}</span><span style="${main}">${a}</span>`
          : `<span style="${main};margin-right:${gap}px">${a}</span><span style="${sub}">${b}</span>`;
  const m = markOf(col, row, i, ctx);
  const stacked = col.position === "below" || col.position === "above"; // already one block
  return m
    ? `<div style="display:flex;align-items:center;gap:6px">${m}${stacked ? body : `<div>${body}</div>`}</div>`
    : body;
}

type BubbleCol<Row> = Extract<ColumnSpec<Row>, { kind: "bubble" }>;
/** reactablefmtr bubble_grid: a circle or square `maxSize * |v| / max|v|` px across, coloured on the column's ramp. */
function bubble<Row>(col: BubbleCol<Row>, row: Row, i: number, ctx: RenderContext<Row>): string {
  const raw = cellValue(row, col.key);
  const v = toNumber(raw);
  if (v === null) return blankOr(raw);
  if (col.colors.length === 0) throw new TableSpecError("bubble colors needs at least one colour");
  const st = statsOf(ctx, col.key);
  const px = Number(
    (sizeOf(v, st, col.minValue, col.maxValue) * checkPx(col.maxSize, "bubble maxSize")).toFixed(2),
  );
  const base =
    refColor(col, row, i, ctx) ??
    (ramp(
      col.colors.map((c) => hex6(c)),
      [0, 1],
      col.bias,
    )(normalized(v, col.minValue ?? st.min, col.maxValue ?? st.max)) as string);
  const fill = withAlpha(base, col.opacity, "bubble opacity");
  const ink = col.showText ? (col.textColor ?? onColor(solid(fill, tableBg(ctx)))) : "transparent";
  return `<div style="${styleAttr({
    background: fill,
    color: ink,
    display: "inline-flex",
    "justify-content": "center",
    "align-items": "center",
    "text-align": "center",
    height: `${px}px`,
    width: `${px}px`,
    "border-radius": col.shape === "circles" ? "50%" : undefined,
  })}">${escapeHtml(fmtNum(v, col.numberFormat))}</div>`;
}

/** highlight's extreme mode (reactablefmtr highlight_min/max/min_max): "min", "max" or null for this row. */
function extremeOf<Row>(
  col: Extract<ColumnSpec<Row>, { kind: "highlight" }>,
  row: Row,
  ctx: RenderContext<Row>,
): "min" | "max" | null {
  if (col.extreme === undefined) return col.when !== undefined && matches(col.when, row) ? "max" : null;
  const v = toNumber(cellValue(row, col.key));
  if (v === null) return null;
  const st = statsOf(ctx, col.key);
  if (col.extreme !== "max" && v === st.min) return "min";
  if (col.extreme !== "min" && v === st.max) return "max";
  return null;
}

/** The column kinds `columnScales` computes a scale for. */
export const isScaled = <Row>(
  col: ColumnSpec<Row>,
): col is Extract<ColumnSpec<Row>, { kind: "colorPills" | "colorRanks" | "percentileBar" }> =>
  col.kind === "colorPills" || col.kind === "colorRanks" || col.kind === "percentileBar";
/** One pass per scaled column (pills, ranks, percentile): numbers, ranks, domain, ramp — gt computes these per column, not per cell. */
export function columnScales<Row>(
  spec: TableSpec<Row>,
  rows: readonly Row[],
  warnFn: (key: string, m: string) => void,
  domainRows: readonly Row[] = rows,
): Map<string, ColumnScale> {
  // J31 (A4): domain, ranks and the out-of-domain count come from domainRows; `values` and pill widths follow `rows`
  const at = domainRows === rows ? null : new Map(domainRows.map((r, j) => [r, j] as const));
  const missing = at !== null && rows.some((r) => !at.has(r));
  const out = new Map<string, ColumnScale>();
  for (const col of spec.columns) {
    if (!isScaled(col)) continue;
    if (missing)
      warnFn(
        `sdvtables:domainRows:${col.key}`,
        `column "${col.key}": a rendered row is not in domainRows (matched by identity, not by value), so it is colored from its own value (a rank fill: not at all); pass the same row objects as rows`,
      );
    // zero rows: no domain to derive, nothing to color. Phase 4's throw for an all-null NON-empty column stays (domainOf).
    if (col.domain === undefined && domainRows.length === 0) continue;
    const nums = domainRows.map((r) => toNumber(cellValue(r, col.key)));
    let values: (number | null)[] = nums;
    let own = (n: number | null): number | null => n; // a rendered row's value when it is not in domainRows (I2)
    let spanned: readonly [number, number] | undefined;
    let buckets: readonly string[] | undefined;
    if (col.kind === "colorPills" && col.fillType === "rank") {
      values = averageRanks(nums, col.rankOrder === "desc");
      own = () => null; // a rank exists only within domainRows
    }
    if (col.kind === "colorRanks" && col.evenBreaks) {
      // reactablefmtr even_breaks: colour i of n for the i-th equal-count bucket (dplyr::ntile), no ramp
      buckets = col.palette.map((c) => hex6(c));
      values = ntile(nums, buckets.length);
      own = () => null;
    } else if (col.kind === "colorRanks" && col.span && col.domain === undefined) {
      // reactablefmtr span: one range over several columns (TRUE: every numeric column of the data)
      const keys =
        col.span === true
          ? [...new Set(domainRows.flatMap((r) => Object.keys(r as object)))].filter((k) =>
              domainRows.some((r) => typeof cellValue(r, k) === "number"),
            )
          : col.span;
      spanned = domainOf(keys.map((k) => domainRows.map((r) => toNumber(cellValue(r, k)))));
    }
    if (col.kind === "percentileBar") {
      const present = nums.filter((n): n is number => n !== null);
      const [lo, hi] = col.domain;
      const scale = col.scale;
      // _layout.py:772-779,806: numeric scale multiplies; "auto" maps proportions only when every value is in [0, 1] and hi > 1
      const proportion =
        scale === "auto" && present.length > 0 && present.every((n) => n >= 0 && n <= 1) && hi > 1;
      own = (n) =>
        n === null ? null : typeof scale === "number" ? n * scale : proportion ? lo + n * (hi - lo) : n;
      values = nums.map(own);
    }
    const domain: readonly [number, number] = buckets
      ? [1, buckets.length]
      : (col.domain ?? spanned ?? domainOf([values]));
    const fmt = (): string => `(${naturalDigits(domain[0])} to ${naturalDigits(domain[1])})`;
    if (col.kind === "colorPills" && col.domain === undefined)
      warnFn(
        `sdvtables:domain:${col.key}:${domain.join(",")}`,
        `no domain given, so the colors span the observed range ${fmt()}; set domain to compare colors across tables or columns`,
      ); // _cells.py:1197-1201
    const palette = col.palette.map((c) => hex6(c));
    const ordered = col.reverse ? [...palette].reverse() : palette;
    const color = buckets
      ? (b: number): string | null => ordered[b - 1] ?? null
      : ramp(ordered, domain, col.kind === "colorRanks" ? (col.bias ?? 1) : 1);
    const outside = values.filter((v) => v !== null && color(v) === null).length;
    if (col.kind === "colorPills" && outside > 0)
      warnFn(
        `sdvtables:outside:${col.key}:${outside}:${domain.join(",")}`,
        `${outside} value(s) fall outside the domain ${fmt()} and are drawn grey`,
      ); // _cells.py:1226-1227
    const shown =
      at === null
        ? values
        : rows.map((r) => {
            const j = at.get(r);
            return j === undefined ? own(toNumber(cellValue(r, col.key))) : (values[j] ?? null);
          });
    const shownNums = at === null ? nums : rows.map((r) => toNumber(cellValue(r, col.key)));
    const labelWidth =
      col.kind === "colorPills" ? Math.max(1, ...shownNums.map((n) => pillLabel(col, n).length)) : 1;
    out.set(col.key, { domain, palette, reverse: col.reverse, values: shown, color, labelWidth });
  }
  return out;
}

export function renderCell<Row>(col: ColumnSpec<Row>, row: Row, i: number, ctx: RenderContext<Row>): string {
  switch (col.kind) {
    case "text":
    case "colorResults": // colorResults fills its row (decorations.ts, Task 9); the cell is its text
      return blankOr(cellValue(row, col.key));
    // ---- Task 6
    case "num":
    case "int": {
      const n = toNumber(cellValue(row, col.key));
      if (n === null) return "";
      const sc = ctx.scaled.get(col.key); // scaleNote (Task 10): Python fmt_number(scale_by = 1/divisor, decimals) replaces the column's own format
      if (sc) return escapeHtml(formatNumber(n / sc.divisor, { digits: sc.decimals, big: true }));
      return escapeHtml(
        col.kind === "int"
          ? formatNumber(n, { digits: 0, big: true })
          : formatNumber(n, {
              ...(col.digits !== undefined ? { digits: col.digits } : {}),
              big: col.big ?? false,
              prefix: col.prefix ?? "",
              suffix: col.suffix ?? "",
              forceSign: col.forceSign ?? false,
            }),
      );
    }
    case "pct": {
      const n = toNumber(cellValue(row, col.key));
      return n === null
        ? ""
        : escapeHtml(`${formatNumber(col.scale ? n * 100 : n, { digits: col.digits })}%`);
    }
    case "rank": {
      const n = toNumber(cellValue(row, col.key));
      if (n === null) return "";
      const o = ordinal(n);
      const num = String(Math.trunc(n));
      return col.superscript
        ? `${num}<sup style="font-size:${escapeAttr(cssValue(col.suffixSize, "rank suffixSize"))}">${o.slice(num.length)}</sup>`
        : escapeHtml(o);
    }
    case "delta": {
      const a = toNumber(cellValue(row, col.key));
      const b = toNumber(cellValue(row, col.to));
      if (a === null || b === null) return "";
      const d = col.percent ? (a === 0 ? null : (b - a) / a) : b - a;
      if (d === null || !Number.isFinite(d)) return "";
      const shown = col.arrows ? Math.abs(d) : d;
      const text = `${col.arrows ? (d > 0 ? "▲ " : d < 0 ? "▼ " : "") : ""}${formatNumber(col.percent ? shown * 100 : shown, { digits: col.decimals, forceSign: col.forceSign && !col.arrows })}${col.percent ? "%" : ""}`;
      const color = !col.color
        ? null
        : d > 0
          ? col.colorPositive
          : d < 0
            ? col.colorNegative
            : (col.colorNeutral ?? null);
      return color
        ? `<span style="color:${escapeAttr(cssValue(color, "delta color"))}">${escapeHtml(text)}</span>`
        : escapeHtml(text);
    }
    case "tally": {
      const ns = col.keys.map((k) => toNumber(cellValue(row, k)));
      if (ns.some((n) => n === null)) {
        const v = cellValue(row, col.key);
        return blankOr(v);
      }
      const xs = ns as number[];
      if (col.share && !(Number.isInteger(col.shareOf) && col.shareOf >= 0 && col.shareOf < xs.length))
        throw new TableSpecError(`tally shareOf must index (from 0) one of ${col.keys.join(", ")}`);
      const text = xs.map((n) => naturalDigits(n)).join(col.separator);
      const total = xs.reduce((s, n) => s + n, 0);
      if (!col.share || total === 0) return escapeHtml(text);
      return escapeHtml(
        `${text}${col.sharePrefix}${formatNumber(((xs[col.shareOf] ?? 0) / total) * 100, { digits: col.shareDecimals })}%${col.shareSuffix}`,
      );
    }
    // ---- Task 7
    case "logo":
    case "wordmark": {
      const raw = cellValue(row, col.key);
      const text = blankOr(raw);
      const id = ctx.teamIds.get(col.key)?.[i];
      if (id === undefined) return text; // blank or unknown: text kept; the column's one resolveSync already warned (J28)
      const url = logoUrlSync(id, col.league, {
        ...(col.season !== undefined ? { season: col.season } : {}),
        ...(col.variant ? { variant: col.variant } : {}),
        markType: col.kind,
        idSystem: "team_id",
      });
      if (!url) return text; // no mark of that type archived (sdvplot warns once)
      return (
        markImg(url, teamNameSync(col.league, id) ?? String(raw), checkHeight(col.height, col.kind), id) +
        (col.kind === "logo" && col.includeName ? text : "")
      );
    }
    case "headshot": {
      const raw = cellValue(row, col.key);
      if (isBlank(raw)) return "";
      const url = headshotUrl(String(raw).trim(), col.league, { idSystem: col.idSystem });
      return url ? markImg(url, String(raw).trim(), checkHeight(col.height, "headshot")) : blankOr(raw);
    }
    case "mergeStackTeamColor": {
      // gt_merge_stack_team_color (_marks.py:451-475): two divs; the bottom in the team's readable color, #bebebe when unresolved
      const id = ctx.teamIds.get(col.key)?.[i];
      const bg = col.background ? solid(col.background) : tableBg(ctx);
      const p = id === undefined ? undefined : teamColorsSync(col.league, id, { idSystem: "team_id" });
      const s =
        id === undefined
          ? undefined
          : teamColorsSync(col.league, id, { which: "secondary", idSystem: "team_id" });
      const ink = readableInk(p ?? "#bebebe", s, bg);
      return `<div style="line-height:${col.fontSizeTop - 2}px"><span style="${styleAttr({ "font-weight": "bold", "font-variant": "small-caps", color: col.color, "font-size": `${col.fontSizeTop}px` })}">${blankOr(cellValue(row, col.key))}</span></div>\n<div style="line-height:${col.fontSizeBottom - 2}px"><span style="${styleAttr({ "font-weight": "bold", color: ink, "font-size": `${col.fontSizeBottom}px` })}">${blankOr(cellValue(row, col.stack))}</span></div>`;
    }
    case "teamColorBar":
    case "teamColorBg":
      return blankOr(cellValue(row, col.key)); // the color lives on the <td> (kindCellStyle)
    // ---- Task 8
    case "colorPills": {
      // gt_color_pills (_cells.py:1203-1225)
      const sc = ctx.scales.get(col.key);
      if (!sc) return "";
      const pillHeight = checkPx(col.pillHeight, "colorPills pillHeight");
      const outlineWidth = checkPx(col.outlineWidth, "colorPills outlineWidth");
      const s = sc.values[i] ?? null;
      const width = sc.labelWidth;
      let fill: string;
      let text: string;
      if (s === null) {
        if (col.naColor === undefined) return "";
        fill = col.naColor;
        text = "";
      } else {
        fill = refColor(col, row, i, ctx) ?? sc.color(s) ?? "#808080";
        text = pillLabel(col, toNumber(cellValue(row, col.key)));
      }
      const ink = col.textColor ?? onColor(solid(fill, tableBg(ctx)));
      const outline =
        col.outlineColor !== undefined
          ? `;border:${outlineWidth}px solid ${escapeAttr(cssValue(col.outlineColor, "colorPills outlineColor"))}`
          : "";
      return `<span style="display:inline-block;width:${width}ch;padding-left:3px;padding-right:3px;height:${pillHeight}px;line-height:${pillHeight}px;background-color:${escapeAttr(cssValue(fill, "colorPills naColor"))};color:${escapeAttr(cssValue(ink, "colorPills textColor"))};border-radius:10px;text-align:center${outline}">${escapeHtml(text)}</span>`;
    }
    case "colorRanks":
    case "highlight":
      return blankOr(cellValue(row, col.key)); // the fill lives on the <td> (kindCellStyle)
    case "highlightNa":
      return isNa(col, cellValue(row, col.key))
        ? escapeHtml(col.missingText ?? "")
        : blankOr(cellValue(row, col.key));
    case "percentileBar": {
      const sc = ctx.scales.get(col.key);
      const v = sc?.values[i] ?? null;
      const th = checkPx(col.trackHeight, "percentileBar trackHeight");
      const m = checkPx(col.markerSize, "percentileBar markerSize");
      const fontSize = col.fontSize === undefined ? m / 2 : checkPx(col.fontSize, "percentileBar fontSize");
      const ringWidth = checkPx(col.ringWidth, "percentileBar ringWidth");
      const trackColor = escapeAttr(cssValue(col.trackColor, "percentileBar trackColor"));
      const textColor = escapeAttr(cssValue(col.textColor, "percentileBar textColor"));
      if (sc === undefined || v === null) {
        // broken track: flex, so no `left:` anywhere
        const seg = `<div style="flex:1;height:${th}px;background:${escapeAttr(cssValue(col.naTrackColor ?? col.trackColor, "percentileBar naTrackColor"))};border-radius:${th}px"></div>`;
        return `<div class="sdvt-pbar" style="display:flex;align-items:center;height:${m}px;width:100%">${seg}<span style="margin:0 6px;color:${escapeAttr(cssValue(col.naTextColor, "percentileBar naTextColor"))};font-size:${fontSize}px">${escapeHtml(col.naLabel ?? "")}</span>${seg}</div>`;
      }
      const [lo, hi] = sc.domain;
      const clamped = Math.min(hi, Math.max(lo, v));
      const p = Number((hi === lo ? 50 : ((clamped - lo) / (hi - lo)) * 100).toFixed(4));
      const color = sc.color(clamped) ?? trackColor; // ramp output is hex
      const track = `<div style="position:absolute;top:50%;left:0;right:0;height:${th}px;margin-top:-${th / 2}px;background:${trackColor};border-radius:${th}px"></div>`;
      const fill = col.fullTrack
        ? ""
        : `<div style="position:absolute;top:50%;left:0;width:${p}%;height:${th}px;margin-top:-${th / 2}px;background:${color};border-radius:${th}px"></div>`;
      const ring =
        col.ringColor !== undefined
          ? `;box-shadow:0 0 0 ${ringWidth}px ${escapeAttr(cssValue(col.ringColor, "percentileBar ringColor"))}`
          : "";
      const marker = `<div style="position:absolute;top:0;left:${p}%;margin-left:-${m / 2}px;width:${m}px;height:${m}px;border-radius:50%;background:${color};color:${textColor};font-size:${fontSize}px;line-height:${m}px;text-align:center;font-weight:700;letter-spacing:-0.02em${ring}">${escapeHtml(formatValue(v, col.decimals, "number", ""))}</div>`;
      return `<div class="sdvt-pbar" style="position:relative;height:${m}px;width:100%">${track}${fill}${marker}</div>`;
    }
    case "indicatorBox": {
      // gt_indicator_boxes (_cells.py:1428-1449): box only (no show_text in Phase 4)
      const on = col.truthy.includes(cellValue(row, col.key));
      if ((col.showOnly === "filled" && !on) || (col.showOnly === "neutral" && on)) return "";
      return `<span style="${styleAttr({ display: "inline-block", width: `${col.size}px`, height: `${col.size}px`, "background-color": on ? col.fill : col.neutral, "vertical-align": "middle", margin: "4px 1px" })}"></span>`;
    }
    case "image": {
      const v = cellValue(row, col.key);
      if (isBlank(v)) return "";
      const alt = col.alt ? cellValue(row, col.alt) : "";
      return markImg(
        String(v),
        isBlank(alt) ? "" : String(alt),
        checkHeight(Number.parseFloat(col.height), "image"),
      );
    }
    // ---- reactablefmtr-style kinds
    case "dataBar":
      return dataBar(col, row, i, ctx);
    case "iconSet":
      return iconSet(col, row, i, ctx);
    case "iconAssign":
      return iconAssign(col, row, i, ctx);
    case "mergeStack":
      return mergeStack(col, row, i, ctx);
    case "bubble":
      return bubble(col, row, i, ctx);
    default: {
      const bad: never = col;
      throw new TableSpecError(`unknown column kind ${String((bad as { kind: string }).kind)}`); // exhaustive over the 26 kinds
    }
  }
}
/** Bare `prop:value` declarations a column kind puts on its own `<td>` (Task 7 team colors; Task 8 colorRanks/highlight/highlightNa); "" otherwise. */
export function kindCellStyle<Row>(
  col: ColumnSpec<Row>,
  row: Row,
  i: number,
  ctx: RenderContext<Row>,
): string {
  switch (col.kind) {
    case "teamColorBar":
    case "teamColorBg": {
      // reactable_sdv_team_color_bar/_bg
      const id = ctx.teamIds.get(col.key)?.[i];
      const color =
        (id === undefined
          ? undefined
          : teamColorsSync(col.league, id, { which: col.which, idSystem: "team_id" })) ?? col.naColor;
      if (col.kind === "teamColorBar")
        return styleAttr({ "border-left": `${col.barWidth}px solid ${color}` });
      const a = Math.round(Math.min(1, Math.max(0, col.alpha)) * 255)
        .toString(16)
        .padStart(2, "0");
      return styleAttr({ "background-color": `${hex6(color, { dropAlpha: true })}${a}` }); // scales::alpha(): replace any alpha the color had
    }
    case "colorRanks": {
      // data_color on the <td>; null or outside the domain -> na_color "white" (gt_color_ranks default)
      const sc = ctx.scales.get(col.key);
      const s = sc?.values[i] ?? null;
      const ref = s === null ? undefined : refColor(col, row, i, ctx); // a null cell stays white (na_color)
      const fill = ref ?? (s === null ? null : sc?.color(s)) ?? "#ffffff";
      return styleAttr({
        "background-color": fill,
        color: col.showText === false ? "transparent" : onColor(solid(fill, tableBg(ctx))),
      });
    }
    case "highlight": {
      const hit = extremeOf(col, row, ctx);
      return hit
        ? styleAttr({
            "background-color": col.fill,
            color: col.textColor ?? (col.extreme === undefined ? undefined : hit === "min" ? "red" : "green"),
            "font-weight": col.bold ? "bold" : undefined,
          })
        : "";
    }
    case "highlightNa":
      return isNa(col, cellValue(row, col.key))
        ? styleAttr({
            "background-color": col.fill,
            color: col.textColor,
            "font-weight": col.bold ? "bold" : undefined,
            "font-style": col.italic ? "italic" : undefined,
          })
        : "";
    default:
      return "";
  }
}
