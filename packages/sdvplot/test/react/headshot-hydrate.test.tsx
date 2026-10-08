// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { act, cleanup, render } from "@testing-library/react";
import type { ReactElement } from "react";
import { hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { afterEach, expect, test } from "vitest";
import { Headshot } from "../../src/react/index.js";

afterEach(() => {
  cleanup();
  document.body.innerHTML = "";
});

// Brian Thomas Jr., a real ESPN id from the bundled gsis shard (see headshot-fallback.test.tsx).
const face = <Headshot playerId="4432773" league="nfl" name="Brian Thomas Jr." fallback="initials" />;

/** Server-render `el`, let the browser settle the <img> as `state` before React arrives, then hydrate. */
async function hydrateAfter(el: ReactElement, state: { complete: boolean; naturalWidth: number }) {
  const container = document.createElement("div");
  container.innerHTML = renderToString(el);
  document.body.appendChild(container);
  const img = container.querySelector("img");
  if (img === null) throw new Error("no <img> in the server markup");
  Object.defineProperty(img, "complete", { value: state.complete, configurable: true });
  Object.defineProperty(img, "naturalWidth", { value: state.naturalWidth, configurable: true });
  await act(async () => {
    hydrateRoot(container, el);
  });
  return container;
}

test("an image that failed before hydration (complete, 0 wide) still becomes the initials: React replays no error", async () => {
  const c = await hydrateAfter(face, { complete: true, naturalWidth: 0 });
  expect(c.querySelector("img")).toBeNull();
  expect(c.querySelector("span[role='img']")).toHaveTextContent("BTJ");
  expect(c.querySelector("span[role='img']")).toHaveAttribute("aria-label", "Brian Thomas Jr.");
});

test("an image still loading at hydration (not complete) stays an <img>", async () => {
  const c = await hydrateAfter(face, { complete: false, naturalWidth: 0 });
  expect(c.querySelector("img")).toHaveAttribute("alt", "Brian Thomas Jr.");
  expect(c.querySelector("span")).toBeNull();
});

test("an image loaded before hydration (complete, 600 wide) stays an <img>", async () => {
  const c = await hydrateAfter(face, { complete: true, naturalWidth: 600 });
  expect(c.querySelector("img")).toHaveAttribute("alt", "Brian Thomas Jr.");
  expect(c.querySelector("span")).toBeNull();
});

test("without fallback, a pre-hydration failure leaves the <img> (the old contract)", async () => {
  const c = await hydrateAfter(<Headshot playerId="4432773" league="nfl" name="Brian Thomas Jr." />, {
    complete: true,
    naturalWidth: 0,
  });
  expect(c.querySelector("img")).toHaveAttribute("alt", "Brian Thomas Jr.");
});

test("server markup is the same as before the hydration check (no attribute or element added)", () => {
  expect(renderToString(face)).toBe(
    '<link rel="preload" as="image" href="https://a.espncdn.com/combiner/i?img=/i/headshots/nfl/players/full/4432773.png"/><img src="https://a.espncdn.com/combiner/i?img=/i/headshots/nfl/players/full/4432773.png" alt="Brian Thomas Jr." height="60" width="83"/>',
  );
  expect(renderToString(<Headshot playerId="3139477" league="nfl" />)).toBe(
    '<link rel="preload" as="image" href="https://a.espncdn.com/combiner/i?img=/i/headshots/nfl/players/full/3139477.png"/><img src="https://a.espncdn.com/combiner/i?img=/i/headshots/nfl/players/full/3139477.png" alt="Player headshot" height="60" width="83"/>',
  );
  expect(
    renderToString(<Headshot playerId="x" league="nfl" name="Calvin Austin III" fallback="initials" />),
  ).toBe(
    '<span role="img" aria-label="Calvin Austin III" style="display:inline-flex;align-items:center;justify-content:center;width:83px;height:60px;background:var(--sdv-line, #e2e2e2);color:var(--sdv-muted, #525252)">CAI</span>',
  );
});

test("the check reruns when the player changes: a new src already settled as broken becomes initials", () => {
  const { container, rerender } = render(face);
  const img = container.querySelector("img");
  if (img === null) throw new Error("no <img>");
  // React reuses the <img> for the next src; the browser has settled it as broken before the effect runs.
  Object.defineProperty(img, "complete", { value: true, configurable: true });
  Object.defineProperty(img, "naturalWidth", { value: 0, configurable: true });
  rerender(<Headshot playerId="4243389" league="nfl" name="Calvin Austin III" fallback="initials" />);
  expect(container.querySelector("img")).toBeNull();
  expect(container.querySelector("span[role='img']")).toHaveTextContent("CAI");
});
