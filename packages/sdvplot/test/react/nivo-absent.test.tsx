// @vitest-environment jsdom
import { cleanup, configure, render, waitFor } from "@testing-library/react";
import { Component, type ReactNode } from "react";
import { afterEach, expect, test, vi } from "vitest";
import { OptionalDependencyError } from "../../src/errors.js";

// @nivo/bump is not installed: any import of it fails, as Node's resolver would.
vi.mock("@nivo/bump", () => {
  throw Object.assign(new Error("Cannot find package '@nivo/bump' imported from sdvplot"), {
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

test("without nivo, ./nivo and ./react still import and the layer still draws (Review Focus 1)", async () => {
  const nivo = await import("../../src/nivo.js");
  await import("../../src/react/index.js");
  const { loadLeague } = await import("../../src/index.js");
  await loadLeague("nfl");
  const el = nivo.logoLayer({ league: "nfl" })({
    innerHeight: 100,
    nodes: [{ id: "KC", x: 1, y: 1, size: 10, data: {} }],
  });
  expect(el).not.toBeNull();
  expect(nivo.teamColors({ league: "nfl" })({ id: "KC" })).toMatch(/^#[0-9a-f]{6}$/i);
});

test("without @nivo/bump, LogoBump throws a clear install error only when it renders (Review Focus 1)", async () => {
  const { LogoBump } = await import("../../src/react/index.js");
  const onError = vi.fn();
  vi.spyOn(console, "error").mockImplementation(() => {}); // React logs the caught render error
  render(
    <Catch onError={onError}>
      <LogoBump league="nfl" data={[]} width={300} height={200} />
    </Catch>,
  );
  await waitFor(() => expect(onError).toHaveBeenCalledTimes(1));
  const e = onError.mock.calls[0]?.[0] as Error;
  expect(e).toBeInstanceOf(OptionalDependencyError);
  expect(e.message).toMatch(/LogoBump needs the optional peer @nivo\/bump.*pnpm add @nivo\/bump/);
});
