import {
  MANIFEST_URL,
  fetchManifest,
  loadLeague,
  manifestMarks,
  parseManifestCsv,
  resetManifestCache,
} from "@sportsdataverse/sdvplot";
import type { ExampleMeta } from "../../contract.js";

export const meta = {
  title: "The full marks manifest",
  tags: ["manifest", "marks", "network", "nfl"],
} satisfies ExampleMeta;

// Downloaded from MANIFEST_URL and parsed once per process (about 18 MB); later calls reuse it.
const rows = await fetchManifest();
// parseManifestCsv is the parser fetchManifest uses, for a copy you downloaded yourself.
const own = parseManifestCsv(await (await fetch(MANIFEST_URL)).text());
// manifestMarks maps one league's rows onto its teams through the shard's aliases, best first.
const nfl = manifestMarks("nfl", rows, (await loadLeague("nfl")).aliases);
resetManifestCache(); // forget the cached copy: the next fetchManifest() downloads again

export default {
  MANIFEST_URL,
  rows: rows.length,
  sameRows: own.length === rows.length,
  nflMarks: nfl.length,
  best: nfl.slice(0, 3).map((m) => `${m.team_id} ${m.mark_type} ${m.variant} ${m.archive_url}`),
};
