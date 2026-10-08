import { expect, test, vi } from "vitest";
import "./_fixtures.js";
import {
  aspect,
  axisLetter,
  axisPlacements,
  colorList,
  column,
  embedSources,
  imageSource,
  markPlacements,
  place,
  seasons,
} from "../src/_web.js";
import { DownloadError, InputError } from "../src/errors.js";
import { HEADSHOT_ASPECT, teamColorsSync } from "../src/index.js";

test("aspect: the manifest's width/height, HEADSHOT_ASPECT for a headshot", () => {
  const [p] = place([1], [2], ["KC"], { league: "nfl", kind: "logo" });
  expect(aspect(p!)).toBeGreaterThan(0);
  const [h] = place([1], [2], ["3139477"], { league: "nfl", kind: "headshot", idSystem: "espn" });
  expect(aspect(h!)).toBe(HEADSHOT_ASPECT);
});

test("axisLetter accepts x and y only", () => {
  expect(axisLetter("x")).toBe("x");
  expect(() => axisLetter("z")).toThrow(InputError);
});

test("imageSource: the archive URL, or the embedded data URI when the map has it", () => {
  const [p] = place([1], [2], ["KC"], { league: "nfl", kind: "logo" });
  expect(imageSource(p!)).toBe(p!.url);
  expect(imageSource(p!, new Map([[p!.url, "data:image/png;base64,AAAA"]]))).toBe(
    "data:image/png;base64,AAAA",
  );
  expect(imageSource({ ...p!, url: "https://x/a b.png" })).toBe("https://x/a%20b.png"); // percent-encoded past URL punctuation
});

test("embedSources fetches each distinct url once and builds data URIs (svg mime from the extension)", async () => {
  const fetchFn = vi.fn(
    async (u: string | URL | Request) =>
      new Response(new Uint8Array([1, 2, 3]), {
        headers: { "content-type": String(u).endsWith(".svg") ? "image/svg+xml" : "image/png" },
      }),
  );
  const m = await embedSources(
    ["https://a/x.png", "https://a/x.png", "https://a/y.svg"],
    fetchFn as unknown as typeof fetch,
  );
  expect(fetchFn).toHaveBeenCalledTimes(2);
  expect(m.get("https://a/x.png")).toBe("data:image/png;base64,AQID");
  expect(m.get("https://a/y.svg")!.startsWith("data:image/svg+xml;base64,")).toBe(true);
});

test("column names a missing column in its error; seasons reads a column or passes the value through", () => {
  expect(() => column([{ a: 1 }], "b", "x")).toThrow(/x column "b" is not in rows/);
  expect(seasons([{ s: 2020 }, { s: 2021 }], "s")).toEqual([2020, 2021]);
  expect(seasons([{ s: 2020 }], 2019)).toBe(2019);
  expect(seasons([{ s: 2020 }], "2019")).toBe("2019"); // a string that is not a column is a season
});

test("markPlacements places the row columns; axisPlacements puts label i at index i along the axis", () => {
  const rows = [
    { x: 10, y: -3, team: "KC" },
    { x: 20, y: -7, team: "BUF" },
  ];
  const ps = markPlacements(rows, "logo", { x: "x", y: "y", team: "team", league: "nfl" });
  expect(ps.map((p) => [p.x, p.y, p.id])).toEqual([
    [10, -3, "12"],
    [20, -7, "2"],
  ]);
  expect(() => markPlacements(rows, "logo", { x: "x", y: "nope", team: "team", league: "nfl" })).toThrow(
    /y column "nope" is not in rows/,
  );
  const hs = markPlacements([{ x: 1, y: 2, player: "3139477" }], "headshot", {
    x: "x",
    y: "y",
    player: "player",
    league: "nfl",
  });
  expect(hs).toHaveLength(1);
  expect(aspect(hs[0]!)).toBe(HEADSHOT_ASPECT);
  const ax = axisPlacements(["KC", "BUF"], "x", { league: "nfl" });
  expect(ax.map((p) => [p.x, p.y])).toEqual([
    [0, 0],
    [1, 0],
  ]);
  const ay = axisPlacements(["KC", "BUF"], "y", { league: "nfl" });
  expect(ay.map((p) => [p.x, p.y])).toEqual([
    [0, 0],
    [0, 1],
  ]);
});

test("embedSources raises DownloadError (url + status) on a non-ok answer", async () => {
  const fetchFn = vi.fn(async () => new Response("", { status: 404 }));
  await expect(embedSources(["https://a/x.png"], fetchFn as unknown as typeof fetch)).rejects.toThrow(
    DownloadError,
  );
});

test("colorList resolves every team in one pass, matching teamColorsSync", () => {
  expect(colorList("nfl", ["KC", "BUF"])).toEqual(teamColorsSync("nfl", ["KC", "BUF"]));
});
