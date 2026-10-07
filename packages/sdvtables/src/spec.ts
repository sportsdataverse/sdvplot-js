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
  /** Phase 5 — the one non-serializable field (JSON.stringify drops it). A method signature, so a numeric kind's comparator still fits ColumnBase<Row>. */
  compare?(a: Row[K], b: Row[K]): number;
}
export type FormatType = "number" | "comma" | "currency" | "percent";
export interface TeamOpts {
  readonly league: League;
  readonly season?: SeasonInput;
  readonly idSystem?: IdSystem;
  readonly strict?: boolean;
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
  | (ColumnBase<Row, NumericKey<Row>> & {
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
  | (ColumnBase<Row, NumericKey<Row>> & {
      readonly kind: "colorRanks";
      readonly palette: readonly string[];
      readonly domain?: readonly [number, number];
      readonly reverse: boolean;
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
      readonly when: Predicate<Row>;
      readonly fill: string;
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
    };

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
  /** Phase 5 — ignored by renderHTML. */
  readonly interactive?: { readonly pageSize?: number };
}
