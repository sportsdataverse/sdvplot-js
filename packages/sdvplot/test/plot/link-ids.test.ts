// @vitest-environment jsdom
import * as Plot from "@observablehq/plot";
import { beforeAll, expect, test, vi } from "vitest";
import { STANDINGS, type Standing } from "../../../sdvtables/test/fixtures/standings.js";
import { InputError } from "../../src/errors.js";
import { loadLeague, resetWarnings, setWarningHandler } from "../../src/index.js";
import { headshots, linkIds, logos, wordmarks } from "../../src/plot/index.js";
import { drawnMarks } from "../../src/testing/index.js";

// a pass-through spy: every test draws exactly what Plot draws; the strip test reads what sdvplot handed Plot.image
vi.mock("@observablehq/plot", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@observablehq/plot")>();
  return { ...actual, image: vi.fn(actual.image) };
});

const warnings: string[] = [];
beforeAll(async () => {
  resetWarnings();
  setWarningHandler((m) => warnings.push(m));
  await loadLeague("nfl");
});
const stamped = (svg: Element, sel: string): (string | null)[] =>
  Array.from(svg.querySelectorAll(sel)).map((e) => e.getAttribute("data-sdv-id"));
const labels = (svg: Element): (string | null)[] =>
  Array.from(svg.querySelectorAll("image")).map((e) => e.getAttribute("aria-label"));
const drawn = (mark: Plot.Markish): string[] => drawnMarks(Plot.plot({ marks: [mark] })).map((m) => m.id);
const pos = { x: "wins", y: "pf" } as const;
const TEAMS = STANDINGS.map((r) => r.team);

test("linkIds stamps each dot with its row's id; a row Plot drops (NE: net_epa null) leaves the rest aligned", () => {
  const svg = Plot.plot({
    marks: [Plot.dot(STANDINGS, { x: "wins", y: "net_epa", render: linkIds(STANDINGS, "team") })],
  });
  expect(stamped(svg, "circle")).toEqual(["KC", "LAC", "DEN", "LV", "BUF", "MIA", "NYJ"]);
  // NE first: Plot's index skips row 0, so a dot's position in the <g> is no longer its row
  const rows = [...STANDINGS].reverse();
  const reversed = Plot.plot({
    marks: [Plot.dot(rows, { x: "wins", y: "net_epa", render: linkIds(rows, "team") })],
  });
  expect(stamped(reversed, "circle")).toEqual(["NYJ", "MIA", "BUF", "LV", "DEN", "LAC", "KC"]);
});
test("the default id is the row index (a linked table's id when it has no rowKey)", () => {
  const svg = Plot.plot({
    marks: [Plot.barY(STANDINGS, { x: "team", y: "wins", render: linkIds(STANDINGS) })],
  });
  expect(stamped(svg, "rect")).toEqual(["0", "1", "2", "3", "4", "5", "6", "7"]);
});
test("with href, the stamp lands on the <a> Plot wraps each element in (A27)", () => {
  const svg = Plot.plot({
    marks: [
      Plot.dot(STANDINGS, {
        x: "wins",
        y: "pf",
        href: (d: (typeof STANDINGS)[number]) => `#${d.team}`,
        render: linkIds(STANDINGS, "team"),
      }),
    ],
  });
  expect(stamped(svg, "a")).toEqual(STANDINGS.map((r) => r.team));
  expect(svg.querySelectorAll("circle[data-sdv-id]")).toHaveLength(0);
});
test("a mark that draws one path per series is left unstamped, with one warning", () => {
  const svg = Plot.plot({
    marks: [Plot.line(STANDINGS, { x: "wins", y: "pf", render: linkIds(STANDINGS, "team") })],
  });
  expect(svg.querySelectorAll("[data-sdv-id]")).toHaveLength(0);
  expect(warnings.filter((w) => w.startsWith("linkIds needs one element per row"))).toHaveLength(1);
});

test("logos / wordmarks / headshots: `id` replaces the stamped id; without it the resolved id stays (Phase 3 unchanged)", () => {
  expect(drawn(logos(STANDINGS, { league: "nfl", ...pos, team: "team", id: "team" }))).toEqual(TEAMS);
  expect(drawn(wordmarks(STANDINGS, { league: "nfl", ...pos, team: "team", id: "team" }))).toEqual(TEAMS);
  expect(drawn(headshots(STANDINGS, { league: "nfl", ...pos, player: "qb_espn_id", id: "team" }))).toEqual(
    TEAMS,
  );
  // no `id`: the resolved ESPN team ids (KC is "12") and the QBs' ESPN ids, as every Phase 3 test pins
  expect(drawn(logos(STANDINGS, { league: "nfl", ...pos, team: "team" }))).toEqual([
    "12",
    "24",
    "7",
    "13",
    "2",
    "15",
    "20",
    "17",
  ]);
  expect(drawn(headshots(STANDINGS, { league: "nfl", ...pos, player: "qb_espn_id" }))).toEqual(
    STANDINGS.map((r) => r.qb_espn_id),
  );
});
test("`id` follows its row when Plot reorders or drops rows (sort, filter, dodgeY)", () => {
  // sort by points for, keep the 8+ win teams: drawn order MIA 345, KC 385, LAC 402, DEN 425, BUF 525
  const sorted = Plot.plot({
    marks: [
      logos(STANDINGS, {
        league: "nfl",
        ...pos,
        team: "team",
        id: "team",
        sort: "pf",
        filter: (d: Standing) => d.wins >= 8,
      }),
    ],
  });
  expect(stamped(sorted, "image")).toEqual(["MIA", "KC", "LAC", "DEN", "BUF"]);
  expect(labels(sorted)).toEqual(["MIA logo", "KC logo", "LAC logo", "DEN logo", "BUF logo"]);
  // a beeswarm drops NE (net_epa null); each face keeps its own row's id
  const swarm = Plot.plot({
    height: 160,
    marks: [
      headshots(
        STANDINGS,
        Plot.dodgeY({ league: "nfl", player: "qb_espn_id", x: "net_epa", r: 12, height: 0.18, id: "qb" }),
      ),
    ],
  });
  const faces = Array.from(swarm.querySelectorAll("image"));
  expect(faces.map((f) => f.getAttribute("data-sdv-id"))).toEqual(STANDINGS.slice(0, 7).map((r) => r.qb));
  expect(faces.map((f) => f.getAttribute("href"))).toEqual(
    STANDINGS.slice(0, 7).map((r) => expect.stringContaining(`/${r.qb_espn_id}.png`)),
  );
});
test("`id` indexes the data row, so it holds across facets (fx): each facet draws its own rows", () => {
  const faceted = Plot.plot({
    marks: [logos(STANDINGS, { league: "nfl", ...pos, team: "team", id: "team", fx: "division" })],
  });
  expect(stamped(faceted, "image")).toEqual(["BUF", "MIA", "NYJ", "NE", "KC", "LAC", "DEN", "LV"]); // East first
  expect(labels(faceted)).toEqual(stamped(faceted, "image").map((t) => `${t} logo`));
});
test("`id` changes only the stamp: each image keeps its team's accessible name (Placement.id is never rewritten)", () => {
  // the row index, a linked table's default id: "1" is also ATL's ESPN team id, so a rewritten placement would
  // name LAC's logo "ATL logo"
  const svg = Plot.plot({
    marks: [logos(STANDINGS, { league: "nfl", ...pos, team: "team", id: (_d: Standing, i: number) => i })],
  });
  expect(stamped(svg, "image")).toEqual(["0", "1", "2", "3", "4", "5", "6", "7"]);
  expect(labels(svg)).toEqual(TEAMS.map((t) => `${t} logo`));
});
test("`id` is sdvplot's option: it is never forwarded to Plot.image", () => {
  const image = vi.mocked(Plot.image);
  image.mockClear();
  logos(STANDINGS, { league: "nfl", ...pos, team: "team", id: "team" });
  headshots(STANDINGS, { league: "nfl", ...pos, player: "qb_espn_id", id: "team" });
  expect(image).toHaveBeenCalledTimes(2);
  for (const [, options] of image.mock.calls) expect(options).not.toHaveProperty("id");
});
test("with href, the image mark's stamp lands on the <image> inside the <a> (A27)", () => {
  const svg = Plot.plot({
    marks: [
      logos(STANDINGS, {
        league: "nfl",
        ...pos,
        team: "team",
        id: "team",
        href: (d: Standing) => `#${d.team}`,
      }),
    ],
  });
  expect(stamped(svg, "a > image")).toEqual(TEAMS);
  expect(svg.querySelectorAll("a[data-sdv-id]")).toHaveLength(0);
});
test("linkIds on an image mark with href restamps the <image>, never the <a>: one stamp per row (A27)", () => {
  const svg = Plot.plot({
    marks: [
      logos(STANDINGS, {
        league: "nfl",
        ...pos,
        team: "team",
        href: (d: Standing) => `#${d.team}`,
        render: linkIds(STANDINGS, "team"),
      }),
    ],
  });
  expect(stamped(svg, "a > image")).toEqual(TEAMS);
  expect(svg.querySelectorAll("a[data-sdv-id]")).toHaveLength(0);
});
test("`id` is one value per row, like every channel: an array of another length throws InputError", () => {
  const twoTeams = STANDINGS.slice(0, 2).map((r) => r.team);
  expect(() => logos(STANDINGS, { league: "nfl", ...pos, team: "team", id: twoTeams })).toThrow(InputError);
  expect(() => logos(STANDINGS, { league: "nfl", ...pos, team: "team", id: twoTeams })).toThrow(
    "id and team need one value per row: id has 2, team has 8",
  );
  // a short team (or player) array is the mismatch: the message names it, never blaming id alone
  expect(() => logos(STANDINGS, { league: "nfl", ...pos, team: ["KC", "BUF"], id: "team" })).toThrow(
    "id and team need one value per row: id has 8, team has 2",
  );
  expect(() => headshots(STANDINGS, { league: "nfl", ...pos, player: ["3139477"], id: "team" })).toThrow(
    "id and player need one value per row: id has 8, player has 1",
  );
});
test("`id: null` is no id, as Plot treats a null channel: the resolved ESPN ids stay", () => {
  // from JS, or `id: cond ? "team" : null`
  const svg = Plot.plot({
    marks: [logos(STANDINGS, { league: "nfl", ...pos, team: "team", id: null as never })],
  });
  expect(stamped(svg, "image")).toEqual(["12", "24", "7", "13", "2", "15", "20", "17"]);
});
