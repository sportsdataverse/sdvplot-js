// src/html/decorations.ts — Task 5 version: every hook exists (defaults are no-ops); title, subtitle, sourceNote here; groupBy is read by index.ts.
// Later tasks only POPULATE hooks; none adds one. Style hooks return bare declarations — index.ts builds the one style="" (styleOf).
import type { ColumnSpec, Decoration, TableSpec } from "../spec.js";
import type { GoogleFont } from "../themes/tokens.js";
import type { RenderContext } from "./cells.js";
import { escapeHtml } from "./escape.js";
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

export function applyDecorations<Row>(
  spec: TableSpec<Row>,
  _rows: readonly Row[],
  _ctx: RenderContext<Row>,
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
      default:
        break; // title/subtitle (above), groupBy (index.ts); Tasks 9-12 add their cases above this line
    }
  return out;
}
