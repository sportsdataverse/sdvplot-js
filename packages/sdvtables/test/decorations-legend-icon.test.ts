import { expect, test } from "vitest";
import { defineTable } from "../src/define.js";
import { renderHTML } from "../src/html/index.js";
import { LEGEND_ICON_SETS, legendIconSvg } from "../src/html/legend-icon.js";
import { STANDINGS, type Standing } from "./fixtures/standings.js";

const render = (o: Parameters<ReturnType<typeof defineTable<Standing>>["legendIcon"]>[0]) =>
  renderHTML(
    defineTable<Standing>()
      .columns((c) => [c.text("team"), c.int("wins")])
      .legendIcon(o)
      .build(),
    STANDINGS,
    { css: "none" },
  );

test("legendIcon presets are reactablefmtr add_icon_legend's (colours, labels), right-aligned below the table", () => {
  const html = render({ iconSet: "ski rating", title: "Trail", footer: "Source: resort" });
  const at = html.indexOf('<div class="sdvt-legend sdvt-legend-icon sdvt-legend-bottom"');
  expect(at).toBeGreaterThan(html.indexOf("</table>"));
  const legend = html.slice(at);
  expect(legend).toContain("text-align:right");
  expect(legend).toContain("justify-content:flex-end");
  expect(legend).toContain(">Trail</div>");
  expect(legend).toContain(">Source: resort</div>");
  for (const [, color, label] of LEGEND_ICON_SETS["ski rating"]) {
    expect(legend).toContain(`color:${color}`);
    expect(legend).toContain(`</svg>${label}</span>`);
  }
  expect(legend.match(/<svg class="sdvt-legend-icon"/g)?.length).toBe(4);
  expect(legend).toContain('viewBox="0 0 30 16" width="30" height="16"'); // most difficult: two diamonds
  expect(LEGEND_ICON_SETS.medals.map((x) => x[1])).toEqual(["#A77044", "#D7D7D7", "#D6AF36"]);
  expect(LEGEND_ICON_SETS.batteries.map((x) => x[2])).toEqual(["0-25%", "25-50%", "50-75%", "75-100%"]);
});

test("legendIcon: renamed preset labels, custom icons with recycled colours, top + left, hidden labels stay accessible", () => {
  expect(render({ iconSet: "medals", labels: ["3rd", "2nd", "1st"] })).toContain("</svg>1st</span>");
  const html = render({
    icons: ["triangle-up", "triangle-down", "circle"],
    colors: ["#1a9641", "#d7191c"],
    labels: ["Up", "Down", "Same"],
    location: "top",
    align: "left",
    showLabels: false,
    iconSize: 20,
  });
  const at = html.indexOf("sdvt-legend-top");
  expect(at).toBeGreaterThan(-1);
  expect(at).toBeLessThan(html.indexOf("<table"));
  expect(html).toContain("justify-content:flex-start");
  expect(html).toContain('role="img" aria-label="Down"');
  expect(html).not.toContain("</svg>Down");
  expect(html.match(/color:#1a9641/g)?.length).toBe(2); // the third icon reuses the first colour
  expect(html).toContain('width="20" height="20" aria-hidden="true"');
});

test("legendIcon without visible labels needs none: each shape names itself", () => {
  const html = render({ icons: ["double-diamond"], showLabels: false });
  expect(html).toContain('role="img" aria-label="double diamond"');
});

test("legendIcon validates its arguments", () => {
  expect(() => render({})).toThrow(/iconSet or icons/);
  expect(() => render({ iconSet: "flags" as never })).toThrow(/ski rating/);
  expect(() => render({ iconSet: "medals", labels: ["a"] })).toThrow(/needs 3 labels/);
  expect(() => render({ icons: ["circle"], labels: ["a", "b"] })).toThrow(/one label per icon/);
  expect(() => render({ icons: ["circle"] })).toThrow(/need labels when showLabels/);
  expect(() => render({ iconSet: "medals", icons: ["circle"], labels: ["a"] })).toThrow(/not both/);
  // inherited Object members are not presets or shapes
  expect(() => render({ iconSet: "toString" as never })).toThrow(/ski rating/);
  expect(() => render({ icons: ["constructor" as never], labels: ["a"] })).toThrow(/icon must be one of/);
  expect(() => render({ icons: ["star" as never], labels: ["a"] })).toThrow(/icon must be one of/);
  expect(() => render({ iconSet: "medals", align: "center" as never })).toThrow(/left or right/);
  expect(() => render({ iconSet: "medals", iconSize: -1 })).toThrow(/positive/);
  expect(() => legendIconSvg("circle", "red;background:url(x)", 16)).toThrow();
});
