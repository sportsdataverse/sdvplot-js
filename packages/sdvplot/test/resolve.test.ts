import { beforeEach, expect, test, vi } from "vitest";
import { InputError, UnresolvedTeamError, resetWarnings, setWarningHandler } from "../src/errors.js";
import { preloadAll } from "../src/index-data.js";
import { resolve, resolveSync, suggest } from "../src/resolve.js";

beforeEach(() => {
  resetWarnings();
  setWarningHandler(() => {});
});

test("scalar in, scalar out; array in, array out; float-origin id equals int (Review Focus 1)", async () => {
  const kc = await resolve("KC", "nfl");
  expect(typeof kc).toBe("string");
  expect(await resolve([kc!, Number(kc), `${kc}.0`], "nfl")).toEqual([kc, kc, kc]);
});

test("reused code without season means current holder (Review Focus 2)", async () => {
  const [lv, oak] = await resolve(["LV", "OAK"], "nfl");
  expect(oak).toBe(lv);
});

test("unknown → undefined + one warning; strict throws", async () => {
  const spy = vi.fn();
  setWarningHandler(spy);
  expect(await resolve(["KC", "ZZZ", "ZZZ"], "nfl")).toEqual([expect.any(String), undefined, undefined]);
  expect(spy).toHaveBeenCalledTimes(1);
  await expect(resolve("ZZZ", "nfl", { strict: true })).rejects.toThrow(UnresolvedTeamError);
});

test("unknown league / id system / season out of bounds are InputError", async () => {
  await expect(resolve("KC", "nlf" as never)).rejects.toThrow(InputError);
  await expect(resolve("KC", "nfl", { idSystem: "espn-id" as never })).rejects.toThrow(InputError);
  await expect(resolve("KC", "nfl", { season: 1800 })).rejects.toThrow(InputError);
});

test("resolveSync works after preloadAll and suggest never guesses", async () => {
  await preloadAll();
  expect(resolveSync("KC", "nfl")).toBe(resolveSync("Kansas City Chiefs", "nfl"));
  const s = await suggest("Kansas Cty Chiefs", "nfl", { n: 2 });
  expect(s[0]?.[1]).toBe("Kansas City Chiefs");
});
