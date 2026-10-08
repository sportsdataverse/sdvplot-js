import { readFileSync } from "node:fs";
import { ESPN_HEADSHOT_LEAGUES, LEAGUES, loadLeague } from "@sportsdataverse/sdvplot";
import { SPORTS, leagues } from "@sportsdataverse/sporty";
import type { ComponentType } from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, test } from "vitest";
import { abs } from "../sources.js";

// The home page's "What's covered" (docs/src/components/Coverage.tsx), fed by the docs plugin that reads the
// registries at build time (docs/plugins/sdv-home.ts), checked against the packages' public API. Strings, not
// literals: the examples' tsc stays out of the docs, as in live.test.tsx.
const PLUGIN: string = "../../docs/plugins/sdv-home.ts";
const COMPONENT: string = "../../docs/src/components/Coverage.tsx";

const fmt = (n: number): string => n.toLocaleString("en-US");

test("the home page's coverage tables render the registries' own counts", async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  const { coverage } = (await import(/* @vite-ignore */ PLUGIN)) as { coverage: () => Promise<unknown> };
  const Coverage = (
    (await import(/* @vite-ignore */ COMPONENT)) as { default: ComponentType<{ data: unknown }> }
  ).default;
  const data = await coverage();
  const container = document.createElement("div");
  const root = createRoot(container);
  await act(async () => root.render(<Coverage data={data} />));

  const rows = [...container.querySelectorAll<HTMLTableRowElement>("tr[data-league]")];
  expect(rows.map((r) => r.dataset.league).sort(), "a row per league of the index").toEqual(
    [...LEAGUES].sort(),
  );
  let teams = 0;
  for (const row of rows) {
    const league = row.dataset.league as (typeof LEAGUES)[number];
    const d = await loadLeague(league);
    teams += d.teams.length;
    const withMark = (type: string): number =>
      new Set(d.marks.filter((m) => m.mark_type === type).map((m) => m.team_id)).size;
    const expected: Record<string, number> = {
      teams: d.teams.length,
      colors: d.teams.filter((t) => t.color_primary !== null).length,
      logos: withMark("logo"),
      wordmarks: withMark("wordmark"),
      aliases: d.aliases.length,
    };
    for (const [col, n] of Object.entries(expected)) {
      const cell = row.querySelector<HTMLElement>(`[data-col="${col}"]`);
      expect(cell?.dataset.value, `${league} ${col}`).toBe(String(n));
      expect(cell?.textContent, `${league} ${col} as shown`).toMatch(
        n === 0 ? /^—none$/ : new RegExp(`^${fmt(n)}`),
      );
    }
    const shots = row.querySelector<HTMLElement>('[data-col="headshots"]')?.dataset.value?.split(" ") ?? [];
    expect(shots.includes("espn"), `${league} ESPN headshots`).toBe(
      Object.hasOwn(ESPN_HEADSHOT_LEAGUES, league),
    );
    // gsis ids are nfl-only (headshotUrl); the league-id CDNs are nbaHeadshotUrl, wnba…, mlb…, nhl…
    expect(shots.includes("gsis"), `${league} gsis headshots`).toBe(league === "nfl");
    expect(shots.includes("league"), `${league} league-id headshots`).toBe(
      ["nba", "wnba", "mlb", "nhl"].includes(league),
    );
  }
  expect(container.querySelector("[data-totals]")?.textContent).toContain(
    `${LEAGUES.length} leagues and ${fmt(teams)} teams`,
  );

  const surfaces = SPORTS.reduce((n, s) => n + leagues(s).filter((l) => l !== "custom").length, 0);
  expect(container.querySelector("[data-totals]")?.textContent).toContain(
    `${SPORTS.length} sports and ${surfaces} league surfaces`,
  );

  const sports = [...container.querySelectorAll<HTMLElement>("[data-sport]")];
  expect(sports.map((s) => s.dataset.sport)).toEqual([...SPORTS]);
  for (const s of sports) {
    const chips = [...s.querySelectorAll<HTMLElement>("[data-league]")].map((c) => c.textContent);
    expect(chips, `${s.dataset.sport} leagues`).toEqual([
      ...leagues(s.dataset.sport as (typeof SPORTS)[number]),
    ]);
  }
  await act(async () => root.unmount());
});

test("the home page's badge row is the root README's, every badge of it", async () => {
  const { readmeBadges } = (await import(/* @vite-ignore */ PLUGIN)) as {
    readmeBadges: () => { alt: string; src: string; href: string }[];
  };
  const readme = readFileSync(abs("README.md"), "utf8");
  const block = readme.slice(
    readme.indexOf("<!-- badges: start -->"),
    readme.indexOf("<!-- badges: end -->"),
  );
  const lines = block.split("\n").filter((l) => l.startsWith("[!["));
  const badges = readmeBadges();
  expect(badges.length, "one per README badge line").toBe(lines.length);
  for (const b of badges) {
    expect(b.alt, "alt text").not.toBe("");
    expect(new URL(b.src).protocol).toBe("https:");
    expect(new URL(b.href).protocol).toBe("https:");
  }
});
