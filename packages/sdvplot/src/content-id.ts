/** FNV-1a: an id that is a function of the content it names, stable across SSR, hydration and prerender. */
export function contentId(prefix: string, text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 0x01000193);
  return `${prefix}-${(h >>> 0).toString(36)}`;
}
