import type { GridOptions } from "ag-grid-community";
import { expectTypeOf, test } from "vitest";
import type { SdvGridOptions } from "../src/aggrid.js";
import type { Standing } from "./fixtures/standings.js";

test("gridOptions' return is AG Grid 36.2's own GridOptions, whole and piece by piece", () => {
  type O = SdvGridOptions<Standing>;
  type G = GridOptions<Standing>;
  expectTypeOf<O>().toMatchTypeOf<G>();
  expectTypeOf<O["columnDefs"]>().toMatchTypeOf<NonNullable<G["columnDefs"]>>();
  expectTypeOf<O["getRowId"]>().toMatchTypeOf<NonNullable<G["getRowId"]>>();
  expectTypeOf<O["getRowStyle"]>().toMatchTypeOf<NonNullable<G["getRowStyle"]>>();
  expectTypeOf<O["theme"]>().toMatchTypeOf<G["theme"]>();
  // negative control: a row height that is not a number is not a GridOptions
  expectTypeOf<Omit<O, "rowHeight"> & { rowHeight: string }>().not.toMatchTypeOf<G>();
});
