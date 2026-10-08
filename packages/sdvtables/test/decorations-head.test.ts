import { expect, test } from "vitest";
import { defineTable } from "../src/define.js";
import { renderHTML } from "../src/html/index.js";
import { SOCIAL_ICONS } from "../src/html/social-icons.js";
import { STANDINGS, type Standing } from "./fixtures/standings.js";
const T = defineTable<Standing>().columns((c) => [c.text("team"), c.int("pf")]);
test("titleHeader: kicker, title, subtitle, date in one caption; styles escaped", () => {
  const html = renderHTML(
    T.titleHeader("AFC standings", {
      kicker: "NFL · 2024",
      subtitle: "Final",
      date: "2025-01-06",
      kickerStyle: { color: "#e31837", transform: "uppercase" },
    }).build(),
    STANDINGS,
    { css: "none" },
  );
  expect(html).toContain(
    '<caption><div class="sdvt-kicker" style="color:#e31837;text-transform:uppercase">NFL · 2024</div><span class="sdvt-title">AFC standings</span><span class="sdvt-subtitle">Final</span><div class="sdvt-date">2025-01-06</div></caption>',
  );
  expect(html).toContain("sdvt-kicker{font-size:0.75em;font-weight:700;color:#C84630"); // Python's kicker defaults (_layout.py:121)
});
test("caption538: two notes, rule + size on the top one, align on the bottom (Python); socialTag icons + caption; scaleNote divides and notes", () => {
  const html = renderHTML(
    T.caption538({ top: "Source: nflverse", bottom: "Table: @SportsDataverse", ruleColor: "#000" })
      .socialTag({ x: "SportsDataverse", gh: "sportsdataverse" })
      .scaleNote(["pf"], { divisor: 10, decimals: 1 })
      .build(),
    STANDINGS.slice(0, 1),
    { css: "none" },
  );
  // _cells.py:526-531: top = border-bottom + font-size, bottom = text-align
  expect(html).toContain(
    '<tfoot><tr><td colspan="2"><div class="sdvt-cap538" style="border-bottom:1px solid #000;font-size:12px">Source: nflverse</div></td></tr><tr><td colspan="2"><div class="sdvt-cap538" style="text-align:right">Table: @SportsDataverse</div></td></tr>',
  );
  // each icon keeps its own Font Awesome viewBox (x-twitter 512 wide, github 496); the style is inserted right after "<svg "
  expect(html).toMatch(
    /<div class="sdvt-social" style="text-align:right"><span class="sdvt-handle"><svg style="height:0\.9em;vertical-align:-0\.125em;fill:currentColor" xmlns="http:\/\/www\.w3\.org\/2000\/svg" viewBox="0 0 512 512"><path d="[^"]+"\/><\/svg>SportsDataverse<\/span> \| <span class="sdvt-handle"><svg [^>]*viewBox="0 0 496 512"><path d="[^"]+"\/><\/svg>sportsdataverse<\/span><\/div>/,
  );
  // 10 has no name in Python _SCALE_NAMES (_layout.py:1442-1447): "Figures divided by 10."; pf 385 / 10 at decimals 1
  expect(html).toContain('<td colspan="2">Figures divided by 10.</td>');
  expect(html).toMatch(/data-col="pf">38\.5</);
  const label = renderHTML(
    T.scaleNote(["pf"], { divisor: 1000, where: "label" }).build(),
    STANDINGS.slice(0, 1),
    {
      css: "none",
    },
  );
  expect(label).toContain('data-kind="int">Pf (000s)</th>');
  expect(label).not.toContain("<tfoot>");
  const both = renderHTML(
    T.scaleNote(["pf"], { divisor: 2500, where: "both" }).build(),
    STANDINGS.slice(0, 1),
    {
      css: "none",
    },
  );
  expect(both).toContain("Pf (÷2,500)</th>");
  expect(both).toContain("Figures divided by 2,500.");
  expect(() => renderHTML(T.socialTag({ tiktok: "x" }).build(), STANDINGS)).toThrow(/tiktok/);
  expect(() => renderHTML(T.caption538({ top: "x", align: "middle" as never }).build(), STANDINGS)).toThrow(
    /left, center or right/,
  );
});
test("social icons keep the viewBox width of their Font Awesome 6 source", () => {
  const widths = Object.fromEntries(
    Object.entries(SOCIAL_ICONS).map(([k, v]) => [k, /viewBox="0 0 (\d+) 512"/.exec(v)?.[1]]),
  );
  expect(widths).toMatchObject({
    x: "512",
    ig: "448",
    bsky: "512",
    gh: "496",
    yt: "576",
    fb: "512",
    web: "512",
    email: "512",
  });
  expect(SOCIAL_ICONS.twitter).toBe(SOCIAL_ICONS.x);
});
test("borderBars (Python _bars): stacked bars outside the table, or one flex bar holding text + image; watermark css; font decoration", () => {
  const html = renderHTML(
    T.borderBars("top", ["#e31837", "#ffb81c"], { text: "Chiefs", img: "https://example.invalid/kc.png" })
      .borderBars("bottom", ["#000", "#fff"])
      .watermark({ text: "DRAFT", angle: -30 })
      .font("Inter", { weight: 600 })
      .build(),
    STANDINGS,
  );
  expect(html).toMatch(
    /<div class="sdvt sdvt-theme-sdv [^"]*"[^>]*><style>.*?<\/style><div class="sdvt-bars sdvt-bars-top"/s,
  );
  // text/img given: ONE bar in the first color (_cells.py:560 "only the first is used with text or img")
  expect(html).toContain(
    '<div class="sdvt-bars-row" style="display:flex;justify-content:space-between;align-items:center;height:10px;background-color:#e31837;width:100%;margin-left:auto;margin-right:auto">',
  );
  expect(html).not.toContain("#ffb81c");
  expect(html).toContain(
    '<span class="sdvt-bars-text" style="font-weight:bold;color:#FFFFFF;font-size:18px;padding-left:10px;font-family:inherit">Chiefs</span>',
  );
  expect(html).toContain(
    '<img class="sdvt-bars-img" src="https://example.invalid/kc.png" alt="" style="width:30px;height:30px;padding-right:10px">',
  );
  expect(html).toMatch(/<\/table><div class="sdvt-bars sdvt-bars-bottom"/);
  expect(html).toContain(
    '<div class="sdvt-bars-box" style="background-color:transparent;width:100%;margin-left:auto;margin-right:auto"><div class="sdvt-bar" style="height:10px;background-color:#000"></div><div class="sdvt-bar" style="height:10px;background-color:#fff"></div></div>',
  );
  expect(html).toContain('tbody{background-image:url("data:image/svg+xml,');
  expect(html).toContain("background-size:60% auto");
  // decode only the data URI: the page itself holds bare % (width:100%, background-size:60%), which decodeURIComponent rejects
  const svg = decodeURIComponent(/url\("data:image\/svg\+xml,([^"]+)"\)/.exec(html)?.[1] ?? "");
  // Python _watermark_svg (_layout.py:251): 5 chars → 310 × 130 box, rotated 30° → 338 × 272, centred
  expect(svg).toContain('viewBox="0 0 338 272"');
  expect(svg).toContain('transform="rotate(-30 169 136)"');
  expect(svg).toContain('fill-opacity="0.06"');
  expect(svg).toContain(">DRAFT</text>");
  expect(html).toContain("family=Inter:wght@600");
  expect(html).toContain("--sdvt-font-body:'Inter',");
  expect(html).toContain("--sdvt-font-label:'Inter',");
});
test("hostile strings cannot close the style element or break the font stack", () => {
  const html = renderHTML(T.watermark({ image: 'x"</style><script>1</script>' }).build(), STANDINGS);
  expect(html).not.toContain("</style><script>");
  expect(() => renderHTML(T.font("a'}</style>").build(), STANDINGS)).toThrow(/font family/);
  expect(() => renderHTML(T.watermark({}).build(), STANDINGS)).toThrow(/exactly one/);
});
