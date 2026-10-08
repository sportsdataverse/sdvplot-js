// @vitest-environment jsdom
import { act, cleanup, render, screen } from "@testing-library/react";
import { type ReactElement, StrictMode, useLayoutEffect } from "react";
import { renderToString } from "react-dom/server";
import { afterEach, expect, test } from "vitest";
import { STANDINGS, type Standing } from "../../../sdvtables/test/fixtures/standings.js";
import { useSelection } from "../../src/react/index.js";
import { type SelectionStore, createSelection } from "../../src/selection.js";

afterEach(cleanup);

/** Renders of the component that holds the hook (a parent would not re-render on a store change). */
let renders = 0;
function Picked({ store }: { store: SelectionStore<Standing> }): ReactElement {
  renders += 1;
  const s = useSelection(store);
  const rows = s.predicate === null ? STANDINGS : STANDINGS.filter(s.predicate);
  return <output>{`${[...s.selected].join(",")}|${rows.length}`}</output>;
}

/** The same store, counting live subscriptions. Built once, so `subscribe` keeps one identity across renders. */
function counted(store: SelectionStore<Standing>): { store: SelectionStore<Standing>; live: () => number } {
  let live = 0;
  return {
    store: {
      ...store,
      subscribe(fn) {
        live += 1;
        const off = store.subscribe(fn);
        return () => {
          live -= 1;
          off();
        };
      },
    },
    live: () => live,
  };
}

test("useSelection re-renders on a store change and not on a no-op", () => {
  const store = createSelection<Standing>();
  render(<Picked store={store} />);
  expect(screen.getByRole("status").textContent).toBe("|8");
  const mounted = renders;
  act(() => store.set({ selected: ["KC", "BUF"], predicate: (r) => r.wins >= 13 }));
  expect(screen.getByRole("status").textContent).toBe("KC,BUF|2");
  expect(renders).toBe(mounted + 1); // the counter sees the hook's re-render, so the no-op check below is not vacuous
  const before = renders;
  act(() => store.set({ selected: ["BUF", "KC"] }));
  expect(renders).toBe(before);
});

test("server render reads the current state (no effects, no DOM needed)", () => {
  const store = createSelection<Standing>();
  store.set({ selected: ["LV"] });
  expect(renderToString(<Picked store={store} />)).toBe("<output>LV|8</output>");
});

test("StrictMode's double effects leave exactly one subscription, and unmounting drops it", () => {
  const { store, live } = counted(createSelection<Standing>());
  const { unmount } = render(
    <StrictMode>
      <Picked store={store} />
    </StrictMode>,
  );
  expect(live()).toBe(1);
  act(() => store.set({ selected: ["BUF"] }));
  expect(screen.getByRole("status").textContent).toBe("BUF|8");
  unmount();
  expect(live()).toBe(0);
});

test("a change made after the render but before the subscription is not lost", () => {
  const store = createSelection<Standing>();
  // A sibling's layout effect runs before any passive effect subscribes: a hook that read the state once in render
  // and subscribed in useEffect would keep showing "|8".
  function Brush(): null {
    useLayoutEffect(() => store.set({ predicate: (r) => r.division === "West" }), []);
    return null;
  }
  render(
    <>
      <Picked store={store} />
      <Brush />
    </>,
  );
  expect(screen.getByRole("status").textContent).toBe("|4");
});

test("passing another store re-subscribes: the new store's state shows, the old store's changes do not", () => {
  const a = counted(createSelection<Standing>());
  const b = createSelection<Standing>();
  b.set({ selected: ["MIA"] });
  const { rerender } = render(<Picked store={a.store} />);
  rerender(<Picked store={b} />);
  expect(screen.getByRole("status").textContent).toBe("MIA|8");
  expect(a.live()).toBe(0);
  act(() => a.store.set({ selected: ["NYJ"] }));
  expect(screen.getByRole("status").textContent).toBe("MIA|8");
  act(() => b.set({ selected: ["NE"] }));
  expect(screen.getByRole("status").textContent).toBe("NE|8");
});
