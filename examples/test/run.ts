import { readFileSync } from "node:fs";
import { MANIFEST_URL, resetWarnings, setWarningHandler } from "@sportsdataverse/sdvplot";
import { type ReactElement, act, isValidElement } from "react";
import { createRoot } from "react-dom/client";
import { abs } from "../sources.js";
import type { ExampleEntry, OutputKind } from "../src/contract.js";

/** The only URLs an example may fetch, and only when tagged "network": each answers from a committed fixture. */
const FIXTURES: Readonly<Record<string, string>> = {
  [MANIFEST_URL]: "fixtures/sdvplot/manifest_sample.csv",
};

export interface RunResult {
  readonly kind: OutputKind;
  readonly markup: string;
  readonly value: unknown;
  readonly warnings: readonly string[];
  readonly fetched: readonly string[];
}

const urlOf = (input: string | URL | Request): string =>
  typeof input === "string" ? input : input instanceof URL ? input.href : input.url;

function offlineFetch(entry: ExampleEntry, fetched: string[]): typeof fetch {
  return async (input) => {
    const url = urlOf(input);
    fetched.push(url);
    const fixture = FIXTURES[url];
    if (entry.tags.includes("network") && fixture !== undefined)
      return new Response(readFileSync(abs(fixture), "utf8"), { status: 200 });
    throw new Error(
      `${entry.id} fetched ${url}: examples run offline (tag it "network" and add a fixture to test/run.ts FIXTURES)`,
    );
  };
}

const escapeHtml = (s: string): string =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const isElement = (v: unknown): v is Element =>
  typeof v === "object" && v !== null && typeof (v as { outerHTML?: unknown }).outerHTML === "string";

declare global {
  // React's flag that `act` is in use (it warns without it).
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}

/** Render a React element into the jsdom document and wait (up to 30 s) for its effects to draw something. */
async function renderReact(el: ReactElement): Promise<string> {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  await act(async () => root.render(el));
  for (const until = Date.now() + 30_000; host.innerHTML === "" && Date.now() < until; )
    await act(() => new Promise<void>((r) => setTimeout(r, 25)));
  const html = host.innerHTML;
  await act(async () => root.unmount());
  host.remove();
  return html;
}

/**
 * Plot numbers clip paths, markers and patterns from process-wide counters, so a figure's ids depend on what
 * rendered before it. Renumber them per output, in order of first appearance, under the example's id: the same
 * example always prerenders to the same bytes, and two examples on one page never share an id.
 */
export function normalizeIds(markup: string, id: string): string {
  const scope = id.replace(/[^A-Za-z0-9]+/g, "-");
  const seen = new Map<string, string>();
  return markup.replace(/plot-(clip|marker|pattern)-\d+/g, (old, kind: string) => {
    let next = seen.get(old);
    if (next === undefined) {
      next = `plot-${kind}-${scope}-${seen.size + 1}`;
      seen.set(old, next);
    }
    return next;
  });
}

/** Classify an example's default export and turn it into the markup the docs serve before (or instead of) a live run. */
export async function toMarkup(out: unknown, id: string): Promise<{ kind: OutputKind; markup: string }> {
  if (isElement(out)) return { kind: "node", markup: normalizeIds(out.outerHTML, id) };
  if (typeof out === "string" && /^\s*</.test(out)) return { kind: "markup", markup: out };
  if (isValidElement(out)) return { kind: "react", markup: normalizeIds(await renderReact(out), id) };
  const text = typeof out === "string" ? out : (JSON.stringify(out, null, 2) ?? String(out));
  return { kind: "value", markup: `<pre class="sdv-value">${escapeHtml(text)}</pre>` };
}

/** Load (= run) one example offline, collecting sdvplot warnings and every fetch it attempted. */
export async function runExample(
  entry: ExampleEntry,
  load: () => Promise<{ default: unknown }> = () => import(/* @vite-ignore */ abs(`examples/${entry.file}`)),
): Promise<RunResult> {
  const warnings: string[] = [];
  const fetched: string[] = [];
  const realFetch = globalThis.fetch;
  globalThis.fetch = offlineFetch(entry, fetched);
  resetWarnings();
  setWarningHandler((m) => warnings.push(m));
  try {
    const value = (await load()).default;
    return { ...(await toMarkup(value, entry.id)), value, warnings, fetched };
  } finally {
    globalThis.fetch = realFetch;
    setWarningHandler(null);
  }
}

/** `undefined`, "", [] and {} show nothing; an example that means to show one wraps it (`String(x)`, `{ x }`). */
const isEmpty = (v: unknown): boolean =>
  v === undefined ||
  v === "" ||
  (Array.isArray(v) && v.length === 0) ||
  (typeof v === "object" && v !== null && !Array.isArray(v) && Object.keys(v).length === 0);

/** The gate's notion of "rendered something": a throw is not the only failure; blank output is one too. */
export function problems(entry: ExampleEntry, r: RunResult): string[] {
  const p: string[] = [];
  if (r.markup.trim() === "" || (r.kind === "value" && isEmpty(r.value))) p.push("rendered nothing");
  if (r.kind === "node" && !/<(path|image|circle|rect|line|polygon|polyline|text|img|table)\b/.test(r.markup))
    p.push("drew no mark (no path/image/circle/rect/line/polygon/text/img/table)");
  if (/\bNaN\b/.test(r.markup)) p.push("output contains NaN");
  const warns = entry.tags.includes("warns");
  if (!warns && r.warnings.length > 0) p.push(`warned without the "warns" tag: ${r.warnings.join(" | ")}`);
  if (warns && r.warnings.length === 0) p.push(`has the "warns" tag but did not warn`);
  return p;
}
