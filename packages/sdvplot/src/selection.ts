import { InputError } from "./errors.js";

/**
 * A row test: the brush region (or any caller's) as a predicate. The same shape as sdvtables' `RowFilter`, so a linked
 * table applies it with `setExternalFilter` as is (not a `ValuePredicate`, which tests one column's cell).
 */
export type RowFilter<Row> = (row: Row) => boolean;

/**
 * A shared hover VALUE (J34): a number along one data field, such as the shot distance under the pointer, that every
 * linked chart draws through its own scale (a rule, a band, a ring). Not an id: it never dims marks or filters a table.
 * Unrelated to sdvtables' `TableCursor` (a grid's keyboard row).
 */
export interface Cursor {
  /** The data field the value is in, e.g. `"shot_distance"`. Never `""`. */
  readonly field: string;
  /** The value along that field. Always finite. */
  readonly value: number;
}

/** What a {@link SelectionStore} holds. Immutable: every change replaces it. */
export interface SelectionState<Row = unknown> {
  /** Ids under the pointer right now (transient). */
  readonly hover: ReadonlySet<string>;
  /** Ids picked by a table-row click or a brush (sticky). */
  readonly selected: ReadonlySet<string>;
  /** The brush region as a row test; null when nothing is brushed. */
  readonly predicate: RowFilter<Row> | null;
  /** The shared hover value; null when the pointer is on no linked chart. */
  readonly cursor: Cursor | null;
}
/** A partial update for {@link SelectionStore.set}: an absent field keeps its value. */
export interface SelectionPatch<Row = unknown> {
  /** The new hover ids (replaces the set; `[]` clears it). */
  readonly hover?: Iterable<string>;
  /** The new selected ids (replaces the set; `[]` clears it). */
  readonly selected?: Iterable<string>;
  /** The new brush region; `null` clears it. */
  readonly predicate?: RowFilter<Row> | null;
  /** The new hover value; `null` clears it. An equal cursor (same field, same value) is a no-op. */
  readonly cursor?: Cursor | null;
}
/** The linked-interactivity hub that {@link createSelection} returns. */
export interface SelectionStore<Row = unknown> {
  /** Referentially stable until the next change: what `useSyncExternalStore` reads. */
  getState(): SelectionState<Row>;
  /** Apply a patch. ONE notification when anything changed, none when nothing did, so linked components cannot ping-pong. */
  set(patch: SelectionPatch<Row>): void;
  /** Clear hover, selected, predicate and cursor. */
  clear(): void;
  /** Call `fn` after every change; returns the unsubscribe function. */
  subscribe(fn: (state: SelectionState<Row>) => void): () => void;
}

const EMPTY: ReadonlySet<string> = new Set<string>();

/**
 * The link id of a value: `String(v)`, or `""` (never matched) for null, undefined, NaN and `""`. A figure and a table
 * link only when they hold the same ids, so an ESPN team id (`"12"`) never matches an abbreviation (`"KC"`).
 *
 * @example
 * ```ts
 * import { toId } from "@sportsdataverse/sdvplot";
 *
 * [toId(12), toId("KC"), toId(null), toId(Number.NaN)];
 * ```
 */
export function toId(v: unknown): string {
  return v === null || v === undefined || v === "" || (typeof v === "number" && Number.isNaN(v))
    ? ""
    : String(v);
}

/**
 * Whether two id sets hold the same ids, in any order.
 *
 * @example
 * ```ts
 * import { sameIds } from "@sportsdataverse/sdvplot";
 *
 * sameIds(new Set(["KC", "BUF"]), new Set(["BUF", "KC"]));
 * ```
 */
export function sameIds(a: ReadonlySet<string>, b: ReadonlySet<string>): boolean {
  if (a === b) return true;
  if (a.size !== b.size) return false;
  for (const id of a) if (!b.has(id)) return false;
  return true;
}

/**
 * Whether two cursors are the same: the same field and an `Object.is`-equal value. `null` equals only `null`.
 *
 * @example
 * ```ts
 * import { sameCursor } from "@sportsdataverse/sdvplot";
 *
 * const rim = { field: "shot_distance", value: 0.5 }; // the centre of the 0-1 ft bin
 * [
 *   sameCursor(rim, { field: "shot_distance", value: 0.5 }), // a new object, the same value: true
 *   sameCursor(rim, { field: "shot_distance", value: 1.5 }), // the next bin: false
 *   sameCursor(rim, null), // the pointer left: false
 *   sameCursor(null, null),
 * ];
 * ```
 */
export function sameCursor(a: Cursor | null, b: Cursor | null): boolean {
  return a === b || (a !== null && b !== null && a.field === b.field && Object.is(a.value, b.value));
}

/**
 * What a figure should emphasise. `null`: nothing is active, draw everything normally. A set, possibly EMPTY
 * (a brush that encloses no point): emphasise those ids and dim the rest. Hover and selected are unioned. The
 * cursor is ignored: a shared hover value never dims anything.
 *
 * @example
 * ```ts
 * import { createSelection, focusIds } from "@sportsdataverse/sdvplot";
 *
 * const store = createSelection();
 * const idle = focusIds(store.getState()); // null: draw everything normally
 * store.set({ selected: ["KC"], hover: ["BUF"] });
 * ({ idle, focus: [...(focusIds(store.getState()) ?? [])] });
 * ```
 */
export function focusIds<Row>(s: SelectionState<Row>): ReadonlySet<string> | null {
  if (s.hover.size === 0 && s.selected.size === 0 && s.predicate === null) return null;
  if (s.hover.size === 0) return s.selected;
  if (s.selected.size === 0) return s.hover;
  return new Set([...s.selected, ...s.hover]);
}

/**
 * The linked-interactivity hub (J31): hover and selected id sets plus a row predicate. Pure data, zero deps, no DOM:
 * creating or updating one in Node changes nothing a server renders. Ids are strings; a number from an untyped
 * caller is stringified (`12` and `"12"` are the same id).
 *
 * @example
 * ```ts
 * import { createSelection } from "@sportsdataverse/sdvplot";
 *
 * const store = createSelection();
 * let updates = 0;
 * store.subscribe(() => updates++);
 * store.set({ selected: ["KC", "BUF"] });
 * store.set({ selected: ["BUF", "KC"] }); // the same ids: silent, so linked views cannot ping-pong
 * ({ updates, selected: [...store.getState().selected] });
 * ```
 */
export function createSelection<Row = unknown>(): SelectionStore<Row> {
  let state: SelectionState<Row> = { hover: EMPTY, selected: EMPTY, predicate: null, cursor: null };
  const listeners = new Set<(s: SelectionState<Row>) => void>();
  const ids = (next: Iterable<string> | undefined, prev: ReadonlySet<string>): ReadonlySet<string> => {
    if (next === undefined) return prev;
    const set = new Set(Array.from(next, (id) => String(id)));
    return sameIds(set, prev) ? prev : set;
  };
  const store: SelectionStore<Row> = {
    getState: () => state,
    set(patch) {
      const c = patch.cursor;
      if (c != null && (typeof c.field !== "string" || c.field === "" || !Number.isFinite(c.value)))
        throw new InputError(
          `selection cursor needs a non-empty field and a finite value, got field ${JSON.stringify(c.field)}, value ${String(c.value)}`,
        );
      const hover = ids(patch.hover, state.hover);
      const selected = ids(patch.selected, state.selected);
      const predicate = patch.predicate === undefined ? state.predicate : patch.predicate;
      // a copy, so a caller mutating its object later cannot change the state behind the listeners' backs
      const cursor =
        c === undefined || sameCursor(c, state.cursor)
          ? state.cursor
          : c === null
            ? null
            : { field: c.field, value: c.value };
      if (
        hover === state.hover &&
        selected === state.selected &&
        predicate === state.predicate &&
        cursor === state.cursor
      )
        return;
      state = { hover, selected, predicate, cursor };
      for (const fn of [...listeners]) fn(state);
    },
    clear() {
      store.set({ hover: EMPTY, selected: EMPTY, predicate: null, cursor: null });
    },
    subscribe(fn) {
      listeners.add(fn);
      return () => {
        listeners.delete(fn);
      };
    },
  };
  return store;
}
