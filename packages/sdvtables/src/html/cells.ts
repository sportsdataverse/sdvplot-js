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
import { formatNumber, isBlank, naturalDigits, ordinal, toNumber } from "../format.js";
import type { ColumnSpec, TableSpec } from "../spec.js";
import { teamNameSync } from "../team-name.js";
import type { Theme } from "../themes/tokens.js";
import { escapeAttr, escapeHtml, styleAttr } from "./escape.js";
/** One scaled column (pills, ranks, percentile), computed once per column by Task 8's columnScales. */
export interface ColumnScale {
  readonly domain: readonly [number, number];
  readonly palette: readonly string[];
  readonly reverse: boolean;
  readonly values: readonly (number | null)[];
  readonly color: (v: number) => string | null;
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

export function renderCell<Row>(col: ColumnSpec<Row>, row: Row, i: number, ctx: RenderContext<Row>): string {
  switch (col.kind) {
    case "text":
      return escapeHtml(cellValue(row, col.key));
    // ---- Task 6
    case "num":
    case "int": {
      const n = toNumber(cellValue(row, col.key));
      if (n === null) return "";
      const sc = ctx.scaled.get(col.key); // scaleNote (Task 10): Python fmt_number(scale_by = 1/divisor, decimals) replaces the column's own format
      if (sc) return escapeHtml(formatNumber(n / sc.divisor, { digits: sc.decimals, big: true }));
      return escapeHtml(
        col.kind === "int"
          ? formatNumber(Math.round(n), { digits: 0, big: true })
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
        ? `${num}<sup style="font-size:${escapeAttr(col.suffixSize)}">${o.slice(num.length)}</sup>`
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
      return color ? `<span style="color:${escapeAttr(color)}">${escapeHtml(text)}</span>` : escapeHtml(text);
    }
    case "tally": {
      const ns = col.keys.map((k) => toNumber(cellValue(row, k)));
      if (ns.some((n) => n === null)) {
        const v = cellValue(row, col.key);
        return isBlank(v) ? "" : escapeHtml(v);
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
      const text = escapeHtml(raw);
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
      return url ? markImg(url, String(raw).trim(), checkHeight(col.height, "headshot")) : escapeHtml(raw);
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
      return `<div style="line-height:${col.fontSizeTop - 2}px"><span style="${styleAttr({ "font-weight": "bold", "font-variant": "small-caps", color: col.color, "font-size": `${col.fontSizeTop}px` })}">${escapeHtml(cellValue(row, col.key))}</span></div>\n<div style="line-height:${col.fontSizeBottom - 2}px"><span style="${styleAttr({ "font-weight": "bold", color: ink, "font-size": `${col.fontSizeBottom}px` })}">${escapeHtml(cellValue(row, col.stack))}</span></div>`;
    }
    case "teamColorBar":
    case "teamColorBg":
      return escapeHtml(cellValue(row, col.key)); // the color lives on the <td> (kindCellStyle)
    default:
      throw new TableSpecError(`renderCell: kind ${col.kind} not yet implemented (Tasks 6–8)`); // Task 8 replaces this with the exhaustive `never` check
  }
}
/** Bare `prop:value` declarations a column kind puts on its own `<td>` (Task 7 team colors; Task 8 colorRanks/highlight/highlightNa); "" otherwise. */
export function kindCellStyle<Row>(
  col: ColumnSpec<Row>,
  _row: Row,
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
    default:
      return ""; // Task 8 adds colorRanks / highlight / highlightNa above this line
  }
}
