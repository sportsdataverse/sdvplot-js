// @vitest-environment jsdom
import { Graph, Sankey, SingleContainer } from "@unovis/ts";
import { afterEach, beforeAll, beforeEach, expect, test, vi } from "vitest";
import { loadLeague, logoUrlSync, resetWarnings, setWarningHandler, teamColorsSync } from "../src/index.js";
import { logoIcons, teamColorScale } from "../src/unovis.js";
import "./_fixtures.js";

/**
 * A real Unovis 1.7.1 render (`SingleContainer` with a `Graph` or a `Sankey`) in jsdom: what Unovis itself writes
 * for each node and link, read back from its SVG, matched to the datum d3 bound to it. jsdom has no SVG layout, so
 * three measurements are stubbed (text and box sizes, and the svg's width / height lengths d3-zoom reads); the
 * transitions are off (`duration: 0`). Pixels are the Chromium render test's (examples/test/interactive.test.ts).
 */
const proto = SVGElement.prototype as unknown as {
  getBBox?: () => DOMRect;
  getComputedTextLength?: () => number;
};
proto.getBBox ??= () => ({ x: 0, y: 0, width: 20, height: 10 }) as DOMRect;
proto.getComputedTextLength ??= () => 20;
(SVGElement.prototype as unknown as { getTotalLength?: () => number }).getTotalLength ??= () => 100;
for (const k of ["width", "height"] as const)
  Object.defineProperty(SVGSVGElement.prototype, k, {
    configurable: true,
    get(this: SVGSVGElement) {
      return { baseVal: { value: Number(this.getAttribute(k)) || 0 } };
    },
  });

beforeAll(() => loadLeague("nfl"));
beforeEach(() => resetWarnings());
const containers: { destroy(): void }[] = [];
afterEach(() => {
  for (const c of containers.splice(0)) c.destroy();
  document.body.replaceChildren();
});

/** Wait until `ready()` holds (Unovis lays a graph out asynchronously), up to 5 s. */
async function until(ready: () => boolean): Promise<void> {
  for (const end = Date.now() + 5000; !ready(); ) {
    if (Date.now() > end) throw new Error("Unovis did not draw in 5 s");
    await new Promise((r) => setTimeout(r, 20));
  }
}
const datum = <T>(el: Element): T => (el as unknown as { __data__: T }).__data__;

type GNode = { id: string; team: string | number };
type GLink = { source: string; target: string; team: string | number };

test("Graph: each node's fill and logo icon, each link's stroke, for numeric ESPN ids and strings; a node with no logo has no icon", async () => {
  // each team's primary colour, read straight from sdvplot's colours (not through the module under test)
  const [KC, PHI, BUF, LV] = teamColorsSync("nfl", ["KC", "PHI", "BUF", "LV"]);
  // KC by ESPN's numeric id, PHI by abbreviation, BUF by ESPN id as a string; LV's logo is not asked for
  const nodes: GNode[] = [
    { id: "kc", team: 12 },
    { id: "phi", team: "PHI" },
    { id: "buf", team: "2" },
    { id: "lv", team: "LV" },
  ];
  const links: GLink[] = [
    { source: "kc", target: "phi", team: 12 },
    { source: "buf", target: "kc", team: "2" },
    { source: "phi", target: "lv", team: "PHI" },
  ];
  const color = teamColorScale(
    "nfl",
    nodes.map((n) => n.team),
  );
  const logos = logoIcons("nfl", [12, "PHI", "2"]);
  const el = document.body.appendChild(document.createElement("div"));
  const graph = new Graph<GNode, GLink>({
    duration: 0,
    layoutType: "force",
    nodeFill: (n) => color(n.team),
    nodeIcon: (n) => logos(n.team),
    nodeIconSize: 24,
    linkStroke: (l) => color(l.team),
  });
  containers.push(
    new SingleContainer(
      el,
      { component: graph, width: 480, height: 320, svgDefs: logos.svgDefs },
      { nodes, links },
    ),
  );
  await until(
    () =>
      el.querySelectorAll("g[class*=g-node]").length === 4 &&
      [...el.querySelectorAll("path[class*=-link]:not([class*=support]):not([class*=band])")].every(
        (p) => (p as SVGElement).style.stroke !== "",
      ),
  );
  const svg = el.querySelector("svg") as SVGSVGElement;
  const drawn = [...el.querySelectorAll("g[class*=g-node]")].map((g) => {
    const use = g.querySelector("use");
    const href = use?.getAttribute("href") ?? null;
    // the symbol the icon uses, in this chart's own svg, and the image it holds
    const image = href === null ? null : svg.querySelector(`symbol[id="${href.slice(1)}"] > image`);
    return {
      id: datum<GNode>(g).id,
      fill: (g.querySelector("circle[class*=node-shape]") as SVGElement).style.fill,
      image: image?.getAttribute("href") ?? null,
      size: use === null ? null : [use.getAttribute("width"), use.getAttribute("height")],
    };
  });
  expect(drawn).toEqual([
    { id: "kc", fill: KC, image: logoUrlSync("KC", "nfl"), size: ["24", "24"] },
    { id: "phi", fill: PHI, image: logoUrlSync("PHI", "nfl"), size: ["24", "24"] },
    { id: "buf", fill: BUF, image: logoUrlSync("BUF", "nfl"), size: ["24", "24"] },
    { id: "lv", fill: LV, image: null, size: null },
  ]);
  const strokes = [...el.querySelectorAll("path[class*=-link]:not([class*=support]):not([class*=band])")].map(
    (p) => {
      const l = datum<{ source: GNode; target: GNode }>(p);
      return [l.source.id, l.target.id, (p as SVGElement).style.stroke];
    },
  );
  expect(strokes).toEqual([
    ["kc", "phi", KC],
    ["buf", "kc", BUF],
    ["phi", "lv", PHI],
  ]);
});

type SNode = { id: string; team?: string | number };
type SLink = { source: string; target: string; value: number; team: string | number };

test("Sankey: each flow in its team's colour (ESPN id 12 and 'PHI'), on a dark background the adjusted colours; team nodes too", async () => {
  // two teams' drives from two field-position bands to two results, as the drive example draws them
  const nodes: SNode[] = [
    { id: "KC", team: 12 },
    { id: "PHI", team: "PHI" },
    { id: "own" },
    { id: "mid" },
    { id: "Punt" },
    { id: "Touchdown" },
  ];
  const links: SLink[] = [
    { source: "KC", target: "own", value: 3, team: 12 },
    { source: "PHI", target: "own", value: 2, team: "PHI" },
    { source: "PHI", target: "mid", value: 1, team: "PHI" },
    { source: "own", target: "Punt", value: 3, team: 12 },
    { source: "own", target: "Touchdown", value: 2, team: "PHI" },
    { source: "mid", target: "Touchdown", value: 1, team: "PHI" },
  ];
  const BG = "#111827";
  const color = teamColorScale("nfl", [12, "PHI"], { background: BG });
  const spy = vi.fn();
  setWarningHandler(spy);
  const el = document.body.appendChild(document.createElement("div"));
  const sankey = new Sankey<SNode, SLink>({
    duration: 0,
    nodeColor: (n) => (n.team === undefined ? "#6b7280" : color(n.team)),
    linkColor: (l) => color(l.team),
  });
  containers.push(new SingleContainer(el, { component: sankey, width: 480, height: 320 }, { nodes, links }));
  await until(() => el.querySelectorAll("path[class*=visible]").length === 6);
  setWarningHandler(null);
  // independent of the module: the shared palette on that background (the recharts adapter's), by abbreviation
  const { teamColorPalette } = await import("../src/recharts.js");
  const [kc, phi] = teamColorPalette("nfl", ["KC", "PHI"], { background: BG });
  expect(phi).not.toBe(teamColorsSync("nfl", ["PHI"])[0]); // midnight green does not read on it
  const flows = [...el.querySelectorAll("path[class*=visible]")].map((p) => {
    const l = datum<{ source: SNode; target: SNode; value: number }>(p);
    return [l.source.id, l.target.id, l.value, (p as SVGElement).style.fill];
  });
  expect(flows).toEqual([
    ["KC", "own", 3, kc],
    ["PHI", "own", 2, phi],
    ["PHI", "mid", 1, phi],
    ["own", "Punt", 3, kc],
    ["own", "Touchdown", 2, phi],
    ["mid", "Touchdown", 1, phi],
  ]);
  const fills = [...el.querySelectorAll("rect[class*=-node]:not([class*=selection])")].map((r) => [
    datum<SNode>(r).id,
    (r as SVGElement).style.fill,
  ]);
  expect(fills).toEqual([
    ["KC", kc],
    ["PHI", phi],
    ["own", "#6b7280"],
    ["mid", "#6b7280"],
    ["Punt", "#6b7280"],
    ["Touchdown", "#6b7280"],
  ]);
  expect(spy).not.toHaveBeenCalled();
});
