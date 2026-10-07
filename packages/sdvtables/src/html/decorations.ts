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
    if (d.type === "sourceNote") out.foot.push(d.unsafe ? d.html : escapeHtml(d.html));
  return out;
}
