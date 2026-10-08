// export-standings.ts: one standings table, written as PNGs in Node. Peer: playwright, with its Chromium
// (pnpm add -D playwright && pnpm exec playwright install chromium).
import { join } from "node:path";
import type { Standing } from "@sportsdataverse/examples/data";
import { defineTable } from "@sportsdataverse/sdvtables";
import { batchToPNG, gridTables, htmlToPNG, socialCrop, tableToPNG } from "@sportsdataverse/sdvtables/export";

/** Writes the AFC standings into `dir` as PNGs and returns the paths, the plain table's first. */
export async function exportStandings(rows: readonly Standing[], dir: string): Promise<string[]> {
  const spec = defineTable<Standing>()
    .columns((c) => [
      c.text("team"),
      c.text("qb", { label: "Quarterback" }),
      c.int("wins"),
      c.int("losses"),
      c.int("pf", { label: "PF" }),
      c.int("pa", { label: "PA" }),
    ])
    .title("AFC")
    .subtitle("2024 regular season")
    .theme("athletic")
    .build();
  const table = join(dir, "afc.png");
  const post = join(dir, "afc-post.png");
  const grid = join(dir, "afc-grid.png");
  // gt_save_crop: rendered at zoom 2, trimmed to the table, 50 px of white put back around it, scaled to 900 px wide
  await tableToPNG(spec, rows, { file: table, width: 900 });
  // gt_social_crop: the same table on a 16:9 canvas, never cropped
  await socialCrop(spec, rows, { aspect: "16:9", file: post });
  // any HTML: here gt_grid's two divisions side by side
  const division = (d: string) => ({ spec, rows: rows.filter((r) => r.division === d) });
  await htmlToPNG(gridTables([division("West"), division("East")], { ncol: 2 }), { file: grid });
  // gt_save_batch: one image per division, afc-west.png and afc-east.png, all as wide as the widest
  const batch = await batchToPNG(
    rows,
    "division",
    (groupRows) => ({ spec, rows: groupRows }),
    "afc-{group}.png",
    {
      dir,
    },
  );
  return [table, post, grid, ...batch];
}
