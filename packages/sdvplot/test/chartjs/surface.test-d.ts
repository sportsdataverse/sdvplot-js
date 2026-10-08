import type { ChartConfiguration, Plugin } from "chart.js";
import { expectTypeOf, test } from "vitest";
import { surface } from "../../src/chartjs-surface.js";

test("the surface plugin and scales slot into a scatter config", () => {
  expectTypeOf(surface("nba").plugin).toMatchTypeOf<Plugin<"scatter">>();
  const court = surface("nba");
  const shots: ChartConfiguration<"scatter"> = {
    type: "scatter",
    data: { datasets: [{ data: [{ x: 0, y: 0 }] }] },
    options: { scales: court.scales },
    plugins: [court.plugin],
  };
  expectTypeOf(shots).not.toBeNever();
});
