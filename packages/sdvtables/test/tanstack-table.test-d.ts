import { useTable } from "@tanstack/react-table";
import {
  type ColumnDef,
  type TableOptions,
  constructTable,
  createSortedRowModel,
  rowSortingFeature,
  tableFeatures,
} from "@tanstack/table-core";
import { expectTypeOf, test } from "vitest";
import { defineTable } from "../src/define.js";
import { tanstackTable } from "../src/tanstack-table.js";
import { STANDINGS, type Standing } from "./fixtures/standings.js";

test("tanstackTable's options are TanStack Table 9.3's own: useTable and constructTable take them as they are", () => {
  const features = tableFeatures({ rowSortingFeature, sortedRowModel: createSortedRowModel() });
  type F = typeof features;
  const spec = defineTable<Standing>()
    .columns((c) => [c.text("team"), c.int("wins")])
    .build();
  const { options } = tanstackTable(spec, STANDINGS, { features });
  expectTypeOf(options.columns).toMatchTypeOf<ColumnDef<F, Standing>[]>();
  expectTypeOf(options).toMatchTypeOf<Pick<TableOptions<F, Standing>, "data" | "getRowId">>();
  // the columns' type follows the features passed in: they fit this table, and the call sites compile
  expectTypeOf(useTable<F, Standing>).toBeCallableWith(options);
  expectTypeOf(useTable<F, Standing>).toBeCallableWith({ ...options, initialState: { sorting: [] } });
  expectTypeOf(constructTable<F, Standing>).toBeCallableWith(options);
  // negative control: columns typed for another feature set do not fit (TanStack's types are invariant in features)
  const other = tableFeatures({});
  expectTypeOf(tanstackTable(spec, STANDINGS, { features: other }).options.columns).not.toMatchTypeOf<
    ColumnDef<F, Standing>[]
  >();
});
