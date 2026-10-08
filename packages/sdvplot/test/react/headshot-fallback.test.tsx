// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, test } from "vitest";
import { Headshot } from "../../src/react/index.js";

afterEach(cleanup);

test("fallback='initials': the initials of name once the image fails (Headshot.tsx:15-29)", () => {
  render(<Headshot playerId="3139477" league="nfl" name="Patrick Mahomes" fallback="initials" />);
  const img = screen.getByRole("img");
  expect(img.tagName).toBe("IMG");
  expect(img).toHaveAttribute("alt", "Patrick Mahomes");
  fireEvent.error(img);
  expect(screen.getByRole("img")).toHaveTextContent("PM");
  expect(screen.getByRole("img")).toHaveAttribute("aria-label", "Patrick Mahomes");
});

// Real names and ESPN ids from the bundled gsis shard (joined to nfl-ngs-data 2025 by headshot slug). blazing-the-nets
// main takes the first character of every space-separated word, up to three: suffixes and particles count as words,
// a hyphenated or apostrophised word is one word.
test.each([
  ["4432773", "Brian Thomas Jr.", "BTJ"],
  ["4243389", "Calvin Austin III", "CAI"],
  ["4374302", "Amon-Ra St. Brown", "ASB"],
  ["4429160", "De'Von Achane", "DA"],
  ["4047646", "A.J. Brown", "AB"],
  ["3133487", "Andrew Van Ginkel", "AVG"],
  ["3139477", "Patrick Mahomes ", "PM"], // ESPN names can carry a trailing space
])("initials of %s (%s) are %s, as main computes them", (id, name, initials) => {
  render(<Headshot playerId={id} league="nfl" name={name} fallback="initials" />);
  fireEvent.error(screen.getByRole("img"));
  expect(screen.getByRole("img")).toHaveTextContent(initials);
});

test("fallback='initials' with no URL at all (a malformed id, or a league headshotUrl rejects) renders initials", () => {
  const { unmount } = render(
    <Headshot playerId="not-an-id" league="nfl" name="A B C D" fallback="initials" />,
  );
  expect(screen.getByRole("img")).toHaveTextContent("ABC");
  unmount();
  render(<Headshot playerId="3139477" league={"ahl" as never} name="Patrick Mahomes" fallback="initials" />);
  expect(screen.getByRole("img")).toHaveTextContent("PM");
});

test("initials keep the headshot's box, className and style; alt overrides the label; alt='' hides it", () => {
  render(
    <Headshot
      playerId="not-an-id"
      league="nfl"
      height={43.6}
      name="Patrick Mahomes"
      alt="Kansas City quarterback"
      fallback="initials"
      className="face"
      style={{ borderRadius: 4 }}
    />,
  );
  const box = screen.getByRole("img");
  expect(box).toHaveAttribute("aria-label", "Kansas City quarterback");
  expect(box).toHaveClass("face");
  expect(box.style.width).toBe("60px");
  expect(box.style.height).toBe("43.6px");
  expect(box.style.borderRadius).toBe("4px");
  cleanup();
  render(<Headshot playerId="not-an-id" league="nfl" name="Patrick Mahomes" alt="" fallback="initials" />);
  expect(screen.queryByRole("img")).toBeNull();
  expect(document.body.querySelector("[aria-hidden='true']")).toHaveTextContent("PM");
});

test("a new playerId after a failure shows the new image again", () => {
  const { rerender } = render(
    <Headshot playerId="3139477" league="nfl" name="Patrick Mahomes" fallback="initials" />,
  );
  fireEvent.error(screen.getByRole("img"));
  expect(screen.getByRole("img").tagName).toBe("SPAN");
  rerender(<Headshot playerId="4374302" league="nfl" name="Amon-Ra St. Brown" fallback="initials" />);
  expect(screen.getByRole("img").tagName).toBe("IMG");
  expect(screen.getByRole("img")).toHaveAttribute("alt", "Amon-Ra St. Brown");
});

test("default fallback 'none' keeps the old contract: a failed load leaves the <img>", () => {
  let errors = 0;
  render(
    <Headshot
      playerId="3139477"
      league="nfl"
      onError={() => {
        errors++;
      }}
    />,
  );
  fireEvent.error(screen.getByRole("img"));
  expect(screen.getByRole("img").tagName).toBe("IMG");
  expect(screen.getByRole("img")).toHaveAttribute("alt", "Player headshot");
  expect(errors).toBe(1); // the caller's onError still runs
});

test("without fallback, a URL that cannot be built still renders nothing, name or not", () => {
  const { container } = render(<Headshot playerId="not-an-id" league="nfl" name="Patrick Mahomes" />);
  expect(container.innerHTML).toBe("");
});

test("an astral first character stays whole (main's w[0] would leave a lone surrogate)", () => {
  render(<Headshot playerId="x" league="nfl" name="𠮷田 太郎" fallback="initials" />);
  const text = screen.getByRole("img").textContent ?? "";
  expect(text).toBe("𠮷太");
  expect(text).not.toMatch(/[\uD800-\uDFFF]/u); // no lone surrogate (a /u regex sees only unpaired halves)
});

test("name='' is not a request for decorative: the box keeps role img and the default label", () => {
  render(<Headshot playerId="x" league="nfl" name="" fallback="initials" />);
  expect(screen.getByRole("img")).toHaveAttribute("aria-label", "Player headshot");
  cleanup();
  render(<Headshot playerId="3139477" league="nfl" name="" fallback="initials" />);
  expect(screen.getByRole("img")).toHaveAttribute("alt", "Player headshot");
});
