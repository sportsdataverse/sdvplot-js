// src/define.ts — the fluent builder. Every method returns a NEW builder (immutable), build() validates once.
import { TableSpecError } from "./errors.js";
import type { ColumnBase, ColumnSpec, Decoration, Density, NumericKey, TableSpec } from "./spec.js";

type Opt<T, K extends PropertyKey> = Omit<T, "kind" | "key" | K>;
type Base<Row, K extends keyof Row & string> = Omit<ColumnBase<Row, K>, "key">;
type Col<Row, Kind extends ColumnSpec<Row>["kind"]> = Extract<ColumnSpec<Row>, { kind: Kind }>;
type Partialize<T, Req extends keyof T> = Partial<Omit<T, Req>> & Pick<T, Req>;

export interface ColumnFactory<Row> {
  text<K extends keyof Row & string>(key: K, o?: Base<Row, K>): Col<Row, "text">;
  num<K extends NumericKey<Row>>(
    key: K,
    o?: Base<Row, K> & Partial<Opt<Col<Row, "num">, never>>,
  ): Col<Row, "num">;
  int<K extends NumericKey<Row>>(key: K, o?: Base<Row, K>): Col<Row, "int">;
  pct<K extends NumericKey<Row>>(
    key: K,
    o?: Base<Row, K> & Partial<Opt<Col<Row, "pct">, never>>,
  ): Col<Row, "pct">;
  rank<K extends NumericKey<Row>>(
    key: K,
    o?: Base<Row, K> & Partial<Opt<Col<Row, "rank">, never>>,
  ): Col<Row, "rank">;
  delta<K extends NumericKey<Row>>(
    from: K,
    to: NumericKey<Row>,
    o?: Base<Row, K> & Partial<Opt<Col<Row, "delta">, "to">>,
  ): Col<Row, "delta">;
  tally(
    keys: readonly [NumericKey<Row>, ...NumericKey<Row>[]],
    o?: Base<Row, NumericKey<Row>> & Partial<Opt<Col<Row, "tally">, "keys">>,
  ): Col<Row, "tally">;
  logo<K extends keyof Row & string>(
    key: K,
    o: Base<Row, K> & Partialize<Opt<Col<Row, "logo">, never>, "league">,
  ): Col<Row, "logo">;
  wordmark<K extends keyof Row & string>(
    key: K,
    o: Base<Row, K> & Partialize<Opt<Col<Row, "wordmark">, never>, "league">,
  ): Col<Row, "wordmark">;
  headshot<K extends keyof Row & string>(
    key: K,
    o: Base<Row, K> & Partialize<Opt<Col<Row, "headshot">, never>, "league">,
  ): Col<Row, "headshot">;
  colorPills<K extends NumericKey<Row>>(
    key: K,
    o?: Base<Row, K> & Partial<Opt<Col<Row, "colorPills">, never>>,
  ): Col<Row, "colorPills">;
  colorRanks<K extends NumericKey<Row>>(
    key: K,
    o?: Base<Row, K> & Partial<Opt<Col<Row, "colorRanks">, never>>,
  ): Col<Row, "colorRanks">;
  colorResults<K extends keyof Row & string>(
    key: K,
    o?: Base<Row, K> & Partial<Opt<Col<Row, "colorResults">, never>>,
  ): Col<Row, "colorResults">;
  percentileBar<K extends NumericKey<Row>>(
    key: K,
    o?: Base<Row, K> & Partial<Opt<Col<Row, "percentileBar">, never>>,
  ): Col<Row, "percentileBar">;
  indicatorBox<K extends keyof Row & string>(
    key: K,
    o?: Base<Row, K> & Partial<Opt<Col<Row, "indicatorBox">, never>>,
  ): Col<Row, "indicatorBox">;
  highlight<K extends keyof Row & string>(
    key: K,
    when: Col<Row, "highlight">["when"],
    o?: Base<Row, K> & Partial<Opt<Col<Row, "highlight">, "when">>,
  ): Col<Row, "highlight">;
  highlightNa<K extends keyof Row & string>(
    key: K,
    o?: Base<Row, K> & Partial<Opt<Col<Row, "highlightNa">, never>>,
  ): Col<Row, "highlightNa">;
  mergeStackTeamColor<K extends keyof Row & string>(
    key: K,
    stack: keyof Row & string,
    team: keyof Row & string,
    o: Base<Row, K> & Partialize<Opt<Col<Row, "mergeStackTeamColor">, "stack" | "team">, "league">,
  ): Col<Row, "mergeStackTeamColor">;
  teamColorBar<K extends keyof Row & string>(
    key: K,
    o: Base<Row, K> & Partialize<Opt<Col<Row, "teamColorBar">, never>, "league">,
  ): Col<Row, "teamColorBar">;
  teamColorBg<K extends keyof Row & string>(
    key: K,
    o: Base<Row, K> & Partialize<Opt<Col<Row, "teamColorBg">, never>, "league">,
  ): Col<Row, "teamColorBg">;
  image<K extends keyof Row & string>(
    key: K,
    o?: Base<Row, K> & Partial<Opt<Col<Row, "image">, never>>,
  ): Col<Row, "image">;
  /** gtUtils aliases — same objects, old names (see src/aliases.ts). */
  fmtRank: ColumnFactory<Row>["rank"];
  fmtTally: ColumnFactory<Row>["tally"];
}

/** gtUtils/sdvplot `_RANK_PALETTE` (green → red), shared by colorRanks, the legend fallback and tiers. */
export const RANK_PALETTE: readonly string[] = ["#3D8B6E", "#9DC5A7", "#EDE0CC", "#DB9070", "#BE4D3A"];

// Defaults are the sdvplotR / sdvplot defaults, verbatim (PARITY_TABLES.md; file:line beside each that was corrected); listed once, here.
// Typed against ColumnFactory (no cast), so every arrow is contextually typed and the defaults are checked against the kind.
export function columnFactory<Row>(): ColumnFactory<Row> {
  const f: Omit<ColumnFactory<Row>, "fmtRank" | "fmtTally"> = {
    text: (key, o = {}) => ({ kind: "text", key, ...o }),
    num: (key, o = {}) => ({ kind: "num", key, ...o }),
    int: (key, o = {}) => ({ kind: "int", key, ...o }),
    pct: (key, o = {}) => ({ kind: "pct", key, digits: 1, scale: true, ...o }),
    rank: (key, o = {}) => ({ kind: "rank", key, superscript: true, suffixSize: "0.7em", ...o }),
    delta: (from, to, o = {}) => ({
      kind: "delta",
      key: from,
      to,
      label: "Change",
      percent: false,
      decimals: 1,
      arrows: false,
      color: true,
      colorPositive: "#1B7837",
      colorNegative: "#B2182B",
      forceSign: true,
      ...o,
    }),
    tally: (keys, o = {}) => ({
      kind: "tally",
      key: keys[0],
      keys,
      separator: "-",
      share: false,
      shareOf: 0,
      shareDecimals: 1,
      shareLabel: "%",
      sharePrefix: " (",
      shareSuffix: ")",
      ...o,
    }),
    logo: (key, o) => ({ kind: "logo", key, height: 30, includeName: false, ...o }),
    wordmark: (key, o) => ({ kind: "wordmark", key, height: 30, ...o }),
    headshot: (key, o) => ({ kind: "headshot", key, idSystem: "espn", height: 30, ...o }),
    colorPills: (key, o = {}) => ({
      kind: "colorPills",
      key,
      palette: ["#C84630", "#5DA271"],
      fillType: "continuous",
      rankOrder: "desc",
      formatType: "number",
      scalePercent: true,
      suffix: "",
      reverse: false,
      outlineWidth: 0.25,
      pillHeight: 25,
      ...o,
    }),
    colorRanks: (key, o = {}) => ({ kind: "colorRanks", key, palette: RANK_PALETTE, reverse: false, ...o }),
    // gt_color_results fills the whole row (_cells.py:155-222); spec §6.1 lists it among the c.* kinds
    colorResults: (key, o = {}) => ({
      kind: "colorResults",
      key,
      winColor: "#5DA271",
      lossColor: "#C84630",
      winTextColor: "white",
      lossTextColor: "white",
      tieTextColor: "white",
      tieValue: "T",
      resultType: "wl",
      ...o,
    }),
    // width: the <th> width, Python gt_percentile_bar width=220 px (_layout.py:662-684)
    percentileBar: (key, o = {}) => ({
      kind: "percentileBar",
      key,
      domain: [0, 100],
      scale: "auto",
      palette: ["#3661AD", "#C9C9C9", "#D22D49"],
      reverse: false,
      trackColor: "#E9E9E9",
      trackHeight: 6,
      markerSize: 22,
      textColor: "#FFFFFF",
      ringWidth: 2,
      fullTrack: true,
      naLabel: "—",
      naTextColor: "#9A9A9A",
      decimals: 0,
      width: "220px",
      ...o,
    }),
    // gt_indicator_boxes: color_yes #FCCF10, color_no #EEEEEE, 20x20 box, yes = value 1 (_cells.py:1337-1347, :1414-1416)
    indicatorBox: (key, o = {}) => ({
      kind: "indicatorBox",
      key,
      truthy: [1, true, "1"],
      fill: "#FCCF10",
      neutral: "#EEEEEE",
      size: 20,
      ...o,
    }),
    highlight: (key, when, o = {}) => ({ kind: "highlight", key, when, fill: "#FFF3B0", bold: false, ...o }),
    highlightNa: (key, o = {}) => ({
      kind: "highlightNa",
      key,
      fill: "#F0F0F0",
      bold: false,
      italic: false,
      naStrings: ["NA"],
      ignoreCase: false,
      ...o,
    }),
    mergeStackTeamColor: (key, stack, team, o) => ({
      kind: "mergeStackTeamColor",
      key,
      stack,
      team,
      fontSizeTop: 14,
      fontSizeBottom: 12,
      color: "black",
      ...o,
    }),
    teamColorBar: (key, o) => ({
      kind: "teamColorBar",
      key,
      which: "primary",
      naColor: "#b3b3b3",
      barWidth: 4,
      ...o,
    }),
    teamColorBg: (key, o) => ({
      kind: "teamColorBg",
      key,
      which: "primary",
      alpha: 0.4,
      naColor: "#b3b3b3",
      ...o,
    }),
    image: (key, o = {}) => ({ kind: "image", key, height: "55px", ...o }),
  };
  return { ...f, fmtRank: f.rank, fmtTally: f.tally };
}

/** Themes whose Python default density is "compact" (_themes.py:241-242, :1108, :1212); every other theme defaults to "comfortable". */
const THEME_DENSITY: Readonly<Record<string, Density>> = {
  almanac: "compact",
  scoreboard: "compact",
  terminal: "compact",
};

type D<Row, T extends Decoration<Row>["type"]> = Extract<Decoration<Row>, { type: T }>;
export class TableBuilder<Row> {
  constructor(private readonly s: TableSpec<Row>) {}
  private add(d: Decoration<Row>): TableBuilder<Row> {
    return new TableBuilder({ ...this.s, decorations: [...this.s.decorations, d] });
  }
  id(id: string): TableBuilder<Row> {
    return new TableBuilder({ ...this.s, id });
  }
  columns(fn: (c: ColumnFactory<Row>) => readonly ColumnSpec<Row>[]): TableBuilder<Row> {
    return new TableBuilder({ ...this.s, columns: fn(columnFactory<Row>()) });
  }
  theme(
    name: string,
    o: { density?: Density; options?: Readonly<Record<string, string>> } = {},
  ): TableBuilder<Row> {
    return new TableBuilder({
      ...this.s,
      theme: {
        name,
        density: o.density ?? THEME_DENSITY[name] ?? "comfortable",
        ...(o.options ? { options: o.options } : {}),
      },
    });
  }
  title(text: string): TableBuilder<Row> {
    return this.add({ type: "title", text });
  }
  subtitle(text: string): TableBuilder<Row> {
    return this.add({ type: "subtitle", text });
  }
  titleHeader(title: string, o: Omit<D<Row, "titleHeader">, "type" | "title"> = {}): TableBuilder<Row> {
    return this.add({ type: "titleHeader", title, ...o });
  }
  sourceNote(html: string, o: { unsafe?: boolean } = {}): TableBuilder<Row> {
    return this.add({ type: "sourceNote", html, ...o });
  }
  caption538(o: Partial<Omit<D<Row, "caption538">, "type">> = {}): TableBuilder<Row> {
    return this.add({ type: "caption538", ruleWidth: 1, size: 12, align: "right", ...o });
  }
  groupBy(key: keyof Row & string): TableBuilder<Row> {
    return this.add({ type: "groupBy", key });
  }
  groupStripes(o: Partial<Omit<D<Row, "groupStripes">, "type">> = {}): TableBuilder<Row> {
    return this.add({ type: "groupStripes", color: "#F5F5F5", start: 2, ...o });
  }
  rowAccent(
    key: keyof Row & string,
    o: Partial<Omit<D<Row, "rowAccent">, "type" | "key">> = {},
  ): TableBuilder<Row> {
    return this.add({
      type: "rowAccent",
      key,
      width: 4,
      side: "left",
      hide: true,
      naColor: "transparent",
      ...o,
    });
  }
  boldRows(
    rows: D<Row, "boldRows">["rows"],
    o: Partial<Omit<D<Row, "boldRows">, "type" | "rows">> = {},
  ): TableBuilder<Row> {
    return this.add({ type: "boldRows", rows, textColor: "black", ...o });
  }
  spotlight(
    rows: D<Row, "spotlight">["rows"],
    o: Partial<Omit<D<Row, "spotlight">, "type" | "rows">> = {},
  ): TableBuilder<Row> {
    return this.add({ type: "spotlight", rows, bold: true, accentWidth: 4, dimColor: "auto", ...o });
  }
  cutline(
    after: number | readonly number[],
    o: Partial<Omit<D<Row, "cutline">, "type" | "after">> = {},
  ): TableBuilder<Row> {
    return this.add({
      type: "cutline",
      after: typeof after === "number" ? [after] : after,
      color: "#A6081A",
      weight: 2,
      style: "dashed",
      labelSize: 9,
      labelPosition: "below",
      gap: [0],
      ...o,
    });
  }
  borderGrid(o: Partial<Omit<D<Row, "borderGrid">, "type">> = {}): TableBuilder<Row> {
    return this.add({ type: "borderGrid", color: "black", weight: 1, includeLabels: false, ...o });
  }
  borderBars(
    side: "top" | "bottom",
    colors: readonly string[],
    o: Partial<Omit<D<Row, "borderBars">, "type" | "side" | "colors">> = {},
  ): TableBuilder<Row> {
    return this.add({
      type: "borderBars",
      side,
      colors,
      barHeight: 10,
      barWidth: "100%",
      barAlign: "center",
      imgWidth: 30,
      imgHeight: 30,
      imgPadding: 10,
      imgAlign: "right",
      textWeight: "bold",
      textColor: "#FFFFFF",
      textSize: 18,
      textAlign: "left",
      textPadding: 10,
      ...o,
    });
  }
  // location "bottom": Python gt_legend_continuous default (_layout.py:357)
  legendContinuous(o: Partial<Omit<D<Row, "legendContinuous">, "type">> = {}): TableBuilder<Row> {
    return this.add({
      type: "legendContinuous",
      nBins: 5,
      digits: 0,
      titlePosition: "top",
      location: "bottom",
      swatchWidth: 40,
      swatchHeight: 12,
      ...o,
    });
  }
  legendDiscrete(
    key: D<Row, "legendDiscrete">["key"],
    o: Partial<Omit<D<Row, "legendDiscrete">, "type" | "key">> = {},
  ): TableBuilder<Row> {
    return this.add({
      type: "legendDiscrete",
      key,
      location: "top",
      shape: "square",
      swatchSize: 14,
      border: true,
      gap: 14,
      direction: "horizontal",
      align: "center",
      ...o,
    });
  }
  // hideP: Python hide_p=True (_layout.py:1303)
  significance(
    pairs: D<Row, "significance">["pairs"],
    o: Partial<Omit<D<Row, "significance">, "type" | "pairs">> = {},
  ): TableBuilder<Row> {
    return this.add({
      type: "significance",
      pairs,
      levels: [0.01, 0.05, 0.1],
      symbols: ["***", "**", "*"],
      superscript: true,
      note: true,
      hideP: true,
      ...o,
    });
  }
  outliers(
    columns: readonly (keyof Row & string)[],
    o: Partial<Omit<D<Row, "outliers">, "type" | "columns">> = {},
  ): TableBuilder<Row> {
    return this.add({ type: "outliers", columns, method: "iqr", side: "both", bold: true, ...o });
  }
  scaleNote(
    columns: readonly (keyof Row & string)[],
    o: Partial<Omit<D<Row, "scaleNote">, "type" | "columns">> = {},
  ): TableBuilder<Row> {
    return this.add({ type: "scaleNote", columns, divisor: 1000, where: "sourceNote", decimals: 0, ...o });
  }
  socialTag(
    accounts: Readonly<Record<string, string>>,
    o: Partial<Omit<D<Row, "socialTag">, "type" | "accounts">> = {},
  ): TableBuilder<Row> {
    return this.add({
      type: "socialTag",
      accounts,
      stack: false,
      separator: " | ",
      align: "right",
      iconHeight: "0.9em",
      ...o,
    });
  }
  watermark(o: Partial<Omit<D<Row, "watermark">, "type">> = {}): TableBuilder<Row> {
    return this.add({
      type: "watermark",
      opacity: 0.06,
      size: "60%",
      position: "center",
      color: "#000000",
      angle: 0,
      font: "Helvetica, Arial, sans-serif",
      ...o,
    });
  }
  wrapLabels(o: Partial<Omit<D<Row, "wrapLabels">, "type">> = {}): TableBuilder<Row> {
    return this.add({ type: "wrapLabels", width: 12, balance: true, ...o });
  }
  marginalia(
    columns: readonly (keyof Row & string)[],
    o: Partial<Omit<D<Row, "marginalia">, "type" | "columns">> = {},
  ): TableBuilder<Row> {
    return this.add({
      type: "marginalia",
      columns,
      width: 220,
      label: "",
      italic: true,
      size: "0.92em",
      rule: true,
      align: "left",
      ...o,
    });
  }
  snake(o: Partial<Omit<D<Row, "snake">, "type">> = {}): TableBuilder<Row> {
    return this.add({ type: "snake", nCols: 2, gap: 20, fill: "", cleanGaps: true, ...o });
  }
  tiers(
    levels: readonly string[],
    tierKey: keyof Row & string,
    imageColumns: readonly (keyof Row & string)[],
    o: Partial<Omit<D<Row, "tiers">, "type" | "levels" | "tierKey" | "imageColumns">> = {},
  ): TableBuilder<Row> {
    return this.add({ type: "tiers", levels, tierKey, imageColumns, imgHeight: "55px", style: "dark", ...o });
  }
  font(family: string, o: Partial<Omit<D<Row, "font">, "type" | "family">> = {}): TableBuilder<Row> {
    return this.add({ type: "font", family, google: true, ...o });
  }
  build(): TableSpec<Row> {
    if (this.s.columns.length === 0)
      throw new TableSpecError("a table needs at least one column: call .columns(c => [...])");
    const seen = new Set<string>();
    for (const col of this.s.columns) {
      if (seen.has(col.key)) throw new TableSpecError(`column key "${col.key}" appears twice`);
      seen.add(col.key);
    }
    if (this.s.decorations.filter((d) => d.type === "title").length > 1)
      throw new TableSpecError("only one .title()");
    return this.s;
  }
}
export function defineTable<Row>(): TableBuilder<Row> {
  return new TableBuilder<Row>({
    columns: [],
    decorations: [],
    theme: { name: "sdv", density: "comfortable" },
  });
}
