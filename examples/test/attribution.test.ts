// @vitest-environment node
import { readFileSync } from "node:fs";
import { TRADINGVIEW_NOTICE } from "@sportsdataverse/sdvplot/lightweight-charts";
import { expect, test } from "vitest";
import { abs } from "../sources.js";
import { EXAMPLES } from "../src/registry.gen.js";

test("the docs' TradingView credit is TRADINGVIEW_NOTICE, verbatim, with the link (Lightweight Charts' licence)", () => {
  const live = readFileSync(abs("docs/src/components/Live.tsx"), "utf8");
  const [name, copyright] = TRADINGVIEW_NOTICE.split("\n") as [string, string];
  const url = "https://www.tradingview.com/";
  expect(copyright.endsWith(` ${url}`)).toBe(true);
  expect(live).toContain(`<span>${name}</span>`);
  // the URL is a link on the page and plain text on a gallery card (itself a link)
  expect(live).toContain(
    `<span>${copyright.slice(0, -url.length)}{linked ? <a href={tv}>{tv}</a> : tv}</span>`,
  );
  expect(live).toContain(`const tv = "${url}";`);
});

test("every example that draws a Lightweight Charts chart carries the tag that adds the credit", () => {
  // the TSDoc examples (api/...) build options only: no chart, so no notice
  const lwc = EXAMPLES.filter((e) => e.id.startsWith("sdvplot/lightweight-charts/"));
  expect(lwc.length).toBeGreaterThan(0);
  for (const e of lwc) expect(e.tags, e.id).toContain("lightweight-charts");
});
