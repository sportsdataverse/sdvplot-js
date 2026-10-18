import { listTableThemes, registryTheme } from "@sportsdataverse/sdvtables";
import type { ExampleMeta } from "../../contract.js";

export const meta = {
  title: "Source-named themes: list and resolve",
  tags: ["theme", "listTableThemes", "registryTheme"],
} satisfies ExampleMeta;

// 122 themes named after the table they are styled on. Filter by category, or by dark support.
const sportsDark = listTableThemes({ category: "sports", mode: "dark" });
const datagolf = registryTheme({ name: "datagolf", density: "comfortable", options: { mode: "dark" } });
const { bg, text, accent, rule } = datagolf.tokens;

export default {
  "all themes": listTableThemes().length,
  "sports themes with a dark mode": sportsDark.length,
  "first three": sportsDark.slice(0, 3),
  "datagolf dark colour tokens": { bg, text, accent, rule },
  "datagolf fonts": datagolf.fonts.map((f) => f.family),
};
