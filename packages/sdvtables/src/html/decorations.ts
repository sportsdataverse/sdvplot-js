// src/html/decorations.ts — Task 5 version: every hook exists (defaults are no-ops); title, subtitle, sourceNote here; groupBy is read by index.ts.
// Later tasks only POPULATE hooks; none adds one. Style hooks return bare declarations — index.ts builds the one style="" (styleOf).
import { hex6, onColor } from "@sportsdataverse/sdvplot";
import { TableSpecError } from "../errors.js";
import { isBlank } from "../format.js";
import { selectRows } from "../predicate.js";
import type { ColumnSpec, Decoration, TableSpec } from "../spec.js";
import { secondaryOn } from "../themes/sdv.js";
import type { GoogleFont } from "../themes/tokens.js";
import { type RenderContext, cellValue } from "./cells.js";
import { escapeHtml, styleAttr } from "./escape.js";
export interface DecorationOutput<Row> {
  caption: string;
  headRows: string;
  foot: string[];
  before: string;
  after: string;
  css: string[];
  fonts: GoogleFont[];
  hiddenColumns: Set<string>;
  /** raw label text replacing a column's label (marginalia, Task 11) */
  labelText: Map<string, string>;
  /** label HTML from raw text: escapes; wrapLabels (Task 6) wraps first */
  label(col: ColumnSpec<Row>, text: string): string;
  /** raw text appended to a label before label() (scaleNote where "label"/"both", Task 10) */
  labelSuffix(key: string): string;
  /** `<th>` declarations after the column's own width (marginalia width, Task 11) */
  labelStyle(key: string): string;
  /** " cls" list for `<tr class="sdvt-row…">` (groupStripes, cutline — Task 9) */
  rowClass(i: number): string;
  /** `<tr>` declarations (rowAccent, boldRows, spotlight, colorResults — Task 9) */
  rowStyle(i: number): string;
  /** " cls" for the group header row of the `groupIndex`-th group (groupStripes, Task 9) */
  groupRowClass(groupIndex: number): string;
  /** `<td>` declarations after the kind's own (spotlight columns — Task 9; outliers, marginalia, tiers — Tasks 11–12) */
  cellStyle(i: number, key: string): string;
  /** HTML appended after the rendered cell (significance stars, outlier symbol — Task 11) */
  cellSuffix(i: number, key: string): string;
}
// ---- Task 6: R strwrap via Python textwrap.wrap(width - 1) (_layout.py:1813-1815) and _balanced (:1818-1833)
function strwrap(words: readonly string[], width: number): string[] {
  const w = Math.max(width - 1, 1);
  const out: string[] = [];
  let cur = "";
  for (const word of words) {
    if (cur && cur.length + 1 + word.length > w) {
      out.push(cur);
      cur = word;
    } else cur = cur ? `${cur} ${word}` : word;
  }
  return cur ? [...out, cur] : out;
}
export function wrapLabel(text: string, width: number, balance: boolean): string[] {
  const words = text.split(/\s+/).filter((x) => x !== "");
  if (words.length <= 1) return [text];
  const greedy = strwrap(words, width);
  if (greedy.length <= 1) return [text];
  if (!balance) return greedy;
  const target = Math.ceil(words.reduce((s, x) => s + x.length + 1, 0) / greedy.length);
  const lines: string[] = [];
  let cur = "";
  for (const word of words) {
    const cand = cur ? `${cur} ${word}` : word;
    if (cand.length > target && cur) {
      lines.push(cur);
      cur = word;
    } else cur = cand;
  }
  return cur ? [...lines, cur] : lines;
}

// ---- Task 9
export function groupIndexOf<Row>(rows: readonly Row[], key: string): number[] {
  const seen = new Map<unknown, number>();
  return rows.map((r) => {
    const g = cellValue(r, key);
    if (!seen.has(g)) seen.set(g, seen.size);
    return seen.get(g) as number;
  });
}
/** Python _cutline_svg (_cells.py:806-817) byte for byte: uppercase label, `quote(svg, safe="")`, `;charset=utf-8`. */
export function cutlineSvg(text: string, color: string, size: number): string {
  const t = text.toUpperCase();
  const tracking = 1.1;
  const esc = t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const f0 = (x: number): string => {
    const r = Math.round(x);
    return String(Math.abs(x % 1) === 0.5 && r % 2 !== 0 ? r - 1 : r);
  }; // Python :.0f rounds half to even
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${f0(t.length * (size * 0.8 + tracking) + 4)}" height="${f0(size + 4)}"><text x="0" y="${(size + 0.5).toFixed(1)}" font-family="Helvetica,Arial,sans-serif" font-size="${size}" font-weight="700" letter-spacing="${tracking}" fill="${color}">${esc}</text></svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg).replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`)}`;
}
const isList = (p: unknown): p is readonly string[] => Array.isArray(p);

export function applyDecorations<Row>(
  spec: TableSpec<Row>,
  rows: readonly Row[],
  ctx: RenderContext<Row>,
): DecorationOutput<Row> {
  const none = (): string => "";
  const out: DecorationOutput<Row> = {
    caption: "",
    headRows: "",
    foot: [],
    before: "",
    after: "",
    css: [],
    fonts: [],
    hiddenColumns: new Set(),
    labelText: new Map(),
    label: (_c, t) => escapeHtml(t),
    labelSuffix: none,
    labelStyle: none,
    rowClass: none,
    rowStyle: none,
    groupRowClass: none,
    cellStyle: none,
    cellSuffix: none,
  };
  const title = spec.decorations.find(
    (d): d is Extract<Decoration<Row>, { type: "title" }> => d.type === "title",
  );
  const subtitle = spec.decorations.find(
    (d): d is Extract<Decoration<Row>, { type: "subtitle" }> => d.type === "subtitle",
  );
  if (title || subtitle)
    out.caption = `${title ? `<span class="sdvt-title">${escapeHtml(title.text)}</span>` : ""}${subtitle ? `<span class="sdvt-subtitle">${escapeHtml(subtitle.text)}</span>` : ""}`;
  // Task 9: the per-row / per-cell maps every row and cell decoration writes into (later tasks reuse them)
  const rowStyles = new Map<number, Record<string, string>>();
  const rowClasses = new Map<number, string[]>();
  const cellStyles = new Map<string, Record<string, string | undefined>>(); // key `${i}:${col}`
  const addRow = (i: number, decl: Record<string, string>): void => {
    rowStyles.set(i, { ...rowStyles.get(i), ...decl });
  };
  const addClass = (i: number, c: string): void => {
    rowClasses.set(i, [...(rowClasses.get(i) ?? []), c]);
  };
  const addCell = (i: number, key: string, decl: Record<string, string | undefined>): void => {
    cellStyles.set(`${i}:${key}`, { ...cellStyles.get(`${i}:${key}`), ...decl });
  };
  const bg = ctx.theme.tokens.bg === "transparent" ? "#ffffff" : hex6(ctx.theme.tokens.bg);
  // colorResults is a column kind (spec §6.1) whose effect is a row fill: gt_color_results (_cells.py:203-222), exact W/L or 1/0
  for (const c of spec.columns)
    if (c.kind === "colorResults") {
      const [win, loss]: readonly [unknown, unknown] = c.resultType === "binary" ? [1, 0] : ["W", "L"];
      const eq = (v: unknown, want: unknown): boolean =>
        v === want || (typeof v === "boolean" && Number(v) === want);
      rows.forEach((r, i) => {
        const v = cellValue(r, c.key);
        if (isBlank(v)) return;
        if (eq(v, win)) addRow(i, { "background-color": c.winColor, color: c.winTextColor });
        else if (eq(v, loss)) addRow(i, { "background-color": c.lossColor, color: c.lossTextColor });
        else if (c.tieColor !== undefined && eq(v, c.tieValue))
          addRow(i, { "background-color": c.tieColor, color: c.tieTextColor });
      });
    }
  for (const d of spec.decorations)
    switch (d.type) {
      case "sourceNote":
        out.foot.push(d.unsafe ? d.html : escapeHtml(d.html));
        break;
      case "wrapLabels": {
        const prev = out.label;
        out.label = (col, text) =>
          !d.columns || d.columns.includes(col.key)
            ? wrapLabel(text, d.width, d.balance).map(escapeHtml).join("<br>")
            : prev(col, text);
        break;
      }
      // ---- Task 9
      case "groupStripes": {
        if (!ctx.groupKey) throw new TableSpecError("groupStripes needs .groupBy(key)");
        const on = (gi: number): boolean => gi % 2 === (d.start === 2 ? 1 : 0);
        groupIndexOf(rows, ctx.groupKey).forEach((g, i) => {
          if (on(g)) addClass(i, "sdvt-gstripe");
        });
        // Python gt_group_stripes (_cells.py:421-424, 458-463) styles body (+stub) rows only: "Group heading rows are left alone" - the brief striped the header too; Python wins
        out.css.push(`${ctx.sel} tr.sdvt-gstripe td{background-color:${d.color}}`);
        break;
      }
      case "rowAccent": {
        // gt_row_accent (_layout.py:1123-1156): no palette = the column holds the colors; a list maps sorted levels, recycled
        const keys = rows.map((r) => {
          const v = cellValue(r, d.key);
          return isBlank(v) ? null : String(v);
        });
        const levels = [...new Set(keys.filter((k): k is string => k !== null))].sort();
        const pal = d.palette;
        const colors = keys.map((k) =>
          k === null
            ? undefined
            : pal === undefined
              ? k
              : isList(pal)
                ? pal[levels.indexOf(k) % pal.length]
                : pal[k],
        );
        const keep = d.rows ? new Set(selectRows(d.rows, rows)) : null;
        if (keep && keep.size === 0) {
          ctx.warn(`sdvtables:rowAccent:${ctx.id}`, "rows matched no rows; the table is unchanged");
          break;
        }
        colors.forEach((c, i) => {
          const fill = c ?? d.naColor;
          if (fill !== "transparent" && (!keep || keep.has(i)))
            addRow(i, { [`border-${d.side}`]: `${d.width}px solid ${fill}` });
        });
        if (d.hide) out.hiddenColumns.add(d.key);
        break;
      }
      case "boldRows":
        for (const i of selectRows(d.rows, rows))
          addRow(i, {
            "font-weight": "bold",
            color: d.textColor,
            ...(d.highlightColor ? { "background-color": d.highlightColor } : {}),
          });
        break;
      case "spotlight": {
        // gt_spotlight (_layout.py:1036-1074): no rows → unchanged + warning; `columns` narrows the lit cells, the rest of a lit row dims
        const lit = new Set(selectRows(d.rows, rows));
        if (lit.size === 0) {
          ctx.warn(`sdvtables:spotlight:${ctx.id}`, "rows matched no rows, so the table is unchanged");
          break;
        }
        const dim = d.dimColor === "auto" ? secondaryOn(bg, onColor(bg)) : d.dimColor;
        const look: Record<string, string> = {
          ...(d.fill ? { "background-color": d.fill } : {}),
          ...(d.textColor ? { color: d.textColor } : {}),
          ...(d.bold ? { "font-weight": "bold" } : {}),
        };
        rows.forEach((_, i) => {
          if (!lit.has(i)) {
            if (dim) addRow(i, { color: dim });
            return;
          }
          if (d.accentColor) addRow(i, { "box-shadow": `inset ${d.accentWidth}px 0 0 ${d.accentColor}` });
          if (!d.columns) {
            addRow(i, look);
            return;
          }
          for (const c of ctx.columns)
            if ((d.columns as readonly string[]).includes(c.key)) addCell(i, c.key, look);
            else if (dim) addCell(i, c.key, { color: dim });
        });
        break;
      }
      case "cutline": {
        // gt_cutline (_cells.py:880-950): `after` rows above the line → the rule is the TOP border of 0-based row `after`
        if (!d.after.every((a) => Number.isInteger(a)))
          throw new TableSpecError(`cutline after must be whole row numbers, got ${d.after.join(", ")}`);
        if (d.gap.length < 1 || d.gap.length > 2 || d.gap.some((g) => !(g >= 0)))
          throw new TableSpecError("cutline gap must be one or two non-negative numbers");
        const n = rows.length;
        const dropped = d.after.filter((a) => a < 0 || a >= n);
        if (dropped.length > 0)
          ctx.warn(
            `sdvtables:cutline:${ctx.id}:${dropped.join(",")}`,
            `dropped ${dropped.length} cut line(s) at ${dropped.join(", ")}: after must be between 0 and ${n - 1}; a line after the last row is just the table border`,
          );
        const above = d.gap[0] ?? 0;
        const below = d.gap[d.gap.length - 1] ?? 0;
        d.after.forEach((a, j) => {
          if (a < 0 || a >= n) return;
          const label = d.label && d.label.length > 0 ? (d.label[j % d.label.length] ?? null) : null;
          const top = d.labelPosition === "below" || a === 0;
          const labelRow = top ? a : a - 1;
          addClass(a, `sdvt-cut-${j}`);
          out.css.push(`${ctx.sel} tr.sdvt-cut-${j} td{border-top:${d.weight}px ${d.style} ${d.color}}`);
          if (above > 0 && a > 0 && !(label && labelRow === a - 1)) {
            addClass(a - 1, `sdvt-cut-${j}-above`);
            out.css.push(`${ctx.sel} tr.sdvt-cut-${j}-above td{padding-bottom:${above}px}`);
          }
          if (below > 0 && !(label && labelRow === a))
            out.css.push(`${ctx.sel} tr.sdvt-cut-${j} td{padding-top:${below}px}`);
          if (label) {
            addClass(labelRow, `sdvt-cut-${j}-label`);
            out.css.push(
              `${ctx.sel} tr.sdvt-cut-${j}-label td{padding-${top ? "top" : "bottom"}:${d.labelSize + 13 + (top ? below : above)}px;background-color:transparent}`,
              `${ctx.sel} tr.sdvt-cut-${j}-label{background-image:url("${cutlineSvg(label, d.labelColor ?? d.color, d.labelSize)}");background-repeat:no-repeat;background-position:${top ? "left 5px" : "left bottom 5px"}}`,
            );
          }
        });
        break;
      }
      case "borderGrid": {
        // _cells.py:793-803
        const b = `border-right:${d.weight}px solid ${d.color}`;
        out.css.push(
          `${ctx.sel} td.sdvt-cell:not(:last-child){${b}}`,
          `${ctx.sel} td.sdvt-cell{border-top-color:${d.color}}`,
        );
        if (d.includeLabels) out.css.push(`${ctx.sel} th.sdvt-label:not(:last-child){${b}}`);
        break;
      }
      default:
        break; // title/subtitle (above), groupBy (index.ts); Tasks 9-12 add their cases above this line
    }
  out.rowClass = (i) => (rowClasses.get(i) ?? []).map((c) => ` ${c}`).join("");
  out.rowStyle = (i) => {
    const s = rowStyles.get(i);
    return s ? styleAttr(s) : "";
  };
  out.cellStyle = (i, key) => {
    const s = cellStyles.get(`${i}:${key}`);
    return s ? styleAttr(s) : "";
  };
  return out;
}
