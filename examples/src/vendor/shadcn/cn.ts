/**
 * The class-name join chart.tsx imports as `cn`: strings, and objects whose truthy keys are taken, as clsx does.
 * ponytail: no merging of conflicting Tailwind classes (the `cn` package shadcn imports does that): the docs have no
 * Tailwind.
 */
export function cn(...parts: (string | false | null | undefined | Record<string, boolean>)[]): string {
  return parts
    .flatMap((p) => (typeof p === "object" && p !== null ? Object.keys(p).filter((k) => p[k]) : p ? [p] : []))
    .join(" ");
}
