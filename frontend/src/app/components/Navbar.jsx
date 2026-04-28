"use client";
import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * Navbar.jsx
 * ──────────
 * Updated for NeuroDL v2.0.
 *
 * Changes vs v1.0:
 *   - History link added
 *   - Active route highlighting
 *   - Mobile hamburger menu
 */

export default function Navbar() {
  const pathname              = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  // Shadow on scroll
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Close menu on route change
  useEffect(() => { setMenuOpen(false); }, [pathname]);

  const isHistory = pathname === "/history";

  return (
    <nav
      className="fixed top-0 inset-x-0 z-50 bg-white border-b border-gray-100"
      style={{
        boxShadow: scrolled ? "var(--shadow-md)" : "none",
        transition: "box-shadow var(--transition-base)",
      }}
    >
      <div className="container">
        <div className="flex items-center justify-between h-20">

          {/* ── Logo ── */}
          <Link href="/" className="flex items-center gap-2 group">
            <div
              className="w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg group-hover:shadow-xl transition-all duration-300"
              style={{
                background: "linear-gradient(135deg, var(--color-primary) 0%, var(--color-primary-hover) 100%)",
              }}
            >
              <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
            <span className="text-2xl font-bold text-black">NeuroDL</span>
          </Link>

          {/* ── Desktop nav ── */}
          <div className="hidden md:flex items-center gap-6">

            {/* History link */}
            <Link
              href="/history"
              className="flex items-center gap-1.5 text-sm font-semibold transition-colors"
              style={{
                color: isHistory
                  ? "var(--color-primary)"
                  : "var(--color-text-secondary)",
              }}
            >
              <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
              Scan History
              {isHistory && (
                <span
                  style={{
                    width: 6, height: 6,
                    borderRadius: "50%",
                    background: "var(--color-primary)",
                    display: "inline-block",
                  }}
                />
              )}
            </Link>

            {/* Analyse CTA */}
            <a href="/#analyze" className="btn btn-primary">
              Analyse Scan
            </a>
          </div>

          {/* ── Mobile hamburger ── */}
          <button
            className="md:hidden btn btn-ghost btn-sm"
            onClick={() => setMenuOpen((o) => !o)}
            aria-label="Toggle menu"
          >
            {menuOpen ? (
              <svg width="22" height="22" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : (
              <svg width="22" height="22" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* ── Mobile menu ── */}
      {menuOpen && (
        <div
          className="md:hidden border-t border-gray-100 bg-white"
          style={{ padding: "var(--spacing-md) var(--spacing-lg)" }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--spacing-sm)" }}>
            <Link
              href="/history"
              className="flex items-center gap-2 py-2 text-sm font-semibold"
              style={{ color: isHistory ? "var(--color-primary)" : "var(--color-text-secondary)" }}
            >
              <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
              Scan History
            </Link>
            <a href="/#analyze" className="btn btn-primary" style={{ width: "100%", justifyContent: "center" }}>
              Analyse Scan
            </a>
          </div>
        </div>
      )}
    </nav>
  );
}