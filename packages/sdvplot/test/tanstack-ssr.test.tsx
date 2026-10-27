// @vitest-environment node
import { defineChart, dot } from "@tanstack/charts";
import { Chart } from "@tanstack/charts/react";
import { scaleLinear } from "@tanstack/charts/scales/linear";
import { renderChartSvg } from "@tanstack/charts/svg";
import { renderToString } from "react-dom/server";
import { expect, test } from "vitest";
import { loadLeague, logoUrlSync } from "../src/index.js";
import { logoDots, withPatterns } from "../src/tanstack.js";
import "./_fixtures.js";

test("a server render through TanStack's React <Chart> writes the logo dots and their patterns into the markup (Review Focus 3)", async () => {
  expect(typeof window).toBe("undefined");
  await loadLeague("nfl");
  const rows = [
    { team: "KC", pf: 385, pa: 326 },
    { team: 13, pf: 309, pa: 434 }, // the Raiders by ESPN id
  ];
  const logos = logoDots(rows, { x: "pf", y: "pa", team: "team", league: "nfl" });
  const html = renderToString(
    <Chart
      definition={defineChart({
        marks: logos.map((d) => dot(d.data, d.options)),
        scales: { x: { scale: scaleLinear }, y: { scale: scaleLinear } },
      })}
      width={400}
      height={300}
      idPrefix="ssr"
      ariaLabel="points for and against"
      renderSvg={withPatterns(renderChartSvg, logos)}
    />,
  );
  for (const [i, d] of logos.entries()) {
    expect(html).toContain(`fill="url(#ssr-${d.options.id})"`);
    expect(html).toMatch(new RegExp(`<pattern [^>]*id="ssr-${d.options.id}"`));
    expect(d.pattern.href).toBe(logoUrlSync(["KC", "LV"][i] as string, "nfl"));
    expect(html).toContain(`href="${d.pattern.href}"`);
  }
  expect(html.match(/<circle /g)).toHaveLength(2);
});
