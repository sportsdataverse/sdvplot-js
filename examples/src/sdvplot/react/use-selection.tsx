import { STANDINGS, type Standing } from "@sportsdataverse/examples/data";
import { createSelection, toId } from "@sportsdataverse/sdvplot";
import { useSelection } from "@sportsdataverse/sdvplot/react";
import { type ReactElement, useMemo } from "react";
import type { ExampleMeta } from "../../contract.js";

export const meta = {
  title: "useSelection: two components on one store",
  tags: ["react", "useSelection", "createSelection", "linked", "selection", "nfl"],
} satisfies ExampleMeta;

// One store for the page: every component that links reads and writes it (a figure's linkSelection would too).
const store = createSelection<Standing>();
const elevenPlus = (r: Standing): boolean => r.wins >= 11;
store.set({ predicate: elevenPlus, selected: ["KC"] }); // start brushed to 11+ wins, KC picked

function Teams(): ReactElement {
  const { hover, selected } = useSelection(store);
  return (
    <p>
      {STANDINGS.map((r) => {
        const id = toId(r.team);
        const picked = selected.has(id);
        return (
          <button
            key={id}
            type="button"
            aria-pressed={picked}
            // the hover outline, else none set: an inline "none" would hide the keyboard focus ring
            style={{ fontWeight: picked ? 700 : 400, outline: hover.has(id) ? "2px solid" : undefined }}
            onPointerEnter={() => store.set({ hover: [id] })}
            onPointerLeave={() => store.set({ hover: [] })}
            onClick={() => store.set({ selected: picked ? [] : [id] })}
          >
            {r.team}
          </button>
        );
      })}{" "}
      <button type="button" onClick={() => store.set({ predicate: elevenPlus })}>
        11+ wins
      </button>
      <button type="button" onClick={() => store.clear()}>
        clear
      </button>
    </p>
  );
}

function Standings(): ReactElement {
  const { hover, selected, predicate } = useSelection(store);
  // Filter-then-redraw is the component's choice: the rows are recomputed only when the brush region changes.
  const rows = useMemo(() => (predicate === null ? STANDINGS : STANDINGS.filter(predicate)), [predicate]);
  return (
    <table>
      <caption>{`${rows.length} of ${STANDINGS.length} AFC teams, 2024`}</caption>
      <thead>
        <tr>
          <th>team</th>
          <th>W-L</th>
          <th>QB</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => {
          const id = toId(r.team);
          return (
            <tr
              key={id}
              style={{
                fontWeight: selected.has(id) ? 700 : 400,
                background: hover.has(id) ? "var(--sdv-line, #e2e2e2)" : "none",
              }}
            >
              <td>{r.team}</td>
              <td>{`${r.wins}-${r.losses}`}</td>
              <td>{r.qb}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

export default (
  <>
    <Teams />
    <Standings />
  </>
);
