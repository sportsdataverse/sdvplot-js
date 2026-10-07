import Link from "@docusaurus/Link";
import useBaseUrl from "@docusaurus/useBaseUrl";
import { LOADERS } from "@sportsdataverse/examples/loaders";
import CodeBlock from "@theme/CodeBlock";
import { type ReactElement, isValidElement, useEffect, useRef, useState } from "react";
import { type Root, createRoot } from "react-dom/client";

/** Props: `id` (+ `thumb`/`href` on gallery cards) come from the MDX; the rest are injected by remark-live at build. */
export interface LiveProps {
  readonly id: string;
  readonly kind: "node" | "markup" | "react" | "value";
  readonly code: string;
  readonly lang: "ts" | "tsx";
  readonly title: string;
  /** The prerendered output, inline (≤ 64 KB) … */
  readonly markup?: string;
  /** … or the URL of the prerendered file. */
  readonly src?: string;
  /** A gallery card: the prerendered output and the title, linking to `href`; never re-run. */
  readonly thumb?: boolean;
  readonly href?: string;
}

/**
 * An example: the prerendered output (static HTML, so the page is complete without JavaScript), the code that
 * produced it, and, for DOM and React outputs that have a browser loader, a live re-run that replaces the static
 * copy. A re-run that throws shows the error over the static output; it never leaves a blank.
 */
export default function Live(p: LiveProps): ReactElement {
  const host = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const src = useBaseUrl(p.src ?? "");
  useEffect(() => {
    const load = LOADERS[p.id];
    if (p.thumb || load === undefined || (p.kind !== "node" && p.kind !== "react")) return;
    let cancelled = false;
    let root: Root | undefined;
    load().then(
      (m) => {
        const el = host.current;
        if (cancelled || el === null) return;
        if (isValidElement(m.default)) {
          root = createRoot(el);
          root.render(m.default);
        } else if (m.default instanceof Node) el.replaceChildren(m.default);
        else return;
        setMounted(true);
      },
      (e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      },
    );
    return () => {
      cancelled = true;
      root?.unmount();
    };
  }, [p.id, p.kind, p.thumb]);
  const output =
    p.src === undefined ? (
      <div
        className="sdv-live-static"
        hidden={mounted}
        // biome-ignore lint/security/noDangerouslySetInnerHtml: markup the gate produced at build time from our own examples
        dangerouslySetInnerHTML={{ __html: p.markup ?? "" }}
      />
    ) : p.src.endsWith(".svg") ? (
      <img className="sdv-live-static" hidden={mounted} src={src} alt={p.title} loading="lazy" />
    ) : (
      <iframe className="sdv-live-static" hidden={mounted} src={src} title={p.title} loading="lazy" />
    );
  if (p.thumb)
    return (
      <Link className="sdv-card" to={p.href ?? "/gallery/"}>
        {output}
        <span>{p.title}</span>
      </Link>
    );
  return (
    <figure className="sdv-live" data-example={p.id}>
      {output}
      <div className="sdv-live-output" ref={host} />
      {error !== null && (
        <p role="alert" className="sdv-live-error">
          This example threw in your browser: {error}
        </p>
      )}
      <CodeBlock language={p.lang}>{p.code}</CodeBlock>
    </figure>
  );
}
