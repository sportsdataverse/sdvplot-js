// @vitest-environment jsdom
import { cleanup, render, waitFor } from "@testing-library/react";
import { Component, type ReactNode } from "react";
import { afterEach, expect, test, vi } from "vitest";
import { OptionalDependencyError } from "../../src/errors.js";

// recharts is not installed: any import of it fails, as Node's resolver would.
vi.mock("recharts", () => {
  throw Object.assign(new Error("Cannot find package 'recharts' imported from sdvplot"), {
    code: "ERR_MODULE_NOT_FOUND",
  });
});
afterEach(cleanup);

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

test("without recharts, ./recharts and ./react still import and the render props still draw (Review Focus 1)", async () => {
  const rc = await import("../../src/recharts.js");
  await import("../../src/react/index.js");
  const { loadLeague } = await import("../../src/index.js");
  await loadLeague("nfl");
  const el = rc.logoDot({ team: "team", league: "nfl" })({ cx: 1, cy: 1, payload: { team: "KC" } });
  expect(el).not.toBeNull();
});

test("without recharts, SurfaceBackdrop throws a clear install error only when it renders (Review Focus 1)", async () => {
  const { SurfaceBackdrop } = await import("../../src/react/index.js");
  const onError = vi.fn();
  vi.spyOn(console, "error").mockImplementation(() => {}); // React logs the caught render error
  render(
    <svg role="img" aria-label="test">
      <Catch onError={onError}>
        <SurfaceBackdrop league="nba" />
      </Catch>
    </svg>,
  );
  await waitFor(() => expect(onError).toHaveBeenCalledTimes(1));
  const e = onError.mock.calls[0]?.[0] as Error;
  expect(e).toBeInstanceOf(OptionalDependencyError);
  expect(e.message).toMatch(/SurfaceBackdrop needs the optional peer recharts.*pnpm add recharts/);
});
