"use client";
import React, { useEffect, useState, useCallback } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ReferenceLine, ResponsiveContainer, Dot,
} from "recharts";
import { useAuth } from "../context/AuthContext";

/**
 * PatientTimeline.jsx  —  NeuroDL v2.0
 * ──────────────────────────────────────
 * Longitudinal chart showing confidence + diagnosis across ALL scans
 * for the currently logged-in patient.
 *
 * Shows:
 *   • Confidence line  (0–100%) with dots colour-coded by diagnosis class
 *   • Class change markers  (vertical dashed lines when diagnosis switches)
 *   • Hover tooltip with full scan detail
 *   • Summary row  — first scan, latest scan, trend arrow
 *
 * Data source: GET /history?per_page=100  (all scans, newest-last after sort)
 *
 * Usage — drop anywhere in the history page or patient profile:
 *   <PatientTimeline />
 */

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5001";

const CLASS_CFG = {
  "Glioma Tumor":     { color: "#dc2626", short: "Glioma"      },
  "Meningioma Tumor": { color: "#d97706", short: "Meningioma"  },
  "No Tumor":         { color: "#16a34a", short: "No Tumor"    },
  "Pituitary Tumor":  { color: "#2563eb", short: "Pituitary"   },
};

const fmtDate = (iso) =>
  new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "2-digit" });

const fmtDateFull = (iso) =>
  new Date(iso).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });

// ── Custom tooltip ─────────────────────────────────────────────────────────
const CustomTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  const d   = payload[0].payload;
  const cfg = CLASS_CFG[d.predicted_class] || { color: "#6b7280", short: d.predicted_class };

  return (
    <div style={{
      background: "white", border: "1px solid var(--color-border-light)",
      borderRadius: "var(--radius-md)", padding: "12px 14px",
      boxShadow: "var(--shadow-md)", minWidth: 200, fontSize: "0.82rem",
    }}>
      <p style={{ margin: "0 0 6px", fontSize: "0.7rem", color: "var(--color-text-light)" }}>
        {fmtDateFull(d.scan_timestamp)}
      </p>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
        <span style={{ width: 10, height: 10, borderRadius: "50%", background: cfg.color, flexShrink: 0 }} />
        <span style={{ fontWeight: 700, color: cfg.color }}>{d.predicted_class}</span>
      </div>
      <p style={{ margin: "0 0 2px", color: "var(--color-text-secondary)" }}>
        Confidence: <strong style={{ color: cfg.color }}>{(d.confidence_score * 100).toFixed(2)}%</strong>
      </p>
      <p style={{ margin: 0, color: "var(--color-text-light)" }}>
        Scan #{d.id}{d.patient_id ? ` · Patient #${d.patient_id}` : ""}
      </p>
      {d.classChanged && (
        <p style={{ margin: "6px 0 0", fontSize: "0.72rem", fontWeight: 700, color: "#d97706",
          background: "#fef9c3", padding: "2px 6px", borderRadius: 4 }}>
          ⚠ Diagnosis changed from previous scan
        </p>
      )}
    </div>
  );
};

// ── Custom dot (colour per class) ──────────────────────────────────────────
const ClassDot = (props) => {
  const { cx, cy, payload } = props;
  const cfg = CLASS_CFG[payload.predicted_class] || { color: "#6b7280" };
  return (
    <Dot
      cx={cx} cy={cy} r={payload.classChanged ? 7 : 5}
      fill={cfg.color} stroke="white" strokeWidth={2}
    />
  );
};

// ── Trend arrow ────────────────────────────────────────────────────────────
const TrendArrow = ({ first, last }) => {
  const diff = last - first;
  const up   = diff > 0;
  const same = Math.abs(diff) < 0.005;
  if (same) return <span style={{ color: "#6b7280", fontWeight: 700 }}>→ Stable</span>;
  return (
    <span style={{ color: up ? "#16a34a" : "#dc2626", fontWeight: 700, display: "flex", alignItems: "center", gap: 3 }}>
      {up ? "▲" : "▼"} {Math.abs(diff * 100).toFixed(1)}%
      <span style={{ fontWeight: 400, color: "var(--color-text-light)", fontSize: "0.78rem" }}>
        {up ? "confidence increased" : "confidence decreased"}
      </span>
    </span>
  );
};

// ── Main component ─────────────────────────────────────────────────────────
export default function PatientTimeline() {
  const { authFetch } = useAuth();
  const [data,    setData]    = useState([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      // Fetch up to 100 scans, sort oldest → newest for the timeline
      const res  = await authFetch(`${API_URL}/history?per_page=100&page=1`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();

      const sorted = [...(json.scans || [])]
        .sort((a, b) => new Date(a.scan_timestamp) - new Date(b.scan_timestamp))
        .map((s, i, arr) => ({
          ...s,
          label:        fmtDate(s.scan_timestamp),
          classChanged: i > 0 && s.predicted_class !== arr[i - 1].predicted_class,
        }));

      setData(sorted);
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  // ── States ──────────────────────────────────────────────────────────────
  if (loading) return (
    <div style={{ padding: 32, textAlign: "center" }}>
      <div style={{
        width: 32, height: 32, borderRadius: "50%", margin: "0 auto 12px",
        border: "3px solid var(--color-border)",
        borderTop: "3px solid var(--color-primary)",
        animation: "spin 0.8s linear infinite",
      }} />
      <p style={{ color: "var(--color-text-light)", fontSize: "0.85rem", margin: 0 }}>
        Building timeline…
      </p>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );

  if (error) return (
    <div className="alert alert-error">
      <span style={{ fontSize: "0.875rem" }}>Could not load timeline: {error}</span>
    </div>
  );

  if (data.length < 2) return (
    <div style={{
      textAlign: "center", padding: "32px 24px",
      background: "white", borderRadius: "var(--radius-lg)",
      border: "1px solid var(--color-border-light)",
    }}>
      <svg style={{ width: 40, height: 40, color: "var(--color-text-light)", margin: "0 auto 10px" }}
        fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
          d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
      </svg>
      <p style={{ fontWeight: 700, margin: "0 0 4px", color: "var(--color-text-primary)" }}>
        Timeline not yet available
      </p>
      <p style={{ fontSize: "0.82rem", color: "var(--color-text-light)", margin: 0 }}>
        You need at least 2 scans to see a longitudinal trend. Run another scan to unlock this view.
      </p>
    </div>
  );

  const first      = data[0];
  const latest     = data[data.length - 1];
  const firstCfg   = CLASS_CFG[first.predicted_class]  || { color: "#6b7280", short: first.predicted_class  };
  const latestCfg  = CLASS_CFG[latest.predicted_class] || { color: "#6b7280", short: latest.predicted_class };
  const diagChanged = first.predicted_class !== latest.predicted_class;
  const changeCount = data.filter(d => d.classChanged).length;

  // Reference lines where diagnosis changed
  const changePoints = data.filter(d => d.classChanged).map(d => d.label);

  return (
    <div style={{
      background: "white", borderRadius: "var(--radius-lg)",
      border: "1px solid var(--color-border-light)",
      overflow: "hidden",
      marginBottom: "var(--spacing-xl)",
    }}>

      {/* ── Header ── */}
      <div style={{
        padding: "16px 20px", background: "var(--color-bg-tertiary)",
        borderBottom: "1px solid var(--color-border-light)",
        display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <svg style={{ width: 18, height: 18, color: "var(--color-primary)" }}
            fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
          </svg>
          <h3 style={{ margin: 0, fontSize: "0.95rem", fontWeight: 700, color: "var(--color-text-primary)" }}>
            Longitudinal Trend
          </h3>
          <span style={{ fontSize: "0.72rem", color: "var(--color-text-light)" }}>
            {data.length} scan{data.length !== 1 ? "s" : ""} · {fmtDate(first.scan_timestamp)} → {fmtDate(latest.scan_timestamp)}
          </span>
        </div>

        {/* Diagnosis change alert */}
        {diagChanged && (
          <span style={{
            fontSize: "0.72rem", fontWeight: 700, padding: "3px 10px", borderRadius: 99,
            background: "#fef9c3", color: "#854d0e", border: "1px solid #fde68a",
          }}>
            ⚠ Diagnosis changed ({changeCount} time{changeCount !== 1 ? "s" : ""})
          </span>
        )}
      </div>

      {/* ── Summary row ── */}
      <div style={{
        display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
        gap: 0, borderBottom: "1px solid var(--color-border-light)",
      }}>
        {[
          {
            label: "First scan",
            value: <span style={{ color: firstCfg.color, fontWeight: 700 }}>{firstCfg.short}</span>,
            sub:   fmtDate(first.scan_timestamp),
          },
          {
            label: "Latest scan",
            value: <span style={{ color: latestCfg.color, fontWeight: 700 }}>{latestCfg.short}</span>,
            sub:   fmtDate(latest.scan_timestamp),
          },
          {
            label: "Confidence trend",
            value: <TrendArrow first={first.confidence_score} last={latest.confidence_score} />,
            sub:   `${(first.confidence_score * 100).toFixed(1)}% → ${(latest.confidence_score * 100).toFixed(1)}%`,
          },
          {
            label: "Diagnosis changes",
            value: <span style={{ fontWeight: 800, fontSize: "1.4rem", color: changeCount > 0 ? "#d97706" : "#16a34a" }}>
              {changeCount}
            </span>,
            sub: changeCount > 0 ? "Follow-up recommended" : "Stable diagnosis",
          },
        ].map(({ label, value, sub }, i, arr) => (
          <div key={label} style={{
            padding: "14px 20px",
            borderRight: i < arr.length - 1 ? "1px solid var(--color-border-light)" : "none",
          }}>
            <p style={{ margin: "0 0 3px", fontSize: "0.68rem", fontWeight: 700, color: "var(--color-text-light)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              {label}
            </p>
            <div style={{ fontSize: "0.9rem" }}>{value}</div>
            <p style={{ margin: "2px 0 0", fontSize: "0.7rem", color: "var(--color-text-light)" }}>{sub}</p>
          </div>
        ))}
      </div>

      {/* ── Chart ── */}
      <div style={{ padding: "20px 20px 12px" }}>
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={data} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 11, fill: "#9ca3af" }}
              tickLine={false}
              axisLine={{ stroke: "#e5e7eb" }}
            />
            <YAxis
              domain={[0, 100]}
              tickFormatter={v => `${v}%`}
              tick={{ fontSize: 11, fill: "#9ca3af" }}
              tickLine={false}
              axisLine={false}
              width={44}
            />
            <Tooltip content={<CustomTooltip />} />

            {/* Reference lines at diagnosis change points */}
            {changePoints.map(label => (
              <ReferenceLine
                key={label} x={label}
                stroke="#d97706" strokeDasharray="4 3"
                strokeWidth={1.5}
                label={{ value: "⚠", position: "top", fontSize: 11 }}
              />
            ))}

            <Line
              type="monotone"
              dataKey={d => d.confidence_score * 100}
              stroke="var(--color-primary, #e60023)"
              strokeWidth={2.5}
              dot={<ClassDot />}
              activeDot={{ r: 8, strokeWidth: 2 }}
              connectNulls
            />
          </LineChart>
        </ResponsiveContainer>

        {/* Legend */}
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 10 }}>
          {Object.entries(CLASS_CFG).map(([cls, cfg]) => {
            const appears = data.some(d => d.predicted_class === cls);
            if (!appears) return null;
            return (
              <span key={cls} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: "0.72rem", color: "var(--color-text-secondary)" }}>
                <span style={{ width: 10, height: 10, borderRadius: "50%", background: cfg.color, flexShrink: 0 }} />
                {cfg.short}
              </span>
            );
          })}
          {changeCount > 0 && (
            <span style={{ display: "flex", alignItems: "center", gap: 5, fontSize: "0.72rem", color: "#d97706" }}>
              <span style={{ borderBottom: "2px dashed #d97706", width: 14, display: "inline-block" }} />
              Diagnosis change
            </span>
          )}
        </div>
      </div>

      {/* ── Medical note ── */}
      {diagChanged && (
        <div style={{
          margin: "0 20px 16px",
          padding: "10px 14px",
          background: "#fffbeb", border: "1px solid #fde68a",
          borderRadius: "var(--radius-md)",
          fontSize: "0.78rem", color: "#78350f", lineHeight: 1.5,
        }}>
          <strong>Note:</strong> The diagnosis changed between scans. This may indicate tumour progression,
          response to treatment, or imaging variability. Consult a qualified radiologist to interpret these results.
        </div>
      )}
    </div>
  );
}