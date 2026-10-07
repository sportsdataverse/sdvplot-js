/** The package version, injected from package.json at build time. */
export const VERSION: string = __SDVTABLES_VERSION__;
// Task 1 barrel (Task 13 writes the final one)
export type * from "./spec.js";
export { TableSpecError } from "./errors.js";
export { type ColumnFactory, RANK_PALETTE, TableBuilder, columnFactory, defineTable } from "./define.js";
export { matches, selectRows } from "./predicate.js";
