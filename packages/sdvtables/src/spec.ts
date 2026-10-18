// src/spec.ts — the whole serializable contract. Nothing here imports the renderer.
import type {
  EspnHeadshotLeague,
  HeadshotIdSystem,
  IdSystem,
  League,
  SeasonInput,
  Variant,
  Which,
} from "@sportsdataverse/sdvplot";

export type Density = "comfortable" | "compact" | "social";
export type Align = "left" | "center" | "right";
/** `& keyof Row & string`: a mapped-type index alone is not provably a string key of Row (TS2344 otherwise). */
export type NumericKey<Row> = {
  [K in keyof Row]-?: Row[K] extends number | null | undefined ? K : never;
}[keyof Row] &
  keyof Row &
  string;
/**
 * The keys of `Row` whose values are arrays of numbers: the series an in-cell chart (`sparkline`, `sparkbar`) draws.
 * A `null` entry (or any non-finite number: `NaN`, `Infinity`) is a gap; a missing or empty array leaves the cell blank.
 */
export type SeriesKey<Row> = {
  [K in keyof Row]-?: Row[K] extends readonly (number | null)[] | null | undefined ? K : never;
}[keyof Row] &
  keyof Row &
  string;
export type StringKey<Row> = {
  [K in keyof Row]-?: Row[K] extends string | null | undefined ? K : never;
}[keyof Row] &
  keyof Row &
  string;

export type PredicateOp =
  | "=="
  | "!="
  | ">"
  | ">="
  | "<"
  | "<="
  | "in"
  | "notIn"
  | "isNull"
  | "notNull"
  | "matches";
export interface Predicate<Row> {
  readonly key: keyof Row & string;
  readonly op: PredicateOp;
  readonly value?: unknown;
}
export type RowSelector<Row> = readonly number[] | Predicate<Row>;

export interface ColumnBase<Row, K extends keyof Row & string = keyof Row & string> {
  readonly key: K;
  readonly label?: string;
  readonly subheader?: string;
  readonly align?: Align;
  /** CSS width of the column, written on its `<th>` (e.g. "220px"). */
  readonly width?: string;
  /** Phase 5 (headless engine) — accepted and ignored by renderHTML. */
  readonly sortable?: boolean;
  readonly filterable?: boolean;
  /** Phase 5 — the one non-serializable field (JSON.stringify drops it). A method signature, so a numeric kind's comparator still fits `ColumnBase<Row>`. */
  compare?(a: Row[K], b: Row[K]): number;
  /** reactablefmtr `tooltip = TRUE`: the cell's formatted value as its `title` attribute (no tooltip library). */
  readonly tooltip?: boolean;
}
export type FormatType = "number" | "comma" | "currency" | "percent";
export interface TeamOpts {
  readonly league: League;
  readonly season?: SeasonInput;
  readonly idSystem?: IdSystem;
  readonly strict?: boolean;
}
/**
 * How a reactablefmtr-style kind prints its number (reactablefmtr `number_fmt`): `value * scale`, then `digits`
 * decimals (default: as many as the value needs, up to 7 significant figures), then the `type` (`comma` groups
 * thousands, `currency` adds `$`, `percent` adds `%`), wrapped in `prefix` and `suffix`.
 */
export interface NumberFormat {
  readonly digits?: number;
  readonly type?: FormatType;
  readonly scale?: number;
  readonly prefix?: string;
  readonly suffix?: string;
}
/**
 * Per-row colour for a reactablefmtr-style kind (reactablefmtr `fill_color_ref` / `color_ref`): `colorRef` names a
 * column holding a hex colour or CSS colour name (`"steelblue"`) per row; or `team` names a column of team names/ids,
 * resolved in `league` to the team's `which` colour. `colorRef` wins over `team`. Any other `colorRef` value (blank,
 * unknown name, `rgb()`, `url(...)`) counts as no row colour: never written to CSS, the row falls back to `team`, then
 * the kind's own scale (or `iconSet`'s bucket colour). A `dataBar` with `gradient: true` ignores both, as reactablefmtr
 * does (`fill_gradient` drops `fill_color_ref`).
 */
export interface ColorRefOpts<Row> {
  readonly colorRef?: keyof Row & string;
  readonly team?: keyof Row & string;
  readonly league?: League;
  readonly which?: Which;
  readonly season?: SeasonInput;
  readonly idSystem?: IdSystem;
  readonly strict?: boolean;
}
/**
 * A logo, wordmark or headshot beside a value (reactablefmtr `img_ref`): `logo` and `wordmark` read the column's
 * `team` (resolved in `league`); `headshot` reads the ESPN athlete id in `markKey`. `markHeight` is in pixels.
 */
export interface MarkOpts<Row> {
  readonly mark?: "logo" | "wordmark" | "headshot";
  readonly markKey?: keyof Row & string;
  readonly markHeight?: number;
}
/** The inline-SVG icons iconSet and iconAssign draw (no icon font). */
export type IconName =
  | "circle"
  | "square"
  | "diamond"
  | "star"
  | "triangle-up"
  | "triangle-down"
  | "arrow-up"
  | "arrow-down"
  | "arrow-right"
  | "check"
  | "xmark"
  | "minus"
  | "plus"
  | "heart";
/** Where text sits on a data bar (reactablefmtr `text_position`). */
export type BarTextPosition =
  | "inside-end"
  | "outside-end"
  | "inside-base"
  | "outside-base"
  | "center"
  | "above"
  | "none";

/** A point of a series: its first, last, minimum or maximum present value (the first of ties), or every point ("all"). */
export type SeriesPoint = "first" | "last" | "min" | "max" | "all";
/**
 * Points (or bars) to mark: a list of names, each drawn in red, or a colour per name, as reactablefmtr's
 * `highlight_points(min = "red", max = "blue")`. Where two names fall on one point, the later of first, last, min,
 * max wins; "all" colours every point the others do not.
 */
export type SeriesHighlight = readonly SeriesPoint[] | Readonly<Partial<Record<SeriesPoint, string>>>;
/** A sparkline / sparkbar reference line (reactablefmtr `statline`): at the series' mean, median, minimum or maximum. */
export type SeriesStat = "mean" | "median" | "min" | "max";
/** A sparkline / sparkbar shaded band (reactablefmtr `bandline`): the inner quartiles (R type 7) or the whole range. */
export type SeriesBand = "innerquartiles" | "range";
/** The options `sparkline` and `sparkbar` share (reactablefmtr `react_sparkline` / `react_sparkbar`). */
export interface SeriesChartOpts {
  /** A dashed reference line across the chart, labelled at its right end. */
  readonly statline?: SeriesStat;
  /** The reference line's and its label's colour (reactablefmtr: red). */
  readonly statlineColor: string;
  /** The reference line label's CSS font size. */
  readonly statlineLabelSize: string;
  /** A shaded band across the chart (reactablefmtr `bandline`). */
  readonly bandline?: SeriesBand;
  /** The band's colour (reactablefmtr: red). */
  readonly bandlineColor: string;
  /** The band's opacity, 0 to 1. */
  readonly bandlineOpacity: number;
  /** Values to print by their point or bar ("all" prints every one); empty prints none. */
  readonly labels: readonly SeriesPoint[];
  /** The value labels' CSS font size. */
  readonly labelSize: string;
  /** Decimal places of the value labels and the reference line label. */
  readonly decimals: number;
  /** The value at the bottom of every cell's chart; default: each series' own minimum (sparkbar: the lower of 0 and it). */
  readonly minValue?: number;
  /** The value at the top of every cell's chart; default: each series' own maximum (sparkbar: the higher of 0 and it). */
  readonly maxValue?: number;
  /**
   * The chart's height in px (reactablefmtr `height`). Default (undefined): 22, grown to 28 or 30 when labels sit
   * above the points, as in reactablefmtr; any number given is used as is, 22 included.
   */
  readonly chartHeight?: number;
  /** The chart's width in px (`width` is the column's CSS width, as on every kind). */
  readonly chartWidth: number;
}

export type ColumnSpec<Row> =
  | (ColumnBase<Row> & { readonly kind: "text" })
  | (ColumnBase<Row, NumericKey<Row>> & {
      readonly kind: "num";
      readonly digits?: number;
      readonly big?: boolean;
      readonly prefix?: string;
      readonly suffix?: string;
      readonly forceSign?: boolean;
    })
  | (ColumnBase<Row, NumericKey<Row>> & { readonly kind: "int" })
  | (ColumnBase<Row, NumericKey<Row>> & {
      readonly kind: "pct";
      readonly digits: number;
      readonly scale: boolean;
    })
  | (ColumnBase<Row, NumericKey<Row>> & {
      readonly kind: "rank";
      readonly superscript: boolean;
      readonly suffixSize: string;
    })
  | (ColumnBase<Row, NumericKey<Row>> & {
      readonly kind: "delta";
      readonly to: NumericKey<Row>;
      readonly percent: boolean;
      readonly decimals: number;
      readonly arrows: boolean;
      readonly color: boolean;
      readonly colorPositive: string;
      readonly colorNegative: string;
      readonly colorNeutral?: string;
      readonly forceSign: boolean;
    })
  | (ColumnBase<Row, NumericKey<Row>> & {
      readonly kind: "tally";
      readonly keys: readonly NumericKey<Row>[];
      readonly separator: string;
      readonly share: boolean;
      readonly shareOf: number;
      readonly shareDecimals: number;
      readonly shareLabel: string;
      readonly sharePrefix: string;
      readonly shareSuffix: string;
    })
  | (ColumnBase<Row> &
      TeamOpts & {
        readonly kind: "logo";
        readonly height: number;
        readonly variant?: Variant;
        readonly includeName: boolean;
      })
  | (ColumnBase<Row> &
      TeamOpts & { readonly kind: "wordmark"; readonly height: number; readonly variant?: Variant })
  | (ColumnBase<Row> & {
      readonly kind: "headshot";
      readonly league: EspnHeadshotLeague;
      readonly idSystem: HeadshotIdSystem;
      readonly height: number;
    })
  | (ColumnBase<Row, NumericKey<Row>> &
      ColorRefOpts<Row> & {
        /** `colorRef` / `team` (reactablefmtr `pill_buttons(color_ref)`): the pill takes the row's colour, not the scale's. */
        readonly kind: "colorPills";
        readonly palette: readonly string[];
        readonly domain?: readonly [number, number];
        readonly fillType: "continuous" | "rank";
        readonly rankOrder: "asc" | "desc";
        readonly digits?: number;
        readonly formatType: FormatType;
        readonly scalePercent: boolean;
        readonly suffix: string;
        readonly reverse: boolean;
        readonly outlineColor?: string;
        readonly outlineWidth: number;
        readonly pillHeight: number;
        readonly textColor?: string;
        readonly naColor?: string;
      })
  | (ColumnBase<Row, NumericKey<Row>> &
      ColorRefOpts<Row> & {
        /** reactablefmtr `color_tiles` / `color_scales`: fills the cell on a scale (`colorRef` / `team`: the row's colour). */
        readonly kind: "colorRanks";
        readonly palette: readonly string[];
        readonly domain?: readonly [number, number];
        readonly reverse: boolean;
        /** grDevices::colorRamp `bias` (default 1): the palette stops sit at `(i / (n - 1)) ^ bias`; above 1 spreads the high end. */
        readonly bias?: number;
        /** reactablefmtr `span`: `true` takes the domain from every numeric column of the rows, a list from those columns. */
        readonly span?: boolean | readonly (keyof Row & string)[];
        /** reactablefmtr `show_text` (default true): false keeps the colour and hides the value. */
        readonly showText?: boolean;
        /** reactablefmtr `even_breaks`: the palette's colours as equal-count buckets (dplyr::ntile), not a ramp. */
        readonly evenBreaks?: boolean;
      })
  | (ColumnBase<Row> & {
      readonly kind: "colorResults";
      readonly winColor: string;
      readonly lossColor: string;
      readonly tieColor?: string;
      readonly winTextColor: string;
      readonly lossTextColor: string;
      readonly tieTextColor: string;
      readonly tieValue: unknown;
      readonly resultType: "wl" | "binary";
    })
  | (ColumnBase<Row, NumericKey<Row>> & {
      readonly kind: "percentileBar";
      readonly domain: readonly [number, number];
      readonly scale: "auto" | "none" | number;
      readonly palette: readonly string[];
      readonly reverse: boolean;
      readonly trackColor: string;
      readonly trackHeight: number;
      readonly markerSize: number;
      readonly textColor: string;
      readonly fontSize?: number;
      readonly ringColor?: string;
      readonly ringWidth: number;
      readonly fullTrack: boolean;
      readonly naLabel?: string;
      readonly naTrackColor?: string;
      readonly naTextColor: string;
      readonly decimals: number;
    })
  | (ColumnBase<Row> & {
      readonly kind: "indicatorBox";
      readonly truthy: readonly unknown[];
      readonly fill: string;
      readonly neutral: string;
      readonly size: number;
      readonly showOnly?: "filled" | "neutral";
    })
  | (ColumnBase<Row> & {
      readonly kind: "highlight";
      /** The cells to mark; ignored when `extreme` is set. */
      readonly when?: Predicate<Row>;
      /**
       * reactablefmtr `highlight_min` / `highlight_max` / `highlight_min_max`: mark the column's minimum, maximum or
       * both (every tie), in bold red (min) or green (max) unless `textColor` is given.
       */
      readonly extreme?: "min" | "max" | "both";
      readonly fill?: string;
      readonly textColor?: string;
      readonly bold: boolean;
    })
  | (ColumnBase<Row> & {
      readonly kind: "highlightNa";
      readonly fill?: string;
      readonly textColor?: string;
      readonly bold: boolean;
      readonly italic: boolean;
      readonly missingText?: string;
      readonly naStrings: readonly string[];
      readonly ignoreCase: boolean;
    })
  | (ColumnBase<Row> &
      TeamOpts & {
        readonly kind: "mergeStackTeamColor";
        readonly stack: keyof Row & string;
        readonly team: keyof Row & string;
        readonly fontSizeTop: number;
        readonly fontSizeBottom: number;
        readonly color: string;
        readonly background?: string;
      })
  | (ColumnBase<Row> &
      TeamOpts & {
        readonly kind: "teamColorBar";
        readonly which: Which;
        readonly naColor: string;
        readonly barWidth: number;
      })
  | (ColumnBase<Row> &
      TeamOpts & {
        readonly kind: "teamColorBg";
        readonly which: Which;
        readonly alpha: number;
        readonly naColor: string;
      })
  | (ColumnBase<Row> & {
      readonly kind: "image";
      readonly height: string;
      readonly alt?: keyof Row & string;
    })
  /**
   * reactablefmtr `data_bars`: a horizontal bar per cell, its length `|value| / max|value|` (or scaled between
   * `minValue` and `maxValue`). `align` ("left" | "right") is the side the bar grows from. One `fill` colour paints
   * every bar; several are a ramp over the column's range (or, with `gradient`, a left-to-right gradient). A column
   * with negatives (or `posNeg: true`) draws diverging bars around a centre line, `fill[0]` left and `fill[1]` right
   * when two colours are given.
   */
  | (ColumnBase<Row, NumericKey<Row>> &
      ColorRefOpts<Row> &
      MarkOpts<Row> & {
        readonly kind: "dataBar";
        readonly fill: readonly string[];
        /** The track behind each bar (reactablefmtr `background`). */
        readonly background: string;
        readonly bias: number;
        readonly minValue?: number;
        readonly maxValue?: number;
        readonly textPosition: BarTextPosition;
        /** Text colour; default: black or white by contrast for text on the bar, the table's ink otherwise. */
        readonly textColor?: string;
        readonly numberFormat?: NumberFormat;
        /** Bar thickness in px (default 18, or 5 for `textPosition: "above"`). */
        readonly barHeight?: number;
        readonly roundEdges: boolean;
        /** Paint `fill` (2+ colours) as a left-to-right gradient; overrides `colorRef` / `team`, as reactablefmtr does. */
        readonly gradient: boolean;
        /** Diverging bars; default: when the column has a negative value. */
        readonly posNeg?: boolean;
      })
  /**
   * reactablefmtr `icon_sets`: the value with an icon, icons and colours each assigned by equal-count buckets of the
   * column (dplyr::ntile): with three colours the bottom third gets `colors[0]`.
   */
  | (ColumnBase<Row, NumericKey<Row>> & {
      readonly kind: "iconSet";
      readonly icons: readonly IconName[];
      readonly colors: readonly string[];
      readonly opacity: number;
      readonly iconPosition: "left" | "right" | "above" | "below" | "over";
      /** Icon size in px. */
      readonly iconSize: number;
      /** A column naming each row's icon (an `IconName`), instead of the buckets. */
      readonly iconRef?: keyof Row & string;
      /** A column holding each row's icon colour (hex or CSS colour name, else blank), instead of the buckets. */
      readonly iconColorRef?: keyof Row & string;
      readonly numberFormat?: NumberFormat;
    })
  /**
   * reactablefmtr `icon_assign`: the value as a row of icons, one per unit up to the column's maximum, filled up to
   * the (rounded) value; `buckets` shows the value's bucket out of `buckets` instead.
   */
  | (ColumnBase<Row, NumericKey<Row>> & {
      readonly kind: "iconAssign";
      readonly icon: IconName;
      readonly fill: string;
      readonly empty: string;
      readonly fillOpacity: number;
      readonly emptyOpacity: number;
      readonly iconSize: number;
      readonly buckets?: number;
      /** One icon per `seqBy` units (reactablefmtr `seq_by`). */
      readonly seqBy: number;
      readonly showValues: "none" | "left" | "right" | "above" | "below";
      readonly numberFormat?: NumberFormat;
    })
  /**
   * reactablefmtr `merge_column`: the cell's value with a second column's value beside it (`position`), each with its
   * own size, colour, weight and style; optionally a logo, wordmark or headshot first.
   */
  | (ColumnBase<Row> &
      MarkOpts<Row> & {
        readonly kind: "mergeStack";
        readonly stack: keyof Row & string;
        readonly position: "right" | "left" | "above" | "below";
        readonly size: number;
        readonly color?: string;
        readonly weight: "normal" | "bold";
        readonly style: "normal" | "italic";
        readonly stackSize: number;
        readonly stackColor: string;
        readonly stackWeight: "normal" | "bold";
        readonly stackStyle: "normal" | "italic";
        /** Extra space between the two values in px (reactablefmtr `spacing`; 3px always). */
        readonly spacing: number;
        /** The team column a logo or wordmark mark reads, resolved in `league`. */
        readonly team?: keyof Row & string;
        readonly league?: League;
        readonly season?: SeasonInput;
        readonly idSystem?: IdSystem;
        readonly strict?: boolean;
      })
  /**
   * reactablefmtr `bubble_grid`: a circle (or square) per cell, `maxSize * |value| / max|value|` px across, coloured on
   * a ramp of the column's range (or the row's `colorRef` / `team` colour), with the value inside.
   */
  | (ColumnBase<Row, NumericKey<Row>> &
      ColorRefOpts<Row> & {
        readonly kind: "bubble";
        readonly shape: "circles" | "squares";
        readonly colors: readonly string[];
        readonly bias: number;
        readonly opacity: number;
        readonly minValue?: number;
        readonly maxValue?: number;
        /** The largest bubble's size in px (reactablefmtr: 100). */
        readonly maxSize: number;
        readonly showText: boolean;
        readonly textColor?: string;
        readonly numberFormat?: NumberFormat;
      })
  /**
   * reactablefmtr `react_sparkline`: each cell's array of numbers as a line, an inline `<svg role="img">` whose
   * `aria-label` (and `<title>`) gives the count, minimum, maximum and last value. A gap breaks the line; a point with
   * gaps on both sides draws as a dot. `colorRef` / `team` colours the line (and area) per row, a team colour checked
   * for 3:1 contrast against the table background. Drawn without dataui: straight segments, no per-point tooltips.
   */
  | (ColumnBase<Row, SeriesKey<Row>> &
      ColorRefOpts<Row> &
      SeriesChartOpts & {
        readonly kind: "sparkline";
        /** The line's colour when the row has no `colorRef` / team colour (reactablefmtr: slategray). */
        readonly lineColor: string;
        /** The line's stroke width in px. */
        readonly lineWidth: number;
        /** Fill the area under the line. */
        readonly showArea: boolean;
        /** The area's colour; default: the line's. */
        readonly areaColor?: string;
        /** The area's opacity, 0 to 1. */
        readonly areaOpacity: number;
        /** Points to mark with a dot (reactablefmtr `highlight_points`). */
        readonly highlightPoints?: SeriesHighlight;
        /** The radius of a highlighted point in px. */
        readonly pointSize: number;
      })
  /**
   * reactablefmtr `react_sparkbar`: each cell's array of numbers as a small bar chart (inline SVG, labelled as
   * `sparkline` is). Bars stand on zero, so positive values rise from it and negative ones hang below it.
   */
  | (ColumnBase<Row, SeriesKey<Row>> &
      ColorRefOpts<Row> &
      SeriesChartOpts & {
        readonly kind: "sparkbar";
        /** The bars' colour when the row has no `colorRef` / team colour (reactablefmtr: slategray). */
        readonly fillColor: string;
        /** The bars' opacity, 0 to 1. */
        readonly fillOpacity: number;
        /** Bars to recolour, as `sparkline`'s `highlightPoints`. */
        readonly highlightBars?: SeriesHighlight;
      })
  /**
   * reactablefmtr `gauge_chart`: each cell's number as a half-circle gauge (inline SVG) with the value inside. As in
   * reactablefmtr the absolute value fills the gauge (-5 fills as 5); the printed value and the `aria-label` keep the
   * sign, and the label says so. A missing or non-finite value is blank; text passes through.
   */
  | (ColumnBase<Row, NumericKey<Row>> &
      ColorRefOpts<Row> & {
        readonly kind: "gauge";
        /** One colour, or several to ramp through from the column's smallest value to its largest. */
        readonly fill: readonly string[];
        /** The unfilled track. */
        readonly background: string;
        /** The value of an empty gauge, at least 0 (the gauge measures the absolute value); default 0. */
        readonly minValue?: number;
        /** The value of a full gauge; default: the column's largest absolute value. */
        readonly maxValue?: number;
        /** Print the scale's two ends under the gauge. */
        readonly showMinMax: boolean;
        /** How the value and the ends print (reactablefmtr `number_fmt`). */
        readonly numberFormat?: NumberFormat;
        /** The gauge's scale: 1 is 50px wide (reactablefmtr `size = 1`), 2 is 100px. */
        readonly size: number;
        /** The value's colour; default: the cell's text colour. */
        readonly textColor?: string;
        /** Print the value in bold. */
        readonly boldText: boolean;
        /** The value's CSS font size; default: the cell's. */
        readonly textSize?: string;
        /** grDevices::colorRamp `bias` for a several-colour `fill`. */
        readonly bias: number;
        /** The fill's opacity, 0 to 1. */
        readonly opacity: number;
      });

export type ColumnKind = ColumnSpec<never>["kind"];
export interface TextStyle {
  readonly color?: string;
  readonly size?: string;
  readonly weight?: number | string;
  readonly font?: string;
  readonly transform?: "none" | "uppercase";
  readonly style?: "normal" | "italic";
}

export type Decoration<Row> =
  | { readonly type: "title"; readonly text: string }
  | { readonly type: "subtitle"; readonly text: string }
  | {
      readonly type: "titleHeader";
      readonly title: string;
      readonly subtitle?: string;
      readonly kicker?: string;
      readonly date?: string;
      readonly kickerStyle?: TextStyle;
      readonly titleStyle?: TextStyle;
      readonly subtitleStyle?: TextStyle;
      readonly dateStyle?: TextStyle;
    }
  | { readonly type: "sourceNote"; readonly html: string; readonly unsafe?: boolean }
  | {
      readonly type: "caption538";
      readonly top?: string;
      readonly bottom?: string;
      readonly ruleColor?: string;
      readonly ruleWidth: number;
      readonly size: number;
      readonly align: Align;
    }
  | { readonly type: "groupBy"; readonly key: keyof Row & string }
  | { readonly type: "groupStripes"; readonly color: string; readonly start: 1 | 2 }
  | {
      readonly type: "rowAccent";
      readonly key: keyof Row & string;
      readonly palette?: Readonly<Record<string, string>> | readonly string[];
      readonly rows?: RowSelector<Row>;
      readonly width: number;
      readonly side: "left" | "right";
      readonly hide: boolean;
      readonly naColor: string;
    }
  | {
      readonly type: "boldRows";
      readonly rows: RowSelector<Row>;
      readonly textColor: string;
      readonly highlightColor?: string;
    }
  | {
      readonly type: "spotlight";
      readonly rows: RowSelector<Row>;
      readonly columns?: readonly (keyof Row & string)[];
      readonly fill?: string;
      readonly textColor?: string;
      readonly bold: boolean;
      readonly accentColor?: string;
      readonly accentWidth: number;
      readonly dimColor: string | "auto" | null;
    }
  /** `after` = rows above each line (Python gt_cutline, _cells.py:840-841): 3 draws between the 3rd and 4th rows, 0 above the first. */
  | {
      readonly type: "cutline";
      readonly after: readonly number[];
      readonly label?: readonly (string | null)[];
      readonly color: string;
      readonly weight: number;
      readonly style: "dashed" | "solid" | "dotted";
      readonly labelColor?: string;
      readonly labelSize: number;
      readonly labelPosition: "above" | "below";
      readonly gap: readonly number[];
    }
  | {
      readonly type: "borderGrid";
      readonly color: string;
      readonly weight: number;
      readonly includeLabels: boolean;
    }
  | {
      readonly type: "borderBars";
      readonly side: "top" | "bottom";
      readonly colors: readonly string[];
      readonly barHeight: number;
      readonly barWidth: string;
      readonly barAlign: Align;
      readonly img?: string;
      readonly imgWidth: number;
      readonly imgHeight: number;
      readonly imgPadding: number;
      readonly imgAlign: "left" | "right";
      readonly text?: string;
      readonly textWeight: string;
      readonly textColor: string;
      readonly textSize: number;
      readonly textAlign: Align;
      readonly textPadding: number;
    }
  | {
      readonly type: "legendContinuous";
      readonly columns?: readonly (keyof Row & string)[];
      readonly palette?: readonly string[];
      readonly domain?: readonly [number, number];
      readonly reverse?: boolean;
      readonly nBins: number;
      readonly labels?: readonly string[];
      readonly digits: number;
      readonly title?: string;
      readonly titlePosition: "top" | "left";
      readonly location: "top" | "bottom";
      readonly swatchWidth: number;
      readonly swatchHeight: number;
    }
  | {
      readonly type: "legendDiscrete";
      readonly key: Readonly<Record<string, string>> | "recorded";
      readonly heading?: string;
      readonly subtitle?: string;
      readonly location: "top" | "bottom";
      readonly shape: "square" | "circle";
      readonly swatchSize: number;
      readonly border: boolean;
      readonly borderColor?: string;
      readonly gap: number;
      readonly direction: "horizontal" | "vertical";
      readonly align: Align;
    }
  | {
      readonly type: "significance";
      readonly pairs: readonly { readonly estimate: keyof Row & string; readonly p: keyof Row & string }[];
      readonly levels: readonly number[];
      readonly symbols: readonly string[];
      readonly superscript: boolean;
      readonly note: boolean;
      readonly hideP: boolean;
    }
  | {
      readonly type: "outliers";
      readonly columns: readonly (keyof Row & string)[];
      readonly method: "iqr" | "sd" | "bounds";
      readonly threshold?: number;
      readonly bounds?: readonly [number | null, number | null];
      readonly side: "both" | "high" | "low";
      readonly fill?: string;
      readonly color?: string;
      readonly bold: boolean;
      readonly symbol?: string;
      readonly note?: string | boolean;
    }
  | {
      readonly type: "scaleNote";
      readonly columns: readonly (keyof Row & string)[];
      readonly divisor: number;
      readonly note?: string;
      readonly where: "sourceNote" | "label" | "both";
      readonly labelSuffix?: string;
      readonly decimals: number;
    }
  | {
      readonly type: "socialTag";
      readonly accounts: Readonly<Record<string, string>>;
      readonly caption?: string;
      readonly stack: boolean;
      readonly separator: string;
      readonly align: Align;
      readonly iconColor?: string;
      readonly iconHeight: string;
    }
  | {
      readonly type: "watermark";
      readonly text?: string;
      readonly image?: string;
      readonly opacity: number;
      readonly size: string;
      readonly position: string;
      readonly color: string;
      readonly angle: number;
      readonly font: string;
    }
  | {
      readonly type: "wrapLabels";
      readonly columns?: readonly (keyof Row & string)[];
      readonly width: number;
      readonly balance: boolean;
    }
  | {
      readonly type: "marginalia";
      readonly columns: readonly (keyof Row & string)[];
      readonly width?: number | string;
      readonly label: string;
      readonly italic: boolean;
      readonly color?: string;
      readonly size: string;
      readonly rule: boolean;
      readonly ruleColor?: string;
      readonly align: Align;
    }
  | {
      readonly type: "snake";
      readonly nCols: number;
      readonly rowsPerCol?: number;
      readonly gap: number;
      readonly fill: string;
      readonly cleanGaps: boolean;
    }
  | {
      readonly type: "tiers";
      readonly levels: readonly string[];
      readonly colors?: readonly string[];
      readonly tierKey: keyof Row & string;
      readonly imageColumns: readonly (keyof Row & string)[];
      readonly imgHeight: string;
      readonly style: "light" | "dark";
    }
  | {
      readonly type: "font";
      readonly family: string;
      readonly google: boolean;
      readonly weight?: number | string;
      readonly style?: "normal" | "italic";
    }
  | LegendIconDecoration;

/** A `legendIcon` shape, drawn as inline SVG (reactablefmtr draws Font Awesome icons; sdvtables loads no icon font). */
export type LegendIconShape =
  | "circle"
  | "square"
  | "diamond"
  | "double-diamond"
  | "triangle-up"
  | "triangle-down"
  | "medal"
  | "battery-quarter"
  | "battery-half"
  | "battery-three-quarters"
  | "battery-full";
/**
 * reactablefmtr `add_icon_legend`: a row of icons with labels above or below the table. Either a preset `iconSet`
 * (reactablefmtr's "ski rating", "medals" or "batteries", with its colours and labels) or your own `icons`, one
 * colour and one label each. Pass `iconSet` or `icons`, not both. reactablefmtr's `centered` argument is not ported
 * (`align` places the row left or right).
 */
export interface LegendIconDecoration {
  readonly type: "legendIcon";
  /** reactablefmtr's preset `icon_set`; its labels can be renamed with `labels` (same count). */
  readonly iconSet?: "ski rating" | "medals" | "batteries";
  /** Custom shapes, used when `iconSet` is absent. */
  readonly icons?: readonly LegendIconShape[];
  /** One CSS colour per custom icon (recycled when shorter). */
  readonly colors?: readonly string[];
  /** One label per icon; required with `icons` when `showLabels` is true (otherwise each shape's name is its accessible name). */
  readonly labels?: readonly string[];
  /** Write each label beside its icon; false keeps the label as the icon's accessible name only. */
  readonly showLabels: boolean;
  /** Bold line above the icons. */
  readonly title?: string;
  /** Small muted line below the icons. */
  readonly footer?: string;
  readonly align: "left" | "right";
  /** reactablefmtr appends the legend after the table: "bottom". */
  readonly location: "top" | "bottom";
  /** Icon height in px (reactablefmtr: font-size 16px). */
  readonly iconSize: number;
}

export type DecorationType = Decoration<never>["type"];
export interface ThemeRef {
  readonly name: string;
  readonly density: Density;
  readonly options?: Readonly<Record<string, string>>;
}
export interface TableSpec<Row> {
  readonly id?: string;
  readonly columns: readonly ColumnSpec<Row>[];
  readonly decorations: readonly Decoration<Row>[];
  readonly theme: ThemeRef;
  /**
   * Phase 5, read by the engine and its renderers (a static `renderHTML(spec, rows)` ignores it): `pageSize` is
   * `createTable`'s default page size; `hotkeys: false` turns off the j/k/h/l/s and `/` keys (Task 10), leaving the
   * grid's arrow keys, Enter and Space.
   */
  readonly interactive?: { readonly pageSize?: number; readonly hotkeys?: boolean };
  /** J31: the column whose value is a row's link id (`String(row[rowKey])`); absent → the row's index in the input rows. */
  readonly rowKey?: keyof Row & string;
}
