import { readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";
import ts from "typescript";
import { expect, test } from "vitest";
import { abs } from "../sources.js";
import { BKN_SHOTS_2026, NBA_SHOTS, STANDINGS } from "../src/data.js";

/**
 * Real data, never invented rows. An example takes its rows from `@sportsdataverse/examples/data`, where
 * sample-data.test.ts checks every row against a committed capture. This fails when an example module types its own
 * table, an array literal of two or more objects carrying a data-looking key, without importing that module.
 * ponytail: a key-name heuristic. A table under other key names, or as arrays of arrays, gets past it; add the key here.
 */
const DATA_KEYS = new Set([
  "team",
  "team_id",
  "abbreviation",
  "abbr",
  "player",
  "x",
  "y",
  "x_legacy",
  "y_legacy",
  "wins",
  "losses",
  "ties",
  "ot_losses",
  "points",
  "pts",
  "pf",
  "pa",
  "score",
  "goals",
  "shots",
  "epa",
  "net_epa",
  "wp",
  "home_wp",
  "win_pct",
  "yardline",
  "lateral",
  "tier_no",
  "rank",
  "season",
  "made",
]);
const DATA_MODULE = "@sportsdataverse/examples/data";

/** Hand-written modules whose literal rows are not data, with the reason. */
const ALLOW: Readonly<Record<string, string>> = {
  "sdvplot/core/logo-eras.ts":
    "each row is a season and sdvplot's own logo URL for it: what to draw, not a measurement",
  "sporty/frames/bottom-left.ts":
    "pitch landmarks computed from SOCCER_SPECS (corner flag, centre spot, penalty mark)",
  "sporty/plot/surface-mark.ts": "rule-book landmarks: the rubber 60.5 ft from home plate, bases 90 ft apart",
};

/**
 * Package TSDoc @example blocks, generated into src/generated/api: a reader copies them, so they cannot import the
 * examples' data module. Each of their rows must instead be a real row: a captured shot (NBA_SHOTS) or a release
 * shot (BKN_SHOTS_2026), every value of the row that shot's, or a 2024 team whose every other value is its STANDINGS
 * value. A tier_no must be the tier of that team's 2024 wins (13 or more,
 * 8 to 12, fewer: the tiers sdvplot/plot/nfl-team-tiers draws).
 */
function isReal(row: Record<string, unknown>): boolean {
  if ("x_legacy" in row)
    return [...NBA_SHOTS, ...BKN_SHOTS_2026].some((s) =>
      Object.entries(row).every(([k, v]) => (s as Record<string, unknown>)[k] === v),
    );
  const s = STANDINGS.find((t) => t.team === row.team);
  if (s === undefined) return false;
  return Object.entries(row).every(([k, v]) =>
    k === "tier_no" ? v === (s.wins >= 13 ? 1 : s.wins >= 8 ? 2 : 3) : s[k as keyof typeof s] === v,
  );
}

const files = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((f) =>
    f.isDirectory() ? files(join(dir, f.name)) : /\.tsx?$/.test(f.name) ? [join(dir, f.name)] : [],
  );

/** A literal property value (string, number, negative number, boolean); anything else is `undefined`. */
function literal(e: ts.Expression): unknown {
  if (ts.isStringLiteral(e) || ts.isNoSubstitutionTemplateLiteral(e)) return e.text;
  if (ts.isNumericLiteral(e)) return Number(e.text);
  if (
    ts.isPrefixUnaryExpression(e) &&
    e.operator === ts.SyntaxKind.MinusToken &&
    ts.isNumericLiteral(e.operand)
  )
    return -Number(e.operand.text);
  if (e.kind === ts.SyntaxKind.TrueKeyword) return true;
  if (e.kind === ts.SyntaxKind.FalseKeyword) return false;
  return undefined;
}

/** Every array literal of two or more objects with a data-looking key: its line and its rows' literal values. */
function inlineTables(sf: ts.SourceFile): { line: number; rows: Record<string, unknown>[] }[] {
  const out: { line: number; rows: Record<string, unknown>[] }[] = [];
  const visit = (n: ts.Node): void => {
    if (ts.isArrayLiteralExpression(n)) {
      const objs = n.elements.filter(ts.isObjectLiteralExpression);
      const rows = objs.map((o) =>
        Object.fromEntries(
          o.properties.flatMap((p) =>
            ts.isPropertyAssignment(p) && (ts.isIdentifier(p.name) || ts.isStringLiteral(p.name))
              ? [[p.name.text, literal(p.initializer)]]
              : [],
          ),
        ),
      );
      if (objs.length >= 2 && rows.some((r) => Object.keys(r).some((k) => DATA_KEYS.has(k))))
        out.push({ line: sf.getLineAndCharacterOfPosition(n.getStart()).line + 1, rows });
    }
    ts.forEachChild(n, visit);
  };
  visit(sf);
  return out;
}

test("no example types its own table of rows: it imports @sportsdataverse/examples/data", () => {
  const src = abs("examples/src");
  const skip = new Set(["data.ts", "contract.ts"]); // the data module itself, and types
  const offenders: string[] = [];
  let checked = 0;
  let scanned = 0;
  for (const f of files(src)) {
    const rel = relative(src, f).replace(/\\/g, "/");
    if (skip.has(rel) || rel.endsWith(".gen.ts")) continue;
    scanned++;
    const sf = ts.createSourceFile(f, readFileSync(f, "utf8"), ts.ScriptTarget.Latest, true);
    const tables = inlineTables(sf);
    if (tables.length === 0 || rel in ALLOW) continue;
    const imports = sf.statements.flatMap((s) =>
      ts.isImportDeclaration(s) && ts.isStringLiteral(s.moduleSpecifier) ? [s.moduleSpecifier.text] : [],
    );
    if (imports.includes(DATA_MODULE)) continue;
    if (rel.startsWith("generated/api/")) {
      checked++;
      for (const t of tables)
        for (const r of t.rows)
          if (!isReal(r)) offenders.push(`${rel}:${t.line} not a real row: ${JSON.stringify(r)}`);
    } else offenders.push(`${rel}:${tables.map((t) => t.line).join(",")}`);
  }
  expect(scanned).toBeGreaterThan(200); // the generated examples are present (global-setup writes them)
  expect(checked).toBeGreaterThan(0); // the TSDoc rows are checked, not skipped
  expect(offenders).toEqual([]);
});

test("the allowlist names only modules that exist and still hold a literal table", () => {
  const src = abs("examples/src");
  for (const rel of Object.keys(ALLOW)) {
    const sf = ts.createSourceFile(rel, readFileSync(join(src, rel), "utf8"), ts.ScriptTarget.Latest, true);
    expect(inlineTables(sf).length, rel).toBeGreaterThan(0);
  }
});
