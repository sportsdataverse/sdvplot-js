import { preloadAll, resetWarnings, setWarningHandler } from "@sportsdataverse/sdvplot";
import { expect, test, vi } from "vitest";
import { resolveTheme } from "../src/themes/index.js";

// No team in any shipped league lacks colors (all 26 leagues scanned: 0 teams without
// color_primary), so the null-colors branch is reached by blanking the lookup for a real
// team (nfl KC) rather than inventing a team.
vi.mock("@sportsdataverse/sdvplot", async (orig) => ({
  ...(await orig<typeof import("@sportsdataverse/sdvplot")>()),
  teamColorsSync: () => undefined,
}));

test("a team with no colors on file warns and falls back to the SportsDataverse colors", async () => {
  await preloadAll();
  const seen: string[] = [];
  resetWarnings();
  setWarningHandler((m) => seen.push(String(m)));
  try {
    const t = resolveTheme({
      name: "sdvTeam",
      density: "comfortable",
      options: { league: "nfl", team: "KC" },
    });
    expect(seen).toHaveLength(1);
    expect(seen[0]).toMatch(/no colors on file for nfl team "KC"/);
    expect(t.tokens.headingBg).toBe("#0B1A33");
    expect(t.tokens.titleColor).toBe("#ffffff");
  } finally {
    setWarningHandler(null);
    resetWarnings();
  }
});
