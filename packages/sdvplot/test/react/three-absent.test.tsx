// @vitest-environment jsdom
import { cleanup, configure, render, waitFor } from "@testing-library/react";
import { Component, type ReactNode } from "react";
import { afterEach, expect, test, vi } from "vitest";
import { OptionalDependencyError } from "../../src/errors.js";

// three and @react-three/fiber are not installed: any import of them fails, as Node's resolver would.
vi.mock("three", () => {
  throw Object.assign(new Error("Cannot find package 'three' imported from sdvplot"), {
    code: "ERR_MODULE_NOT_FOUND",
  });
});
vi.mock("@react-three/fiber", () => {
  throw Object.assign(new Error("Cannot find package '@react-three/fiber' imported from sdvplot"), {
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

const PATH = [
  [0, 50, 6],
  [0, 17 / 12, 2],
] as const;

test("without three, ./three and ./react still import and the mesh buffers still build (Review Focus 1)", async () => {
  const three = await import("../../src/three/index.js");
  await import("../../src/react/index.js");
  const { loadLeague } = await import("../../src/index.js");
  await loadLeague("mlb");
  expect(three.surfaceMesh("baseball", "mlb").indices.length).toBeGreaterThan(0);
  const tube = three.trajectoryTube(PATH, { radius: 0.121, team: "NYY", league: "mlb" });
  expect(tube.color).toMatch(/^#[0-9a-f]{6}$/);
});

test.each(["Surface3D", "Trajectory"] as const)(
  "without the peers, <%s> throws a clear install error only when it renders (Review Focus 1)",
  async (name) => {
    const react = await import("../../src/react/index.js");
    const onError = vi.fn();
    vi.spyOn(console, "error").mockImplementation(() => {}); // React logs the caught render error
    render(
      <Catch onError={onError}>
        {name === "Surface3D" ? (
          <react.Surface3D sport="baseball" league="mlb" />
        ) : (
          <react.Trajectory points={PATH} radius={0.121} color="#003087" />
        )}
      </Catch>,
    );
    await waitFor(() => expect(onError).toHaveBeenCalledTimes(1));
    const e = onError.mock.calls[0]?.[0] as Error;
    expect(e).toBeInstanceOf(OptionalDependencyError);
    expect(e.message).toMatch(
      new RegExp(
        `${name} needs the optional peers three and @react-three/fiber.*pnpm add three @react-three/fiber`,
      ),
    );
  },
);
