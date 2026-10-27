<script lang="ts">
  // A sortable TanStack Table v9 in Svelte 5, built from an sdvtables spec by tanstackTable: the spec's labels, number
  // formats and sort (missing values last both ways), with logos and superscript ranks drawn by CellPart.svelte.
  // The spec's sdvtables theme styles it: its stylesheet, scoped to the theme's class, styles th.sdvt-label and
  // td.sdvt-cell. Call `await prepare(spec)` before mounting it.
  import type { TableSpec } from "@sportsdataverse/sdvtables";
  import { styleSheet, themeKey } from "@sportsdataverse/sdvtables/html";
  import { tanstackTable } from "@sportsdataverse/sdvtables/tanstack-table";
  import {
    FlexRender,
    type SortingState,
    createSortedRowModel,
    createTable,
    renderComponent,
    rowSortingFeature,
    tableFeatures,
  } from "@tanstack/svelte-table";
  import { untrack } from "svelte";
  import CellPart from "./CellPart.svelte";

  type Row = Record<string, unknown>;
  interface Props {
    spec: TableSpec<Row>;
    rows: Row[];
    /** The sort to start with: `[{ id: "wins", desc: true }]`. */
    sorting?: SortingState;
  }
  const props: Props = $props();

  const features = tableFeatures({ rowSortingFeature, sortedRowModel: createSortedRowModel() });
  // built once, from the props as first passed (untrack says so): the columns, the rows and their ids; CellPart
  // draws a logo or a superscript rank. Mount the component again for other rows.
  const sdv = untrack(() =>
    tanstackTable(props.spec, props.rows, { features, render: (part) => renderComponent(CellPart, { part }) }),
  );
  const table = createTable({ ...sdv.options, initialState: { sorting: untrack(() => props.sorting) ?? [] } });
  const ARROW = { asc: " ▲", desc: " ▼" } as const;
  const ARIA = { asc: "ascending", desc: "descending" } as const;
</script>

<div class={themeKey(props.spec.theme)}>
  {@html `<style>${styleSheet(props.spec)}</style>`}
  <table>
    <thead>
      {#each table.getHeaderGroups() as group (group.id)}
        <tr>
          {#each group.headers as header (header.id)}
            {@const sorted = header.column.getIsSorted()}
            {@const style = sdv.columnStyle[header.column.id]}
            <th
              class="sdvt-label"
              style:text-align={style?.textAlign}
              style:width={style?.width}
              aria-sort={sorted ? ARIA[sorted] : "none"}
            >
              {#if header.column.getCanSort()}
                <button
                  type="button"
                  onclick={header.column.getToggleSortingHandler()}
                  style="all:inherit;cursor:pointer"><FlexRender {header} />{sorted ? ARROW[sorted] : ""}</button
                >
              {:else}
                <FlexRender {header} />
              {/if}
            </th>
          {/each}
        </tr>
      {/each}
    </thead>
    <tbody>
      {#each table.getRowModel().rows as row (row.id)}
        <tr data-row-id={row.id}>
          {#each row.getAllCells() as cell (cell.id)}
            {@const style = sdv.columnStyle[cell.column.id]}
            <td class="sdvt-cell" data-col={cell.column.id} style:text-align={style?.textAlign} style:width={style?.width}
              ><FlexRender {cell} /></td
            >
          {/each}
        </tr>
      {/each}
    </tbody>
  </table>
</div>
