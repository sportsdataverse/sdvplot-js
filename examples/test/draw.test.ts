import { expect, test, vi } from "vitest";

// A library that adds its box, then throws: what plotly.ts does when Plotly.newPlot rejects.
vi.mock("../src/draw/vega.js", () => ({
  default: async (el: HTMLElement) => {
    el.append(document.createElement("svg"));
    throw new Error("vega failed");
  },
}));
const { draw } = await import("../src/draw/index.js");

test("a drawing that throws removes what it drew, and only that", async () => {
  const el = document.createElement("div");
  const newer = el.appendChild(document.createElement("div")); // a newer drawing's chart in the same figure
  await expect(draw(el, { lib: "vega", spec: {} })).rejects.toThrow("vega failed");
  expect([...el.children]).toEqual([newer]);
});
