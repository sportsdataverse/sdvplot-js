import * as duckdb from "@duckdb/duckdb-wasm";

/**
 * A DuckDB-WASM database in a Web Worker, started from the package's own files, never a CDN. Each
 * `new URL("@duckdb/duckdb-wasm/dist/…", import.meta.url)` tells the bundler (webpack 5, Vite, Rspack) to copy that
 * file next to your app and gives its URL there. The worker URL is made apart from `new Worker(…)`: written inline,
 * webpack would rebuild the worker as a chunk of its own instead of copying DuckDB's prebuilt one.
 *
 * It takes DuckDB's "eh" build (WebAssembly exception handling, in every current browser) and no other: the "mvp"
 * fallback is a second 41 MB file, for browsers from before 2022. A bundler copies every file named here, so naming
 * only one keeps the other out of your site. Start it once per page and share it: compiling the module is the slow
 * part.
 */
export async function startDuckDB(): Promise<duckdb.AsyncDuckDB> {
  const worker = new URL("@duckdb/duckdb-wasm/dist/duckdb-browser-eh.worker.js", import.meta.url);
  const wasm = new URL("@duckdb/duckdb-wasm/dist/duckdb-eh.wasm", import.meta.url);
  const db = new duckdb.AsyncDuckDB(new duckdb.VoidLogger(), new Worker(worker));
  await db.instantiate(wasm.href);
  return db;
}
