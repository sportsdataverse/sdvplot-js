import { describe, expect, it } from "vitest";
import reg from "../data/table_themes.json" with { type: "json" };
import { TableSpecError } from "../src/errors.js";
import { THEMES, resolveTheme } from "../src/themes/index.js";
import { listTableThemes, registryTheme } from "../src/themes/registry.js";

type Spec = {
  category: string;
  darkPolicy: string;
  light: Record<string, string>;
  dark: Record<string, string> | null;
  structure: Record<string, string>;
};
const themes = reg.themes as unknown as Record<string, Spec>;
const ref = (name: string, mode?: "light" | "dark") => ({
  name,
  density: "comfortable" as const,
  ...(mode ? { options: { mode } } : {}),
});

describe("registry themes resolve", () => {
  it("datagolf dark uses the JSON dark bg", () => {
    expect(resolveTheme(ref("datagolf", "dark")).tokens.bg).toBe(themes.datagolf?.dark?.bg);
  });
  it("wikipedia: tableBorderX carries the colRule colour", () => {
    const s = themes.wikipedia as Spec;
    expect(resolveTheme(ref("wikipedia")).tokens.tableBorderX).toContain(s.light.hline);
    expect(s.structure.colRule).toContain("{hline}");
  });
  it("never emits a literal {key}", () => {
    for (const id of Object.keys(themes)) {
      const t = registryTheme(ref(id)).tokens;
      expect(JSON.stringify(t), id).not.toMatch(/\{\w+\}/);
    }
  });
  it("light-only theme + dark throws naming it and 3 same-category dark ids", () => {
    const cat = (themes.nejm as Spec).category;
    const expected = Object.keys(themes)
      .filter((k) => (themes[k] as Spec).category === cat && (themes[k] as Spec).darkPolicy !== "none")
      .sort()
      .slice(0, 3);
    let err: unknown;
    try {
      resolveTheme(ref("nejm", "dark"));
    } catch (e) {
      err = e;
    }
    expect(err).toBeInstanceOf(TableSpecError);
    const m = (err as Error).message;
    expect(m).toMatch(/nejm/);
    expect(m).toMatch(/light-only/);
    for (const id of expected) expect(m).toContain(id);
  });
  it("house themes win", () => {
    expect(resolveTheme(ref("almanac")).name).toBe("almanac");
    expect(THEMES.almanac).toBeDefined();
  });
  it("listTableThemes filters", () => {
    const n = Object.values(themes).filter((s) => s.darkPolicy !== "none").length;
    expect(listTableThemes({ mode: "dark" }).length).toBe(n);
    expect(listTableThemes().length).toBe(reg.count);
    expect(listTableThemes({ category: "journal" }).every((r) => r.category === "journal")).toBe(true);
  });
  it("unknown theme still errors", () => {
    expect(() => resolveTheme(ref("datagolff"))).toThrow(TableSpecError);
  });
});
