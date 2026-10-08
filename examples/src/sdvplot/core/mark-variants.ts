import { compareMarks, marks, selectMark, selectMarkSync } from "@sportsdataverse/sdvplot";
import type { ExampleMeta } from "../../contract.js";

export const meta = {
  title: "Picking a mark: variants and ranking",
  tags: ["selectMark", "marks", "variant", "nfl"],
} satisfies ExampleMeta;

const light = await selectMark("KC", "nfl");
const dark = selectMarkSync("KC", "nfl", { variant: "dark" }); // the league is loaded now
const wordmark = selectMarkSync("KC", "nfl", { markType: "wordmark" });
// marks() returns the bundled rows already ranked; compareMarks is that ranking, for rows you filter or merge.
const ranked = [...(await marks("KC", "nfl"))].sort(compareMarks);

export default {
  light: light && `${light.variant} ${light.source} ${light.archive_url}`,
  dark: dark && `${dark.variant} ${dark.source} ${dark.archive_url}`,
  wordmark: wordmark && `${wordmark.variant} ${wordmark.source} ${wordmark.archive_url}`,
  ranked: ranked.map((r) => `${r.mark_type} ${r.variant} (${r.source}, rank ${r.source_rank})`),
};
