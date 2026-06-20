"use client";

import { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { DOCS } from "@/components/admin/docsRegistry";

export default function DocsSection() {
  const [slug, setSlug] = useState(DOCS[0]?.slug ?? "");
  const [content, setContent] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!slug) return;
    let cancelled = false;
    // Reset to loading on each slug change before the async fetch resolves.
    /* eslint-disable react-hooks/set-state-in-effect */
    setLoading(true);
    setError(null);
    /* eslint-enable react-hooks/set-state-in-effect */
    fetch(`/docs/${slug}.md`)
      .then((r) => {
        if (!r.ok) throw new Error(`Could not load this guide (${r.status}).`);
        return r.text();
      })
      .then((text) => { if (!cancelled) setContent(text); })
      .catch((e) => { if (!cancelled) setError((e as Error).message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [slug]);

  return (
    <div style={{ display: "flex", gap: 28 }}>
      <nav style={{ width: 220, flexShrink: 0, display: "flex", flexDirection: "column", gap: 4 }}>
        <strong style={{ marginBottom: 8 }}>📚 How-tos</strong>
        {DOCS.map((d) => (
          <button
            key={d.slug}
            onClick={() => setSlug(d.slug)}
            style={{
              textAlign: "left", padding: "6px 8px", borderRadius: 6, border: "none", cursor: "pointer",
              background: slug === d.slug ? "var(--ink-800)" : "transparent",
              color: "var(--parchment)", fontWeight: slug === d.slug ? 700 : 400, fontSize: 13,
            }}
          >
            {d.title}
          </button>
        ))}
      </nav>
      <div style={{ flex: 1, minWidth: 0 }}>
        {loading && <p style={{ color: "var(--parchment-faint)" }}>Loading…</p>}
        {error && <p style={{ color: "var(--loss)" }}>{error}</p>}
        {!loading && !error && (
          <div className="docs-md">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
          </div>
        )}
      </div>
    </div>
  );
}
