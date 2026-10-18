import useBaseUrl from "@docusaurus/useBaseUrl";
import { type ReactNode, useState } from "react";
import registry from "../../../packages/sdvtables/data/table_themes.json";

type Entry = {
  id: string;
  source: string;
  category: string;
  url: string;
  darkPolicy: "none" | "derived" | "native";
};

const THEMES = Object.values(registry.themes) as Entry[];
const CATEGORIES = [...new Set(THEMES.map((t) => t.category))].sort();
const MODES = ["all", "light only", "dark available", "native dark"] as const;
type ModeFilter = (typeof MODES)[number];

const keep = (t: Entry, m: ModeFilter): boolean =>
  m === "all" ||
  (m === "light only" && t.darkPolicy === "none") ||
  (m === "dark available" && t.darkPolicy !== "none") ||
  (m === "native dark" && t.darkPolicy === "native");

function Card({ t }: { t: Entry }): ReactNode {
  const [dark, setDark] = useState(false);
  const canDark = t.darkPolicy !== "none";
  const src = useBaseUrl(`/img/table-themes/${t.id}-${dark && canDark ? "dark" : "light"}.webp`);
  return (
    <figure
      style={{ margin: 0, border: "1px solid var(--ifm-color-emphasis-300)", borderRadius: 8, padding: 12 }}
    >
      <img
        src={src}
        alt={`${t.source} table theme, ${dark ? "dark" : "light"}`}
        loading="lazy"
        width={960}
        height={522}
        style={{ width: "100%", height: "auto" }}
      />
      <figcaption>
        <strong>
          <code>{t.id}</code>
        </strong>{" "}
        <a href={t.url}>{t.source}</a>
        <br />
        <small>
          {t.category}, dark: {t.darkPolicy}{" "}
          {canDark && (
            <button type="button" onClick={() => setDark(!dark)}>
              show {dark ? "light" : "dark"}
            </button>
          )}
        </small>
        <details>
          <summary>Use it</summary>
          <pre>
            <code>{`sdvtables   theme: { name: "${t.id}", options: { mode: "light" } }
Python      gt_theme_source(gt, "${t.id}")
            reactable_sdv_theme("${t.id}")
            plottable_sdv_theme("${t.id}")
            itables_sdv_theme("${t.id}")
R           gt_theme_source(gt, "${t.id}")
            reactable_sdv_theme("${t.id}")`}</code>
          </pre>
        </details>
      </figcaption>
    </figure>
  );
}

/** Filterable gallery of every theme in the cross-library registry, built from the vendored JSON at build time. */
export default function TableThemeGallery(): ReactNode {
  const [category, setCategory] = useState("all");
  const [mode, setMode] = useState<ModeFilter>("all");
  const shown = THEMES.filter((t) => (category === "all" || t.category === category) && keep(t, mode));
  return (
    <div>
      <p>
        <label>
          Category{" "}
          <select value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="all">all</option>
            {CATEGORIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </label>{" "}
        <label>
          Mode{" "}
          <select value={mode} onChange={(e) => setMode(e.target.value as ModeFilter)}>
            {MODES.map((m) => (
              <option key={m}>{m}</option>
            ))}
          </select>
        </label>{" "}
        {shown.length} of {THEMES.length} themes
      </p>
      <div style={{ display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))" }}>
        {shown.map((t) => (
          <Card key={t.id} t={t} />
        ))}
      </div>
    </div>
  );
}
