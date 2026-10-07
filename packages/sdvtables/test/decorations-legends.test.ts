import { expect, test } from "vitest";
import { defineTable } from "../src/define.js";
import { renderHTML } from "../src/html/index.js";
import { STANDINGS, type Standing } from "./fixtures/standings.js";
test("legendContinuous reads the recorded pills scale (default location bottom); explicit palette/domain override; nBins swatches at bin midpoints", () => {
  const html = renderHTML(
    defineTable<Standing>()
      .columns((c) => [c.text("team"), c.colorPills("wins", { domain: [0, 17], digits: 0 })])
      .legendContinuous({ title: "Wins", nBins: 4 })
      .build(),
    STANDINGS,
    { css: "none" },
  );
  const at = html.indexOf('<div class="sdvt-legend sdvt-legend-bottom"');
  expect(at).toBeGreaterThan(html.indexOf("</table>"));
  const legend = html.slice(at);
  expect(legend).toContain('<div class="sdvt-legend-title">Wins</div>');
  expect(legend.match(/class="sdvt-swatch"/g)?.length).toBe(4);
  // swatch b samples t = (b + 0.5) / 4 = 0.125, 0.375, 0.625, 0.875 of #c84630 → #5da271 (_layout.py:471): first = mix(…, 0.125) = #bb5238
  expect(legend).toContain("background-color:#bb5238");
  expect(legend).toContain("background-color:#6a9669");
  expect(legend).toContain(">0<");
  expect(legend).toContain(">17<");
  const own = renderHTML(
    defineTable<Standing>()
      .columns((c) => [c.text("team")])
      .legendContinuous({ palette: ["#000", "#fff"], domain: [0, 1], nBins: 2, digits: 1, location: "top" })
      .build(),
    STANDINGS,
    { css: "none" },
  );
  expect(own).toMatch(/<div class="sdvt-legend sdvt-legend-top"[^>]*>.*?<\/div><table>/s);
  expect(own).toContain(">0.0<");
  expect(own).toContain(">1.0<");
  expect(own).toContain("background-color:#404040"); // mix(#000, #fff, 0.25)
  expect(() =>
    renderHTML(
      defineTable<Standing>()
        .columns((c) => [c.text("team")])
        .legendContinuous()
        .build(),
      STANDINGS,
    ),
  ).toThrow(/no recorded scale/);
});
test("legendDiscrete key swatches; significance stars (strictest first) with note, p hidden; outliers flag by IQR; marginalia restyles", () => {
  const rows = STANDINGS.map((r, i) => ({
    ...r,
    p: [0.004, 0.03, 0.08, 0.5, 0.2, 0.01, 0.6, 0.09][i] as number,
  }));
  type R = (typeof rows)[number];
  const html = renderHTML(
    defineTable<R>()
      .columns((c) => [
        c.text("team"),
        c.num("net_epa", { digits: 3 }),
        c.num("p", { digits: 2 }),
        c.int("pf"),
        c.text("qb"),
      ])
      .legendDiscrete({ Home: "#e31837", Away: "#ffb81c" }, { shape: "circle" })
      .significance([{ estimate: "net_epa", p: "p" }])
      .outliers(["pf"], { method: "iqr", threshold: 1.0, color: "#B2182B", symbol: "†" })
      .marginalia(["qb"], { label: "Starter", width: 160 })
      .build(),
    rows,
    { css: "none" },
  );
  expect(html).toContain(
    '<span class="sdvt-swatch" style="display:inline-block;width:14px;height:14px;background-color:#e31837;border:1px solid currentColor;border-radius:50%"></span>',
  );
  expect(html).toContain("Home");
  expect(html).toContain("Away");
  expect(html).toMatch(
    /data-row="0">.*?data-col="net_epa"[^>]*>0\.071<sup style="font-size:0\.7em">\*\*\*<\/sup></s,
  );
  expect(html).toMatch(/data-row="3">.*?data-col="net_epa"[^>]*>−0\.128</s);
  expect(html).not.toContain('data-col="p"'); // hideP (Python hide_p=True, _layout.py:1303): 4 visible columns
  expect(html).toContain('<td colspan="4">*** p &lt; 0.01, ** p &lt; 0.05, * p &lt; 0.1</td>'); // levels order, strictest first (_layout.py:1367)
  // IQR of pf (type 7): q1 330.75, q3 407.75, IQR 77; high fence 407.75 + 1.0 × 77 = 484.75 → BUF 525
  expect(html).toMatch(/data-row="4">.*?data-col="pf" style="color:#B2182B;font-weight:bold">525†</s);
  // marginalia ink on #ffffff: secondaryOn(#ffffff, #000000) = #737373; hairline mix(#ffffff, #000000, 0.18) = #d1d1d1 (_layout.py:1425-1427)
  expect(html).toContain('data-col="qb" data-kind="text" style="width:160px">Starter</th>');
  expect(html).toMatch(
    /data-col="qb" style="font-style:italic;font-size:0\.92em;color:#737373;border-left:1px solid #d1d1d1;text-align:left">Patrick Mahomes</,
  );
  expect(() =>
    renderHTML(
      defineTable<R>()
        .columns((c) => [c.num("net_epa"), c.num("p")])
        .significance([{ estimate: "net_epa", p: "p" }], { levels: [0.1, 0.05, 0.01] })
        .build(),
      rows,
    ),
  ).toThrow(/ascending/);
});
