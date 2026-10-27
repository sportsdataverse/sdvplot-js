import type { DataGridProps, GridColDef } from "@mui/x-data-grid";
import { expectTypeOf, test } from "vitest";
import type { SdvDataGridProps } from "../src/mui.js";
import type { Standing } from "./fixtures/standings.js";

test("dataGridProps' structural types match @mui/x-data-grid 9.15's own", () => {
  type P = SdvDataGridProps<Standing>;
  expectTypeOf<P["columns"][number]>().toMatchTypeOf<GridColDef<Standing>>();
  expectTypeOf<P["columns"]>().toMatchTypeOf<DataGridProps<Standing>["columns"]>();
  expectTypeOf<P["getRowId"]>().toMatchTypeOf<NonNullable<DataGridProps<Standing>["getRowId"]>>();
  expectTypeOf<P["getRowClassName"]>().toMatchTypeOf<
    NonNullable<DataGridProps<Standing>["getRowClassName"]>
  >();
  expectTypeOf<P["sx"]>().toMatchTypeOf<NonNullable<DataGridProps<Standing>["sx"]>>();
  expectTypeOf<P["density"]>().toMatchTypeOf<NonNullable<DataGridProps<Standing>["density"]>>();
  expectTypeOf<P["rowHeight"]>().toMatchTypeOf<NonNullable<DataGridProps<Standing>["rowHeight"]>>();
  // and the whole object spreads onto a DataGrid
  expectTypeOf<P & { rows: readonly Standing[] }>().toMatchTypeOf<Partial<DataGridProps<Standing>>>();
});
