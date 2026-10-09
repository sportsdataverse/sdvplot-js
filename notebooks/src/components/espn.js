// ESPN JSON for the "Workflows with sdv-js" pages: the committed snapshot, or, when the reader ticks "Fetch live from
// ESPN", the same endpoint fetched by their browser. Builds never fetch (nothing here runs at build time), so two
// builds stay byte-identical. ESPN's API answers a browser's cross-origin request (Access-Control-Allow-Origin: *),
// so no proxy is needed.
export const SITE = "https://site.api.espn.com/apis/site/v2/sports";

// { raw, live: true, url, at } from ESPN, or { raw, live: false, error? } from the snapshot when live is off or fails.
export async function espnJSON(url, { live, snapshot }) {
  if (live)
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return { raw: await res.json(), live: true, url, at: new Date() };
    } catch (error) {
      return {
        raw: await snapshot.json(),
        live: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  return { raw: await snapshot.json(), live: false };
}

// One line saying where the rows came from: the live URL and when, or the snapshot's URL, capture time and sha256.
export function source(got, snap) {
  const p = document.createElement("p");
  p.style.cssText = "font-size: 0.85em; color: var(--theme-foreground-muted); overflow-wrap: anywhere";
  const link = (url) => Object.assign(document.createElement("a"), { href: url, textContent: url });
  if (got.live) p.append("Live from ", link(got.url), `, fetched ${got.at.toLocaleString()}.`);
  else
    p.append(
      got.error ? `The live fetch failed (${got.error}), so this is the snapshot: ` : "Snapshot: ",
      link(snap.url),
      `, captured ${snap.captured_at} (${snap.bytes.toLocaleString("en-US")} bytes, sha256 ${snap.sha256.slice(0, 12)}…).`,
    );
  return p;
}

// The page's query string: a link from another page (the scoreboard) can open it live on one game.
export const params = new URLSearchParams(location.search);
