/**
 * Draw the sdvplot-js brand assets: the hex logo, its small mark, the favicons and the GitHub social card.
 *
 * Usage: pnpm brand   (downloads the eight team logos, so it needs the network)
 *
 * Port of the sibling recipe (sdvplot tools/hex_logo.py, itself sdvplotR's "Axis" hex): the SportsDataverse
 * starfield masked to a pointy-top hex with its middle band replaced by a gain-matched, feathered copy of the clean
 * top strip; the wordmark in Russo One (SIL OFL 1.1, see OFL.txt) filled with the SDV blue-to-cyan gradient; a bar
 * chart of eight teams, one per league, in each team's primary colour with its logo under the axis; all inside a
 * 30 px print-safe inset. Colours and logo URLs come from this repo's @sportsdataverse/sdvplot data. The SVG is
 * built here and rasterised with @resvg/resvg-js; the starfield band is done on decoded pixels.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { crc32, deflateSync } from "node:zlib";
import { Resvg, type ResvgRenderOptions } from "@resvg/resvg-js";
// the package barrel needs the build-time __SDVPLOT_VERSION__ define, so import the modules directly
import { teamColorsSync } from "../../packages/sdvplot/src/colors.js";
import { contrast } from "../../packages/sdvplot/src/contrast.js";
import { preloadAll } from "../../packages/sdvplot/src/index-data.js";
import { logoUrlSync } from "../../packages/sdvplot/src/marks.js";
import type { League } from "../../packages/sdvplot/src/types.js";

const BRAND = new URL("./", import.meta.url);
const OUT = new URL("../../docs/static/img/", import.meta.url);
const FONT = { fontFiles: [fileURLToPath(new URL("RussoOne-Regular.ttf", BRAND))], loadSystemFonts: false };
const W = 1036;
const H = 1200;
const U = 600; // plot units: y spans -1..1 (600 px per unit) and x spans -W/1200..W/1200, origin at the centre
const R3 = Math.sqrt(3);
const SAFE_R = 1 - ((30 / U) * 2) / R3; // print-safe inner hex, 30 px in from every edge
const PT = 300 / 72; // the recipe's line widths are points at 300 dpi
const EDGE = "#071224";
const ICE = "#9CCBFF";
const GRADIENT = ["#3346F0", "#7FE6DC"] as const;
// one team per league, none of sdvplotR's (KC BOS NY LAD PHI FSU PUR SC) or sdvplot's (MIA GS CHI CIN DAL TENN KU LSU)
const TEAMS: readonly [League, string][] = [
  ["nfl", "CAR"],
  ["nba", "POR"],
  ["wnba", "LV"],
  ["mlb", "BAL"],
  ["nhl", "NSH"],
  ["cfb", "ORE"],
  ["mbb", "UNC"],
  ["wbb", "MD"],
];
const HEIGHTS = [0.46, 0.62, 0.54, 0.72, 0.6, 0.8, 0.68, 0.76]; // sdvplot: .52 .7 .44 .78 .6 .48 .8 .66
const MIN_CONTRAST = 2.5; // every bar against the starfield behind the chart (sdvplot's own floor was ~1.5, LSU)
const BASE = -0.48; // the axis line's y
const SPAN = 0.78; // the y span of a full-height bar
const LOGO_BOX = 76; // px: each logo fits a square this size, centred 0.09 below the axis
const WORD = "sdvplot-js";
const INK_TOP = 0.627; // the wordmark's ink top, as sdvplotR
const REF_WIDTH = 583; // px: sdvplotR's "sdvplotR" ink width, which sets the type size

const px = (x: number): number => W / 2 + x * U;
const py = (y: number): number => H / 2 - y * U;
const n1 = (v: number): string => String(Math.round(v * 10) / 10);
const hexPoints = (): string =>
  Array.from({ length: 6 }, (_, i) => {
    const a = Math.PI / 2 + (i * Math.PI) / 3;
    return `${n1(px(Math.cos(a)))},${n1(py(Math.sin(a)))}`;
  }).join(" ");
const dataUri = (bytes: Buffer, type: string): string => `data:${type};base64,${bytes.toString("base64")}`;
const svgOpen = (attrs: string): string => `<svg xmlns="http://www.w3.org/2000/svg" ${attrs}>`;
const render = (svg: string, fitTo?: ResvgRenderOptions["fitTo"]) =>
  new Resvg(svg, fitTo ? { font: FONT, fitTo } : { font: FONT }).render();
const toHex = (rgb: number[]): string =>
  `#${rgb.map((v) => Math.round(v).toString(16).padStart(2, "0")).join("")}`;

/** An 8-bit RGB PNG (Sub filter, deflate): just enough to hand the treated starfield back to resvg and browsers. */
function encodePng(w: number, h: number, rgb: Uint8Array): Buffer {
  const row = w * 3;
  const raw = Buffer.alloc((row + 1) * h);
  for (let y = 0; y < h; y++) {
    const o = y * (row + 1);
    raw[o] = 1; // Sub: each byte minus the same channel one pixel left (Buffer stores it mod 256)
    for (let i = 0; i < row; i++) raw[o + 1 + i] = rgb[y * row + i]! - (i >= 3 ? rgb[y * row + i - 3]! : 0);
  }
  const chunk = (type: string, data: Buffer): Buffer => {
    const body = Buffer.concat([Buffer.from(type, "latin1"), data]);
    const out = Buffer.alloc(body.length + 8);
    out.writeUInt32BE(data.length, 0);
    body.copy(out, 4);
    out.writeUInt32BE(crc32(body), body.length + 4);
    return out;
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; // bit depth; colour type 2 (RGB) next, compression/filter/interlace stay 0
  ihdr[9] = 2;
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  return Buffer.concat([
    sig,
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

/**
 * sdvplotR's ground: the starfield cropped to 1040 x 1200, its middle band (behind the chart) replaced by a
 * gain-matched copy of the clean top strip, feathered at the edges. Returns the PNG and the band's mean colour.
 */
function starfield(): { png: Buffer; ground: string } {
  const src = readFileSync(new URL("sdv-starfield.png", BRAND));
  const { pixels } = render(
    `${svgOpen('width="1200" height="1200"')}<image width="1200" height="1200" href="${dataUri(src, "image/png")}"/></svg>`,
  );
  const SW = 1040;
  const at = (y: number, x: number, k: number): number => (y * SW + x) * 3 + k;
  const orig = new Float64Array(SW * H * 3);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < SW; x++)
      for (let k = 0; k < 3; k++) orig[at(y, x, k)] = pixels[(y * 1200 + x + 80) * 4 + k]!;
  const sky = orig.slice();
  const [R0, C0, NR, NC] = [399, 79, 430, 920];
  const ramp = (n: number, edge: number): number[] =>
    Array.from({ length: n }, (_, i) => Math.min(1, Math.min(i, n - 1 - i) / edge));
  const wr = ramp(NR, 40);
  const wc = ramp(NC, 60);
  const mean = [0, 0, 0];
  for (let k = 0; k < 3; k++) {
    let s = 0;
    let d = 0;
    for (let i = 0; i < NR; i++)
      for (let j = 0; j < NC; j++)
        if (wr[i]! * wc[j]! < 0.25) {
          // the blend ring, outside the mark in both images
          s += orig[at(i, C0 + j, k)]!;
          d += orig[at(R0 + i, C0 + j, k)]!;
        }
    for (let i = 0; i < NR; i++)
      for (let j = 0; j < NC; j++) {
        const w = wr[i]! * wc[j]!;
        const t = at(R0 + i, C0 + j, k);
        sky[t] = w * Math.min(255, (orig[at(i, C0 + j, k)]! * d) / s) + (1 - w) * orig[t]!;
        mean[k]! += Math.trunc(sky[t]!) / (NR * NC);
      }
  }
  return { png: encodePng(SW, H, Uint8Array.from(sky, Math.trunc)), ground: toHex(mean) };
}

interface Glyphs {
  d: string;
  x: number;
  y: number;
  w: number;
  h: number;
}
/** The text's outline as one path (resvg turns text into paths) and its ink box, at a 1000 px type size. */
function glyphs(text: string): Glyphs {
  const r = new Resvg(
    `${svgOpen('width="8000" height="2000"')}<text x="0" y="1000" font-size="1000" font-family="Russo One">${text}</text></svg>`,
    { font: FONT },
  );
  const b = r.getBBox();
  if (!b) throw new Error(`no ink for ${text}: is Russo One loaded?`);
  const d = [...r.toString().matchAll(/ d="([^"]+)"/g)].map((m) => m[1]).join(" ");
  return { d, x: b.x, y: b.y, w: b.width, h: b.height };
}
/** Maps a path's absolute coordinates (resvg emits only M/L/Q/C/Z, so numbers alternate x, y), rounded to 0.1. */
const mapPath = (d: string, fx: (x: number) => number, fy: (y: number) => number): string => {
  let i = 0;
  return d.replace(/-?\d*\.?\d+(?:e-?\d+)?/g, (v) => n1(i++ % 2 ? fy(+v) : fx(+v)));
};
/** The glyphs scaled by q px per font unit, ink centred on cx with its top at y = top. */
const placeGlyphs = (g: Glyphs, q: number, cx: number, top: number) => ({
  d: mapPath(
    g.d,
    (x) => cx + (x - g.x - g.w / 2) * q,
    (y) => top + (y - g.y) * q,
  ),
  top,
  bottom: top + g.h * q,
  width: g.w * q,
});

/** True when every inked pixel of the path lies inside the print-safe hex. */
function insideSafeHex(d: string): boolean {
  const { pixels } = render(`${svgOpen(`width="${W}" height="${H}"`)}<path d="${d}"/></svg>`);
  for (let i = 3; i < pixels.length; i += 4) {
    if (!pixels[i]) continue;
    const p = (i - 3) / 4;
    const x = Math.abs((p % W) + 0.5 - W / 2) / U;
    const y = Math.abs(H / 2 - Math.floor(p / W) - 0.5) / U;
    if (x > Math.min((SAFE_R * R3) / 2, (SAFE_R - y) * R3)) return false;
  }
  return true;
}

/** The wordmark at sdvplotR's type size, scaled down only if it would leave the safe hex. */
function wordmark(): ReturnType<typeof placeGlyphs> & { scale: number; glyphs: Glyphs; q: number } {
  const g = glyphs(WORD);
  const k = REF_WIDTH / glyphs("sdvplotR").w;
  for (let scale = 1; scale > 0.5; scale -= 0.005) {
    const m = placeGlyphs(g, k * scale, W / 2, py(INK_TOP));
    if (insideSafeHex(m.d)) return { ...m, scale, glyphs: g, q: k * scale };
  }
  throw new Error(`${WORD} does not fit the safe hex`);
}

interface HexParts {
  colors: string[];
  word: ReturnType<typeof placeGlyphs>;
  sky?: string; // the starfield data URI; without it the hex gets a flat dark fill (the mark)
  logos?: string[];
}
/** The hex as an <svg> element (`attrs` sizes or places it), in the recipe's 1036 x 1200 px space. */
function hexSvg(p: HexParts, attrs = `width="${W}" height="${H}"`): string {
  const hex = hexPoints();
  const x = HEIGHTS.map((_, i) => -0.46 + (i * 0.92) / (HEIGHTS.length - 1));
  const grid = [0.2, 0.4, 0.6, 0.8].map((t) => BASE + t * SPAN);
  const gridD = grid
    .map((y) => {
      const half = Math.max(0, (SAFE_R - Math.abs(y)) * R3) - 0.04;
      return `M${n1(px(-half))} ${n1(py(y))}H${n1(px(half))}`;
    })
    .join("");
  const bars = HEIGHTS.map((h, i) => {
    const top = py(BASE + h * SPAN);
    return `<rect x="${n1(px(x[i]!) - 0.04 * U)}" y="${n1(top)}" width="${0.08 * U}" height="${n1(py(BASE) - top)}" fill="${p.colors[i]}" fill-opacity="0.95"/>`;
  }).join("");
  const logos = (p.logos ?? [])
    .map(
      (href, i) =>
        `<image x="${n1(px(x[i]!) - LOGO_BOX / 2)}" y="${n1(py(BASE - 0.09) - LOGO_BOX / 2)}" width="${LOGO_BOX}" height="${LOGO_BOX}" href="${href}"/>`,
    )
    .join("");
  const ground = p.sky
    ? `<image x="${n1(px(-R3 / 2))}" y="0" width="${n1(R3 * U)}" height="${H}" preserveAspectRatio="none" clip-path="url(#hex)" href="${p.sky}"/>`
    : `<polygon points="${hex}" fill="url(#ground)"/>`;
  return [
    svgOpen(`viewBox="0 0 ${W} ${H}" ${attrs}`),
    "<defs>",
    `<clipPath id="hex"><polygon points="${hex}"/></clipPath>`,
    `<linearGradient id="ink" gradientUnits="userSpaceOnUse" x1="0" y1="${n1(p.word.top)}" x2="0" y2="${n1(p.word.bottom)}">`,
    `<stop offset="0" stop-color="${GRADIENT[0]}"/><stop offset="1" stop-color="${GRADIENT[1]}"/></linearGradient>`,
    p.sky
      ? ""
      : '<linearGradient id="ground" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0e2347"/><stop offset="1" stop-color="#050c1c"/></linearGradient>',
    "</defs>",
    ground,
    `<path d="${gridD}" stroke="${ICE}" stroke-opacity="0.18" stroke-width="${n1(0.85 * PT)}"/>`,
    bars,
    `<path d="M${n1(px(-0.58))} ${n1(py(BASE))}H${n1(px(0.58))}" stroke="${ICE}" stroke-opacity="0.7" stroke-width="${n1(1.28 * PT)}"/>`,
    logos,
    `<path d="${p.word.d}" fill="url(#ink)"/>`,
    `<polygon points="${hex}" fill="none" stroke="${EDGE}" stroke-width="${n1(1.92 * PT)}" stroke-linejoin="round"/>`,
    "</svg>",
  ].join("");
}

/** The hex centred on a transparent (or `bg`-filled) square, as the recipe's favicon. */
const square = (hex: (attrs: string) => string, bg?: string): string =>
  `${svgOpen('width="1200" height="1200"')}${bg ? `<rect width="1200" height="1200" fill="${bg}"/>` : ""}${hex(`x="${(1200 - W) / 2}" y="0" width="${W}" height="${H}"`)}</svg>`;

/** ICONDIR + one ICONDIRENTRY per image + the PNGs themselves (PNG-in-ICO, read by every current browser). */
function ico(images: { size: number; png: Buffer }[]): Buffer {
  const head = Buffer.alloc(6 + 16 * images.length);
  head.writeUInt16LE(1, 2); // type 1 = icon
  head.writeUInt16LE(images.length, 4);
  let offset = head.length;
  images.forEach(({ size, png }, i) => {
    const e = 6 + 16 * i;
    head[e] = size % 256; // 0 means 256
    head[e + 1] = size % 256;
    head.writeUInt16LE(1, e + 4); // colour planes
    head.writeUInt16LE(32, e + 6); // bits per pixel
    head.writeUInt32LE(png.length, e + 8);
    head.writeUInt32LE(offset, e + 12);
    offset += png.length;
  });
  return Buffer.concat([head, ...images.map((i) => i.png)]);
}

/** The 1280 x 640 GitHub social preview: starfield ground, the hex at left, wordmark, tagline and packages right. */
function socialCard(hex: (attrs: string) => string, sky: string, g: Glyphs): string {
  const CW = 1280;
  const CH = 640;
  const hexH = 560;
  const hexX = 56;
  const hexY = (CH - hexH) / 2;
  const left = 600; // the text column's left edge
  const word = placeGlyphs(g, 560 / g.w, left + 280, 158);
  const text = (y: number, size: number, fill: string, s: string): string =>
    `<text x="${left}" y="${y}" font-family="Russo One" font-size="${size}" fill="${fill}">${s}</text>`;
  return [
    svgOpen(`width="${CW}" height="${CH}"`),
    "<defs>",
    `<linearGradient id="cardInk" gradientUnits="userSpaceOnUse" x1="0" y1="${n1(word.top)}" x2="0" y2="${n1(word.bottom)}">`,
    `<stop offset="0" stop-color="${GRADIENT[0]}"/><stop offset="1" stop-color="${GRADIENT[1]}"/></linearGradient>`,
    '<linearGradient id="scrim" x1="0" y1="0" x2="1" y2="0"><stop offset="0.3" stop-color="#030812" stop-opacity="0.25"/><stop offset="0.6" stop-color="#030812" stop-opacity="0.6"/></linearGradient>',
    '<filter id="glow" x="-0.2" y="-0.2" width="1.4" height="1.4"><feGaussianBlur stdDeviation="40"/></filter>',
    "</defs>",
    `<image x="0" y="${(CH - (CW * H) / 1040) / 2}" width="${CW}" height="${(CW * H) / 1040}" preserveAspectRatio="none" href="${sky}"/>`,
    `<rect width="${CW}" height="${CH}" fill="url(#scrim)"/>`,
    // a soft blue halo lifts the hex off the starfield it is cut from
    `<g transform="translate(${hexX} ${hexY}) scale(${hexH / H})"><polygon points="${hexPoints()}" fill="${GRADIENT[0]}" fill-opacity="0.5" filter="url(#glow)"/></g>`,
    hex(`x="${hexX}" y="${hexY}" width="${n1((hexH * W) / H)}" height="${hexH}"`),
    `<path d="${word.d}" fill="url(#cardInk)"/>`,
    text(354, 34, "#EAF2FF", "Team logos, colours and playing"),
    text(400, 34, "#EAF2FF", "surfaces for Observable Plot and D3"),
    `<rect x="${left}" y="438" width="120" height="4" fill="${GRADIENT[1]}"/>`,
    text(492, 26, ICE, "@sportsdataverse/sdvplot · sporty · sdvtables"),
    "</svg>",
  ].join("");
}

async function fetchLogo(url: string): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  const type = url.endsWith(".svg") ? "image/svg+xml" : url.endsWith(".png") ? "image/png" : null;
  if (!type) throw new Error(`${url}: not a PNG or SVG`);
  return dataUri(Buffer.from(await res.arrayBuffer()), type);
}

async function main(): Promise<void> {
  await preloadAll();
  const { png: skyPng, ground } = starfield();
  const colors = TEAMS.map(([league, team]) => {
    const c = teamColorsSync(league, team);
    if (!c) throw new Error(`no colour for ${league} ${team}`);
    const ratio = contrast(c, ground);
    if (ratio < MIN_CONTRAST)
      throw new Error(`${league} ${team} ${c} reads ${ratio.toFixed(2)}:1 on ${ground}`);
    return c;
  });
  const urls = TEAMS.map(([league, team]) => {
    const u = logoUrlSync(team, league, { variant: "dark" });
    if (!u) throw new Error(`no logo for ${league} ${team}`);
    return u;
  });
  const logos = await Promise.all(urls.map(fetchLogo));
  const word = wordmark();
  const sky = dataUri(skyPng, "image/png");
  const full = (attrs?: string): string => hexSvg({ colors, word, sky, logos }, attrs);
  const mark = (attrs?: string): string => hexSvg({ colors, word }, attrs);

  const write = (name: string, data: string | Buffer): void => {
    writeFileSync(new URL(name, OUT), data);
    console.log(`wrote docs/static/img/${name} (${(Buffer.byteLength(data) / 1024).toFixed(1)} KB)`);
  };
  write("sdvplot-js-logo.svg", full());
  write("sdvplot-js-logo.png", render(full()).asPng());
  write("sdvplot-js-mark.svg", mark());
  const icon = (size: number, svg: string): Buffer => render(svg, { mode: "width", value: size }).asPng();
  write("favicon.ico", ico([16, 32, 48].map((size) => ({ size, png: icon(size, square(mark)) }))));
  write("favicon-192.png", icon(192, square(full)));
  write("favicon-512.png", icon(512, square(full)));
  write("apple-touch-icon.png", icon(180, square(full, EDGE)));
  write("social-card.png", render(socialCard(full, sky, word.glyphs)).asPng());

  const rows = TEAMS.map(
    ([l, t], i) => `${l} ${t} ${colors[i]} (${contrast(colors[i]!, ground).toFixed(2)}:1)`,
  );
  console.log(`ground ${ground}; teams: ${rows.join(", ")}`);
  console.log(`wordmark "${WORD}" at ${(word.scale * 100).toFixed(1)}% of sdvplotR's type size`);
  for (const u of urls) console.log(u);
}

await main();
