"use client";
import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "../context/AuthContext";

/**
 * Navbar.jsx  —  NeuroDL v2.0
 * ─────────────────────────────
 * Role-aware navigation:
 *   patient → Scan History + Analyse Scan
 *   doctor  → Doctor Portal + Analyse Scan
 */
export default function Navbar() {
  const pathname              = usePathname();
  const { user, logout }      = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  const isDoctor   = user?.role === "doctor";
  const isHistory  = pathname === "/history";
  const isDoctor_p  = pathname === "/doctor";
  const isAnalytics = pathname === "/model-analytics";

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => { setMenuOpen(false); }, [pathname]);

  // Role badge shown next to name
  const RoleBadge = () => (
    <span style={{
      fontSize: "0.62rem", fontWeight: 700, padding: "1px 7px",
      borderRadius: 99, textTransform: "uppercase", letterSpacing: "0.05em",
      background: isDoctor ? "#eff6ff" : "#f0fdf4",
      color:      isDoctor ? "#2563eb" : "#16a34a",
    }}>
      {isDoctor ? "Doctor" : "Patient"}
    </span>
  );

  return (
    <nav
      className="fixed top-0 inset-x-0 z-50 bg-white border-b border-gray-100"
      style={{ boxShadow: scrolled ? "var(--shadow-md)" : "none", transition: "box-shadow var(--transition-base)" }}
    >
      <div className="container">
        <div className="flex items-center justify-between h-20">

          {/* ── Logo ── */}
          <Link href="/" className="flex items-center gap-2 group">
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg"
              style={{ background: "linear-gradient(135deg, var(--color-primary) 0%, var(--color-primary-hover) 100%)" }}>
              <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
            <span className="text-2xl font-bold text-black">NeuroDL</span>
          </Link>

          {/* ── Desktop nav ── */}
          <div className="hidden md:flex items-center gap-6">
            {user ? (
              <>
                {/* Doctor-specific nav */}
                {isDoctor ? (
                  <Link href="/doctor"
                    className="flex items-center gap-1.5 text-sm font-semibold transition-colors"
                    style={{ color: isDoctor_p ? "#2563eb" : "var(--color-text-secondary)" }}>
                    <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    Doctor Portal
                    {isDoctor_p && <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#2563eb", display: "inline-block" }} />}
                  </Link>
                ) : (
                  /* Patient-specific nav */
                  <Link href="/history"
                    className="flex items-center gap-1.5 text-sm font-semibold transition-colors"
                    style={{ color: isHistory ? "var(--color-primary)" : "var(--color-text-secondary)" }}>
                    <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                    </svg>
                    Scan History
                    {isHistory && <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--color-primary)", display: "inline-block" }} />}
                  </Link>
                )}

                {/* Model Analytics — visible to all roles */}
                <Link href="/model-analytics"
                  className="flex items-center gap-1.5 text-sm font-semibold transition-colors"
                  style={{ color: isAnalytics ? "#7c3aed" : "var(--color-text-secondary)" }}>
                  <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                  Model Analytics
                  {isAnalytics && <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#7c3aed", display: "inline-block" }} />}
                </Link>

                {/* Analyse CTA — both roles can analyse */}
                <a href="/#analyze" className="btn btn-primary">Analyse Scan</a>

                {/* User info */}
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{
                    width: 36, height: 36, borderRadius: "50%", flexShrink: 0,
                    background: isDoctor
                      ? "linear-gradient(135deg, #2563eb, #1d4ed8)"
                      : "linear-gradient(135deg, var(--color-primary), var(--color-primary-hover))",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    color: "white", fontWeight: 700, fontSize: "0.9rem",
                  }}>
                    {user.full_name?.charAt(0).toUpperCase() || "U"}
                  </div>
                  <div>
                    <p style={{ margin: 0, fontSize: "0.82rem", fontWeight: 600, color: "var(--color-text-primary)", lineHeight: 1.2, maxWidth: 110, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {user.full_name}
                    </p>
                    <RoleBadge />
                  </div>
                  <button onClick={logout} className="btn btn-ghost btn-sm"
                    style={{ fontSize: "0.8rem", color: "var(--color-text-light)" }} title="Sign out">
                    <svg width="15" height="15" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                    </svg>
                    Sign out
                  </button>
                </div>
              </>
            ) : (
              <>
                <Link href="/login"  className="text-sm font-semibold" style={{ color: "var(--color-text-secondary)" }}>Sign In</Link>
                <Link href="/register" className="btn btn-primary">Get Started</Link>
              </>
            )}
          </div>

          {/* ── Mobile hamburger ── */}
          <button className="md:hidden btn btn-ghost btn-sm" onClick={() => setMenuOpen(o => !o)} aria-label="Toggle menu">
            {menuOpen
              ? <svg width="22" height="22" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              : <svg width="22" height="22" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
            }
          </button>
        </div>
      </div>

      {/* ── Mobile menu ── */}
      {menuOpen && (
        <div className="md:hidden border-t border-gray-100 bg-white" style={{ padding: "var(--spacing-md) var(--spacing-lg)" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--spacing-sm)" }}>
            {user ? (
              <>
                {/* User info */}
                <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "var(--spacing-sm) 0", borderBottom: "1px solid var(--color-border-light)", marginBottom: "var(--spacing-sm)" }}>
                  <div style={{
                    width: 36, height: 36, borderRadius: "50%", flexShrink: 0,
                    background: isDoctor ? "linear-gradient(135deg,#2563eb,#1d4ed8)" : "linear-gradient(135deg,var(--color-primary),var(--color-primary-hover))",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    color: "white", fontWeight: 700,
                  }}>
                    {user.full_name?.charAt(0).toUpperCase() || "U"}
                  </div>
                  <div>
                    <p style={{ margin: 0, fontWeight: 700, fontSize: "0.9rem", color: "var(--color-text-primary)" }}>{user.full_name}</p>
                    <RoleBadge />
                  </div>
                </div>

                {isDoctor
                  ? <Link href="/doctor" className="flex items-center gap-2 py-2 text-sm font-semibold" style={{ color: isDoctor_p ? "#2563eb" : "var(--color-text-secondary)" }}>
                      <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                      Doctor Portal
                    </Link>
                  : <Link href="/history" className="flex items-center gap-2 py-2 text-sm font-semibold" style={{ color: isHistory ? "var(--color-primary)" : "var(--color-text-secondary)" }}>
                      <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
                      Scan History
                    </Link>
                }

                <Link href="/model-analytics"
                  className="flex items-center gap-2 py-2 text-sm font-semibold"
                  style={{ color: isAnalytics ? "#7c3aed" : "var(--color-text-secondary)" }}>
                  <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                  Model Analytics
                </Link>
                <a href="/#analyze" className="btn btn-primary" style={{ justifyContent: "center" }}>Analyse Scan</a>
                <button onClick={logout} className="btn btn-ghost" style={{ justifyContent: "center", color: "var(--color-text-light)" }}>
                  <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
                  Sign out
                </button>
              </>
            ) : (
              <>
                <Link href="/login"    className="btn btn-ghost" style={{ justifyContent: "center" }}>Sign In</Link>
                <Link href="/register" className="btn btn-primary" style={{ justifyContent: "center" }}>Get Started</Link>
              </>
            )}
          </div>
        </div>
      )}
    </nav>
  );
}