import type { TableSpec } from "@sportsdataverse/sdvtables";
import { styleSheet, themeKey } from "@sportsdataverse/sdvtables/html";
import type { CellPart, SdvTanstackTable } from "@sportsdataverse/sdvtables/tanstack-table";
import {
  type RowData,
  type SortingState,
  createSortedRowModel,
  rowSortingFeature,
  tableFeatures,
  useTable,
} from "@tanstack/react-table";
import type { ReactElement, ReactNode } from "react";

/** The table's TanStack Table v9 features: sorting, client side. Module scope, so it stays the same object. */
export const features = tableFeatures({ rowSortingFeature, sortedRowModel: createSortedRowModel() });

/** sdvtables' image and superscript-rank cells as React elements: tanstackTable's `render`. */
export function renderPart(p: CellPart): ReactNode {
  if (p.type === "rank")
    return (
      <>
        {p.num}
        <sup style={{ fontSize: p.size }}>{p.suffix}</sup>
      </>
    );
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: "0.4em" }}>
      <img src={p.src} alt={p.alt} height={p.height} data-sdv-id={p.id} data-sdv-kind={p.kind} />
      {p.text}
    </span>
  );
}

const ARROW = { asc: " ▲", desc: " ▼" } as const;
const ARIA = { asc: "ascending", desc: "descending" } as const;

/**
 * A sortable table from `tanstackTable(spec, rows, { features, render: renderPart })`, in the spec's sdvtables theme:
 * its stylesheet, scoped to the theme's class, styles the `th.sdvt-label` and `td.sdvt-cell` here as it does the HTML
 * table's. Click a header to sort; missing values stay last both ways.
 */
export function SdvTable<TData extends RowData>({
  spec,
  sdv,
  sorting = [],
}: {
  spec: TableSpec<TData>;
  sdv: SdvTanstackTable<typeof features, TData>;
  /** The sort to start with: `[{ id: "wins", desc: true }]`. */
  sorting?: SortingState;
}): ReactElement {
  const table = useTable({ ...sdv.options, initialState: { sorting } });
  return (
    <div className={themeKey(spec.theme)}>
      <style>{styleSheet(spec)}</style>
      <table>
        <thead>
          {table.getHeaderGroups().map((g) => (
            <tr key={g.id}>
              {g.headers.map((h) => {
                const sorted = h.column.getIsSorted();
                return (
                  <th
                    key={h.id}
                    className="sdvt-label"
                    style={sdv.columnStyle[h.column.id]}
                    aria-sort={sorted ? ARIA[sorted] : "none"}
                  >
                    {h.column.getCanSort() ? (
                      <button
                        type="button"
                        onClick={h.column.getToggleSortingHandler()}
                        style={{ all: "inherit", cursor: "pointer" }}
                      >
                        <table.FlexRender header={h} />
                        {sorted ? ARROW[sorted] : ""}
                      </button>
                    ) : (
                      <table.FlexRender header={h} />
                    )}
                  </th>
                );
              })}
            </tr>
          ))}
        </thead>
        <tbody>
          {table.getRowModel().rows.map((r) => (
            <tr key={r.id} data-row-id={r.id}>
              {r.getAllCells().map((c) => (
                <td
                  key={c.id}
                  className="sdvt-cell"
                  data-col={c.column.id}
                  style={sdv.columnStyle[c.column.id]}
                >
                  <table.FlexRender cell={c} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
