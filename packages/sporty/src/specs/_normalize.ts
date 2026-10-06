export const asArray = <T>(v: T | readonly T[] | undefined, fallback: readonly T[] = []): readonly T[] => v === undefined ? fallback : Array.isArray(v) ? (v as readonly T[]) : [v as T];
export const or = <T>(v: T | undefined | null, fallback: T): T => (v === undefined || v === null ? fallback : v);   // R `%or%`
