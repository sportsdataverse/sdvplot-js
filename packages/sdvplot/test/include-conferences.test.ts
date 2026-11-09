import { expect, test, vi } from "vitest";
import type { Team } from "../src/data/index.js";

// The bundled index has no conference or league rows yet: give nfl a conference and a league row (as sdvplot's index does from cc2db0ef on)
// plus a null-program row, which Python keeps (soccer's clubs).
const row = (team_id: string, program: string | null, color: string): Team => ({
  league: "nfl",
  team_id,
  abbr: team_id,
  name: team_id,
  short_name: team_id,
  location: null,
  program,
  conference_id: null,
  conference: null,
  color_primary: color,
  color_secondary: null,
  color_source: "fallback",
  division: null,
});
const EXTRA = [
  row("ZCONF", "conference", "#010101"),
  row("ZLEAGUE", "league", "#020202"),
  row("ZNUL", null, "#030303"),
];
vi.mock("../src/data/index.js", async (importOriginal) => {
  const m = await importOriginal<typeof import("../src/data/index.js")>();
  return {
    ...m,
    loaders: {
      ...m.loaders,
      nfl: async () => {
        const d = await m.loaders.nfl();
        return { ...d, teams: [...d.teams, ...EXTRA] };
      },
    },
  };
});
const { loadLeague, palette, teams } = await import("../src/index.js");

test("conference and league rows are left out of the team listing unless asked, as Python's teams()", async () => {
  const ids = (ts: readonly Team[]) => ts.map((t) => t.team_id);
  const listed = await teams("nfl");
  expect(ids(listed)).not.toContain("ZCONF");
  expect(ids(listed)).not.toContain("ZLEAGUE");
  expect(ids(listed)).toContain("ZNUL"); // a null program is a team (fill_null(False))
  expect(listed.every((t) => t.program !== "conference" && t.program !== "league")).toBe(true);
  expect((await loadLeague("nfl")).teams).toEqual(listed);
  const all = await teams("nfl", { includeConferences: true });
  expect(ids(all)).toEqual(expect.arrayContaining(["ZCONF", "ZLEAGUE", "ZNUL"]));
  // the opt-in adds exactly the non-team rows, in index order
  expect(all.filter((t) => t.program !== "conference" && t.program !== "league")).toEqual(listed);
  expect(ids(await teams())).not.toContain("ZCONF");
  expect(ids(await teams(undefined, { includeConferences: true }))).toContain("ZCONF");
});
test("palettes never list a conference or league row", async () => {
  const p = await palette("nfl");
  expect(p).not.toHaveProperty("ZCONF");
  expect(p).not.toHaveProperty("ZLEAGUE");
  expect(Object.values(p)).not.toContain("#010101");
  expect(p.ZNUL).toBe("#030303");
});
