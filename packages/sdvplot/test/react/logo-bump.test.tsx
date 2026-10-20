// @vitest-environment jsdom
import { cleanup, configure, render, waitFor } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { hex6, logoUrlSync, resolveSync, teamColorsSync } from "../../src/index.js";
import { teamColors } from "../../src/nivo.js";
import { LogoBump } from "../../src/react/index.js";
import { drawnMarks } from "../../src/testing/index.js";
import { BUF, KC } from "../_fixtures.js";

afterEach(cleanup);
// The first render waits on the lazy @nivo/bump import, which can take well over waitFor's default 1 s.
configure({ asyncUtilTimeout: 15_000 });
vi.setConfig({ testTimeout: 20_000 });

const rgba = (hex: string) => {
  const h = hex6(hex);
  const [r, g, b] = [1, 3, 5].map((i) => Number.parseInt(h.slice(i, i + 2), 16));
  return `rgba(${r}, ${g}, ${b}, 1)`;
};
const DATA = [
  { id: KC, data: [1, 2, 3].map((x) => ({ x, y: x === 1 ? 2 : 1 })) },
  { id: BUF, data: [1, 2, 3].map((x) => ({ x, y: x === 1 ? 1 : 2 })) },
];

test("LogoBump: a nivo Bump with team-coloured lines and a logo at the end of each line", async () => {
  const { container } = render(
    <LogoBump league="nfl" data={DATA} width={400} height={300} animate={false} logoHeight={0.2} />,
  );
  await waitFor(() => expect(drawnMarks(container)).toHaveLength(2));
  const marks = drawnMarks(container);
  expect(marks.map((m) => [m.id, m.url, m.height])).toEqual([
    [resolveSync(KC, "nfl"), logoUrlSync(KC, "nfl"), 0.2],
    [resolveSync(BUF, "nfl"), logoUrlSync(BUF, "nfl"), 0.2],
  ]);
  // each logo sits at its line's week-3 point: the same x, the rank's y
  expect(marks[0]?.x).toBe(marks[1]?.x);
  expect(marks[0]?.y).toBeLessThan(marks[1]?.y as number); // KC is first in week 3: higher up
  const strokes = [KC, BUF].map((id) =>
    container.querySelector(`[data-testid="line.${id}"]`)?.getAttribute("stroke"),
  );
  expect(strokes).toEqual(teamColorsSync("nfl", [KC, BUF]).map((c) => rgba(c as string)));
});

test("LogoBump background: the dark-mode palette of teamColors over the series' teams", async () => {
  const { container } = render(
    <LogoBump league="nfl" data={DATA} width={400} height={300} animate={false} background="#181a1b" />,
  );
  await waitFor(() => expect(drawnMarks(container)).toHaveLength(2));
  const c = teamColors({ league: "nfl", teams: [KC, BUF], background: "#181a1b" });
  expect(
    [KC, BUF].map((id) => container.querySelector(`[data-testid="line.${id}"]`)?.getAttribute("stroke")),
  ).toEqual([KC, BUF].map((id) => rgba(c({ id }))));
});
