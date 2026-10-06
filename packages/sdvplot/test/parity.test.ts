import { readFileSync } from "node:fs";
import { beforeAll, describe, expect, test } from "vitest";
import { teamColorsSync } from "../src/colors.js";
import { INDEX_VERSION } from "../src/data/index.js";
import { resetWarnings, setWarningHandler } from "../src/errors.js";
import { headshotUrl } from "../src/headshots.js";
import { preloadAll } from "../src/index-data.js";
import { logoUrlSync } from "../src/marks.js";
import { resolveSync } from "../src/resolve.js";
const fx = (n: string) =>
  JSON.parse(readFileSync(new URL(`../../../fixtures/sdvplot/${n}.json`, import.meta.url), "utf8"));
type In = { league: string; value: unknown; season: number | null; id_system: string };
const inputs = fx("inputs") as In[];
const norm = (x: unknown) => (x === null ? undefined : x);
beforeAll(async () => {
  setWarningHandler(() => {});
  resetWarnings();
  await preloadAll();
}, 120_000);
test("fixture index matches the shards", () => {
  expect(fx("meta").index_version).toBe(INDEX_VERSION);
});
const call = (f: () => unknown) => {
  try {
    return f();
  } catch (e) {
    return { error: (e as Error).name };
  }
};
const cases: [string, (i: In) => Record<string, unknown>][] = [
  [
    "resolve",
    (i) => ({
      team_id: norm(
        resolveSync(i.value as never, i.league as never, {
          season: i.season,
          idSystem: i.id_system as never,
        }),
      ),
    }),
  ],
  [
    "palette",
    (i) => ({
      primary: norm(
        teamColorsSync(i.league as never, i.value as never, {
          season: i.season,
          idSystem: i.id_system as never,
        }),
      ),
      secondary: norm(
        teamColorsSync(i.league as never, i.value as never, {
          which: "secondary",
          season: i.season,
          idSystem: i.id_system as never,
        }),
      ),
    }),
  ],
  [
    "logo_url",
    (i) => ({
      default: norm(
        logoUrlSync(i.value as never, i.league as never, {
          season: i.season,
          idSystem: i.id_system as never,
        }),
      ),
      dark: norm(
        logoUrlSync(i.value as never, i.league as never, {
          season: i.season,
          variant: "dark",
          idSystem: i.id_system as never,
        }),
      ),
      wordmark: norm(
        logoUrlSync(i.value as never, i.league as never, {
          season: i.season,
          markType: "wordmark",
          idSystem: i.id_system as never,
        }),
      ),
    }),
  ],
];
describe.each(cases)("%s parity", (name, fn) => {
  const want = fx(name) as Record<string, unknown>[];
  test.each(inputs.map((i, k) => [k, i] as const))("input %i", (k, i) => {
    const got = call(() => fn(i)) as Record<string, unknown>;
    const w = want[k] as Record<string, unknown>;
    if ("error" in w)
      expect(got).toHaveProperty(
        "error",
        { InputError: "InputError", UnresolvedTeamError: "UnresolvedTeamError", TypeError: "InputError" }[
          w.error as string
        ] ?? w.error,
      );
    else
      expect(Object.fromEntries(Object.entries(got).map(([a, b]) => [a, norm(b)]))).toEqual(
        Object.fromEntries(Object.entries(w).map(([a, b]) => [a, norm(b)])),
      );
  });
});
test("headshot_url parity", () => {
  for (const h of fx("headshot_url") as {
    player_id: unknown;
    league: string;
    id_system: string;
    url: string | null;
  }[])
    expect(
      norm(headshotUrl(h.player_id as never, h.league as never, { idSystem: h.id_system as never })),
    ).toBe(norm(h.url));
});
