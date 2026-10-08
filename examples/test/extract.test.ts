import { expect, test } from "vitest";
import { codeOf, discoverSporty, docModule, extractDocExamples } from "../scripts/lib.js";

const NL = "\n";
const FENCE = "```";
const doc = (lines: string[], decl: string): string => `/**${NL}${lines.join(NL)}${NL} */${NL}${decl}${NL}`;

test("extractDocExamples handles every documented TSDoc shape", () => {
  // two blocks on one symbol, a tsx fence, a same-line caption, another tag after the fence, no space after `*`
  const src = doc(
    [
      " * Thing.",
      " * @example Caption here",
      ` * ${FENCE}ts`,
      " * a();",
      ` * ${FENCE}`,
      " *",
      " * @example",
      ` *${FENCE}tsx`,
      " *b();",
      ` *${FENCE}`,
      " * @see x",
    ],
    "export const thing = 1;",
  );
  expect(extractDocExamples(src, "t.ts")).toEqual([
    { symbol: "thing", lang: "ts", code: `a();${NL}` },
    { symbol: "thing", lang: "tsx", code: `b();${NL}` },
  ]);
});

test("an @example the extractor cannot attach is a loud error, never a silent drop", () => {
  const body = [" * @example", ` * ${FENCE}ts`, " * x();", ` * ${FENCE}`];
  expect(extractDocExamples(doc(body, "export abstract class A {}"), "a.ts")).toEqual([
    { symbol: "A", lang: "ts", code: `x();${NL}` },
  ]);
  const member = `export class B {${NL}  /**${NL}   * Does m.${NL}   * @example${NL}   * ${FENCE}ts${NL}   * y();${NL}   * ${FENCE}${NL}   */${NL}  m(): void {}${NL}}${NL}`;
  expect(() => extractDocExamples(member, "b.ts")).toThrow('b.ts: @example in the doc comment "Does m."');
  expect(() => extractDocExamples(doc([" * Hi.", ...body], "export { z };"), "c.ts")).toThrow(
    'c.ts: @example in the doc comment "Hi."',
  );
});

test("the Task 9 authoring template round-trips into an example module", () => {
  const src = doc(
    [
      " * Resolve team values (abbreviations, ids, names) to ESPN team ids, loading the league first.",
      " * Unknown values give `undefined` and one warning per call; `strict: true` throws `UnresolvedTeamError`.",
      " *",
      " * @example",
      ` * ${FENCE}ts`,
      ' * import { resolve } from "@sportsdataverse/sdvplot";',
      " *",
      ' * await resolve(["KC", "Kansas City Chiefs", "OAK"], "nfl", { season: 2019 });',
      ` * ${FENCE}`,
    ],
    "export async function resolve<T extends Value | readonly Value[]>(",
  );
  const [ex] = extractDocExamples(src, "resolve.ts");
  if (ex === undefined) throw new Error("template not extracted");
  expect(ex.symbol).toBe("resolve");
  const text = docModule({ ...ex, from: "resolve.ts", contract: "./contract.js" });
  expect(text).toContain(
    'export default await resolve(["KC", "Kansas City Chiefs", "OAK"], "nfl", { season: 2019 });',
  );
  expect(codeOf(text, "gen.ts")).toBe(ex.code);
});

test("discoverSporty reads leagues minus custom and dispatches only sports with a surface() case", () => {
  const r = discoverSporty(
    {
      hockey: 'export const HOCKEY_LEAGUES = ["ahl","custom","nhl"] as const;',
      soccer: 'export const SOCCER_LEAGUES = ["custom","epl"] as const;',
    },
    'switch (s) { case "hockey": return 1; default: throw 0; }',
  );
  expect(r.all).toEqual({ hockey: ["ahl", "nhl"], soccer: ["epl"] });
  expect(r.dispatched).toEqual({ hockey: ["ahl", "nhl"] });
});
