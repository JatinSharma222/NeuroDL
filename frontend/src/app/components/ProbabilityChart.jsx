"use client";
import React from "react";

/**
 * ProbabilityChart.jsx
 * ────────────────────
 * Displays the full softmax probability distribution across all 4 classes.
 * Shows the model is making a probabilistic decision, not a binary one —
 * critical for any serious ML project evaluation.
 *
 * Props:
 *   probabilities  (object) — { "Glioma Tumor": 0.9953, "Meningioma Tumor": 0.002, ... }
 *   predictedClass (string) — name of the winning class
 */

const CLASS_CONFIG = {
  "Glioma Tumor":     { color: "#dc2626", bg: "#fef2f2", label: "Glioma"     },
  "Meningioma Tumor": { color: "#d97706", bg: "#fffbeb", label: "Meningioma" },
  "No Tumor":         { color: "#16a34a", bg: "#f0fdf4", label: "No Tumor"   },
  "Pituitary Tumor":  { color: "#2563eb", bg: "#eff6ff", label: "Pituitary"  },
};

// Order to always display bars in
const CLASS_ORDER = ["Glioma Tumor", "Meningioma Tumor", "Pituitary Tumor", "No Tumor"];

const ProbabilityChart = ({ probabilities, predictedClass }) => {
  if (!probabilities || Object.keys(probabilities).length === 0) return null;

  return (
    <div
      style={{
        background:   "white",
        border:       "1px solid var(--color-border-light)",
        borderRadius: "var(--radius-lg)",
        padding:      "var(--spacing-lg)",
        marginTop:    "var(--spacing-lg)",
      }}
    >
      {/* Header */}
      <div style={{ marginBottom: "var(--spacing-lg)" }}>
        <h3 style={{ fontSize: "1rem", fontWeight: 700, color: "var(--color-text-primary)", margin: 0 }}>
          Class Probability Distribution
        </h3>
        <p style={{ margin: "4px 0 0", fontSize: "0.78rem", color: "var(--color-text-light)" }}>
          Softmax scores across all 4 classes — not just the top prediction
        </p>
      </div>

      {/* Bars */}
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {CLASS_ORDER.map((className) => {
          const prob      = probabilities[className] ?? 0;
          const pct       = (prob * 100).toFixed(2);
          const cfg       = CLASS_CONFIG[className] || { color: "#6b7280", bg: "#f9fafb", label: className };
          const isWinner  = className === predictedClass;
          const barWidth  = `${Math.max(prob * 100, 0.5)}%`;

          return (
            <div key={className}>
              {/* Label row */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 5 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                  <span style={{
                    width: 10, height: 10, borderRadius: "50%",
                    background: cfg.color, flexShrink: 0,
                  }} />
                  <span style={{
                    fontSize:   "0.82rem",
                    fontWeight: isWinner ? 700 : 500,
                    color:      isWinner ? cfg.color : "var(--color-text-secondary)",
                  }}>
                    {cfg.label}
                  </span>
                  {isWinner && (
                    <span style={{
                      fontSize:     "0.65rem",
                      fontWeight:   700,
                      padding:      "1px 7px",
                      borderRadius: 99,
                      background:   cfg.bg,
                      color:        cfg.color,
                      textTransform:"uppercase",
                      letterSpacing:"0.04em",
                    }}>
                      Predicted
                    </span>
                  )}
                </div>
                <span style={{
                  fontSize:   "0.82rem",
                  fontWeight: isWinner ? 700 : 400,
                  color:      isWinner ? cfg.color : "var(--color-text-light)",
                  fontVariantNumeric: "tabular-nums",
                }}>
                  {pct}%
                </span>
              </div>

              {/* Bar track */}
              <div style={{
                width:        "100%",
                height:       10,
                background:   "var(--color-bg-tertiary)",
                borderRadius: 99,
                overflow:     "hidden",
              }}>
                <div
                  style={{
                    width:        barWidth,
                    height:       "100%",
                    background:   cfg.color,
                    borderRadius: 99,
                    opacity:      isWinner ? 1 : 0.5,
                    transition:   "width 0.6s cubic-bezier(0.4,0,0.2,1)",
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer note */}
      <p style={{
        marginTop:  "var(--spacing-md)",
        fontSize:   "0.72rem",
        color:      "var(--color-text-light)",
        borderTop:  "1px solid var(--color-border-light)",
        paddingTop: "var(--spacing-sm)",
      }}>
        All bars sum to 100% · Model: ResNet50V2 fine-tuned · Input: 224×224
      </p>
    </div>
  );
};

export default ProbabilityChart;