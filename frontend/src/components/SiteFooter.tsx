import { DISCORD_URL, WEEKLY_DRAFT_LINE } from "@/lib/site";

/** Discord "clyde" mark. */
export function DiscordGlyph({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden style={{ flexShrink: 0 }}>
      <path d="M20.317 4.369A19.79 19.79 0 0 0 15.885 3c-.2.36-.43.845-.59 1.23a18.27 18.27 0 0 0-5.6 0A12.6 12.6 0 0 0 9.1 3a19.74 19.74 0 0 0-4.435 1.37C1.86 8.59 1.1 12.7 1.48 16.76a19.9 19.9 0 0 0 6.07 3.08c.49-.67.93-1.38 1.3-2.13-.71-.27-1.39-.6-2.03-.99.17-.13.34-.26.5-.4a14.2 14.2 0 0 0 12.36 0c.16.14.33.27.5.4-.64.39-1.32.72-2.03.99.37.75.81 1.46 1.3 2.13a19.86 19.86 0 0 0 6.07-3.08c.45-4.7-.77-8.77-3.2-12.39ZM8.02 14.33c-1.18 0-2.15-1.09-2.15-2.43 0-1.34.95-2.43 2.15-2.43 1.2 0 2.17 1.1 2.15 2.43 0 1.34-.95 2.43-2.15 2.43Zm7.96 0c-1.18 0-2.15-1.09-2.15-2.43 0-1.34.95-2.43 2.15-2.43 1.2 0 2.17 1.1 2.15 2.43 0 1.34-.94 2.43-2.15 2.43Z" />
    </svg>
  );
}

/** Accent-filled "Join our Discord" call-to-action button. */
export function DiscordButton() {
  return (
    <a
      href={DISCORD_URL}
      target="_blank"
      rel="noopener noreferrer"
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 7,
        padding: "5px 12px",
        borderRadius: 8,
        background: "var(--accent-400)",
        color: "var(--ink-950)",
        fontSize: 12,
        fontWeight: 700,
        textDecoration: "none",
        whiteSpace: "nowrap",
      }}
    >
      <DiscordGlyph size={15} />
      Join our Discord
    </a>
  );
}

/** Discord invite link, styled inline for footers. */
export function DiscordLink() {
  return (
    <a
      href={DISCORD_URL}
      target="_blank"
      rel="noopener noreferrer"
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        color: "var(--parchment-muted)",
        textDecoration: "none",
        fontSize: 12,
        letterSpacing: "0.04em",
      }}
    >
      <DiscordGlyph size={15} />
      Discord
    </a>
  );
}

/**
 * Site-wide footer. Pass `children` to replace the left slot (the ladder supplies its
 * live "last updated" line); otherwise the weekly-draft line shows there.
 */
export default function SiteFooter({ children }: { children?: React.ReactNode }) {
  return (
    <footer
      className="page-footer"
      style={{
        borderTop: "1px solid color-mix(in srgb, var(--ink-700) 60%, transparent)",
        fontSize: 11,
        color: "var(--parchment-faint)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        {children ?? (
          <span>
            Weekly Drafts · <span style={{ color: "var(--parchment-muted)" }}>{WEEKLY_DRAFT_LINE}</span>
          </span>
        )}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
        <DiscordLink />
        <span className="eyebrow">Magic Mates Monday @ Chromatic Games</span>
      </div>
    </footer>
  );
}
