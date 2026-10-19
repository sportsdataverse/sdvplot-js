import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import cytoscape from "cytoscape";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { type CyEdge, type CyNode, type StyleBlock, passNetwork, teamStylesheet } from "../src/cytoscape.js";
import { InputError } from "../src/errors.js";
import { headshotUrl } from "../src/headshots.js";
import { getLeagueSync } from "../src/index-data.js";
import { contrast, onColor, resetWarnings, setWarningHandler, teamColorsSync } from "../src/index.js";
import { MIN_CONTRAST, MIN_DELTA_E, deltaE } from "../src/team-palette.js";
import "./_fixtures.js"; // preloads every league

beforeEach(() => resetWarnings()); // warn() dedupes per key per process; every test counts its own

const HERE = dirname(fileURLToPath(import.meta.url));
/** A committed example fixture CSV (no quoted fields) as rows of strings. */
function csv(name: string): Record<string, string>[] {
  const [head = "", ...lines] = readFileSync(resolve(HERE, "../../../fixtures/examples", name), "utf8")
    .trim()
    .split("\n");
  const cols = head.split(",");
  return lines.map((l) => Object.fromEntries(l.split(",").map((v, i) => [cols[i], v])));
}

// Real rows, every one: France's 75 completed first-half passes in the 2018 World Cup final (StatsBomb open data, match
// 8658: positions through SPADL, passer and receiver from the events and lineup; the examples' fixtures). France is ESPN
// soccer team 478.
const who = new Map(csv("statsbomb_8658_france_h1_pass_recipients.csv").map((r) => [r.action_id, r]));
const FRANCE = csv("spadl_8658_france_h1_passes.csv").map((p) => {
  const r = who.get(p.action_id) as Record<string, string>;
  return {
    passer: Number(r.player_id),
    passer_name: r.player_name,
    receiver: Number(r.recipient_id),
    receiver_name: r.recipient_name,
    team: "478",
    x: Number(p.start_x),
    y: Number(p.start_y),
    xend: Number(p.end_x),
    yend: Number(p.end_y),
  };
});
const NET = {
  from: "passer",
  to: "receiver",
  fromName: "passer_name",
  toName: "receiver_name",
  team: "team",
  league: "soccer",
  idSystem: "team_id",
} as const;
// The five touchdown passes of Super Bowl LIX (ESPN game 401671889: the play texts of the examples' TD fixture, the
// players' ESPN ids from sportsdataverse-py's captured box score of that game).
const SB_LIX_TDS = [
  {
    passer: 4040715,
    passer_name: "Jalen Hurts",
    receiver: 4047646,
    receiver_name: "A.J. Brown",
    team: "PHI",
  },
  {
    passer: 4040715,
    passer_name: "Jalen Hurts",
    receiver: 4241478,
    receiver_name: "DeVonta Smith",
    team: "PHI",
  },
  {
    passer: 3139477,
    passer_name: "Patrick Mahomes",
    receiver: 4683062,
    receiver_name: "Xavier Worthy",
    team: "KC",
  },
  {
    passer: 3139477,
    passer_name: "Patrick Mahomes",
    receiver: 15795,
    receiver_name: "DeAndre Hopkins",
    team: "KC",
  },
  {
    passer: 3139477,
    passer_name: "Patrick Mahomes",
    receiver: 4683062,
    receiver_name: "Xavier Worthy",
    team: "KC",
  },
];
const NFL = { ...NET, league: "nfl", idSystem: "auto" } as const;
const { fromName: _from, toName: _to, ...unnamed } = NET;

const warnings = (fn: () => void): string[] => {
  const spy = vi.fn();
  setWarningHandler(spy);
  try {
    fn();
  } finally {
    setWarningHandler(null);
  }
  return spy.mock.calls.map((c) => String(c[0]));
};
const quiet = <T>(fn: () => T): T => {
  let out: T | undefined;
  warnings(() => {
    out = fn();
  });
  return out as T;
};
/** The style one selector sets (the last block naming it). */
const rule = (style: readonly StyleBlock[], selector: string): Record<string, unknown> | undefined =>
  [...style].reverse().find((b) => b.selector === selector)?.style;
const byId = (nodes: readonly CyNode[], id: number): CyNode =>
  nodes.find((n) => n.data.id === String(id)) as CyNode;

describe("passNetwork: elements", () => {
  test("a node per player and a directed edge per passer -> receiver pair, weighted by its passes", () => {
    const { elements } = quiet(() => passNetwork(FRANCE, NET));
    const players = new Set(FRANCE.flatMap((r) => [r.passer, r.receiver]));
    expect(elements.nodes.map((n) => n.data.id).sort()).toEqual([...players].map(String).sort());
    expect(elements.nodes).toHaveLength(11);
    const pairs = new Map<string, number>();
    for (const r of FRANCE)
      pairs.set(`${r.passer}->${r.receiver}`, (pairs.get(`${r.passer}->${r.receiver}`) ?? 0) + 1);
    expect(elements.edges).toHaveLength(pairs.size);
    for (const e of elements.edges) {
      expect(e.data.id).toBe(`${e.data.source}->${e.data.target}`);
      expect(e.data.weight).toBe(pairs.get(e.data.id));
      expect(e.data.team).toBe("478");
    }
    expect(elements.edges.reduce((s, e) => s + e.data.weight, 0)).toBe(75);
    // Varane (5485) to Lloris (3099) runs that way; Lloris to Varane is its own edge only if it happened
    const varane = elements.edges.filter((e) => e.data.source === "5485");
    expect(varane.every((e) => e.data.source === "5485" && e.data.target !== "5485")).toBe(true);
  });

  test("edge width is px, the heaviest pair `edgeWidth` (default 10) and the others in proportion to their passes", () => {
    const { elements } = quiet(() => passNetwork(FRANCE, NET));
    const max = Math.max(...elements.edges.map((e) => e.data.weight));
    expect(max).toBeGreaterThan(1);
    for (const e of elements.edges) expect(e.data.width).toBeCloseTo((10 * e.data.weight) / max, 10);
    const wide = quiet(() => passNetwork(FRANCE, { ...NET, edgeWidth: 16 }));
    expect(Math.max(...wide.elements.edges.map((e) => e.data.width))).toBe(16);
  });

  test("minWeight leaves out the pairs with fewer passes, and keeps every player", () => {
    const { elements } = quiet(() => passNetwork(FRANCE, { ...NET, minWeight: 2 }));
    expect(elements.edges.length).toBeGreaterThan(0);
    expect(elements.edges.every((e) => e.data.weight >= 2)).toBe(true);
    expect(elements.nodes).toHaveLength(11);
  });

  test("a `weight` column is summed per pair in place of counting rows", () => {
    const rows = FRANCE.map((r) => ({ ...r, w: 2 }));
    const counted = quiet(() => passNetwork(FRANCE, NET)).elements.edges;
    const summed = quiet(() => passNetwork(rows, { ...NET, weight: "w" })).elements.edges;
    expect(summed.map((e) => e.data.weight)).toEqual(counted.map((e) => 2 * e.data.weight));
  });

  test("each node is labelled by name, with initials from its first and last word; no name column: the id", () => {
    const { elements } = quiet(() => passNetwork(FRANCE, NET));
    expect(byId(elements.nodes, 3009).data).toMatchObject({
      label: "Kylian Mbappé",
      initials: "KM",
      team: "478",
    });
    expect(byId(elements.nodes, 3961).data).toMatchObject({ label: "N'Golo Kanté", initials: "NK" });
    expect(byId(elements.nodes, 5487).data).toMatchObject({ label: "Antoine Griezmann", initials: "AG" });
    // a name of three words keeps the first and last: StatsBomb's player_name for Umtiti (5492), who has a nickname
    const name = (id: number, n: string) => (id === 5492 ? "Samuel Yves Umtiti" : n);
    const full = FRANCE.map((r) => ({
      ...r,
      passer_name: name(r.passer, r.passer_name as string),
      receiver_name: name(r.receiver, r.receiver_name as string),
    }));
    const umtiti = byId(quiet(() => passNetwork(full, NET)).elements.nodes, 5492).data;
    expect(umtiti).toMatchObject({ label: "Samuel Yves Umtiti", initials: "SU" });
    const bare = quiet(() => passNetwork(FRANCE, unnamed));
    expect(byId(bare.elements.nodes, 3009).data).toMatchObject({ label: "3009", initials: "3009" });
  });

  test("with x/y/xend/yend each player sits at the mean of where they passed from and received, y up, in px", () => {
    const pos = { x: "x", y: "y", xend: "xend", yend: "yend" } as const;
    const { elements } = quiet(() => passNetwork(FRANCE, { ...NET, ...pos }));
    // Lloris (3099), by hand from the fixture rows
    const xs = [
      ...FRANCE.filter((r) => r.passer === 3099).map((r) => r.x),
      ...FRANCE.filter((r) => r.receiver === 3099).map((r) => r.xend),
    ];
    const ys = [
      ...FRANCE.filter((r) => r.passer === 3099).map((r) => r.y),
      ...FRANCE.filter((r) => r.receiver === 3099).map((r) => r.yend),
    ];
    const mean = (v: number[]) => v.reduce((s, x) => s + x, 0) / v.length;
    const lloris = byId(elements.nodes, 3099).position;
    // scale (px per data unit) defaults to 10; Cytoscape's y runs down, so a pitch's y is negated
    expect(lloris?.x).toBeCloseTo(10 * mean(xs), 10);
    expect(lloris?.y).toBeCloseTo(-10 * mean(ys), 10);
    // the goalkeeper is the deepest player: France attack left to right
    expect(Math.min(...elements.nodes.map((n) => n.position?.x as number))).toBe(lloris?.x);
    const half = quiet(() => passNetwork(FRANCE, { ...NET, ...pos, scale: 5 }));
    expect(byId(half.elements.nodes, 3099).position?.x).toBeCloseTo(5 * mean(xs), 10);
    // without the columns there are no positions (lay the graph out, e.g. with cose)
    expect(quiet(() => passNetwork(FRANCE, NET)).elements.nodes.every((n) => n.position === undefined)).toBe(
      true,
    );
  });

  test("units are px: a fractional node size or edge width, a non-positive scale, or half the positions throw", () => {
    for (const nodeSize of [0.5, 0, Number.NaN])
      expect(() => passNetwork(FRANCE, { ...NET, nodeSize })).toThrow(InputError);
    for (const edgeWidth of [0.1, 0])
      expect(() => passNetwork(FRANCE, { ...NET, edgeWidth })).toThrow(InputError);
    expect(() =>
      passNetwork(FRANCE, { ...NET, x: "x", y: "y", xend: "xend", yend: "yend", scale: 0 }),
    ).toThrow(InputError);
    expect(() => passNetwork(FRANCE, { ...NET, x: "x", y: "y" })).toThrow(/x, y, xend and yend/);
    expect(() => passNetwork(FRANCE, { ...NET, minWeight: -1 })).toThrow(InputError);
    expect(() => passNetwork(FRANCE, { ...NET, from: "kicker" })).toThrow(InputError);
  });

  test("a row with no passer, no receiver or a missing coordinate is left out with one warning", () => {
    const rows = [{ ...FRANCE[0], receiver: null }, { ...FRANCE[1], x: Number.NaN }, ...FRANCE.slice(2)];
    let net: ReturnType<typeof passNetwork> | undefined;
    const w = warnings(() => {
      net = passNetwork(rows, { ...NET, x: "x", y: "y", xend: "xend", yend: "yend", headshots: false });
    });
    expect(w).toHaveLength(1);
    expect(w[0]).toMatch(/skipped 2 pass\(es\)/);
    expect(net?.elements.edges.reduce((s, e) => s + e.data.weight, 0)).toBe(73);
  });
});

describe("passNetwork: headshots and the fallback node", () => {
  test("a player whose headshot resolves is a headshot node: the image as its background, its name below", () => {
    const { elements, style } = passNetwork(SB_LIX_TDS, NFL);
    expect(elements.nodes).toHaveLength(6); // two passers, four receivers
    for (const n of elements.nodes) {
      expect(n.classes).toBe("headshot");
      expect(n.data.image).toBe(headshotUrl(n.data.id, "nfl"));
    }
    expect(byId(elements.nodes, 3139477).data).toMatchObject({ label: "Patrick Mahomes", team: "12" });
    expect(rule(style, "node.headshot")).toMatchObject({
      "background-image": "data(image)",
      "background-fit": "cover",
      "background-clip": "node",
      label: "data(label)",
      "text-valign": "bottom",
    });
  });

  test("soccer has no headshots: every player is a team-coloured node with its initials, and one warning says so", () => {
    let net: ReturnType<typeof passNetwork> | undefined;
    const w = warnings(() => {
      net = passNetwork(FRANCE, NET);
    });
    expect(w).toHaveLength(1);
    expect(w[0]).toMatch(/11 player\(s\) with no headshot/);
    for (const n of net?.elements.nodes ?? []) {
      expect(n.classes).toBe("initials");
      expect("image" in n.data).toBe(false);
    }
    const [navy] = teamColorsSync("soccer", ["478"], { idSystem: "team_id" });
    const style = net?.style ?? [];
    expect(rule(style, 'node[team = "478"]')).toMatchObject({
      "background-color": navy,
      "border-color": navy,
    });
    expect(rule(style, 'node.initials[team = "478"]')).toEqual({ color: onColor(navy as string) });
    expect(rule(style, "node.initials")).toMatchObject({ label: "data(initials)", "text-valign": "center" });
    // headshots: false asks for none, so nothing is missing
    expect(warnings(() => passNetwork(FRANCE, { ...NET, headshots: false }))).toEqual([]);
  });

  test("a player with no headshot (gsis ids the map lacks) falls back to initials, the others keep theirs", async () => {
    const { loadGsis } = await import("../src/headshots.js");
    await loadGsis();
    let net: ReturnType<typeof passNetwork> | undefined;
    const w = warnings(() => {
      net = passNetwork(SB_LIX_TDS, { ...NFL, headshots: "gsis" });
    });
    expect(w).toHaveLength(1); // ESPN ids are not gsis ids
    expect(net?.elements.nodes.every((n) => n.classes === "initials")).toBe(true);
  });

  test("Cytoscape itself draws the network as specified (headless): colours, widths, arrows, images, initials", () => {
    const net = passNetwork(SB_LIX_TDS, NFL);
    const cy = cytoscape({ headless: true, styleEnabled: true, elements: net.elements, style: net.style });
    const [kcRed] = teamColorsSync("nfl", ["KC"]);
    const rgb = (h: string) =>
      `rgb(${[1, 3, 5].map((i) => Number.parseInt(h.slice(i, i + 2), 16)).join(",")})`;
    const mahomes = cy.getElementById("3139477");
    expect(mahomes.style("background-color")).toBe(rgb(kcRed as string));
    expect(mahomes.style("background-image")).toBe(headshotUrl(3139477, "nfl"));
    expect(mahomes.style("width")).toBe("40px");
    const worthy = cy.getElementById("3139477->4683062");
    expect(worthy.style("line-color")).toBe(rgb(kcRed as string));
    expect(worthy.style("target-arrow-color")).toBe(rgb(kcRed as string));
    expect(worthy.style("target-arrow-shape")).toBe("triangle");
    expect(worthy.style("width")).toBe("10px"); // two passes, the heaviest pair
    expect(cy.getElementById("3139477->15795").style("width")).toBe("5px");
    const france = quiet(() => passNetwork(FRANCE, NET));
    const fr = cytoscape({
      headless: true,
      styleEnabled: true,
      elements: france.elements,
      style: france.style,
    });
    expect(fr.getElementById("3009").style("label")).toBe("KM");
    expect(fr.getElementById("3009").style("background-image")).toBe("none");
    expect(fr.getElementById("3009").style("color")).toBe("rgb(255,255,255)"); // white on navy
    cy.destroy();
    fr.destroy();
  });
});

describe("teamStylesheet", () => {
  test("the light default is the teams' own colours: nodes filled, edges and arrows stroked", () => {
    const style = teamStylesheet({ league: "nfl", teams: ["KC", "PHI"] });
    const [kc, phi] = teamColorsSync("nfl", ["KC", "PHI"]);
    expect(rule(style, 'node[team = "12"]')?.["background-color"]).toBe(kc);
    expect(rule(style, 'edge[team = "12"]')).toEqual({ "line-color": kc, "target-arrow-color": kc });
    const phiId = Object.keys(Object.fromEntries(style.map((b) => [b.selector, 1]))).find(
      (s) => s.startsWith("edge[team") && s !== 'edge[team = "12"]',
    );
    expect(rule(style, phiId as string)).toEqual({ "line-color": phi, "target-arrow-color": phi });
    expect(rule(style, "edge")).toMatchObject({ "curve-style": "bezier", "target-arrow-shape": "triangle" });
    const second = teamStylesheet({ league: "nfl", teams: ["KC"], which: "secondary" });
    expect(rule(second, 'edge[team = "12"]')?.["line-color"]).toBe(
      teamColorsSync("nfl", ["KC"], { which: "secondary" })[0],
    );
  });

  test("dark mode (Review Focus 4): on a background every team colour reads at 3:1, and labels take the ink", () => {
    const style = teamStylesheet({
      league: "soccer",
      teams: ["478"],
      idSystem: "team_id",
      background: "#181a1b",
    });
    const fill = rule(style, 'node[team = "478"]')?.["background-color"] as string;
    expect(contrast(fill, "#181a1b")).toBeGreaterThanOrEqual(MIN_CONTRAST);
    expect(rule(style, "node.headshot")?.color).toBe(onColor("#181a1b"));
    expect(rule(style, 'node.initials[team = "478"]')?.color).toBe(onColor(fill));
  });

  const LEAGUES = ["nba", "nfl", "mlb", "nhl"] as const;
  test.each(LEAGUES.flatMap((lg) => ["#181a1b", "#000000", "#ffffff"].map((bg) => [lg, bg] as const)))(
    "%s in league order on %s: every colour reads (3:1) and every pair is MIN_DELTA_E apart, no warning",
    (lg, background) => {
      const teams = getLeagueSync(lg).teams.map((t) => t.team_id);
      let style: StyleBlock[] = [];
      const w = warnings(() => {
        style = teamStylesheet({ league: lg, teams, background, idSystem: "team_id" });
      });
      expect(w).toEqual([]);
      const c = teams.map(
        (id) => rule(style, `edge[team = ${JSON.stringify(id)}]`)?.["line-color"] as string,
      );
      for (const x of c) expect(contrast(x, background)).toBeGreaterThanOrEqual(MIN_CONTRAST);
      const close = c.flatMap((x, i) =>
        c.slice(0, i).flatMap((p, j) => (deltaE(x, p) < MIN_DELTA_E ? [`${teams[j]}/${teams[i]}`] : [])),
      );
      expect(close).toEqual([]);
    },
  );

  test("a team that does not resolve gets no rule (its elements keep the fallback grey) and moves no colour", () => {
    let style: StyleBlock[] = [];
    const w = warnings(() => {
      style = teamStylesheet({ league: "nfl", teams: ["XXX", "KC"], background: "#7a7a7a" });
    });
    expect(w).toHaveLength(1); // the resolver's
    expect(w.join()).not.toMatch(/\b(null|undefined)\b/);
    expect(style.filter((b) => b.selector.includes("team =")).map((b) => b.selector)).toEqual([
      'node[team = "12"]',
      'node.initials[team = "12"]',
      'edge[team = "12"]',
    ]);
    const alone = teamStylesheet({ league: "nfl", teams: ["KC"], background: "#7a7a7a" });
    expect(rule(style, 'edge[team = "12"]')).toEqual(rule(alone, 'edge[team = "12"]'));
    expect(rule(style, "node")?.["background-color"]).toBe("#808080");
    expect(rule(style, "edge")?.["line-color"]).toBe("#808080");
  });

  test("a passNetwork node whose team does not resolve has no team, so it takes the fallback", () => {
    const rows = [{ ...SB_LIX_TDS[0], team: "XXX" }, ...SB_LIX_TDS.slice(1)];
    const net = quiet(() => passNetwork(rows, { ...NFL, fallback: "#555555" }));
    expect("team" in (net.elements.edges.find((e) => e.data.id === "4040715->4047646") as CyEdge).data).toBe(
      false,
    );
    expect(rule(net.style, "edge")?.["line-color"]).toBe("#555555");
  });

  test("nodeSize is the node's diameter in px; a fraction throws", () => {
    expect(rule(teamStylesheet({ league: "nfl", teams: [], nodeSize: 56 }), "node")).toMatchObject({
      width: 56,
      height: 56,
    });
    expect(() => teamStylesheet({ league: "nfl", teams: [], nodeSize: 0.2 })).toThrow(/px/);
  });
});
