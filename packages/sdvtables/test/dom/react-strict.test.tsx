import { preloadAll, setWarningHandler } from "@sportsdataverse/sdvplot";
// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { type ReactElement, StrictMode } from "react";
import { afterEach, beforeAll, expect, test, vi } from "vitest";
import type { Table, TableEvent, TableOptions } from "../../src/engine.js";
import { SdvTable } from "../../src/react/index.js";
import type { TableSpec } from "../../src/spec.js";
import { many, spec } from "../fixtures/engine.js";
import type { Standing } from "../fixtures/standings.js";

// Every engine SdvTable builds, with setRows spied: a pass-through wrapper, so behaviour is unchanged.
const built = vi.hoisted((): Table<Standing>[] => []);
vi.mock("../../src/engine.js", async (importOriginal) => {
  const m = await importOriginal<typeof import("../../src/engine.js")>();
  return {
    ...m,
    createTable: <Row,>(s: TableSpec<Row>, rows: readonly Row[], options?: TableOptions): Table<Row> => {
      const t = m.createTable(s, rows, options);
      vi.spyOn(t, "setRows");
      built.push(t as unknown as Table<Standing>);
      return t;
    },
  };
});

beforeAll(async () => {
  setWarningHandler(() => {});
  await preloadAll();
});
afterEach(cleanup); // no vitest globals, so RTL cannot register its own cleanup

test("StrictMode: the owned engine survives the double render and effect replay; setRows never runs on mount and once per new rows", () => {
  const Parent = ({ data }: { data: readonly Standing[] }): ReactElement => (
    <StrictMode>
      <SdvTable
        spec={{ ...spec, rowKey: "team" }}
        rows={data.map((r) => ({ ...r }))}
        interactive
        pageSize={5}
      />
    </StrictMode>
  );
  const { container, rerender } = render(<Parent data={many} />);
  const atMount = built.length;
  expect(atMount).toBeGreaterThanOrEqual(1);
  expect(atMount).toBeLessThanOrEqual(2); // StrictMode runs the useState initializer twice and keeps one
  for (const t of built) expect(t.setRows).not.toHaveBeenCalled(); // the replayed mount effect sees allRows === rows

  const filter = (): HTMLInputElement => screen.getByLabelText("Filter Team") as HTMLInputElement;
  fireEvent.click(screen.getByRole("button", { name: "Wins" }));
  fireEvent.click(screen.getByRole("button", { name: "Wins" })); // desc
  fireEvent.input(filter(), { target: { value: "T1" } }); // T19..T10
  fireEvent.click(screen.getByRole("button", { name: "Next page" }));
  fireEvent.click(container.querySelector('[data-sdv-body] tr[data-row="2"]') as Element); // T12
  const live = built.filter((t) => t.state.sort !== null);
  expect(live).toHaveLength(1); // the controls drive exactly one engine
  const table = live[0] as Table<Standing>;
  const events: TableEvent["type"][] = [];
  table.subscribe((e) => events.push(e.type));

  const kept = (): void => {
    expect(filter().value).toBe("T1");
    expect(container.querySelector('th[data-col="wins"]')?.getAttribute("aria-sort")).toBe("descending");
    expect(screen.getByText("Page 2 of 2")).toBeTruthy();
    expect(container.querySelector('tr.sdvt-selected [data-col="team"]')?.textContent).toBe("T12");
  };
  kept();
  rerender(<Parent data={many} />); // fresh equal rows, rendered twice by StrictMode
  kept();
  expect(table.setRows).toHaveBeenCalledTimes(1);
  expect(events).toEqual(["change"]); // one notification, not one per StrictMode render
  rerender(<Parent data={many} />);
  kept();
  expect(table.setRows).toHaveBeenCalledTimes(2);
  expect(built.length).toBe(atMount); // re-renders never build another engine
});
