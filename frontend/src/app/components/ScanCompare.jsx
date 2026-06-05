"use client";
import React, { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";

/**
 * ScanCompare.jsx
 * ───────────────
 * Side-by-side comparison of two scans selected from history.
 *
 * Usage:
 *   <ScanCompare scanIds={[12, 17]} onClose={() => ...} />
 *
 * Or used standalone on /history/compare?a=12&b=17
 *
 * Props:
 *   scanIds  ([int, int])  — two scan IDs to compare
 *   onClose  (fn|null)     — if provided, renders as a modal overlay
 */

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5001";

const CLASS_CONFIG = {
  "Glioma Tumor":     { color: "#dc2626", bg: "#fef2f2" },
  "Meningioma Tumor": { color: "#d97706", bg: "#fffbeb" },
  "No Tumor":         { color: "#16a34a", bg: "#f0fdf4" },
  "Pituitary Tumor":  { color: "#2563eb", bg: "#eff6ff" },
};

// ── Single scan column ─────────────────────────────────────────────
const ScanColumn = ({ scan, label }) => {
  if (!scan) return (
    <div style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "center", justifyContent: "center", minHeight: 300 }}>
      <p style={{ color: "var(--color-text-light)", fontSize: "0.875rem" }}>No scan selected</p>
    </div>
  );

  const cfg       = CLASS_CONFIG[scan.predicted_class] || { color: "#6b7280", bg: "#f9fafb" };
  const conf      = (scan.confidence_score * 100).toFixed(2);
  const date      = scan.scan_timestamp
    ? new Date(scan.scan_timestamp).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })
    : "—";

  return (
    <div style={{ flex: 1, minWidth: 0 }}>

      {/* Column header */}
      <div style={{
        background:   cfg.bg,
        border:       `2px solid ${cfg.color}`,
        borderRadius: "var(--radius-lg) var(--radius-lg) 0 0",
        padding:      "12px 16px",
        display:      "flex",
        alignItems:   "center",
        justifyContent: "space-between",
        flexWrap:     "wrap",
        gap:          8,
      }}>
        <span style={{ fontSize: "0.72rem", fontWeight: 700, color: "var(--color-text-light)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
          {label}
        </span>
        <span style={{ fontSize: "0.78rem", fontWeight: 700, color: cfg.color }}>
          Scan #{scan.id}
        </span>
      </div>

      {/* Body */}
      <div style={{
        border:       `1.5px solid ${cfg.color}`,
        borderTop:    "none",
        borderRadius: "0 0 var(--radius-lg) var(--radius-lg)",
        background:   "white",
        overflow:     "hidden",
      }}>

        {/* Diagnosis */}
        <div style={{ padding: "16px", borderBottom: "1px solid var(--color-border-light)" }}>
          <p style={{ margin: "0 0 4px", fontSize: "0.72rem", fontWeight: 700, color: "var(--color-text-light)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Diagnosis</p>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <span style={{
              fontSize: "1rem", fontWeight: 800, color: cfg.color,
            }}>
              {scan.predicted_class}
            </span>
            <span style={{
              fontSize: "0.75rem", fontWeight: 700, padding: "2px 9px",
              borderRadius: 99, background: cfg.bg, color: cfg.color,
            }}>
              {conf}%
            </span>
          </div>
        </div>

        {/* Meta */}
        <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--color-border-light)", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <div>
            <p style={{ margin: "0 0 2px", fontSize: "0.68rem", fontWeight: 700, color: "var(--color-text-light)", textTransform: "uppercase" }}>Date</p>
            <p style={{ margin: 0, fontSize: "0.8rem", color: "var(--color-text-primary)", fontWeight: 600 }}>{date}</p>
          </div>
          <div>
            <p style={{ margin: "0 0 2px", fontSize: "0.68rem", fontWeight: 700, color: "var(--color-text-light)", textTransform: "uppercase" }}>File</p>
            <p style={{ margin: 0, fontSize: "0.78rem", color: "var(--color-text-secondary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {scan.file_name || "—"}
            </p>
          </div>
        </div>

        {/* Feature flags */}
        <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--color-border-light)", display: "flex", gap: 8, flexWrap: "wrap" }}>
          {[
            { label: "Segmentation", active: scan.segmentation_performed },
            { label: "Grad-CAM",     active: scan.gradcam_performed      },
            { label: "AI Report",    active: !!scan.report_text          },
          ].map(({ label, active }) => (
            <span key={label} style={{
              fontSize: "0.72rem", fontWeight: 700,
              padding: "3px 9px", borderRadius: 99,
              background: active ? "#dcfce7" : "var(--color-bg-tertiary)",
              color:      active ? "#15803d" : "var(--color-text-light)",
            }}>
              {active ? "✓" : "✗"} {label}
            </span>
          ))}
        </div>

        {/* Confidence bar */}
        <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--color-border-light)" }}>
          <p style={{ margin: "0 0 6px", fontSize: "0.72rem", fontWeight: 700, color: "var(--color-text-light)", textTransform: "uppercase" }}>Confidence</p>
          <div style={{ height: 10, background: "var(--color-bg-tertiary)", borderRadius: 99, overflow: "hidden" }}>
            <div style={{
              height: "100%", width: `${conf}%`,
              background: cfg.color, borderRadius: 99,
              transition: "width 0.6s ease",
            }} />
          </div>
          <p style={{ margin: "4px 0 0", fontSize: "0.75rem", fontWeight: 700, color: cfg.color }}>{conf}%</p>
        </div>

        {/* Report excerpt */}
        {scan.report_text && (
          <div style={{ padding: "12px 16px" }}>
            <p style={{ margin: "0 0 6px", fontSize: "0.72rem", fontWeight: 700, color: "var(--color-text-light)", textTransform: "uppercase" }}>Report Excerpt</p>
            <p style={{
              margin: 0, fontSize: "0.78rem", color: "var(--color-text-secondary)",
              lineHeight: 1.55, maxHeight: 120, overflow: "hidden",
              display: "-webkit-box", WebkitLineClamp: 6, WebkitBoxOrient: "vertical",
            }}>
              {scan.report_text.slice(0, 400)}
              {scan.report_text.length > 400 ? "…" : ""}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

// ── Delta badge ────────────────────────────────────────────────────
const DeltaBadge = ({ a, b }) => {
  if (a == null || b == null) return null;
  const delta = ((b - a) * 100).toFixed(1);
  const up    = b > a;
  const same  = Math.abs(b - a) < 0.001;
  if (same) return <span style={{ fontSize: "0.72rem", color: "var(--color-text-light)" }}>no change</span>;
  return (
    <span style={{
      fontSize: "0.75rem", fontWeight: 700,
      padding: "2px 8px", borderRadius: 99,
      background: up ? "#dcfce7" : "#fee2e2",
      color:      up ? "#15803d" : "#dc2626",
    }}>
      {up ? "▲" : "▼"} {Math.abs(delta)}%
    </span>
  );
};

// ── Main component ─────────────────────────────────────────────────
export default function ScanCompare({ scanIds = [], onClose = null }) {
  const { authFetch }   = useAuth();
  const [scans, setScans] = useState([null, null]);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState(null);

  useEffect(() => {
    if (!scanIds || scanIds.length < 2) return;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const [resA, resB] = await Promise.all([
          authFetch(`${API_URL}/history/${scanIds[0]}`),
          authFetch(`${API_URL}/history/${scanIds[1]}`),
        ]);
        if (!resA.ok || !resB.ok) throw new Error("Could not load one or both scans");
        const [a, b] = await Promise.all([resA.json(), resB.json()]);
        setScans([a, b]);
      } catch (e) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [scanIds]);

  const [scanA, scanB] = scans;
  const sameClass      = scanA && scanB && scanA.predicted_class === scanB.predicted_class;
  const confDelta      = scanA && scanB ? scanB.confidence_score - scanA.confidence_score : null;

  const wrapper = {
    background:   "white",
    borderRadius: "var(--radius-lg)",
    border:       "1px solid var(--color-border-light)",
    overflow:     "hidden",
    boxShadow:    "var(--shadow-lg)",
  };

  return (
    <div style={onClose ? {
      position: "fixed", inset: 0, zIndex: 9999,
      background: "rgba(0,0,0,0.55)",
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: "var(--spacing-lg)",
      backdropFilter: "blur(4px)",
    } : {}}>
      <div style={onClose ? { ...wrapper, width: "100%", maxWidth: 860, maxHeight: "90vh", overflow: "auto" } : wrapper}>

        {/* Header */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "16px 20px",
          borderBottom: "1px solid var(--color-border-light)",
          background: "var(--color-bg-tertiary)",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <svg style={{ width: 20, height: 20, color: "var(--color-primary)" }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            <h2 style={{ margin: 0, fontSize: "1rem", fontWeight: 800, color: "var(--color-text-primary)" }}>
              Scan Comparison
            </h2>
            {scanA && scanB && (
              <span style={{ fontSize: "0.75rem", color: "var(--color-text-light)" }}>
                #{scanA.id} vs #{scanB.id}
              </span>
            )}
          </div>
          {onClose && (
            <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--color-text-light)", padding: 4 }}>
              <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        {/* Content */}
        <div style={{ padding: "var(--spacing-lg)" }}>

          {loading && (
            <div style={{ display: "flex", justifyContent: "center", padding: 40 }}>
              <div style={{
                width: 36, height: 36, borderRadius: "50%",
                border: "3px solid var(--color-border)",
                borderTop: "3px solid var(--color-primary)",
                animation: "spin 0.8s linear infinite",
              }} />
              <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            </div>
          )}

          {error && (
            <div className="alert alert-error">{error}</div>
          )}

          {!loading && !error && (
            <>
              {/* Delta summary bar */}
              {scanA && scanB && (
                <div style={{
                  display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center",
                  padding: "10px 14px", marginBottom: "var(--spacing-lg)",
                  background: sameClass ? "#f0fdf4" : "#fef9c3",
                  border: `1px solid ${sameClass ? "#bbf7d0" : "#fde68a"}`,
                  borderRadius: "var(--radius-md)",
                  fontSize: "0.82rem",
                }}>
                  <span style={{ fontWeight: 700, color: sameClass ? "#14532d" : "#78350f" }}>
                    {sameClass
                      ? `✓ Both scans agree: ${scanA.predicted_class}`
                      : `⚠ Diagnosis changed: ${scanA.predicted_class} → ${scanB.predicted_class}`}
                  </span>
                  {confDelta !== null && (
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <span style={{ color: "var(--color-text-light)" }}>Confidence:</span>
                      <DeltaBadge a={scanA.confidence_score} b={scanB.confidence_score} />
                    </div>
                  )}
                </div>
              )}

              {/* Two columns */}
              <div style={{ display: "flex", gap: "var(--spacing-md)", alignItems: "flex-start" }}>
                <ScanColumn scan={scanA} label="Scan A (Earlier)" />

                {/* Divider */}
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, paddingTop: 48, flexShrink: 0 }}>
                  <div style={{ width: 1, height: 40, background: "var(--color-border)" }} />
                  <span style={{ fontSize: "0.72rem", fontWeight: 700, color: "var(--color-text-light)", background: "white", padding: "2px 6px", border: "1px solid var(--color-border)", borderRadius: 99 }}>VS</span>
                  <div style={{ width: 1, height: 40, background: "var(--color-border)" }} />
                </div>

                <ScanColumn scan={scanB} label="Scan B (Later)" />
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}