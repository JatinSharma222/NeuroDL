"use client";
import React, { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";

/**
 * AnalyticsDashboard.jsx
 * ──────────────────────
 * Displays aggregated analytics for the authenticated user's scan history.
 *
 * Sections:
 *   1. KPI cards  — total scans, avg confidence, most common class
 *   2. Class distribution — horizontal bar chart
 *   3. Scans per day — sparkline (last 30 days)
 *   4. Feature usage — segmentation / grad-cam / report counts
 */

const CLASS_CONFIG = {
  "Glioma Tumor":     { color: "#dc2626", bg: "#fef2f2", short: "Glioma"     },
  "Meningioma Tumor": { color: "#d97706", bg: "#fffbeb", short: "Meningioma" },
  "No Tumor":         { color: "#16a34a", bg: "#f0fdf4", short: "No Tumor"   },
  "Pituitary Tumor":  { color: "#2563eb", bg: "#eff6ff", short: "Pituitary"  },
};

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5001";

// ── tiny sparkline SVG ─────────────────────────────────────────────
const Sparkline = ({ data, color = "#dc2626" }) => {
  if (!data || data.length === 0) return null;
  const counts  = data.map((d) => d.count);
  const max     = Math.max(...counts, 1);
  const W       = 340;
  const H       = 56;
  const pad     = 4;
  const step    = (W - pad * 2) / (counts.length - 1);

  const pts = counts.map((v, i) => {
    const x = pad + i * step;
    const y = H - pad - ((v / max) * (H - pad * 2));
    return `${x},${y}`;
  });

  const area = [
    `M${pad},${H - pad}`,
    ...counts.map((v, i) => {
      const x = pad + i * step;
      const y = H - pad - ((v / max) * (H - pad * 2));
      return `L${x},${y}`;
    }),
    `L${pad + (counts.length - 1) * step},${H - pad}`,
    "Z",
  ].join(" ");

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: H }}>
      <defs>
        <linearGradient id="sg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor={color} stopOpacity="0.25" />
          <stop offset="100%" stopColor={color} stopOpacity="0.02" />
        </linearGradient>
      </defs>
      <path d={area} fill="url(#sg)" />
      <polyline points={pts.join(" ")} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      {/* Last point dot */}
      {(() => {
        const last = counts.length - 1;
        const x    = pad + last * step;
        const y    = H - pad - ((counts[last] / max) * (H - pad * 2));
        return <circle cx={x} cy={y} r="3.5" fill={color} />;
      })()}
    </svg>
  );
};

export default function AnalyticsDashboard() {
  const { authFetch }     = useAuth();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);

  useEffect(() => {
    const load = async () => {
      try {
        const res  = await authFetch(`${API_URL}/stats`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        setStats(data);
      } catch (e) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  if (loading) return (
    <div style={{ display: "flex", justifyContent: "center", padding: "40px 0" }}>
      <div style={{
        width: 36, height: 36, borderRadius: "50%",
        border: "3px solid var(--color-border)",
        borderTop: "3px solid var(--color-primary)",
        animation: "spin 0.8s linear infinite",
      }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );

  if (error) return (
    <div className="alert alert-error" style={{ marginBottom: "var(--spacing-lg)" }}>
      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd"/>
      </svg>
      <span>Could not load analytics: {error}</span>
    </div>
  );

  if (!stats || stats.total === 0) return (
    <div style={{
      textAlign: "center", padding: "40px 24px",
      background: "white", borderRadius: "var(--radius-lg)",
      border: "1px solid var(--color-border-light)",
      marginBottom: "var(--spacing-xl)",
    }}>
      <svg style={{ width: 48, height: 48, color: "var(--color-text-light)", margin: "0 auto 12px" }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
      <p style={{ fontWeight: 700, color: "var(--color-text-primary)", marginBottom: 4 }}>No analytics yet</p>
      <p style={{ fontSize: "0.875rem", color: "var(--color-text-light)" }}>Run your first scan to see analytics here.</p>
    </div>
  );

  // ── Derived values ──────────────────────────────────────────────
  const topClass    = Object.entries(stats.class_distribution).sort((a, b) => b[1] - a[1])[0];
  const topCfg      = CLASS_CONFIG[topClass?.[0]] || { color: "#6b7280", bg: "#f9fafb", short: topClass?.[0] };
  const totalScansLast30 = stats.scans_per_day.reduce((s, d) => s + d.count, 0);
  const maxDist     = Math.max(...Object.values(stats.class_distribution), 1);

  const card = {
    background: "white", borderRadius: "var(--radius-lg)",
    border: "1px solid var(--color-border-light)",
    padding: "var(--spacing-lg)",
  };

  return (
    <div style={{ marginBottom: "var(--spacing-xl)" }}>

      {/* ── Section header ── */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: "var(--spacing-lg)" }}>
        <svg style={{ width: 20, height: 20, color: "var(--color-primary)", flexShrink: 0 }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
        <h2 style={{ fontSize: "1.15rem", fontWeight: 800, color: "var(--color-text-primary)", margin: 0 }}>
          Analytics Overview
        </h2>
        <span style={{ fontSize: "0.72rem", color: "var(--color-text-light)", marginLeft: "auto" }}>
          All-time · {stats.total} scan{stats.total !== 1 ? "s" : ""}
        </span>
      </div>

      {/* ── KPI row ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: "var(--spacing-md)", marginBottom: "var(--spacing-lg)" }}>

        {/* Total scans */}
        <div style={card}>
          <p style={{ margin: "0 0 4px", fontSize: "0.72rem", fontWeight: 700, color: "var(--color-text-light)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Total Scans</p>
          <p style={{ margin: 0, fontSize: "2rem", fontWeight: 800, color: "var(--color-primary)", lineHeight: 1.1 }}>{stats.total}</p>
        </div>

        {/* Avg confidence */}
        <div style={card}>
          <p style={{ margin: "0 0 4px", fontSize: "0.72rem", fontWeight: 700, color: "var(--color-text-light)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Avg Confidence</p>
          <p style={{ margin: 0, fontSize: "2rem", fontWeight: 800, color: "#16a34a", lineHeight: 1.1 }}>{(stats.overall_avg_confidence * 100).toFixed(1)}%</p>
        </div>

        {/* Most common class */}
        <div style={card}>
          <p style={{ margin: "0 0 4px", fontSize: "0.72rem", fontWeight: 700, color: "var(--color-text-light)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Most Common</p>
          <p style={{ margin: 0, fontSize: "1.25rem", fontWeight: 800, color: topCfg.color, lineHeight: 1.2 }}>{topCfg.short}</p>
          <p style={{ margin: "2px 0 0", fontSize: "0.75rem", color: "var(--color-text-light)" }}>{topClass?.[1]} scan{topClass?.[1] !== 1 ? "s" : ""}</p>
        </div>

        {/* Last 30 days */}
        <div style={card}>
          <p style={{ margin: "0 0 4px", fontSize: "0.72rem", fontWeight: 700, color: "var(--color-text-light)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Last 30 Days</p>
          <p style={{ margin: 0, fontSize: "2rem", fontWeight: 800, color: "#2563eb", lineHeight: 1.1 }}>{totalScansLast30}</p>
        </div>
      </div>

      {/* ── Bottom row: distribution + sparkline + features ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "var(--spacing-md)" }}>

        {/* Class distribution */}
        <div style={card}>
          <p style={{ margin: "0 0 var(--spacing-md)", fontSize: "0.82rem", fontWeight: 700, color: "var(--color-text-primary)" }}>Class Distribution</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {Object.entries(stats.class_distribution)
              .sort((a, b) => b[1] - a[1])
              .map(([cls, count]) => {
                const cfg = CLASS_CONFIG[cls] || { color: "#6b7280", bg: "#f9fafb", short: cls };
                const pct = ((count / stats.total) * 100).toFixed(1);
                const avgConf = stats.avg_confidence[cls];
                return (
                  <div key={cls}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <span style={{ width: 9, height: 9, borderRadius: "50%", background: cfg.color, flexShrink: 0 }} />
                        <span style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--color-text-secondary)" }}>{cfg.short}</span>
                      </div>
                      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                        {avgConf && (
                          <span style={{ fontSize: "0.72rem", color: "var(--color-text-light)" }}>
                            avg {(avgConf * 100).toFixed(1)}%
                          </span>
                        )}
                        <span style={{ fontSize: "0.8rem", fontWeight: 700, color: "var(--color-text-primary)" }}>{count}</span>
                      </div>
                    </div>
                    <div style={{ height: 8, background: "var(--color-bg-tertiary)", borderRadius: 99, overflow: "hidden" }}>
                      <div style={{
                        height: "100%", borderRadius: 99, background: cfg.color,
                        width: `${(count / maxDist) * 100}%`,
                        transition: "width 0.6s cubic-bezier(0.4,0,0.2,1)",
                      }} />
                    </div>
                    <p style={{ margin: "3px 0 0", fontSize: "0.7rem", color: "var(--color-text-light)" }}>{pct}% of all scans</p>
                  </div>
                );
              })}
          </div>
        </div>

        {/* Scans per day sparkline */}
        <div style={card}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "var(--spacing-sm)" }}>
            <p style={{ margin: 0, fontSize: "0.82rem", fontWeight: 700, color: "var(--color-text-primary)" }}>Scans Over Time</p>
            <span style={{ fontSize: "0.72rem", color: "var(--color-text-light)" }}>Last 30 days</span>
          </div>
          <Sparkline data={stats.scans_per_day} color="var(--color-primary)" />
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6 }}>
            <span style={{ fontSize: "0.7rem", color: "var(--color-text-light)" }}>
              {stats.scans_per_day[0]?.date?.slice(5)}
            </span>
            <span style={{ fontSize: "0.7rem", color: "var(--color-text-light)" }}>
              {stats.scans_per_day[stats.scans_per_day.length - 1]?.date?.slice(5)}
            </span>
          </div>

          {/* Feature usage */}
          <div style={{
            marginTop: "var(--spacing-md)", paddingTop: "var(--spacing-md)",
            borderTop: "1px solid var(--color-border-light)",
            display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8,
          }}>
            {[
              { label: "Seg", key: "segmentation", color: "#16a34a" },
              { label: "CAM", key: "gradcam",       color: "#d97706" },
              { label: "Report", key: "report",     color: "#2563eb" },
            ].map(({ label, key, color }) => {
              const count = stats.feature_usage[key] ?? 0;
              const pct   = stats.total > 0 ? Math.round((count / stats.total) * 100) : 0;
              return (
                <div key={key} style={{ textAlign: "center" }}>
                  <p style={{ margin: 0, fontSize: "1.2rem", fontWeight: 800, color }}>{pct}%</p>
                  <p style={{ margin: "2px 0 0", fontSize: "0.68rem", color: "var(--color-text-light)" }}>{label}</p>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}