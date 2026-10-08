// Pointer helpers for Plot's tip / pointer under jsdom (test-only).
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * jsdom has no SVG text metrics. Plot measures a tip with `getBBox` once the tip is SHOWN (never at render), so a test
 * that moves the pointer needs this stub; without it jsdom throws asynchronously ("Unhandled errors").
 */
export function stubBBox(): void {
  const proto = SVGElement.prototype as unknown as { getBBox?: () => DOMRect };
  proto.getBBox ??= () => ({ x: 0, y: 0, width: 0, height: 0 }) as DOMRect;
}
/** A pointer move in svg pixels: jsdom's d3.pointer falls back to clientX/clientY (no getScreenCTM). */
export function pointAt(svg: Element, x: number, y: number): void {
  svg.dispatchEvent(new MouseEvent("pointermove", { clientX: x, clientY: y, bubbles: true }));
}
/** The text of every tip line currently shown. */
export function tipText(root: Element): string {
  return Array.from(root.querySelectorAll("g[aria-label=tip] tspan"))
    .map((t) => t.textContent)
    .join(" ");
}
/** The centre of a drawn `<image>`. */
export function centreOf(img: Element): [number, number] {
  const n = (k: string): number => Number(img.getAttribute(k));
  return [n("x") + n("width") / 2, n("y") + n("height") / 2];
}

export interface TeamEpa {
  team: string;
  off: number;
  def: number;
  net: number;
}
/**
 * The 32 NFL teams' 2024 offensive and defensive EPA per rush or pass play: nflverse play_by_play_2024, regular season,
 * as committed in fixtures/examples/nfl_epa_2024_reg.csv by tools/sample-data/nfl_2024.py.
 */
export function teamEpa2024(): TeamEpa[] {
  const file = join(fileURLToPath(import.meta.url), "../../../../../fixtures/examples/nfl_epa_2024_reg.csv");
  return readFileSync(file, "utf8")
    .trim()
    .split(/\r?\n/)
    .slice(1)
    .map((line) => {
      const [team, offPlays, offEpa, defPlays, defEpa] = line.split(",");
      const off = Number(offEpa) / Number(offPlays);
      const def = Number(defEpa) / Number(defPlays);
      return { team: String(team), off, def, net: off - def };
    });
}
