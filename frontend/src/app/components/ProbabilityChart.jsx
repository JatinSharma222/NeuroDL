"use client";
import React from "react";

/**
 * ProbabilityChart.jsx
 * ────────────────────
 * Shows full softmax distribution + MC Dropout uncertainty bands.
 *
 * Props:
 *   probabilities  (object) — { "Glioma Tumor": 0.9953, ... }
 *   predictedClass (string) — winning class name
 *   uncertainty    (object|null) — from /predict:
 *     { mc_samples, pred_std, pred_entropy, is_uncertain, class_std, class_mean }
 */

const CLASS_CONFIG = {
  "Glioma Tumor":     { color: "#dc2626", bg: "#fef2f2", label: "Glioma"     },
  "Meningioma Tumor": { color: "#d97706", bg: "#fffbeb", label: "Meningioma" },
  "No Tumor":         { color: "#16a34a", bg: "#f0fdf4", label: "No Tumor"   },
  "Pituitary Tumor":  { color: "#2563eb", bg: "#eff6ff", label: "Pituitary"  },
};

const CLASS_ORDER = ["Glioma Tumor", "Meningioma Tumor", "Pituitary Tumor", "No Tumor"];

const stdColor = (std) => {
  if (std < 0.03) return { bg: "#dcfce7", color: "#15803d" };
  if (std < 0.08) return { bg: "#fef9c3", color: "#854d0e" };
  return              { bg: "#fee2e2", color: "#dc2626"  };
};

const ProbabilityChart = ({ probabilities, predictedClass, uncertainty }) => {
  if (!probabilities || Object.keys(probabilities).length === 0) return null;

  const hasUncertainty = uncertainty && uncertainty.class_std;
  const isUncertain    = uncertainty?.is_uncertain;

  return (
    <div style={{
      background:   "white",
      border:       `1.5px solid ${isUncertain ? "#fca5a5" : "var(--color-border-light)"}`,
      borderRadius: "var(--radius-lg)",
      padding:      "var(--spacing-lg)",
      marginTop:    "var(--spacing-lg)",
    }}>

      {/* Header */}
      <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", flexWrap:"wrap", gap:8, marginBottom:"var(--spacing-lg)" }}>
        <div>
          <h3 style={{ fontSize:"1rem", fontWeight:700, color:"var(--color-text-primary)", margin:0 }}>
            Class Probability Distribution
          </h3>
          <p style={{ margin:"4px 0 0", fontSize:"0.78rem", color:"var(--color-text-light)" }}>
            Softmax scores across all 4 classes
            {hasUncertainty && ` · MC Dropout (T=${uncertainty.mc_samples})`}
          </p>
        </div>
        {hasUncertainty && (
          <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
            <span style={{ fontSize:"0.72rem", fontWeight:700, padding:"3px 9px", borderRadius:99, ...stdColor(uncertainty.pred_std) }}>
              σ = {uncertainty.pred_std.toFixed(4)}
            </span>
            <span style={{ fontSize:"0.72rem", fontWeight:700, padding:"3px 9px", borderRadius:99, background:"#f0f9ff", color:"#0369a1" }}>
              H = {uncertainty.pred_entropy.toFixed(3)}
            </span>
          </div>
        )}
      </div>

      {/* Uncertainty warning */}
      {isUncertain && (
        <div style={{
          display:"flex", gap:10, alignItems:"flex-start",
          background:"#fffbeb", border:"1px solid #fde68a",
          borderRadius:"var(--radius-md)", padding:"10px 14px",
          marginBottom:"var(--spacing-lg)",
        }}>
          <svg style={{ width:18, height:18, color:"#d97706", flexShrink:0, marginTop:1 }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
          </svg>
          <div>
            <p style={{ margin:0, fontWeight:700, fontSize:"0.82rem", color:"#92400e" }}>High Prediction Uncertainty</p>
            <p style={{ margin:"3px 0 0", fontSize:"0.76rem", color:"#78350f", lineHeight:1.4 }}>
              MC Dropout σ={uncertainty.pred_std.toFixed(4)} exceeds threshold (0.08).
              The model is not confident on this scan — consider expert review.
            </p>
          </div>
        </div>
      )}

      {/* Bars */}
      <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
        {CLASS_ORDER.map((className) => {
          const prob     = probabilities[className] ?? 0;
          const pct      = (prob * 100).toFixed(2);
          const cfg      = CLASS_CONFIG[className] || { color:"#6b7280", bg:"#f9fafb", label:className };
          const isWinner = className === predictedClass;
          const std      = hasUncertainty ? (uncertainty.class_std[className] ?? 0) : null;
          const mean     = hasUncertainty ? (uncertainty.class_mean[className] ?? prob) : prob;
          const bandLeft  = Math.max((mean - (std ?? 0)) * 100, 0);
          const bandRight = Math.min((mean + (std ?? 0)) * 100, 100);

          return (
            <div key={className}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:6 }}>
                <div style={{ display:"flex", alignItems:"center", gap:7, flexWrap:"wrap" }}>
                  <span style={{ width:10, height:10, borderRadius:"50%", background:cfg.color, flexShrink:0 }} />
                  <span style={{ fontSize:"0.83rem", fontWeight:isWinner?700:500, color:isWinner?cfg.color:"var(--color-text-secondary)" }}>
                    {cfg.label}
                  </span>
                  {isWinner && (
                    <span style={{ fontSize:"0.65rem", fontWeight:700, padding:"1px 7px", borderRadius:99, background:cfg.bg, color:cfg.color, textTransform:"uppercase", letterSpacing:"0.04em" }}>
                      Predicted
                    </span>
                  )}
                  {std !== null && (
                    <span style={{ fontSize:"0.65rem", fontWeight:600, padding:"1px 6px", borderRadius:99, ...stdColor(std) }}>
                      ±{std.toFixed(3)}
                    </span>
                  )}
                </div>
                <span style={{ fontSize:"0.83rem", fontWeight:isWinner?700:400, color:isWinner?cfg.color:"var(--color-text-light)", fontVariantNumeric:"tabular-nums" }}>
                  {pct}%
                </span>
              </div>

              {/* Track */}
              <div style={{ position:"relative", width:"100%", height:12, borderRadius:99, background:"var(--color-bg-tertiary)", overflow:"hidden" }}>
                {/* Main bar */}
                <div style={{
                  position:"absolute", left:0, top:0, bottom:0,
                  width:`${Math.max(prob*100, 0.5)}%`,
                  background:cfg.color, borderRadius:99,
                  opacity:isWinner?1:0.45,
                  transition:"width 0.6s cubic-bezier(0.4,0,0.2,1)",
                }} />
                {/* ±1σ band */}
                {std !== null && std > 0 && (
                  <div style={{
                    position:"absolute",
                    left:`${bandLeft}%`,
                    width:`${Math.max(bandRight-bandLeft, 0.5)}%`,
                    top:"15%", bottom:"15%",
                    background:cfg.color, opacity:0.28, borderRadius:99,
                  }} />
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div style={{ marginTop:"var(--spacing-md)", paddingTop:"var(--spacing-sm)", borderTop:"1px solid var(--color-border-light)" }}>
        <p style={{ margin:0, fontSize:"0.72rem", color:"var(--color-text-light)" }}>
          All bars sum to 100% · ResNet50V2 fine-tuned · 224×224
          {hasUncertainty && (
            <> · Shaded region = ±1σ across {uncertainty.mc_samples} MC passes · <span style={{color:"#15803d"}}>●</span> σ&lt;0.03 confident · <span style={{color:"#dc2626"}}>●</span> σ&gt;0.08 uncertain</>
          )}
        </p>
      </div>
    </div>
  );
};

export default ProbabilityChart;