// @vitest-environment jsdom
import { cleanup, configure, render, waitFor } from "@testing-library/react";
import { Component, type ReactNode } from "react";
import { afterEach, expect, test, vi } from "vitest";
import { OptionalDependencyError } from "../../src/errors.js";
import { drawnMarks } from "../../src/testing/index.js";

// victory is not installed: any import of it fails, as Node's resolver would.
vi.mock("victory", () => {
  throw Object.assign(new Error("Cannot find package 'victory' imported from sdvplot"), {
    code: "ERR_MODULE_NOT_FOUND",
  });
});
afterEach(cleanup);
// The first render waits on a dynamic import, which can take well over waitFor's default 1 s on a busy machine.
configure({ asyncUtilTimeout: 15_000 });
vi.setConfig({ testTimeout: 20_000 });

class Catch extends Component<{ onError: (e: unknown) => void; children: ReactNode }, { failed: boolean }> {
  override state = { failed: false };
  static getDerivedStateFromError(): { failed: boolean } {
    return { failed: true };
  }
  override componentDidCatch(e: unknown): void {
    this.props.onError(e);
  }
  override render(): ReactNode {
    return this.state.failed ? null : this.props.children;
  }
}

test("without victory, ./victory and ./react import, and the logos draw (Review Focus 1)", async () => {
  const victory = await import("../../src/victory.js");
  const { LogoPoint, LogoTick } = await import("../../src/react/index.js");
  const { loadLeague } = await import("../../src/index.js");
  await loadLeague("nfl");
  expect(victory.teamTheme({ league: "nfl", teams: ["KC"] }).group?.colorScale?.[0]).toMatch(
    /^#[0-9a-f]{6}$/i,
  );
  const { container } = render(
    <svg role="img" aria-label="t">
      <LogoPoint league="nfl" team="team" x={1} y={1} size={5} datum={{ team: "KC" }} />
      <LogoTick league="nfl" text="KC" x={1} y={1} textAnchor="middle" verticalAnchor="start" />
    </svg>,
  );
  expect(drawnMarks(container)).toHaveLength(2);
});

test("without victory, a LogoTick that must draw a text label throws a clear install error then (Review Focus 1)", async () => {
  const { LogoTick } = await import("../../src/react/index.js");
  const onError = vi.fn();
  vi.spyOn(console, "error").mockImplementation(() => {}); // React logs the caught render error
  vi.spyOn(console, "warn").mockImplementation(() => {}); // XXX has no logo: one sdvplot warning
  render(
    <Catch onError={onError}>
      <svg role="img" aria-label="t">
        <LogoTick league="nfl" text="XXX" x={1} y={1} />
      </svg>
    </Catch>,
  );
  await waitFor(() => expect(onError).toHaveBeenCalledTimes(1));
  const e = onError.mock.calls[0]?.[0] as Error;
  expect(e).toBeInstanceOf(OptionalDependencyError);
  expect(e.message).toMatch(/LogoTick needs the optional peer victory.*pnpm add victory/);
});
