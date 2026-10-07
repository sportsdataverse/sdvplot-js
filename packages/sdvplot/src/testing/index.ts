import {
  ESPN_HEADSHOT_LEAGUES,
  type EspnHeadshotLeague,
  InputError,
  type League,
  UnsupportedTargetError,
  headshotUrl,
  logoUrlSync,
  resetWarnings,
  resolveSync,
  setWarningHandler,
} from "../index.js";
import type { Axis } from "../plot/axis.js";
import type { Value } from "../resolve.js";

export interface DrawnMark {
  id: string;
  x: Value;
  y: Value;
  /** Drawn image height as a fraction of the frame height the render saw. */
  height: number;
  url: string;
  kind: string;
}
const num = (s: string | null): Value =>
  s === null || s === "" ? null : Number.isNaN(Number(s)) ? s : Number(s);

/** Every `<image data-sdv-id>` under `node`, in document order. */
export function drawnMarks(node: ParentNode): DrawnMark[] {
  return Array.from(node.querySelectorAll("image[data-sdv-id]")).map((img) => ({
    id: img.getAttribute("data-sdv-id") ?? "",
    x: num(img.getAttribute("data-sdv-x")),
    y: num(img.getAttribute("data-sdv-y")),
    height: Number(img.getAttribute("height")) / Number(img.getAttribute("data-sdv-frame")),
    url: img.getAttribute("href") ?? "",
    kind: img.getAttribute("data-sdv-kind") ?? "",
  }));
}

export interface ContractMarkOptions {
  league: League;
  height?: number;
  alpha?: number;
}
/** Adapters must accept typed arrays (e.g. `Float64Array`) for the x and y positions: rule 3 passes them. */
export interface ContractAdapter<T> {
  name: string;
  addLogos(
    target: T,
    x: ArrayLike<Value>,
    y: ArrayLike<Value>,
    teams: readonly Value[],
    o: ContractMarkOptions,
  ): T | Promise<T>;
  addWordmarks(
    target: T,
    x: ArrayLike<Value>,
    y: ArrayLike<Value>,
    teams: readonly Value[],
    o: ContractMarkOptions,
  ): T | Promise<T>;
  /** `league` is narrowed to the ESPN-headshot leagues: the contract checks that before calling, so adapters need no cast. */
  addHeadshots(
    target: T,
    x: ArrayLike<Value>,
    y: ArrayLike<Value>,
    players: readonly Value[],
    o: Omit<ContractMarkOptions, "league"> & { league: EspnHeadshotLeague },
  ): T | Promise<T>;
  /** Throws `UnsupportedTargetError` when `supportsAxisLogos` is false. */
  axisLogos(target: T, axis: "x" | "y", o: { league: League; height?: number }): T | Promise<T>;
  supportsAxisLogos: boolean;
  drawnMarks(target: T): readonly DrawnMark[];
  drawnAxisMarks(target: T, axis: "x" | "y"): readonly { id: string; tick: number; height: number }[];
  visibleAxisLabels(target: T, axis: "x" | "y"): readonly string[];
}

/** `message` starts with "rule N (...): ..." so a test can match `/^rule N/`. */
export class ContractError extends Error {
  constructor(
    readonly rule: string,
    msg: string,
  ) {
    super(`${rule}: ${msg}`);
    this.name = "ContractError";
  }
}
const fail = (rule: string, msg: string): never => {
  throw new ContractError(rule, msg);
};
const xyz = (m: readonly DrawnMark[]): unknown[][] => m.map((d) => [d.id, d.x, d.y]);
const same = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b);

// There is no getter for the current warning handler, so a previous one cannot be restored:
// this leaves the default handler (null) installed.
async function counted<R>(fn: () => R | Promise<R>): Promise<[R, number]> {
  let n = 0;
  resetWarnings();
  setWarningHandler(() => {
    n++;
  });
  try {
    return [await fn(), n];
  } finally {
    setWarningHandler(null);
  }
}
/** null when `fn` threw InputError; otherwise what went wrong, for the failure message. */
async function notInputError(fn: () => unknown): Promise<string | null> {
  try {
    await fn();
  } catch (e) {
    if (e instanceof InputError) return null;
    return `threw ${e instanceof Error ? `${e.name}: ${e.message}` : String(e)}`;
  }
  return "did not throw";
}

export interface ContractOptions<T> {
  makeTarget: () => T;
  makeAxisTarget?: (categories: readonly string[]) => T;
  league?: League;
  known?: readonly [string, string];
  knownWordmarks?: readonly [string, string];
  players?: readonly [string, string];
}

/**
 * Port of Python `sdvplot.testing.check_adapter_contract` (rules 0-8). Rejects with a `ContractError`
 * naming the first rule broken. Warnings are once per call (one message listing every unresolved value).
 * Resets the warning handler to null (the default) when done: the previous handler cannot be restored.
 */
export async function checkAdapterContract<T>(a: ContractAdapter<T>, o: ContractOptions<T>): Promise<void> {
  const league = o.league ?? "nfl";
  const [ka, kb] = o.known ?? ["LV", "LAR"];
  const [wa, wb] = o.knownWordmarks ?? ["LV", "LAC"];
  const [p, q] = o.players ?? ["3139477", "4241479"];
  const xs = [10, 20];
  const ys = [-3, -7];
  // rule 0: shape (JS has no dispatch front door)
  for (const k of [
    "addLogos",
    "addWordmarks",
    "addHeadshots",
    "axisLogos",
    "drawnMarks",
    "drawnAxisMarks",
    "visibleAxisLabels",
  ] as const)
    if (typeof a[k] !== "function") fail("rule 0 (shape)", `${a.name} lacks ${k}`);
  if (typeof a.supportsAxisLogos !== "boolean") fail("rule 0 (shape)", "supportsAxisLogos must be boolean");

  type Verb = (
    t: T,
    x: ArrayLike<Value>,
    y: ArrayLike<Value>,
    v: readonly Value[],
    opts: { height?: number; alpha?: number },
  ) => T | Promise<T>;
  // rules 1, 2, 4 for one image verb; wordmarks (5) and headshots (6) reuse it with their own rule labels
  const checkVerb = async (
    verb: Verb,
    vals: readonly [string, string],
    ids: readonly [string, string],
    urls: readonly [string | undefined, string | undefined],
    r: readonly [string, string, string],
  ): Promise<void> => {
    const want = [
      [ids[0], 10, -3],
      [ids[1], 20, -7],
    ];
    const [t1, n1] = await counted(() => verb(o.makeTarget(), xs, ys, vals, {}));
    const m1 = a.drawnMarks(t1);
    if (!same(xyz(m1), want)) fail(r[0], `expected ${JSON.stringify(want)}, drew ${JSON.stringify(xyz(m1))}`);
    if (n1 !== 0) fail(r[0], `known values warned ${n1} time(s)`);
    m1.forEach((d, i) => {
      const u = urls[i];
      if (u && d.url !== u) fail(r[0], `${d.id} drew ${d.url}, its mark is ${u}`);
    });
    const [t2, n2] = await counted(() => verb(o.makeTarget(), xs, ys, ["XXX", vals[1]], {}));
    if (!same(xyz(a.drawnMarks(t2)), [want[1]]))
      fail(r[1], "an unknown value must be skipped with its own x/y");
    if (n2 !== 1) fail(r[1], `one unknown value must warn exactly once, warned ${n2}`);
    const [, n3] = await counted(() =>
      verb(o.makeTarget(), [1, 2, 3], [1, 2, 3], ["XXX", "YYY", vals[0]], {}),
    );
    if (n3 !== 1)
      fail(
        r[1],
        `two distinct unknown values must warn exactly once per call (one message listing both), warned ${n3}`,
      );
    for (const h of [0.1, 0.25, 1]) {
      const t = await verb(o.makeTarget(), xs, ys, vals, { height: h });
      for (const d of a.drawnMarks(t))
        if (Math.abs(d.height - h) / h > 0.01) fail(r[2], `asked height ${h}, drew ${d.height}`);
    }
    for (const bad of [0, 1.5, 40]) {
      const why = await notInputError(() => verb(o.makeTarget(), xs, ys, vals, { height: bad }));
      if (why) fail(r[2], `height ${bad} must throw InputError when the verb is called, ${why}`);
    }
  };
  const [ia = "", ib = ""] = resolveSync([ka, kb], league);
  await checkVerb(
    (t, x, y, v, opts) => a.addLogos(t, x, y, v, { league, ...opts }),
    [ka, kb],
    [ia, ib],
    [logoUrlSync(ka, league), logoUrlSync(kb, league)],
    ["rule 1 (resolution)", "rule 2 (unknown team: warn and skip)", "rule 4 (height semantics)"],
  );
  // rule 3: columnar parity (real Float64Array positions draw what plain arrays draw)
  const tA = await a.addLogos(o.makeTarget(), xs, ys, [ka, kb], { league });
  const tB = await a.addLogos(o.makeTarget(), new Float64Array(xs), new Float64Array(ys), [ka, kb], {
    league,
  });
  if (!same(xyz(a.drawnMarks(tA)), xyz(a.drawnMarks(tB))))
    fail("rule 3 (columnar parity)", "typed-array positions drew different marks");
  // rule 5: wordmarks
  const [wia = "", wib = ""] = resolveSync([wa, wb], league);
  const wm = (t: string): string | undefined => logoUrlSync(t, league, { markType: "wordmark" });
  await checkVerb(
    (t, x, y, v, opts) => a.addWordmarks(t, x, y, v, { league, ...opts }),
    [wa, wb],
    [wia, wib],
    [wm(wa), wm(wb)],
    ["rule 5 (wordmarks: resolution)", "rule 5 (wordmarks: warn and skip)", "rule 5 (wordmarks: height)"],
  );
  // rule 6: headshots (ESPN leagues only; the narrowing keeps adapters cast-free)
  if (!Object.hasOwn(ESPN_HEADSHOT_LEAGUES, league))
    fail(
      "rule 6 (headshots)",
      `league ${JSON.stringify(league)} has no ESPN headshots; pass an ESPN headshot league`,
    );
  const hl = league as EspnHeadshotLeague;
  await checkVerb(
    (t, x, y, v, opts) => a.addHeadshots(t, x, y, v, { league: hl, ...opts }),
    [p, q],
    [p, q],
    [headshotUrl(p, hl), headshotUrl(q, hl)],
    ["rule 6 (headshots)", "rule 6 (headshots: unknown id)", "rule 6 (headshots: height)"],
  );
  // rule 7: axis logos
  const r7 = "rule 7 (axis logos)";
  if (a.supportsAxisLogos) {
    const mk = o.makeAxisTarget;
    if (!mk) return fail(r7, "makeAxisTarget is required for an adapter that supports axis logos");
    // an adapter may resolve at construction or only when the target renders: count across both
    const [[marks, shown], n] = await counted(async () => {
      const t = await a.axisLogos(mk([ka, "XXX", kb]), "x", { league });
      return [a.drawnAxisMarks(t, "x"), a.visibleAxisLabels(t, "x")] as const;
    });
    if (
      !same(
        marks.map((m) => m.id),
        [ia, ib],
      )
    )
      fail(r7, `expected axis images for [${ia}, ${ib}] in tick order, drew ${JSON.stringify(marks)}`);
    if (!((marks[0]?.tick ?? 0) < (marks[1]?.tick ?? 0)))
      fail(r7, "axis images must sit at increasing tick positions");
    if (n !== 1) fail(r7, `an unknown axis category must warn exactly once, warned ${n}`);
    if (!shown.includes("XXX") || shown.includes(ka) || shown.includes(kb))
      fail(r7, `only the unknown category may stay as text, visible labels are ${JSON.stringify(shown)}`);
    for (const h of [0.1, 0.25])
      for (const m of a.drawnAxisMarks(await a.axisLogos(mk([ka, kb]), "x", { league, height: h }), "x"))
        if (Math.abs(m.height - h) / h > 0.01) fail(`${r7} (height)`, `asked ${h}, drew ${m.height}`);
  } else {
    let threw = false;
    try {
      await a.axisLogos(o.makeTarget(), "x", { league });
    } catch (e) {
      threw = e instanceof UnsupportedTargetError;
    }
    if (!threw)
      fail(r7, "an adapter without axis-logo support must throw UnsupportedTargetError from axisLogos");
  }
  // rule 8: alpha outside [0, 1] throws on every verb
  const alphaVerbs: [string, (alpha: number) => unknown][] = [
    ["addLogos", (alpha) => a.addLogos(o.makeTarget(), [10], [-3], [ka], { league, alpha })],
    ["addWordmarks", (alpha) => a.addWordmarks(o.makeTarget(), [10], [-3], [wa], { league, alpha })],
    ["addHeadshots", (alpha) => a.addHeadshots(o.makeTarget(), [10], [-3], [p], { league: hl, alpha })],
  ];
  for (const [name, call] of alphaVerbs)
    for (const bad of [-0.1, 1.1]) {
      const why = await notInputError(() => call(bad));
      if (why) fail("rule 8 (alpha)", `${name} with alpha ${bad} must throw InputError, ${why}`);
    }
  setWarningHandler(null);
}

/** Axis images (`<image data-sdv-axis>`), in tick-position order; `height` is a fraction of the frame. */
export function drawnAxisMarks(node: ParentNode, axis: Axis): { id: string; tick: number; height: number }[] {
  return Array.from(node.querySelectorAll(`image[data-sdv-axis="${axis}"]`))
    .map((img) => ({
      id: img.getAttribute("data-sdv-id") ?? "",
      tick: Number(img.getAttribute("data-sdv-tick")),
      height: Number(img.getAttribute("height")) / Number(img.getAttribute("data-sdv-frame")),
    }))
    .sort((a, b) => a.tick - b.tick);
}
/** Non-empty tick `<text>` still on the axis (categories that did not resolve to an image). */
export function visibleAxisLabels(node: ParentNode, axis: Axis): string[] {
  return Array.from(node.querySelectorAll(`[aria-label="${axis}-axis tick label"] text`))
    .map((t) => t.textContent ?? "")
    .filter((s) => s !== "");
}
