"use client";

import { useState } from "react";
import Link from "next/link";
import { AdminAuthProvider, useAdminAuth } from "@/context/AdminAuth";
import { ToastProvider } from "@/components/admin/ui";
import { AdminNavContext, type AdminSection, type NavRequest } from "@/components/admin/nav";
import LoginForm from "@/components/admin/LoginForm";
import CupSection from "@/components/admin/CupSection";
import SeasonSection from "@/components/admin/SeasonSection";
import TournamentSection from "@/components/admin/TournamentSection";
import UploadSection from "@/components/admin/UploadSection";
import PlayerSection from "@/components/admin/PlayerSection";
import HistorySection from "@/components/admin/HistorySection";
import DocsSection from "@/components/admin/DocsSection";

type Section = AdminSection;
const NAV: { key: Section; label: string }[] = [
  { key: "cups", label: "🏆 Yearly Cups" },
  { key: "seasons", label: "📅 Seasons" },
  { key: "tournaments", label: "🎲 Tournaments" },
  { key: "upload", label: "⬆️ Upload" },
  { key: "players", label: "👤 Players" },
  { key: "history", label: "📜 History" },
  { key: "docs", label: "📚 Docs" },
];

function Shell() {
  const { ready, authed, logout } = useAdminAuth();
  const [section, setSection] = useState<Section>("cups");
  const [request, setRequest] = useState<NavRequest | null>(null);
  const navigate = (target: AdminSection, id: number) => {
    setSection(target);
    setRequest({ section: target, id, nonce: Date.now() });
  };
  if (!ready) return <div style={{ padding: 40 }}>Loading…</div>;
  if (!authed) return <LoginForm />;
  return (
    <AdminNavContext.Provider value={{ navigate, request }}>
    <div style={{ display: "flex", minHeight: "100vh", color: "var(--parchment)" }}>
      <nav style={{ width: 200, borderRight: "1px solid var(--ink-700)", padding: 16, display: "flex", flexDirection: "column", gap: 6 }}>
        <Link href="/" style={{ color: "var(--parchment-muted)", textDecoration: "none", fontSize: 13, marginBottom: 6 }}>← Ladder</Link>
        <strong style={{ marginBottom: 10 }}>🗂️ Admin</strong>
        {NAV.map((n) => (
          <button
            key={n.key}
            onClick={() => setSection(n.key)}
            style={{
              textAlign: "left",
              padding: "6px 8px",
              borderRadius: 6,
              border: "none",
              cursor: "pointer",
              background: section === n.key ? "var(--ink-800)" : "transparent",
              color: "var(--parchment)",
              fontWeight: section === n.key ? 700 : 400,
            }}
          >
            {n.label}
          </button>
        ))}
        <button
          onClick={logout}
          style={{ marginTop: "auto", textAlign: "left", padding: "6px 8px", background: "none", border: "none", color: "var(--parchment-faint)", cursor: "pointer" }}
        >
          Log out
        </button>
      </nav>
      <main style={{ flex: 1, padding: 24, maxWidth: 920 }}>
        {section === "cups" && <CupSection />}
        {section === "seasons" && <SeasonSection />}
        {section === "tournaments" && <TournamentSection />}
        {section === "upload" && <UploadSection />}
        {section === "players" && <PlayerSection />}
        {section === "history" && <HistorySection />}
        {section === "docs" && <DocsSection />}
      </main>
    </div>
    </AdminNavContext.Provider>
  );
}

export default function AdminApp() {
  return (
    <AdminAuthProvider>
      <ToastProvider>
        <Shell />
      </ToastProvider>
    </AdminAuthProvider>
  );
}
