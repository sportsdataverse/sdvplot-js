import {
  DownloadError,
  InputError,
  OfflineError,
  SdvplotError,
  UnsupportedTargetError,
  loadLeague,
  marks,
} from "@sportsdataverse/sdvplot";
import { logoWatermarks } from "@sportsdataverse/sdvplot/chartjs";
import type { ExampleMeta } from "../../contract.js";

export const meta = {
  title:
    "Errors: InputError, DownloadError (an OfflineError) and UnsupportedTargetError, each from a real call",
  tags: ["node", "errors", "InputError", "DownloadError", "OfflineError", "UnsupportedTargetError"],
} satisfies ExampleMeta;

const caught = async (f: () => unknown) => {
  try {
    await f();
    return "no error";
  } catch (e) {
    if (!(e instanceof SdvplotError)) throw e;
    return {
      name: e.name,
      "instanceof InputError": e instanceof InputError,
      "instanceof OfflineError": e instanceof OfflineError,
      "instanceof UnsupportedTargetError": e instanceof UnsupportedTargetError,
      ...(e instanceof DownloadError ? { url: e.url, status: e.status } : {}),
      message: e.message,
    };
  }
};

// The only download in sdvplot is the full logo manifest; this fetch answers as a CDN outage would. Catch
// OfflineError (DownloadError is one) to fall back to the bundled marks.
const outage = async (): Promise<Response> => new Response("", { status: 503 });

export default {
  // @ts-expect-error: the league is checked at compile time too
  'loadLeague("nfll")': await caught(() => loadLeague("nfll")),
  'marks("KC", "nfl", { full: true }) during an outage': await caught(() =>
    marks("KC", "nfl", { full: true, fetch: outage }),
  ),
  // the Chart.js image plugins build <img> elements: in Node (SSR) there is no DOM to build them in
  'logoWatermarks(["PHI", "KC"], …) in Node': await caught(() =>
    logoWatermarks(["PHI", "KC"], { league: "nfl" }),
  ),
};
