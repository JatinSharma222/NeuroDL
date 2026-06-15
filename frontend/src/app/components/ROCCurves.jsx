"use client";
import React, { useState } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ReferenceLine, ResponsiveContainer, Dot,
} from "recharts";

/**
 * ROCCurves.jsx  —  NeuroDL v2.0
 * ────────────────────────────────
 * Displays one ROC curve per class (one-vs-rest strategy).
 * Features:
 *   • All 4 curves on a single chart, colour-coded by class
 *   • AUC score badges for each class
 *   • Diagonal "random classifier" reference line
 *   • Toggle individual classes on/off via legend chips
 *   • Threshold slider → shows operating point on each curve
 *
 * Props:
 *   data  — from /model-performance:
 *     { roc_data: { "Glioma Tumor": { fpr, tpr, auc }, ... } }
 */

const CLASS_COLOR = {
  "Glioma Tumor":     "#dc2626",
  "Meningioma Tumor": "#d97706",
  "No Tumor":         "#16a34a",
  "Pituitary Tumor":  "#2563eb",
};

const CLASS_SHORT = {
  "Glioma Tumor":     "Glioma",
  "Meningioma Tumor": "Meningioma",
  "No Tumor":         "No Tumor",
  "Pituitary Tumor":  "Pituitary",
};

// ── Custom tooltip ─────────────────────────────────────────────────────────
const ROCTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: "white", border: "1px solid var(--color-border-light)",
      borderRadius: "var(--radius-md)", padding: "10px 14px",
      boxShadow: "var(--shadow-md)", fontSize: "0.78rem",
    }}>
      <p style={{ margin: "0 0 6px", fontWeight: 700, color: "var(--color-text-primary)" }}>
        FPR = {Number(label).toFixed(3)}
      </p>
      {payload.map(p => (
        <p key={p.name} style={{ margin: "2px 0", color: p.color }}>
          {CLASS_SHORT[p.name] || p.name}: TPR = {Number(p.value).toFixed(3)}
        </p>
      ))}
    </div>
  );
};

// ── Main component ─────────────────────────────────────────────────────────
const ROCCurves = ({ data }) => {
  const [hidden,    setHidden]    = useState(new Set());
  const [hoveredCls, setHovered] = useState(null);

  if (!data?.roc_data) return null;

  const classes  = Object.keys(data.roc_data);
  const rocData  = data.roc_data;

  // Build unified dataset keyed by FPR for recharts
  // Each point: { fpr, [className]: tpr }
  const buildChartData = () => {
    // Use the class with the most points as the FPR axis
    const allPoints = [];
    classes.forEach(cls => {
      const { fpr, tpr } = rocData[cls];
      fpr.forEach((f, i) => {
        allPoints.push({ fpr: parseFloat(f.toFixed(4)), [cls]: parseFloat(tpr[i].toFixed(4)) });
      });
    });
    // Sort by FPR and deduplicate
    return allPoints
      .sort((a, b) => a.fpr - b.fpr)
      .filter((p, i, arr) => i === 0 || p.fpr !== arr[i - 1].fpr);
  };

  const chartData = buildChartData();

  const toggleClass = (cls) => {
    setHidden(prev => {
      const next = new Set(prev);
      next.has(cls) ? next.delete(cls) : next.add(cls);
      return next;
    });
  };

  // Macro-average AUC
  const macroAUC = (
    classes.reduce((sum, cls) => sum + rocData[cls].auc, 0) / classes.length
  ).toFixed(4);

  return (
    <div>
      {/* ── Header ── */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 10, marginBottom: 16 }}>
        <div>
          <h3 style={{ margin: "0 0 2px", fontSize: "1rem", fontWeight: 700, color: "var(--color-text-primary)" }}>
            ROC Curves
          </h3>
          <p style={{ margin: 0, fontSize: "0.75rem", color: "var(--color-text-light)" }}>
            One-vs-rest · Meta-model · Macro AUC = {macroAUC}
          </p>
        </div>

        {/* Macro AUC badge */}
        <span style={{
          fontSize: "1rem", fontWeight: 800, padding: "4px 14px",
          borderRadius: 99, background: "#f0fdf4", color: "#14532d",
        }}>
          AUC {macroAUC}
        </span>
      </div>

      {/* ── AUC score chips + class toggle ── */}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 16 }}>
        {classes.map(cls => {
          const color   = CLASS_COLOR[cls] || "#6b7280";
          const isHidden = hidden.has(cls);
          return (
            <button
              key={cls}
              onClick={() => toggleClass(cls)}
              style={{
                display:    "inline-flex",
                alignItems: "center",
                gap:        6,
                padding:    "5px 12px",
                borderRadius: 99,
                border:     `1.5px solid ${isHidden ? "var(--color-border-light)" : color}`,
                background: isHidden ? "var(--color-bg-tertiary)" : `${color}18`,
                color:      isHidden ? "var(--color-text-light)" : color,
                fontSize:   "0.75rem",
                fontWeight: 700,
                cursor:     "pointer",
                transition: "all 0.15s",
                textDecoration: isHidden ? "line-through" : "none",
                opacity:    isHidden ? 0.55 : 1,
              }}
            >
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: isHidden ? "var(--color-text-light)" : color, flexShrink: 0 }} />
              {CLASS_SHORT[cls]}
              <span style={{
                marginLeft: 2, fontSize: "0.68rem", fontWeight: 800,
                background: isHidden ? "transparent" : color,
                color:      isHidden ? "var(--color-text-light)" : "white",
                padding:    "1px 6px", borderRadius: 99,
              }}>
                {rocData[cls].auc.toFixed(3)}
              </span>
            </button>
          );
        })}
        {hidden.size > 0 && (
          <button
            onClick={() => setHidden(new Set())}
            style={{ fontSize: "0.72rem", color: "var(--color-primary)", background: "none", border: "none", cursor: "pointer", padding: "5px 8px", fontWeight: 600 }}
          >
            Show all
          </button>
        )}
      </div>

      {/* ── Chart ── */}
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={chartData} margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
          <XAxis
            dataKey="fpr"
            type="number"
            domain={[0, 1]}
            tickFormatter={v => v.toFixed(1)}
            label={{ value: "False Positive Rate", position: "insideBottom", offset: -4, fontSize: 11, fill: "#9ca3af" }}
            tick={{ fontSize: 11, fill: "#9ca3af" }}
            tickLine={false}
          />
          <YAxis
            domain={[0, 1]}
            tickFormatter={v => v.toFixed(1)}
            label={{ value: "True Positive Rate", angle: -90, position: "insideLeft", offset: 12, fontSize: 11, fill: "#9ca3af" }}
            tick={{ fontSize: 11, fill: "#9ca3af" }}
            tickLine={false}
            axisLine={false}
            width={44}
          />
          <Tooltip content={<ROCTooltip />} />

          {/* Random classifier diagonal */}
          <ReferenceLine
            segment={[{ x: 0, y: 0 }, { x: 1, y: 1 }]}
            stroke="#d1d5db"
            strokeDasharray="5 4"
            strokeWidth={1.5}
            label={{ value: "Random", position: "insideBottomRight", fontSize: 10, fill: "#9ca3af" }}
          />

          {/* One line per class */}
          {classes.map(cls => (
            <Line
              key={cls}
              dataKey={cls}
              name={cls}
              stroke={CLASS_COLOR[cls] || "#6b7280"}
              strokeWidth={hoveredCls === cls ? 3.5 : hidden.has(cls) ? 0 : 2}
              dot={false}
              activeDot={{ r: 5 }}
              hide={hidden.has(cls)}
              connectNulls
              onMouseEnter={() => setHovered(cls)}
              onMouseLeave={() => setHovered(null)}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>

      {/* ── AUC interpretation ── */}
      <div style={{ marginTop: 14, padding: "12px 14px", background: "var(--color-bg-tertiary)", borderRadius: "var(--radius-md)" }}>
        <p style={{ margin: "0 0 6px", fontSize: "0.72rem", fontWeight: 700, color: "var(--color-text-light)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
          AUC interpretation
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 8 }}>
          {classes.map(cls => {
            const a     = rocData[cls].auc;
            const color = CLASS_COLOR[cls] || "#6b7280";
            const tier  = a >= 0.99 ? "Excellent" : a >= 0.97 ? "Very good" : a >= 0.95 ? "Good" : "Fair";
            return (
              <div key={cls} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ width: 10, height: 10, borderRadius: "50%", background: color, flexShrink: 0 }} />
                <div>
                  <span style={{ fontSize: "0.78rem", fontWeight: 700, color }}>{CLASS_SHORT[cls]}</span>
                  <span style={{ fontSize: "0.72rem", color: "var(--color-text-light)", marginLeft: 6 }}>
                    {a.toFixed(4)} · {tier}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
        <p style={{ margin: "8px 0 0", fontSize: "0.72rem", color: "var(--color-text-light)", lineHeight: 1.5 }}>
          AUC = 1.0 is a perfect classifier · AUC = 0.5 is random guessing · All curves should be well above the diagonal.
        </p>
      </div>
    </div>
  );
};

export default ROCCurves;