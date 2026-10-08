import * as Plot from "@observablehq/plot";
import { MANIFEST_URL, fetchManifest, loadLeague } from "@sportsdataverse/sdvplot";
import { logos } from "@sportsdataverse/sdvplot/plot";
import { createElement } from "react";
import { expect, test } from "vitest";
import type { ExampleEntry } from "../src/contract.js";
import { normalizeIds, problems, runExample } from "./run.js";

// Inline rows: examples/src/data.ts has no STANDINGS until Phase 4 lands (then this swaps to the shared fixture).
const STANDINGS = [
  ["KC", 14, 9],
  ["BUF", 13, 10],
  ["NYJ", 7, 12],
  ["MIA", 11, 8],
  ["DEN", 10, 11],
  ["LV", 6, 14],
  ["LAC", 9, 9],
  ["HOU", 12, 10],
].map(([team, pf, pa]) => ({ team, pf, pa }));

const entry = (id: string, tags: readonly string[] = []): ExampleEntry => ({
  id,
  package: "sdvplot",
  title: id,
  tags,
  code: "",
  lang: "ts",
  file: "",
});
const out = (v: unknown) => async (): Promise<{ default: unknown }> => ({ default: v });

test("Review Focus 1: a throw fails the gate; a blank figure or no output is a problem, not a pass", async () => {
  await expect(runExample(entry("t/throws"), () => Promise.reject(new Error("boom")))).rejects.toThrow(
    "boom",
  );
  const blank = entry("t/blank");
  expect(problems(blank, await runExample(blank, out(Plot.plot({ marks: [] }))))).toContain(
    "drew no mark (no path/image/circle/rect/line/polygon/text/img/table)",
  );
  expect(problems(blank, await runExample(blank, out(undefined)))).toContain("rendered nothing");
  for (const empty of ["", [], {}])
    expect(problems(blank, await runExample(blank, out(empty)))).toContain("rendered nothing");
});

// Review Focus 2 (a table prerenders to renderHTML's string byte for byte) needs sdvtables/html: Phase 4.
test("a markup string output passes through untouched", async () => {
  const html = "<table><tr><td>1</td></tr></table>";
  const r = await runExample(entry("t/table"), out(html));
  expect(r.kind).toBe("markup");
  expect(r.markup).toBe(html);
  expect(problems(entry("t/table"), r)).toEqual([]);
});

test("Review Focus 3: a Plot example with network logos renders offline: archive URLs, no fetch", async () => {
  await loadLeague("nfl");
  const fig = Plot.plot({ marks: [logos(STANDINGS, { league: "nfl", x: "pf", y: "pa", team: "team" })] });
  const r = await runExample(entry("t/logos"), out(fig));
  expect(r.fetched).toEqual([]);
  expect(
    r.markup.match(/<image[^>]+href="https:\/\/sdv\.nyc3\.cdn\.digitaloceanspaces\.com\//g),
  ).toHaveLength(8);
  expect(problems(entry("t/logos"), r)).toEqual([]);
  const sneaky = runExample(entry("t/fetch"), async () => ({
    default: await fetch("https://example.com/a.csv"),
  }));
  await expect(sneaky).rejects.toThrow("t/fetch fetched https://example.com/a.csv");
});

test("Review Focus 4: a clipped figure prerenders to the same bytes whatever rendered before it", async () => {
  const fig = (): Element => Plot.plot({ marks: [Plot.dot(STANDINGS, { x: "pf", y: "pa", clip: true })] });
  const a = (await runExample(entry("t/clip"), out(fig()))).markup;
  fig();
  fig(); // advance Plot's process-wide clip counter
  const b = (await runExample(entry("t/clip"), out(fig()))).markup;
  expect(a).toContain('id="plot-clip-t-clip-1"');
  expect(a).toContain("url(#plot-clip-t-clip-1)");
  expect(b).toBe(a);
  expect(normalizeIds("plot-clip-9 plot-marker-4 plot-clip-9", "a/b")).toBe(
    "plot-clip-a-b-1 plot-marker-a-b-2 plot-clip-a-b-1",
  );
});

test("I1/I3: a swallowed fetch, an Image src, an XHR and a network example that never fetched are problems", async () => {
  const draws = Plot.plot({ marks: [Plot.dot(STANDINGS, { x: "pf", y: "pa" })] });
  const swallowed = entry("t/swallow");
  const r = await runExample(swallowed, async () => {
    await fetch("https://example.com/a.csv").catch(() => undefined);
    return { default: draws };
  });
  expect(problems(swallowed, r).join()).toContain('fetched without the "network" tag');
  const imgEntry = entry("t/img");
  const ri = await runExample(imgEntry, async () => {
    new Image().src = "https://example.com/x.png";
    return { default: draws };
  });
  expect(ri.fetched).toEqual(["https://example.com/x.png"]);
  expect(problems(imgEntry, ri).join()).toContain("fetched without");
  // A displayed <img> (React 19 sets `src` on each one it mounts) is output, not a request.
  const shown = await runExample(imgEntry, async () => {
    const el = document.body.appendChild(document.createElement("img"));
    el.src = "https://example.com/logo.png";
    el.remove();
    return { default: draws };
  });
  expect(shown.fetched).toEqual([]);
  // React 19 mounts an <img> through setAttribute("src"), which the property hook never sees: shown, not fetched.
  const mounted = await runExample(
    imgEntry,
    out(createElement("img", { src: "https://example.com/logo.png", alt: "" })),
  );
  expect(mounted.markup).toContain('src="https://example.com/logo.png"');
  expect(mounted.fetched).toEqual([]);
  expect(problems(imgEntry, mounted)).toEqual([]);
  const xhrEntry = entry("t/xhr");
  const rx = await runExample(xhrEntry, async () => {
    new XMLHttpRequest().open("GET", "https://example.com/y.json");
    return { default: draws };
  });
  expect(rx.fetched).toEqual(["https://example.com/y.json"]);
  const idle = entry("t/idle", ["network"]);
  expect(problems(idle, await runExample(idle, out(draws)))).toContain(
    'has the "network" tag but did not fetch',
  );
});

test("I2: axes alone are not a drawing; a data mark is", async () => {
  const none = entry("t/none");
  const empty = await runExample(none, out(Plot.plot({ marks: [Plot.dot([], { x: "a", y: "b" })] })));
  expect(problems(none, empty)).toContain(
    "drew no mark (no path/image/circle/rect/line/polygon/text/img/table)",
  );
  const some = await runExample(none, out(Plot.plot({ marks: [Plot.dot(STANDINGS, { x: "pf", y: "pa" })] })));
  expect(problems(none, some)).toEqual([]);
  const bare = await runExample(
    none,
    out("<div><svg><g aria-label='x-axis tick label'><text>1</text></g></svg></div>"),
  );
  expect(problems(none, bare)).toContain(
    "drew no mark (no path/image/circle/rect/line/polygon/text/img/table)",
  );
});

test("every example starts with an empty manifest cache: a network example fetches whatever ran before it", async () => {
  const e = entry("t/manifest", ["network"]);
  const run = async () =>
    (await runExample(e, async () => ({ default: (await fetchManifest()).length }))).fetched;
  expect(await run()).toEqual([MANIFEST_URL]);
  expect(await run()).toEqual([MANIFEST_URL]);
});
