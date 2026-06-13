"use client";

import { useState } from "react";
import { useAdminAuth } from "@/context/AdminAuth";

export default function LoginForm() {
  const { login } = useAdminAuth();
  const [pw, setPw] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      await login(pw);
    } catch {
      setErr("Incorrect password.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ minHeight: "70vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <form onSubmit={submit} style={{ width: 320, display: "flex", flexDirection: "column", gap: 12 }}>
        <h1 style={{ fontSize: 20, margin: 0 }}>Admin sign-in</h1>
        <input
          type="password"
          value={pw}
          onChange={(e) => setPw(e.target.value)}
          placeholder="Admin password"
          autoFocus
          style={{ padding: "10px 12px", borderRadius: 8, border: "1px solid var(--ink-700)", background: "var(--ink-850)", color: "var(--parchment)" }}
        />
        {err && <div style={{ color: "var(--loss)", fontSize: 13 }}>{err}</div>}
        <button
          disabled={busy || !pw}
          type="submit"
          style={{ padding: "10px 12px", borderRadius: 8, border: "none", background: "var(--accent-400)", color: "var(--ink-950)", fontWeight: 700, cursor: "pointer" }}
        >
          {busy ? "Checking…" : "Sign in"}
        </button>
      </form>
    </div>
  );
}
