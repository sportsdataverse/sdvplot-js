/** Round half to even, as Python :.0f formats. */
export const halfEven = (x: number): string => {
  const r = Math.round(x);
  return String(Math.abs(x % 1) === 0.5 && r % 2 !== 0 ? r - 1 : r);
};
/** Python _cutline_svg (_cells.py:806-817) byte for byte: uppercase label, `quote(svg, safe="")`, `;charset=utf-8`. */
export function cutlineSvg(text: string, color: string, size: number): string {
  const t = text.toUpperCase();
  const tracking = 1.1;
  const esc = t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${halfEven(t.length * (size * 0.8 + tracking) + 4)}" height="${halfEven(size + 4)}"><text x="0" y="${(size + 0.5).toFixed(1)}" font-family="Helvetica,Arial,sans-serif" font-size="${size}" font-weight="700" letter-spacing="${tracking}" fill="${color}">${esc}</text></svg>`;
  return `data:image/svg+xml;charset=utf-8,${pyQuote(svg)}`;
}
/** Python `urllib.parse.quote(s, safe="")`: encodeURIComponent also leaves `!'()*` alone. */
export const pyQuote = (x: string): string =>
  encodeURIComponent(x).replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
/** Python _watermark_svg (_layout.py:251-268): returns the data URI and whether the rotated box is taller than wide. */
export function watermarkSvg(
  text: string,
  color: string,
  opacity: number,
  angle: number,
  font: string,
): [string, boolean] {
  const label = text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const size = 100;
  const textW = Math.max(label.length * size * 0.62, size);
  const textH = size * 1.3;
  const rad = (Math.abs(angle) * Math.PI) / 180;
  const w = Math.ceil(textW * Math.cos(rad) + textH * Math.sin(rad)) + 4;
  const h = Math.ceil(textW * Math.sin(rad) + textH * Math.cos(rad)) + 4;
  const rot = angle !== 0 ? ` transform="rotate(${angle} ${w / 2} ${h / 2})"` : "";
  const attr = (v: string): string => v.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}"><text x="50%" y="50%" text-anchor="middle" dominant-baseline="central" font-family="${attr(font)}" font-size="${size}" font-weight="700" fill="${attr(color)}" fill-opacity="${opacity}"${rot}>${label}</text></svg>`;
  return [`data:image/svg+xml,${pyQuote(svg)}`, h > w];
}
/** A CSS string body: backslash-escape what could end the string or the <style> element. */
export const cssStr = (v: string): string =>
  v.replace(/[\\"\n\r<]/g, (c) => `\\${c.charCodeAt(0).toString(16)} `);
