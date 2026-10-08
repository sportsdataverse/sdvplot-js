import Link from "@docusaurus/Link";
import useBaseUrl from "@docusaurus/useBaseUrl";
import { LOADERS } from "@sportsdataverse/examples/loaders";
import CodeBlock from "@theme/CodeBlock";
import { type ReactElement, isValidElement, useEffect, useRef, useState } from "react";

/** Props: `id` (+ `thumb`/`href` on gallery cards) come from the MDX; the rest are injected by remark-live at build. */
export interface LiveProps {
  readonly id: string;
  readonly kind: "node" | "markup" | "react" | "value";
  readonly code: string;
  readonly lang: "ts" | "tsx";
  readonly title: string;
  /** The prerendered output, inline (≤ 64 KB) … */
  readonly markup?: string;
  /** … or the URL of the prerendered file, with the root <svg>'s size when it is an SVG. */
  readonly src?: string;
  readonly width?: string;
  readonly height?: string;
  /** A gallery card: the prerendered output and the title, linking to `href`; never re-run. */
  readonly thumb?: boolean;
  readonly href?: string;
}

/**
 * An example: the prerendered output (static HTML, so the page is complete without JavaScript), the code that
 * produced it, and, for DOM and React outputs that have a browser loader, a live re-run that replaces the static
 * copy once the example comes within a screen of the viewport. A re-run that throws shows the error over the static
 * output; it never leaves a blank.
 */
export default function Live(p: LiveProps): ReactElement {
  const figure = useRef<HTMLElement>(null);
  const host = useRef<HTMLDivElement>(null);
  const [near, setNear] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [element, setElement] = useState<ReactElement | null>(null);
  const [error, setError] = useState<string | null>(null);
  const src = useBaseUrl(p.src ?? "");
  const live = !p.thumb && LOADERS[p.id] !== undefined && (p.kind === "node" || p.kind === "react");
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
  useEffect(() => {
    const load = LOADERS[p.id];
    if (!near || load === undefined) return;
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
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      },
    );
    return () => {
      cancelled = true;
    };
  }, [near, p.id]);
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
  if (p.thumb)
    return (
      <Link className="sdv-card" to={p.href ?? "/gallery/"}>
        {output}
        <span>{p.title}</span>
      </Link>
    );
  return (
    <figure className="sdv-live" data-example={p.id} ref={figure}>
      {output}
      <div className="sdv-live-output" ref={host}>
        {element}
      </div>
      {error !== null && (
        <p role="alert" className="sdv-live-error">
          This example threw in your browser: {error}
        </p>
      )}
      <CodeBlock language={p.lang}>{p.code}</CodeBlock>
    </figure>
  );
}
