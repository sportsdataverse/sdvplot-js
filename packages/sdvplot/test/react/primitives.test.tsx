// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, test } from "vitest";
import { Headshot, TeamLogo, useTeamColors } from "../../src/react/index.js";

afterEach(cleanup);

test("TeamLogo renders an <img> with the archive URL and alt text", async () => {
  render(<TeamLogo team="KC" league="nfl" size={40} />);
  await waitFor(() =>
    expect(screen.getByRole("img")).toHaveAttribute("src", expect.stringMatching(/sha256/)),
  );
  expect(screen.getByRole("img")).toHaveAttribute("alt", "Kansas City Chiefs");
  expect(screen.getByRole("img")).toHaveAttribute("height", "40");
});

test("Headshot is sync and keeps 600:436", () => {
  render(<Headshot playerId="3139477" league="nfl" height={43.6} />);
  expect(screen.getByRole("img")).toHaveAttribute("width", "60");
});

test("useTeamColors returns the palette after load", async () => {
  function P() {
    const c = useTeamColors("nfl");
    return <i data-testid="c">{c?.KC ?? "…"}</i>;
  }
  render(<P />);
  await waitFor(() => expect(screen.getByTestId("c").textContent).toMatch(/^#/));
});

test("TeamLogo renders nothing (no unhandled rejection) when the load/lookup throws", async () => {
  const { container } = render(<TeamLogo team="KC" league="nfl" variant="neon" />);
  await new Promise((r) => setTimeout(r, 200));
  await waitFor(() => expect(container.innerHTML).toBe(""));
});

test("useTeamColors stays undefined for an unknown league", async () => {
  function P() {
    const c = useTeamColors("nlf" as never);
    return <i data-testid="c">{c === undefined ? "none" : "some"}</i>;
  }
  render(<P />);
  await new Promise((r) => setTimeout(r, 200));
  expect(screen.getByTestId("c").textContent).toBe("none");
});
