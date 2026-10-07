import type { GoogleFont } from "../themes/tokens.js";
export function fontsLink(fonts: readonly GoogleFont[]): string {
  const byFamily = new Map<string, Set<number>>();
  for (const f of fonts) {
    const set = byFamily.get(f.family) ?? new Set<number>();
    for (const w of f.weights) set.add(w);
    byFamily.set(f.family, set);
  }
  if (byFamily.size === 0) return "";
  const q = [...byFamily.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(
      ([fam, ws]) =>
        `family=${encodeURIComponent(fam).replace(/%20/g, "+")}:wght@${[...ws].sort((a, b) => a - b).join(";")}`,
    )
    .join("&amp;");
  return `<link rel="stylesheet" href="https://fonts.googleapis.com/css2?${q}&amp;display=swap">`;
}
