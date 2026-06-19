"use client";

import Link from "next/link";
import { useState } from "react";
import ManaSwitcher from "@/components/ManaSwitcher";

type NavTarget = "leaderboard" | "pods" | "board";

function NavLink({ href, label, active }: { href: string; label: string; active: boolean }) {
  const [hover, setHover] = useState(false);
  return (
    <Link
      href={href}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        fontFamily: "var(--font-sans)",
        fontSize: 12,
        letterSpacing: "0.08em",
        textTransform: "uppercase",
        fontWeight: 600,
        textDecoration: "none",
        padding: "5px 12px",
        borderRadius: 7,
        whiteSpace: "nowrap",
        color: active || hover ? "var(--parchment)" : "var(--parchment-muted)",
        background: active ? "var(--ink-850)" : "none",
        border: `1px solid ${active ? "var(--ink-600)" : "transparent"}`,
      }}
    >
      {label}
    </Link>
  );
}

export default function HeaderNav({ current }: { current: NavTarget }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <nav style={{ display: "flex", alignItems: "center", gap: 4 }}>
        <NavLink href="/" label="Ladder" active={current === "leaderboard"} />
        <NavLink href="/board" label="Board" active={current === "board"} />
        <NavLink href="/pods" label="Pod" active={current === "pods"} />
        <NavLink href="/admin" label="Admin" active={false} />
      </nav>
      <span style={{ width: 1, height: 22, background: "var(--ink-700)", margin: "0 2px" }} />
      <ManaSwitcher />
    </div>
  );
}
