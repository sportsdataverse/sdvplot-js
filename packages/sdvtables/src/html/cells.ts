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
import { TableSpecError } from "../errors.js";
import { formatNumber, formatValue, isBlank, naturalDigits, ordinal, toNumber } from "../format.js";
import { matches } from "../predicate.js";
import { averageRanks, domainOf, ramp } from "../scale.js";
import type { ColumnSpec, TableSpec } from "../spec.js";
import { teamNameSync } from "../team-name.js";
import type { Theme } from "../themes/tokens.js";
import { checkPx, cssValue, escapeAttr, escapeHtml, styleAttr } from "./escape.js";
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
    if (
      c.kind !== "logo" &&
      c.kind !== "wordmark" &&
      c.kind !== "mergeStackTeamColor" &&
      c.kind !== "teamColorBar" &&
      c.kind !== "teamColorBg"
    )
      continue;
    const from = c.kind === "mergeStackTeamColor" ? c.team : c.key;
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
    if (col.kind === "colorPills" && col.fillType === "rank") {
      values = averageRanks(nums, col.rankOrder === "desc");
      own = () => null; // a rank exists only within domainRows
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
    const domain: readonly [number, number] = col.domain ?? domainOf([values]);
    const fmt = (): string => `(${naturalDigits(domain[0])} to ${naturalDigits(domain[1])})`;
    if (col.kind === "colorPills" && col.domain === undefined)
      warnFn(
        `sdvtables:domain:${col.key}:${domain.join(",")}`,
        `no domain given, so the colors span the observed range ${fmt()}; set domain to compare colors across tables or columns`,
      ); // _cells.py:1197-1201
    const palette = col.palette.map((c) => hex6(c));
    const color = ramp(col.reverse ? [...palette].reverse() : palette, domain);
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
        fill = sc.color(s) ?? "#808080";
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
    default: {
      const bad: never = col;
      throw new TableSpecError(`unknown column kind ${String((bad as { kind: string }).kind)}`); // exhaustive over the 21 kinds
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
      const fill = (s === null ? null : sc?.color(s)) ?? "#ffffff";
      return styleAttr({ "background-color": fill, color: onColor(solid(fill, tableBg(ctx))) });
    }
    case "highlight":
      return matches(col.when, row)
        ? styleAttr({
            "background-color": col.fill,
            color: col.textColor,
            "font-weight": col.bold ? "bold" : undefined,
          })
        : "";
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
