import client from "@perspective-dev/client";
import type browserClient from "@perspective-dev/client/dist/esm/perspective.browser.js";
import viewer from "@perspective-dev/viewer";
import "@perspective-dev/viewer-datagrid/dist/esm/perspective-viewer-datagrid.js";
import "@perspective-dev/viewer-charts/dist/esm/perspective-viewer-charts.js";
import "@perspective-dev/viewer/dist/css/pro.css";
import "@perspective-dev/viewer/dist/css/pro-dark.css";

/**
 * Perspective 5.5 in the page, from the packages' own files, never a CDN. Each
 * `new URL("@perspective-dev/…/x.wasm", import.meta.url)` tells the bundler (webpack 5, Vite, Rspack) to copy that
 * file next to your app and gives its URL there: the engine ("server", 2.4 MB, run in a Web Worker the client starts
 * from an inline script) and the viewer's own module, which also serves as the client. The viewer must be ready
 * before `worker()` asks for the client. Importing the two plugins registers the Datagrid and the charts ("Y Bar",
 * "X/Y Scatter", …), imported by file because their type declarations reach into the viewer's TypeScript source,
 * which a strict project would then type-check; the two stylesheets are the "Pro Light" and "Pro Dark" themes. Start it
 * once per page and share the worker: browser only (it touches `customElements`), so import this module lazily from
 * client code.
 */
export async function startPerspective(): Promise<Awaited<ReturnType<typeof browserClient.worker>>> {
  // TypeScript under Node resolution reads the package's Node build; a bundler for the browser picks the browser one
  const perspective = client as unknown as typeof browserClient;
  perspective.init_server(
    fetch(new URL("@perspective-dev/server/dist/wasm/perspective-server.wasm", import.meta.url)),
  );
  await viewer.init_client(
    fetch(new URL("@perspective-dev/viewer/dist/wasm/perspective-viewer.wasm", import.meta.url)),
  );
  return perspective.worker();
}
