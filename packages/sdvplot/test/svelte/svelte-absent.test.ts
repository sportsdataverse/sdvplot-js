import { cleanup, configure, render, waitFor } from "@testing-library/svelte";
import { afterEach, expect, test, vi } from "vitest";
import { OptionalDependencyError } from "../../src/errors.js";
import Bare from "./fixtures/Bare.svelte";

// layerchart is not installed: any import of it fails, as Node's resolver would.
vi.mock("layerchart", () => {
  throw Object.assign(new Error("Cannot find package 'layerchart' imported from sdvplot"), {
    code: "ERR_MODULE_NOT_FOUND",
  });
});
afterEach(cleanup);
configure({ asyncUtilTimeout: 15_000 });
vi.setConfig({ testTimeout: 30_000 });

test("without layerchart, ./svelte still imports and its palette still works (Review Focus 1)", async () => {
  const svelte = await import("../../src/svelte/index.js");
  const { loadLeague } = await import("../../src/index.js");
  await loadLeague("nfl");
  expect(svelte.teamColorPalette("nfl", ["KC"])).toHaveLength(1);
  expect(typeof svelte.LogoMark).toBe("function");
});

test("without layerchart, each component throws a clear install error only when it renders (Review Focus 1)", async () => {
  const { HeadshotMark, LogoMark, SurfaceBackdrop } = await import("../../src/svelte/index.js");
  const xy = { x: "x", y: "y", league: "nfl" };
  for (const [name, is, props] of [
    ["LogoMark", LogoMark, { ...xy, team: "team" }],
    ["HeadshotMark", HeadshotMark, { ...xy, player: "player" }],
    ["SurfaceBackdrop", SurfaceBackdrop, { league: "nba" }],
  ] as const) {
    const onerror = vi.fn();
    render(Bare, { props: { is, props, onerror } }); // under `props`: Bare has a prop named props
    await waitFor(() => expect(onerror).toHaveBeenCalledTimes(1));
    const e = onerror.mock.calls[0]?.[0] as Error;
    expect(e).toBeInstanceOf(OptionalDependencyError);
    expect(e.message).toMatch(
      new RegExp(`^${name} needs the optional peer layerchart.*pnpm add layerchart$`),
    );
    cleanup();
  }
});
