// all 74 sdvplotR exports named gt_*/pal_*/reactable_sdv_* (67 gt_* incl. the deprecated gt_color_legend/gt_centered_legend, pal_midnight, 6 reactable_sdv_*) have a row; every ported target exists
import { expect, test } from "vitest";
import { GT_ALIASES } from "../src/aliases.js";
import { TableBuilder, columnFactory } from "../src/define.js";
import * as html from "../src/html/index.js";
import * as root from "../src/index.js";
import { THEME_NAMES } from "../src/themes/index.js";
const R_NAMES = [
  "gt_sdv_logos",
  "gt_sdv_wordmarks",
  "gt_sdv_headshots",
  "gt_sdv_cols_label",
  "gt_merge_stack_team_color",
  "gt_theme_sdv",
  "gt_theme_sdv_team",
  "gt_theme_almanac",
  "gt_theme_athletic",
  "gt_theme_booktabs",
  "gt_theme_broadsheet",
  "gt_theme_brutalist",
  "gt_theme_drench",
  "gt_theme_gtutils",
  "gt_theme_kenpom",
  "gt_theme_midnight",
  "gt_theme_ncaa",
  "gt_theme_pl",
  "gt_theme_savant",
  "gt_theme_scoreboard",
  "gt_theme_sofa",
  "gt_theme_swiss",
  "gt_theme_terminal",
  "gt_theme_tier",
  "gt_theme_tufte",
  "gt_theme_preview",
  "pal_midnight",
  "gt_538_caption",
  "gt_bold_rows",
  "gt_border_bars_bottom",
  "gt_border_bars_top",
  "gt_border_grid",
  "gt_color_pills",
  "gt_color_ranks",
  "gt_color_results",
  "gt_column_subheaders",
  "gt_cutline",
  "gt_delta",
  "gt_fmt_rank",
  "gt_fmt_tally",
  "gt_group_stripes",
  "gt_highlight_cells",
  "gt_highlight_na",
  "gt_indicator_boxes",
  "gt_legend_continuous",
  "gt_legend_discrete",
  "gt_color_legend",
  "gt_centered_legend",
  "gt_marginalia",
  "gt_outliers",
  "gt_percentile_bar",
  "gt_row_accent",
  "gt_scale_note",
  "gt_set_font",
  "gt_significance",
  "gt_snake",
  "gt_snake_align",
  "gt_social_tag",
  "gt_spotlight",
  "gt_tiers",
  "gt_title_header",
  "gt_watermark",
  "gt_wrap_labels",
  "gt_save_crop",
  "gt_save_batch",
  "gt_social_crop",
  "gt_grid",
  "gt_stack_tables",
  "reactable_sdv_logos",
  "reactable_sdv_wordmarks",
  "reactable_sdv_headshots",
  "reactable_sdv_cols_label",
  "reactable_sdv_team_color_bar",
  "reactable_sdv_team_color_bg",
];
test("every R name has an alias row; ported targets resolve to a real factory kind, builder method, theme, ./html export or root export", () => {
  const members: Readonly<Record<string, readonly string[]>> = {
    c: Object.keys(columnFactory<Record<string, unknown>>()),
    builder: Object.getOwnPropertyNames(TableBuilder.prototype),
    theme: THEME_NAMES,
    html: Object.keys(html),
    root: Object.keys(root),
  };
  for (const name of R_NAMES) {
    const a = GT_ALIASES[name];
    expect(a, name).toBeDefined();
    if (a?.status !== "ported") continue;
    const [kind, member] = a.target.includes(".") ? a.target.split(".") : ["root", a.target];
    expect(members[kind ?? ""] ?? [], a.target).toContain(member);
  }
  expect(R_NAMES).toHaveLength(74);
  expect(new Set(R_NAMES).size).toBe(74);
  expect(Object.keys(GT_ALIASES).sort()).toEqual([...R_NAMES].sort());
  expect(
    Object.values(GT_ALIASES)
      .filter((a) => a.status === "phase-5")
      .map((a) => a.target),
  ).toEqual(["tableToPNG", "tableToPNG", "socialCrop", "gridTables", "stackTables"]);
});
