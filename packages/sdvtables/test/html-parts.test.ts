import { preloadAll, resetWarnings, setWarningHandler } from "@sportsdataverse/sdvplot";
import { beforeAll, expect, test } from "vitest";
import { defineTable } from "../src/define.js";
import { TableSpecError } from "../src/errors.js";
import { escapeHtml } from "../src/html/escape.js";
import { renderHTML } from "../src/html/index.js";
import { assemble, attrsText, fontsLinkFor, renderParts, tableHTML } from "../src/html/parts.js";
import { rows, spec } from "./fixtures/engine.js";
import { STANDINGS, type Standing } from "./fixtures/standings.js";

beforeAll(async () => {
  setWarningHandler(() => {});
  await preloadAll();
});

test("renderHTML is exactly assemble(renderParts(...))", () => {
  expect(assemble(renderParts(spec, rows))).toBe(renderHTML(spec, rows));
  expect(assemble(renderParts(spec, rows, { css: "none" }))).toBe(renderHTML(spec, rows, { css: "none" }));
});
test("parts: unescaped wrapper attrs in order, link separable, tableHTML is the <table> block", () => {
  const p = renderParts(spec, rows);
  expect(Object.keys(p.wrapperAttrs)).toEqual(["class", "id", "data-sdvt-theme", "data-sdvt-density"]);
  expect(p.wrapperAttrs.class).toMatch(/^sdvt sdvt-theme-sdv sdvt-t-[0-9a-f]{8}$/); // Phase 4: name class + themeKey class
  expect(p.wrapperAttrs).toMatchObject({ "data-sdvt-theme": "sdv", "data-sdvt-density": "compact" });
  expect(p.id).toMatch(/^sdvt-[0-9a-f]{8}$/);
  expect(renderParts(spec, rows, { fonts: false }).link).toBe("");
  expect(fontsLinkFor(spec)).toBe(p.link);
  expect(tableHTML(p)).toMatch(/^<table>.*<\/table>$/s);
  expect(attrsText({ class: "a", title: `x"<y>` })).toBe(` class="a" title="x&quot;&lt;y&gt;"`);
});
test("interactive opts: aria-sort + sort button on sortable columns only; hidden drops a column", () => {
  const p = renderParts(spec, rows, {
    interactive: true,
    sort: { col: "wins", dir: "desc" },
    hidden: ["net_epa"],
  });
  expect(p.head).toContain(
    '<th scope="col" class="sdvt-label sdvt-right" data-col="wins" data-kind="int" aria-sort="descending"><button type="button" class="sdvt-sort" data-sdv-sort="wins">Wins</button></th>',
  );
  expect(p.head).toContain('data-col="team" data-kind="text"><button'); // M4: aria-sort only on the sorted header
  expect(p.head).toContain(
    '<th scope="col" class="sdvt-label sdvt-left" data-col="qb" data-kind="text">Quarterback</th>',
  );
  expect(p.head).not.toContain('data-col="net_epa"');
  expect(p.rows).not.toContain('data-col="net_epa"');
  expect(renderParts(spec, rows).head).not.toContain("aria-sort");
});
test("apostrophes escape as &#x27; (React's form)", () => {
  expect(escapeHtml("O'Neal")).toBe("O&#x27;Neal");
  const p = renderParts(spec, [STANDINGS[3] as Standing]); // Aidan O'Connell
  expect(p.rows).toContain("Aidan O&#x27;Connell");
});

// I1: zero rows used to throw in domainOf for any domain-less colorPills/colorRanks column
const scaled = defineTable<Standing>()
  .columns((c) => [c.text("team"), c.colorPills("wins", { digits: 0 }), c.colorRanks("srs_rank")])
  .legendContinuous({ title: "SRS" })
  .build();
test("zero rows: fontsLinkFor and renderParts(spec, []) do not throw on domain-less pills/ranks; no legend without a domain", () => {
  expect(fontsLinkFor(scaled)).toBe(renderParts(scaled, STANDINGS).link);
  const empty = renderParts(scaled, []);
  expect(empty.rows).toBe("");
  expect(empty.after).not.toContain("sdvt-legend"); // the recorded scale (srs_rank) has no domain yet
  expect(renderParts(scaled, STANDINGS).after).toContain("sdvt-legend");
  // Phase 4's throw for an all-null column in a NON-empty table stays
  const allNull = defineTable<Standing>()
    .columns((c) => [c.colorPills("net_epa")])
    .build();
  expect(() => renderHTML(allNull, [STANDINGS[7] as Standing])).toThrow(/no numeric value/);
});
test("zero rows: a continuous legend renders when its domain does not need data, no-ops when it does, throws with no source", () => {
  const T = defineTable<Standing>().columns((c) => [c.text("team"), c.colorPills("wins", { digits: 0 })]);
  expect(
    renderParts(T.legendContinuous({ domain: [0, 1], palette: ["#000", "#fff"] }).build(), []).after,
  ).toContain("sdvt-legend");
  const withDomain = defineTable<Standing>()
    .columns((c) => [c.colorPills("wins", { domain: [0, 17], digits: 0 })])
    .legendContinuous()
    .build();
  expect(renderParts(withDomain, []).after).toContain("sdvt-legend"); // recorded scale has an explicit domain
  expect(renderParts(T.legendContinuous({ columns: ["wins"] }).build(), []).after).toBe("");
  const noSource = defineTable<Standing>()
    .columns((c) => [c.text("team")])
    .legendContinuous()
    .build();
  expect(() => renderParts(noSource, [])).toThrow(/no recorded scale/);
});
test("domainRows is matched by identity: equal copies render from their own values and warn once per column", () => {
  const S = defineTable<Standing>()
    .columns((c) => [
      c.colorPills("wins", { digits: 0 }),
      c.colorRanks("srs_rank"),
      c.percentileBar("pf", { domain: [0, 600] }),
    ])
    .build();
  const copies = STANDINGS.map((r) => ({ ...r }));
  const msgs: string[] = [];
  resetWarnings();
  setWarningHandler((m) => msgs.push(m));
  try {
    const p = renderParts(S, copies, { domainRows: STANDINGS });
    renderParts(S, copies, { domainRows: STANDINGS });
    expect(p.rows).toBe(renderParts(S, STANDINGS).rows);
  } finally {
    setWarningHandler(() => {});
  }
  const seen = msgs.filter((m) => m.includes("not in domainRows"));
  expect(seen).toHaveLength(3);
  for (const k of ["wins", "srs_rank", "pf"])
    expect(seen.filter((m) => m.startsWith(`column "${k}"`))).toHaveLength(1);
});
test("hidden: an unknown key throws naming it; hiding every column keeps every colspan >= 1", () => {
  expect(() => renderParts(spec, rows, { hidden: ["nope"] })).toThrow(TableSpecError);
  expect(() => renderParts(spec, rows, { hidden: ["wins", "nope"] })).toThrow(/"nope"/);
  const g = defineTable<Standing>()
    .columns((c) => [c.text("team"), c.int("wins")])
    .groupBy("division")
    .sourceNote("Source: test")
    .build();
  const p = renderParts(g, STANDINGS, { hidden: ["team", "wins"] });
  expect(p.head).toBe("");
  expect(tableHTML(p)).not.toContain('colspan="0"');
  expect(p.rows).toContain('<th scope="rowgroup" colspan="1" class="sdvt-group">');
  expect(p.foot).toContain('<td colspan="1">');
  expect(p.rows.match(/<tr class="sdvt-row/g)).toHaveLength(STANDINGS.length);
});
