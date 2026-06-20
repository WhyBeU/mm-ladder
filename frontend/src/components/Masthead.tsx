"use client";

import Image from "next/image";
import HeaderNav from "@/components/HeaderNav";

type NavTarget = "leaderboard" | "board" | "pods";

const headerStyle: React.CSSProperties = {
  position: "sticky", top: 0, zIndex: 20,
  background: "color-mix(in srgb, var(--ink-950) 88%, transparent)",
  backdropFilter: "blur(8px)",
  borderBottom: "1px solid var(--ink-700)",
  padding: "12px 32px",
  display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16,
};

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
    <header style={headerStyle}>
      <div style={{ display: "flex", alignItems: "center", gap: 16, minWidth: 0 }}>
        <div style={{
          width: logoSize, height: logoSize, borderRadius: 14, flexShrink: 0,
          background: "var(--parchment)", padding: 5,
          display: "flex", alignItems: "center", justifyContent: "center",
          boxShadow: "0 0 0 1px color-mix(in srgb, var(--accent-400) 40%, transparent), var(--shadow-gold-glow)",
        }}>
          <Image
            src="/mm-logo-svg.svg"
            alt="Magic Mates"
            width={logoSize - 12}
            height={logoSize - 12}
            unoptimized
            style={{ objectFit: "contain" }}
            onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
          />
        </div>
        <div style={{ minWidth: 0 }}>
          {eyebrow != null && (
            <div className="eyebrow" style={{ color: "var(--parchment-muted)" }}>{eyebrow}</div>
          )}
          <h2 className="font-display" style={{ margin: "1px 0 0", fontSize: 24, color: "var(--parchment)", letterSpacing: "0.02em" }}>
            {title}
          </h2>
        </div>
      </div>
      <HeaderNav current={current} />
    </header>
  );
}
