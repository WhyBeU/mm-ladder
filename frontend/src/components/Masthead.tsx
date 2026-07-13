"use client";

import Image from "next/image";
import HeaderNav from "@/components/HeaderNav";

type NavTarget = "leaderboard" | "board" | "pods";

export default function Masthead({
  current,
  title,
  eyebrow,
  logoSize = 76,
}: {
  current: NavTarget;
  title: string;
  eyebrow?: React.ReactNode;
  logoSize?: number;
}) {
  return (
    <header className="masthead" style={{ "--logo-size": `${logoSize}px` } as React.CSSProperties}>
      <div style={{ display: "flex", alignItems: "center", gap: 16, minWidth: 0 }}>
        <div className="masthead-logo" style={{
          flexShrink: 0,
          background: "var(--parchment)",
          display: "flex", alignItems: "center", justifyContent: "center",
          boxShadow: "0 0 0 1px color-mix(in srgb, var(--accent-400) 40%, transparent), var(--shadow-gold-glow)",
        }}>
          <Image
            src="/mm-logo-svg.svg"
            alt="Magic Mates"
            width={logoSize - 12}
            height={logoSize - 12}
            unoptimized
            style={{ objectFit: "contain", width: "100%", height: "100%" }}
            onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
          />
        </div>
        <div style={{ minWidth: 0 }}>
          {eyebrow != null && (
            <div className="eyebrow" style={{ color: "var(--parchment-muted)" }}>{eyebrow}</div>
          )}
          <h2 className="font-display masthead-title" style={{ margin: "1px 0 0", color: "var(--parchment)", letterSpacing: "0.02em" }}>
            {title}
          </h2>
        </div>
      </div>
      <HeaderNav current={current} />
    </header>
  );
}
