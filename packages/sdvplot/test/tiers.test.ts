import { beforeAll, expect, test } from "vitest";
import { InputError, loadLeague, prepareTiers, setWarningHandler, wrapLabel } from "../src/index.js";

beforeAll(() => loadLeague("nfl"));
const rows = [
  { tierNo: 1, team: "KC" },
  { tierNo: 1, team: "BUF" },
  { tierNo: 2, team: "BAL" },
  { tierNo: 3, team: "NYJ" },
];
test("ranks within tier, lines at tier ± 0.5, ylim ± 0.6, default labels wrapped at 14 chars", () => {
  const t = prepareTiers(rows, "nfl");
  expect(t.x).toEqual([1, 2, 1, 1]);
  expect(t.y).toEqual([1, 1, 2, 3]);
  expect(t.lines).toEqual([0.5, 1.5, 2.5, 3.5]);
  expect(t.ylim).toEqual([0.4, 3.6]);
  expect(t.xlim).toEqual([1 - 0.05, 2 + 0.05]);
  expect(t.breakLabels).toEqual(["Elite", "Very Good", "Medium"]);
  expect(t.title).toBe("NFL Team Tiers");
  expect(t.variant).toBe("dark");
});
test("snake_case keys, tier_rank, presort, noLineBelowTier, light theme -> default variant", () => {
  const t = prepareTiers(
    [
      { tier_no: 1, team: "KC", tier_rank: 3 },
      { tier_no: 1, team: "BUF", tier_rank: 1 },
    ],
    "nfl",
    { presort: true, noLineBelowTier: 1, theme: "light" },
  );
  expect(t.x).toEqual([1, 2]);
  expect(t.labels).toEqual(["BUF", "KC"]);
  expect(t.lines).toEqual([0.5]);
  expect(t.variant).toBe("default");
});
test("tier_rank is honoured without presort", () => {
  const t = prepareTiers(
    [
      { tierNo: 1, team: "KC", tierRank: 3 },
      { tierNo: 1, team: "BUF", tierRank: 1 },
    ],
    "nfl",
  );
  expect(t.x).toEqual([3, 1]);
  expect(t.xlim[0]).toBeCloseTo(1 - 0.1, 9);
});
test("an unknown team keeps its slot (x range) but is not drawn; no tiers throws", () => {
  setWarningHandler(() => {});
  try {
    const t = prepareTiers(
      [
        { tierNo: 1, team: "XXX" },
        { tierNo: 1, team: "KC" },
      ],
      "nfl",
    );
    expect(t.x).toEqual([2]);
    expect(t.xlim[1]).toBeCloseTo(2.05, 6);
    expect(() => prepareTiers([{ tierNo: null, team: "KC" }], "nfl")).toThrow(/no rows with a tier/);
  } finally {
    setWarningHandler(null);
  }
});
test("a row with a missing tier is skipped with one warning (the Python text)", () => {
  const msgs: string[] = [];
  setWarningHandler((m) => msgs.push(m));
  try {
    const t = prepareTiers(
      [
        { tierNo: 1, team: "KC" },
        { tierNo: null, team: "BUF" },
      ],
      "nfl",
    );
    expect(t.x).toEqual([1]);
    expect(msgs).toEqual(["skipped 1 point(s) with a missing tier_no or tier_rank: BUF"]);
  } finally {
    setWarningHandler(null);
  }
});
test("non-numeric tiers throw InputError", () => {
  expect(() => prepareTiers([{ tierNo: "one", team: "KC" }], "nfl")).toThrow(InputError);
});
test("wrapLabel mirrors textwrap.wrap(text, 14, break_long_words=False)", () => {
  expect(prepareTiers([{ tierNo: 5, team: "KC" }], "nfl").breakLabels[0]).toBe("What are they\ndoing?");
  expect(wrapLabel("Supercalifragilistic is")).toBe("Supercalifragilistic\nis");
  expect(wrapLabel("")).toBe("");
});
