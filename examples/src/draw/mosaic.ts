import * as vg from "@uwdata/vgplot";
import { startDuckDB } from "../../snippets/mosaic/duckdb.js";
import { type Draw, figureBox } from "./index.js";

// One database per page, started on first use and shared: compiling DuckDB's module is the slow part.
let database: ReturnType<typeof startDuckDB> | undefined;

/**
 * Mosaic linked views (vgplot), drawn by the example's own `mount` with vgplot and a DuckDB-WASM database started
 * from the package's own files (examples/snippets/mosaic/duckdb.ts: no CDN). Mosaic's coordinator is connected to it
 * before `mount` runs, so no query goes anywhere else (its default connector is a REST server on localhost:3000).
 * The box is a `figure` at most `width` px wide: the views are controls (brushing, a scrolling table). The brush
 * stays on the box as `sdvBrush`, for the render test.
 */
const draw: Draw<"mosaic"> = async (el, s) => {
  // a failed start is not cached: the next mount on the page tries again
  database ??= startDuckDB().catch((e: unknown) => {
    database = undefined;
    throw e;
  });
  const db = await database;
  vg.coordinator().databaseConnector(new vg.DuckDBWASMConnector({ duckdb: db }));
  const box = figureBox(el, s.label, "figure");
  box.style.maxWidth = `${s.width}px`;
  const { view, brush } = await s.mount({ vg, db });
  box.append(view);
  Object.assign(box, { sdvBrush: brush });
  return () => {
    vg.coordinator().clear();
    box.remove();
  };
};
export default draw;
