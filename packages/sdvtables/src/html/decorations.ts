// src/html/decorations.ts — Task 5 version: every hook exists (defaults are no-ops); title, subtitle, sourceNote here; groupBy is read by index.ts.
// Later tasks only POPULATE hooks; none adds one. Style hooks return bare declarations — index.ts builds the one style="" (styleOf).
import { hex6, onColor } from "@sportsdataverse/sdvplot";
import { TableSpecError } from "../errors.js";
import { formatNumber, isBlank, naturalDigits } from "../format.js";
import { selectRows } from "../predicate.js";
import type { ColumnSpec, Decoration, TableSpec, TextStyle } from "../spec.js";
import { secondaryOn } from "../themes/sdv.js";
import { type GoogleFont, fontStack } from "../themes/tokens.js";
import { type RenderContext, cellValue } from "./cells.js";
import { escapeAttr, escapeHtml, styleAttr } from "./escape.js";
import { SOCIAL_ICONS } from "./social-icons.js";
import { cssStr, cutlineSvg, watermarkSvg } from "./svg.js";
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
const isList = (p: unknown): p is readonly string[] => Array.isArray(p);

// ---- Task 10
export function textStyleAttr(ts: TextStyle | undefined): string {
  if (!ts) return "";
  const s = styleAttr({
    color: ts.color,
    "font-size": ts.size,
    "font-weight": ts.weight,
    "font-family": ts.font ? fontStack(checkFamily(ts.font)) : undefined,
    "text-transform": ts.transform === "uppercase" ? "uppercase" : undefined,
    "font-style": ts.style === "italic" ? "italic" : undefined,
  });
  return s ? ` style="${s}"` : "";
}
/** A family name lands inside `'…'` in CSS: letters, digits, spaces, `.`, `-`, `_` only. */
function checkFamily(f: string): string {
  if (!/^[\w .-]+$/.test(f))
    throw new TableSpecError(`font family "${f}" may only hold letters, digits, spaces, "." "-" "_"`);
  return f;
}
const ALIGN = new Set(["left", "center", "right"]);
const checkAlign = (a: string, arg: string): string => {
  if (!ALIGN.has(a)) throw new TableSpecError(`${arg} must be left, center or right, not "${a}"`);
  return a;
};
/** Python _SCALE_NAMES (_layout.py:1442-1447): only these four divisors have names. */
const SCALE_NAMES: Readonly<Record<number, readonly [string, string]>> = {
  1e3: ["thousands", "(000s)"],
  1e6: ["millions", "(millions)"],
  1e9: ["billions", "(billions)"],
  1e12: ["trillions", "(trillions)"],
};

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
  // Fills go on every <td> (Python applies them as !important cell styles, _cells.py:221): a <tr> background is hidden by the stripe and theme band rules on td
  const fillCells = (i: number, decl: Record<string, string | undefined>): void => {
    for (const c of ctx.columns) addCell(i, c.key, decl);
  };
  let cutCount = 0; // one id per .cutline() call so two calls never share a class
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
        if (eq(v, win)) fillCells(i, { "background-color": c.winColor, color: c.winTextColor });
        else if (eq(v, loss)) fillCells(i, { "background-color": c.lossColor, color: c.lossTextColor });
        else if (c.tieColor !== undefined && eq(v, c.tieValue))
          fillCells(i, { "background-color": c.tieColor, color: c.tieTextColor });
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
        if (d.side !== "left" && d.side !== "right")
          throw new TableSpecError(`rowAccent side must be left or right, not ${JSON.stringify(d.side)}`);
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
        for (const i of selectRows(d.rows, rows)) {
          addRow(i, { "font-weight": "bold" });
          fillCells(i, {
            color: d.textColor,
            ...(d.highlightColor ? { "background-color": d.highlightColor } : {}),
          });
        }
        break;
      case "spotlight": {
        // gt_spotlight (_layout.py:1036-1074): no rows → unchanged + warning; `columns` narrows the lit cells, the rest of a lit row dims
        const lit = new Set(selectRows(d.rows, rows));
        if (lit.size === 0) {
          ctx.warn(`sdvtables:spotlight:${ctx.id}`, "rows matched no rows, so the table is unchanged");
          break;
        }
        const dim = d.dimColor === "auto" ? secondaryOn(bg, onColor(bg)) : d.dimColor;
        const fill: Record<string, string> = {
          ...(d.fill ? { "background-color": d.fill } : {}),
          ...(d.textColor ? { color: d.textColor } : {}),
        };
        const look: Record<string, string> = { ...fill, ...(d.bold ? { "font-weight": "bold" } : {}) };
        rows.forEach((_, i) => {
          if (!lit.has(i)) {
            if (dim) addRow(i, { color: dim });
            return;
          }
          if (d.accentColor) addRow(i, { "box-shadow": `inset ${d.accentWidth}px 0 0 ${d.accentColor}` });
          if (!d.columns) {
            fillCells(i, fill);
            if (d.bold) addRow(i, { "font-weight": "bold" });
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
        const cn = cutCount++;
        const above = d.gap[0] ?? 0;
        const below = d.gap[d.gap.length - 1] ?? 0;
        d.after.forEach((a, j) => {
          if (a < 0 || a >= n) return;
          const label = d.label && d.label.length > 0 ? (d.label[j % d.label.length] ?? null) : null;
          const top = d.labelPosition === "below" || a === 0;
          const labelRow = top ? a : a - 1;
          addClass(a, `sdvt-cut-${cn}-${j}`);
          out.css.push(
            `${ctx.sel} tr.sdvt-cut-${cn}-${j} td{border-top:${d.weight}px ${d.style} ${d.color}}`,
          );
          if (above > 0 && a > 0 && !(label && labelRow === a - 1)) {
            addClass(a - 1, `sdvt-cut-${cn}-${j}-above`);
            out.css.push(`${ctx.sel} tr.sdvt-cut-${cn}-${j}-above td{padding-bottom:${above}px}`);
          }
          if (below > 0 && !(label && labelRow === a))
            out.css.push(`${ctx.sel} tr.sdvt-cut-${cn}-${j} td{padding-top:${below}px}`);
          if (label) {
            addClass(labelRow, `sdvt-cut-${cn}-${j}-label`);
            out.css.push(
              `${ctx.sel} tr.sdvt-cut-${cn}-${j}-label td{padding-${top ? "top" : "bottom"}:${d.labelSize + 13 + (top ? below : above)}px;background-color:transparent}`,
              `${ctx.sel} tr.sdvt-cut-${cn}-${j}-label{background-image:url("${cutlineSvg(label, d.labelColor ?? d.color, d.labelSize)}");background-repeat:no-repeat;background-position:${top ? "left 5px" : "left bottom 5px"}}`,
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
      // ---- Task 10
      case "titleHeader": {
        // gt_title_header (_layout.py:121-215): kicker / title / subtitle / date, each with its own style; Python's kicker and date defaults live in the rules below
        for (const ts of [d.kickerStyle, d.titleStyle, d.subtitleStyle, d.dateStyle])
          if (ts?.font)
            out.fonts.push({
              family: checkFamily(ts.font),
              weights: [typeof ts.weight === "number" ? ts.weight : 400],
            });
        out.css.push(
          `${ctx.sel} .sdvt-kicker{font-size:0.75em;font-weight:700;color:#C84630;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:0.15em}`,
          `${ctx.sel} .sdvt-date{font-size:0.85em;font-weight:400;color:#8A8A8A;margin-top:0.15em}`,
        );
        out.caption = `${d.kicker ? `<div class="sdvt-kicker"${textStyleAttr(d.kickerStyle)}>${escapeHtml(d.kicker)}</div>` : ""}<span class="sdvt-title"${textStyleAttr(d.titleStyle)}>${escapeHtml(d.title)}</span>${d.subtitle ? `<span class="sdvt-subtitle"${textStyleAttr(d.subtitleStyle)}>${escapeHtml(d.subtitle)}</span>` : ""}${d.date ? `<div class="sdvt-date"${textStyleAttr(d.dateStyle)}>${escapeHtml(d.date)}</div>` : ""}`;
        break;
      }
      case "caption538": {
        // gt_538_caption (_cells.py:482-535): the TOP note carries the rule + size, the BOTTOM note the alignment
        const align = checkAlign(d.align, "caption538 align");
        if (!d.top && !d.bottom)
          throw new TableSpecError("caption538: nothing to caption; pass top, bottom, or both");
        const rule = d.ruleColor ?? ctx.theme.tokens.text;
        if (d.top)
          out.foot.push(
            `<div class="sdvt-cap538" style="${styleAttr({ "border-bottom": `${d.ruleWidth}px solid ${rule}`, "font-size": `${d.size}px` })}">${escapeHtml(d.top)}</div>`,
          );
        if (d.bottom)
          out.foot.push(
            `<div class="sdvt-cap538" style="${styleAttr({ "text-align": align })}">${escapeHtml(d.bottom)}</div>`,
          );
        break;
      }
      case "socialTag": {
        // gt_social_tag (_layout.py:1553-1620): handles behind icons; a caption is a gt_538_caption TOP note (rule + size), the handle line the bottom
        const align = checkAlign(d.align, "socialTag align");
        const entries = Object.entries(d.accounts);
        if (entries.length === 0)
          throw new TableSpecError("socialTag accounts must be a non-empty {platform: handle} object");
        const parts = entries.map(([k, handle]) => {
          const svg = SOCIAL_ICONS[k.toLowerCase()];
          if (!svg)
            throw new TableSpecError(
              `socialTag: unknown platform "${k}"; one of ${Object.keys(SOCIAL_ICONS).join(", ")}`,
            );
          return `<span class="sdvt-handle">${svg.replace("<svg ", `<svg style="${styleAttr({ height: d.iconHeight, "vertical-align": "-0.125em", fill: d.iconColor ?? "currentColor" })}" `)}${escapeHtml(handle)}</span>`;
        });
        out.css.push(
          `${ctx.sel} .sdvt-handle{display:inline-flex;align-items:center;gap:0.3em;white-space:nowrap}`,
        );
        if (d.caption)
          out.foot.push(
            `<div class="sdvt-cap538" style="${styleAttr({ "border-bottom": `1px solid ${ctx.theme.tokens.text}`, "font-size": "12px" })}">${escapeHtml(d.caption)}</div>`,
          );
        out.foot.push(
          `<div class="sdvt-social" style="text-align:${align}">${parts.join(d.stack ? "<br>" : escapeHtml(d.separator))}</div>`,
        );
        break;
      }
      case "scaleNote": {
        // gt_scale_note (_layout.py:1495-1515)
        if (!(Number.isFinite(d.divisor) && d.divisor !== 0))
          throw new TableSpecError(`scaleNote divisor must be a single non-zero number, got ${d.divisor}`);
        if (d.columns.length === 0) throw new TableSpecError("scaleNote columns matched no columns");
        for (const k of d.columns) ctx.scaled.set(k, { divisor: d.divisor, decimals: d.decimals });
        const named = SCALE_NAMES[d.divisor];
        const shown = Number.isInteger(d.divisor)
          ? formatNumber(d.divisor, { digits: 0, big: true })
          : naturalDigits(d.divisor, true);
        const note = d.note ?? (named ? `Figures in ${named[0]}.` : `Figures divided by ${shown}.`);
        const suffix = d.labelSuffix ?? (named ? named[1] : `(÷${shown})`);
        if (d.where !== "label") out.foot.push(escapeHtml(note));
        if (d.where !== "sourceNote") {
          const prev = out.labelSuffix;
          out.labelSuffix = (key) =>
            (d.columns as readonly string[]).includes(key) ? ` ${suffix}` : prev(key);
        }
        break;
      }
      case "borderBars": {
        // _bars (_cells.py:560-594): no text/img = one full-width bar per color; either = ONE flex bar in the first color holding the text and image (Python)
        checkAlign(d.barAlign, "borderBars barAlign");
        if (d.imgAlign !== "left" && d.imgAlign !== "right")
          throw new TableSpecError(
            `borderBars imgAlign must be left or right, not ${JSON.stringify(d.imgAlign)}`,
          );
        const barHeight = Number(d.barHeight);
        if (!Number.isFinite(barHeight))
          throw new TableSpecError(
            `borderBars barHeight must be a number, got ${JSON.stringify(d.barHeight)}`,
          );
        if (d.textAlign !== "left" && d.textAlign !== "right")
          throw new TableSpecError(`borderBars textAlign must be left or right, not "${d.textAlign}"`);
        const margin = {
          left: "margin-left:0;margin-right:auto",
          center: "margin-left:auto;margin-right:auto",
          right: "margin-left:auto;margin-right:0",
        }[d.barAlign as "left" | "center" | "right"];
        let block: string;
        if (!d.text && !d.img) {
          const bars = d.colors
            .map(
              (c) =>
                `<div class="sdvt-bar" style="height:${barHeight}px;background-color:${escapeAttr(c)}"></div>`,
            )
            .join("");
          block = `<div class="sdvt-bars-box" style="background-color:transparent;width:${escapeAttr(d.barWidth)};${margin}">${bars}</div>`;
        } else {
          const text = d.text
            ? `<span class="sdvt-bars-text" style="${styleAttr({ "font-weight": d.textWeight, color: d.textColor, "font-size": `${d.textSize}px`, [`padding-${d.textAlign}`]: `${d.textPadding}px`, "font-family": "inherit" })}">${escapeHtml(d.text)}</span>`
            : "<span></span>";
          const img = d.img
            ? `<img class="sdvt-bars-img" src="${escapeAttr(d.img)}" alt="" style="${styleAttr({ width: `${d.imgWidth}px`, height: `${d.imgHeight}px`, [`padding-${d.imgAlign}`]: `${d.imgPadding}px` })}">`
            : "";
          block = `<div class="sdvt-bars-row" style="display:flex;justify-content:space-between;align-items:center;height:${barHeight}px;background-color:${escapeAttr(d.colors[0] ?? "#000")};width:${escapeAttr(d.barWidth)};${margin}">${text}${img}</div>`;
        }
        const wrapped = `<div class="sdvt-bars sdvt-bars-${d.side}">${block}</div>`;
        if (d.side === "top") out.before += wrapped;
        else out.after += wrapped;
        break;
      }
      case "watermark": {
        // gt_watermark (_layout.py:271-340); Python reads a local image into a base64 URI, here `image` is a URL used as is
        if (!d.text === !d.image) throw new TableSpecError("watermark: supply exactly one of text or image");
        let url: string;
        let tall = false;
        let extra = "";
        if (d.image) {
          url = cssStr(d.image);
          extra = `;opacity:${d.opacity}`;
        } else [url, tall] = watermarkSvg(d.text ?? "", d.color, d.opacity, d.angle, d.font);
        out.css.push(
          `${ctx.sel} tbody{background-image:url("${url}");background-repeat:no-repeat;background-position:${d.position};background-size:${tall ? `auto ${d.size}` : `${d.size} auto`}${extra}}`,
        );
        break;
      }
      case "font": {
        const stack = fontStack(checkFamily(d.family));
        if (d.google)
          out.fonts.push({ family: d.family, weights: [typeof d.weight === "number" ? d.weight : 400] });
        out.css.push(
          `${ctx.sel}{--sdvt-font-body:${stack};--sdvt-font-label:${stack};--sdvt-font-title:${stack}${d.weight ? `;--sdvt-body-weight:${d.weight}` : ""}${d.style ? `;font-style:${d.style}` : ""}}`,
        );
        break;
      }
      default:
        break; // title/subtitle (above), groupBy (index.ts); Tasks 9-12 add their cases above this line
    }
  out.css = out.css.map((r) => r.replace(/</g, "\\3c ")); // nothing a spec says can close the <style> element
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
