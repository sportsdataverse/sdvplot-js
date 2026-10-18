import { NHL_STANDINGS } from "@sportsdataverse/examples/data";
import { defineTable } from "@sportsdataverse/sdvtables";
import { composePage } from "@sportsdataverse/sdvtables/export";
import { renderHTMLAsync } from "@sportsdataverse/sdvtables/html";
import type { ExampleMeta } from "../../contract.js";

export const meta = {
  title: "A table framed for a social post: handles, a watermark and a composed caption",
  tags: ["node", "table", "export", "composePage", "socialTag", "watermark", "social", "nhl"],
} satisfies ExampleMeta;

const spec = defineTable<(typeof NHL_STANDINGS)[number]>()
  .columns((c) => [
    c.logo("team", { league: "nhl", includeName: true, label: "Team" }),
    c.tally(["wins", "losses", "ot_losses"], { label: "W-L-OT" }),
    c.colorPills("points", { label: "Points", digits: 0, domain: [70, 110] }),
  ])
  .socialTag({ x: "SportsDataverse", gh: "sportsdataverse" })
  .watermark({ text: "SDV", angle: -20, opacity: 0.05 })
  .theme("sdv", { density: "social" })
  .build();
// In Chromium, socialCrop(spec, NHL_STANDINGS, { aspect: "1:1" }) is the table alone on a square canvas, and
// htmlToPNG(page) is this framed page as an image.
export default composePage(await renderHTMLAsync(spec, NHL_STANDINGS), {
  title: "Buffalo wins the Atlantic",
  subtitle: "NHL 2025-26, final regular-season standings",
  caption: "Tampa Bay and Montreal tied on 106 points; Toronto finished last",
  sourceNote: "Source: NHL api-web /v1/standings/now",
});
