import { expectTypeOf, test } from "vitest";
import { createTable } from "../src/engine.js";
import { SdvTable, type SdvTableProps } from "../src/react/index.js";
import { type Row, rows, spec } from "./fixtures/engine.js";

const table = createTable(spec, rows);
test("I2: SdvTable owns an engine from { spec, rows } (both required, with initial pageSize/sort)", () => {
  expectTypeOf({ spec, rows }).toMatchTypeOf<SdvTableProps<Row>>();
  expectTypeOf({
    spec,
    rows,
    interactive: true,
    pageSize: 10,
    sort: { col: "wins", dir: "desc" as const },
  }).toMatchTypeOf<SdvTableProps<Row>>();
  expectTypeOf({ spec }).not.toMatchTypeOf<SdvTableProps<Row>>();
  expectTypeOf({ rows }).not.toMatchTypeOf<SdvTableProps<Row>>();
  expectTypeOf(SdvTable<Row>).toBeCallableWith({ spec, rows });
});
test("I2: SdvTable renders a given engine from { table } alone; spec/rows beside it are harmless, initial state is rejected", () => {
  expectTypeOf({ table }).toMatchTypeOf<SdvTableProps<Row>>();
  expectTypeOf({ table, interactive: true, css: "none" as const }).toMatchTypeOf<SdvTableProps<Row>>();
  // harmless: accepted and ignored (the engine's own spec and rows are rendered)
  expectTypeOf({ table, spec, rows }).toMatchTypeOf<SdvTableProps<Row>>();
  // rejected: initial state belongs to the engine the caller built
  expectTypeOf({ table, pageSize: 5 }).not.toMatchTypeOf<SdvTableProps<Row>>();
  expectTypeOf({ table, sort: { col: "wins", dir: "asc" as const } }).not.toMatchTypeOf<SdvTableProps<Row>>();
  expectTypeOf(SdvTable<Row>).toBeCallableWith({ table });
  // Row is inferred from the table
  // @ts-expect-error — rows of another type than the table's
  SdvTable({ table, rows: [{ other: 1 }] });
});
