"use client";

import { useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { SIGN_UP_URL } from "@/lib/site";

/** "Share" button that pops up a QR code (plus copy link) for the public sign-up page. */
export default function ShareSignUp() {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(SIGN_UP_URL);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable */
    }
  }

  return (
    <>
      <button onClick={() => setOpen(true)} style={shareBtnStyle}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <rect x="3" y="3" width="7" height="7" rx="1" />
          <rect x="14" y="3" width="7" height="7" rx="1" />
          <rect x="3" y="14" width="7" height="7" rx="1" />
          <path d="M14 14h3v3h-3zM20 14v.01M14 20h.01M17 20h4v-3" />
        </svg>
        Share sign-up
      </button>

      {open && (
        <div
          onClick={() => setOpen(false)}
          style={{ position: "fixed", inset: 0, zIndex: 50, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
        >
          <div
            role="dialog"
            aria-label="Sign-up QR code"
            onClick={(e) => e.stopPropagation()}
            style={{ background: "var(--ink-900, var(--ink-850))", border: "1px solid var(--ink-600)", borderRadius: 14, padding: 24, maxWidth: 380, width: "100%", textAlign: "center" }}
          >
            <h3 className="font-display" style={{ margin: "0 0 16px", color: "var(--parchment)", fontSize: 20 }}>
              Scan to sign up
            </h3>
            <div style={{ background: "#fff", borderRadius: 10, padding: 16, display: "inline-block", lineHeight: 0 }}>
              {/* Level H error correction keeps the code scannable with the MM logo covering its centre. */}
              <QRCodeSVG
                value={SIGN_UP_URL}
                size={260}
                level="H"
                imageSettings={{ src: "/mm-logo-svg.svg", width: 56, height: 56, excavate: true }}
              />
            </div>
            <p style={{ margin: "14px 0 16px", fontFamily: "var(--font-mono)", fontSize: 13, color: "var(--accent-400)", wordBreak: "break-all" }}>
              {SIGN_UP_URL.replace(/^https:\/\//, "")}
            </p>
            <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
              <button onClick={copyLink} style={dialogBtnStyle}>
                {copied ? "Copied!" : "Copy link"}
              </button>
              <button onClick={() => setOpen(false)} style={dialogBtnStyle}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

const shareBtnStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 8,
  width: "100%",
  padding: "12px 18px",
  fontSize: 15,
  fontWeight: 600,
  fontFamily: "var(--font-sans)",
  cursor: "pointer",
  borderRadius: 10,
  border: "1px solid color-mix(in srgb, var(--accent-400) 50%, transparent)",
  background: "color-mix(in srgb, var(--accent-400) 12%, var(--ink-850))",
  color: "var(--accent-300, var(--accent-400))",
};

const dialogBtnStyle: React.CSSProperties = {
  padding: "8px 16px",
  fontSize: 14,
  fontFamily: "var(--font-sans)",
  cursor: "pointer",
  borderRadius: 8,
  border: "1px solid var(--ink-600)",
  background: "var(--ink-850)",
  color: "var(--parchment-muted)",
};
