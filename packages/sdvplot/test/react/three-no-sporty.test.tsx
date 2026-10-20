// @vitest-environment jsdom
import { cleanup, configure, render, waitFor } from "@testing-library/react";
import { Component, type ReactNode } from "react";
import { afterEach, expect, test, vi } from "vitest";
import { OptionalDependencyError } from "../../src/errors.js";

// sporty is not installed (three and react-three-fiber are): <Surface3D> needs it, <Trajectory> does not.
vi.mock("@sportsdataverse/sporty", () => {
  throw Object.assign(new Error("Cannot find package '@sportsdataverse/sporty' imported from sdvplot"), {
    code: "ERR_MODULE_NOT_FOUND",
  });
});
afterEach(cleanup);
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

test("without sporty, ./react imports and <Surface3D> throws a clear install error when it renders", async () => {
  const { Surface3D } = await import("../../src/react/index.js");
  const onError = vi.fn();
  vi.spyOn(console, "error").mockImplementation(() => {}); // React logs the caught render error
  render(
    <Catch onError={onError}>
      <Surface3D sport="baseball" league="mlb" />
    </Catch>,
  );
  await waitFor(() => expect(onError).toHaveBeenCalledTimes(1));
  const e = onError.mock.calls[0]?.[0] as Error;
  expect(e).toBeInstanceOf(OptionalDependencyError);
  expect(e.message).toMatch(
    /Surface3D needs the optional peer @sportsdataverse\/sporty.*pnpm add @sportsdataverse\/sporty/,
  );
});
