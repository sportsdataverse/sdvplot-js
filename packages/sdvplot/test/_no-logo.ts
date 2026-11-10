import { onTestFinished } from "vitest";
import { type League, type MarkRow, loadLeague } from "../src/index.js";

/**
 * From the 2026-11 index every team with colours has an archived logo, so the "a team with colours but no logo" tests
 * have no real team left (Python's tests use a stub manifest for the same case). For the running test only, this takes
 * one team's logos out of the loaded league; the team keeps its colours, wordmarks and every other mark.
 */
export async function withoutLogos(league: League, teamId: string): Promise<void> {
  const d = (await loadLeague(league)) as { marks: readonly MarkRow[] };
  const kept = d.marks;
  d.marks = kept.filter((m) => !(m.team_id === teamId && m.mark_type === "logo"));
  onTestFinished(() => {
    d.marks = kept;
  });
}
