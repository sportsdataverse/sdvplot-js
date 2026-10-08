import Link from "@docusaurus/Link";
import useBaseUrl from "@docusaurus/useBaseUrl";
import { LOADERS } from "@sportsdataverse/examples/loaders";
import CodeBlock from "@theme/CodeBlock";
import {
  Component,
  type ReactElement,
  type ReactNode,
  isValidElement,
  useEffect,
  useRef,
  useState,
} from "react";

/** A React example that throws while rendering in the browser reports to its <Live>, not to the page's crash screen. */
class Boundary extends Component<
  { onError: (e: unknown) => void; children: ReactNode },
  { failed: boolean }
> {
  override state = { failed: false };
  static getDerivedStateFromError(): { failed: boolean } {
    return { failed: true };
  }
  override componentDidCatch(e: unknown): void {
    this.props.onError(e);
  }
  override render(): ReactNode {
    return this.state.failed ? null : this.props.children;
  }
}

/** Props: `id` (+ `thumb`/`href` on gallery cards) come from the MDX; the rest are injected by remark-live at build. */
export interface LiveProps {
  readonly id: string;
  readonly kind: "node" | "markup" | "react" | "value";
  readonly code: string;
  readonly lang: "ts" | "tsx";
  readonly title: string;
  /** The example's tags, space-separated: a data source's tag adds the credit its terms ask for. */
  readonly tags?: string;
  /** The prerendered output, inline (≤ 64 KB) … */
  readonly markup?: string;
  /** … or the URL of the prerendered file, with the root <svg>'s size when it is an SVG. */
  readonly src?: string;
  readonly width?: string;
  readonly height?: string;
  /** The example exports `browser`: its library draws it here once the page's scripts run (see BrowserSpec). */
  readonly browser?: boolean;
  /** A gallery card: the prerendered output and the title, linking to `href`; never re-run. */
  readonly thumb?: boolean;
  readonly href?: string;
}

/**
 * An example: the prerendered output (static HTML, so the page is complete without JavaScript), the code that
 * produced it, and, for DOM and React outputs that have a browser loader, a live re-run that replaces the static
 * copy once the example comes within a screen of the viewport. An adapter example with a browser upgrade (Plotly,
 * Vega, ECharts, Chart.js: `export const browser`) is drawn by its library instead, in the same place and at the same
 * moment. A re-run or a drawing that throws shows the error over the static output; it never leaves a blank.
 */
export default function Live(p: LiveProps): ReactElement {
  const figure = useRef<HTMLElement>(null);
  const host = useRef<HTMLDivElement>(null);
  const [near, setNear] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [element, setElement] = useState<ReactElement | null>(null);
  const [error, setError] = useState<string | null>(null);
  const src = useBaseUrl(p.src ?? "");
  const statsbombLogo = useBaseUrl("/img/statsbomb-logo.png");
  const live =
    !p.thumb &&
    (p.browser === true || (LOADERS[p.id] !== undefined && (p.kind === "node" || p.kind === "react")));
  // Re-run only near the viewport: the prerendered copy already shows, so a guide does not load every example's
  // chunk at once (the shot-charts guide's gsis map alone is 0.5 MB compressed).
  useEffect(() => {
    const el = figure.current;
    if (!live || el === null) return;
    if (typeof IntersectionObserver === "undefined") {
      setNear(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting)) return;
        setNear(true);
        io.disconnect();
      },
      { rootMargin: "100% 0px" }, // one screen above and below
    );
    io.observe(el);
    return () => io.disconnect();
  }, [live]);
  // The upgrades' table and the libraries load only on a page that shows one, so no other page's bundle grows.
  useEffect(() => {
    const el = host.current;
    if (!near || p.browser !== true || el === null) return;
    let cancelled = false;
    let remove: (() => void) | undefined;
    import("@sportsdataverse/examples/browser")
      .then(async ({ BROWSER, draw }) => {
        const upgrade = BROWSER[p.id];
        if (upgrade === undefined) throw new Error(`${p.id} has no browser upgrade in this build`);
        return draw(el, (await upgrade()).browser);
      })
      .then(
        (r) => {
          if (cancelled) return r();
          remove = r;
          setMounted(true);
        },
        (e: unknown) => {
          if (!cancelled) fail(e); // draw() has removed what it drew; a cancelled run leaves el to the newer one
        },
      );
    return () => {
      cancelled = true;
      remove?.();
    };
  }, [near, p.id, p.browser]);
  useEffect(() => {
    const load = LOADERS[p.id];
    if (!near || load === undefined || p.browser === true) return;
    let cancelled = false;
    load().then(
      (m) => {
        const el = host.current;
        if (cancelled || el === null) return;
        if (isValidElement(m.default)) setElement(m.default);
        else if (m.default instanceof Node) el.replaceChildren(m.default);
        else return;
        setMounted(true);
      },
      (e: unknown) => {
        if (!cancelled) fail(e);
      },
    );
    return () => {
      cancelled = true;
    };
  }, [near, p.id, p.browser]);
  // A load or a render that throws: drop the live output and bring the static copy back under the alert.
  function fail(e: unknown): void {
    setError(e instanceof Error ? e.message : String(e));
    setElement(null);
    setMounted(false);
  }
  // A static file is embedded as a document (never <img>: that would not load the external logo <image>s); the
  // wrapper is the scrolling container that keeps the fixed-size frame inside the column. A card shows a static
  // SVG as an <img> instead: it scales to the card (a fixed-size frame would be a crop), and losing the logos in a
  // thumbnail is fine.
  // Once the re-run is in, the inline copy is removed, not hidden: it carries the same element ids (a gradient, a
  // clipPath), and url(#id) resolves to the first one in the document, which inside a hidden subtree paints nothing.
  const output =
    p.src === undefined ? (
      mounted ? null : (
        <div
          className="sdv-live-static"
          // biome-ignore lint/security/noDangerouslySetInnerHtml: markup the gate produced at build time from our own examples
          dangerouslySetInnerHTML={{ __html: p.markup ?? "" }}
        />
      )
    ) : p.thumb && p.src.endsWith(".svg") ? (
      <div className="sdv-live-static">
        <img src={src} alt={p.title} width={p.width} height={p.height} loading="lazy" />
      </div>
    ) : (
      <div className="sdv-live-static" hidden={mounted}>
        <iframe src={src} title={p.title} width={p.width} height={p.height} loading="lazy" />
      </div>
    );
  // StatsBomb's open-data terms: published analysis of their data carries the StatsBomb logo with the credit. A card is
  // already a link, so its logo is not one.
  const credit = (linked: boolean): ReactElement | null => {
    if (!(p.tags ?? "").split(" ").includes("statsbomb")) return null;
    const logo = <img src={statsbombLogo} alt="StatsBomb" width={100} height={16} />;
    return (
      <span className="sdv-credit">
        {linked ? <a href="https://statsbomb.com">{logo}</a> : logo} Data: StatsBomb open data
      </span>
    );
  };
  if (p.thumb)
    return (
      <Link className="sdv-card" to={p.href ?? "/gallery/"}>
        {output}
        {credit(false)}
        <span>{p.title}</span>
      </Link>
    );
  return (
    <figure className="sdv-live" data-example={p.id} ref={figure}>
      {p.browser === true && p.kind === "value" && !mounted && (
        // a Plotly figure: the static copy is its data, not a picture of it
        <p className="sdv-live-note">With JavaScript on, plotly.js draws this figure here.</p>
      )}
      {output}
      <div className="sdv-live-output" ref={host}>
        <Boundary onError={fail}>{element}</Boundary>
      </div>
      {credit(true)}
      {error !== null && (
        <p role="alert" className="sdv-live-error">
          This example threw in your browser: {error}
        </p>
      )}
      <CodeBlock language={p.lang}>{p.code}</CodeBlock>
    </figure>
  );
}
