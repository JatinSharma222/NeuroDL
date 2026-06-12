"use client";
import React, { useState } from "react";

/**
 * ProbabilityChart.jsx  —  NeuroDL v2.0
 * ────────────────────────────────────────
 * Redesigned with:
 *   • Confidence meter (gauge + tier badge) at the top
 *   • MC Dropout stats row  — σ, entropy, T passes
 *   • Per-class bars with real ±1σ tick markers (not just a shaded blob)
 *   • Per-class σ pill, colour-coded green/amber/red
 *   • Expandable "What is MC Dropout?" explainer for examiners
 *
 * Props (unchanged):
 *   probabilities  (object) — { "Glioma Tumor": 0.9953, ... }
 *   predictedClass (string) — winning class name
 *   uncertainty    (object|null) — from /predict response:
 *     { mc_samples, pred_std, pred_entropy, is_uncertain, class_std, class_mean }
 */

// ── Constants ──────────────────────────────────────────────────────────────
const CLASS_CONFIG = {
  "Glioma Tumor":     { color: "#dc2626", bg: "#fef2f2", label: "Glioma"      },
  "Meningioma Tumor": { color: "#d97706", bg: "#fffbeb", label: "Meningioma"  },
  "No Tumor":         { color: "#16a34a", bg: "#f0fdf4", label: "No Tumor"    },
  "Pituitary Tumor":  { color: "#2563eb", bg: "#eff6ff", label: "Pituitary"   },
};

const CLASS_ORDER = ["Glioma Tumor", "Meningioma Tumor", "Pituitary Tumor", "No Tumor"];

// ── Tier helpers ───────────────────────────────────────────────────────────
function getTier(std) {
  if (std < 0.03) return { label: "High confidence",   short: "HIGH",   dot: "#16a34a", bg: "#dcfce7", text: "#14532d", bar: "#16a34a" };
  if (std < 0.08) return { label: "Moderate confidence", short: "MODERATE", dot: "#d97706", bg: "#fef9c3", text: "#854d0e", bar: "#d97706" };
  return               { label: "Low confidence",     short: "LOW",    dot: "#dc2626", bg: "#fee2e2", text: "#991b1b", bar: "#dc2626" };
}

function stdPill(std) {
  const t = getTier(std);
  return { background: t.bg, color: t.text };
}

// ── Confidence Meter ───────────────────────────────────────────────────────
// Converts σ (0 → 0.15+) to a 0-100 "confidence" scale (inverted)
function stdToConfidence(std) {
  return Math.max(0, Math.min(100, (1 - std / 0.15) * 100));
}

const ConfidenceMeter = ({ std, tier }) => {
  const pct = stdToConfidence(std);
  const segments = [
    { from: 0,  to: 47,  color: "#fee2e2" },  // low
    { from: 47, to: 73,  color: "#fef9c3" },  // moderate
    { from: 73, to: 100, color: "#dcfce7" },  // high
  ];

  return (
    <div style={{ flex: 1 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
        <span style={{ fontSize: "0.68rem", color: "var(--color-text-light)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>
          Model confidence
        </span>
        <span style={{
          fontSize: "0.68rem", fontWeight: 800,
          padding: "1px 7px", borderRadius: 99,
          background: tier.bg, color: tier.text,
          letterSpacing: "0.06em",
        }}>
          {tier.short}
        </span>
      </div>

      {/* Segmented track */}
      <div style={{ position: "relative", height: 8, borderRadius: 99, overflow: "hidden", display: "flex" }}>
        {segments.map((s, i) => (
          <div key={i} style={{ width: `${s.to - s.from}%`, background: s.color, height: "100%" }} />
        ))}
        {/* Needle */}
        <div style={{
          position:   "absolute",
          left:       `${pct}%`,
          top:        -2,
          bottom:     -2,
          width:      3,
          background: tier.bar,
          borderRadius: 99,
          transform:  "translateX(-50%)",
          boxShadow:  `0 0 4px ${tier.bar}88`,
        }} />
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 3 }}>
        <span style={{ fontSize: "0.63rem", color: "#dc2626" }}>Low</span>
        <span style={{ fontSize: "0.63rem", color: "#d97706" }}>Moderate</span>
        <span style={{ fontSize: "0.63rem", color: "#16a34a" }}>High</span>
      </div>
    </div>
  );
};

// ── Main component ─────────────────────────────────────────────────────────
const ProbabilityChart = ({ probabilities, predictedClass, uncertainty }) => {
  const [showExplainer, setShowExplainer] = useState(false);

  if (!probabilities || Object.keys(probabilities).length === 0) return null;

  const hasUncertainty = !!(uncertainty?.class_std);
  const isUncertain    = !!uncertainty?.is_uncertain;
  const tier           = hasUncertainty ? getTier(uncertainty.pred_std) : null;

  return (
    <div style={{
      background:   "white",
      border:       `1.5px solid ${isUncertain ? "#fca5a5" : "var(--color-border-light, #e5e7eb)"}`,
      borderRadius: "var(--radius-lg, 16px)",
      padding:      "var(--spacing-lg, 20px)",
      marginTop:    "var(--spacing-lg, 16px)",
    }}>

      {/* ── Header row ── */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 10, marginBottom: 16 }}>
        <div>
          <h3 style={{ fontSize: "1rem", fontWeight: 700, color: "var(--color-text-primary)", margin: 0 }}>
            Class Probability Distribution
          </h3>
          <p style={{ margin: "3px 0 0", fontSize: "0.78rem", color: "var(--color-text-light)" }}>
            Softmax scores across all 4 classes
            {hasUncertainty && (
              <> · <strong style={{ color: "var(--color-text-secondary)" }}>MC Dropout</strong> · T={uncertainty.mc_samples} passes</>
            )}
          </p>
        </div>

        {/* MC Dropout explainer toggle */}
        {hasUncertainty && (
          <button
            onClick={() => setShowExplainer(p => !p)}
            style={{
              background: "var(--color-bg-tertiary, #f3f4f6)",
              border:     "none",
              borderRadius: 99,
              padding:    "4px 10px",
              fontSize:   "0.72rem",
              fontWeight: 600,
              color:      "var(--color-text-secondary)",
              cursor:     "pointer",
              display:    "flex",
              alignItems: "center",
              gap:        4,
            }}
          >
            <svg width="13" height="13" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            What is MC Dropout?
          </button>
        )}
      </div>

      {/* ── MC Dropout explainer ── */}
      {showExplainer && (
        <div style={{
          background: "#f0f9ff", border: "1px solid #bae6fd",
          borderRadius: "var(--radius-md, 10px)", padding: "12px 14px",
          marginBottom: 14,
        }}>
          <p style={{ margin: 0, fontSize: "0.78rem", color: "#0c4a6e", lineHeight: 1.6 }}>
            <strong>Monte Carlo Dropout</strong> runs the same image through the model <strong>T={uncertainty.mc_samples} times</strong>,
            each time randomly disabling neurons (dropout). The spread of those {uncertainty.mc_samples} predictions gives
            a standard deviation <strong>σ</strong> — low σ means the model gives the same answer every time (confident),
            high σ means it changes its mind (uncertain). <strong>Entropy H</strong> measures how spread-out the probabilities
            are across all 4 classes.
          </p>
        </div>
      )}

      {/* ── Confidence meter + stats row (only with uncertainty data) ── */}
      {hasUncertainty && (
        <div style={{
          display:      "flex",
          gap:          16,
          alignItems:   "center",
          flexWrap:     "wrap",
          background:   "var(--color-bg-tertiary, #f9fafb)",
          borderRadius: "var(--radius-md, 10px)",
          padding:      "12px 14px",
          marginBottom: 16,
        }}>
          {/* Gauge */}
          <ConfidenceMeter std={uncertainty.pred_std} tier={tier} />

          {/* Divider */}
          <div style={{ width: 1, height: 40, background: "var(--color-border-light, #e5e7eb)", flexShrink: 0 }} />

          {/* Stats */}
          <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
            {[
              { label: "σ (std)",   value: uncertainty.pred_std.toFixed(4),   tip: "Lower = more confident" },
              { label: "H (entropy)", value: uncertainty.pred_entropy.toFixed(3), tip: "Lower = less spread across classes" },
              { label: "MC passes", value: uncertainty.mc_samples,             tip: "Number of stochastic forward passes" },
            ].map(({ label, value, tip }) => (
              <div key={label} title={tip} style={{ cursor: "help" }}>
                <p style={{ margin: "0 0 2px", fontSize: "0.65rem", fontWeight: 700, color: "var(--color-text-light)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  {label}
                </p>
                <p style={{ margin: 0, fontSize: "1rem", fontWeight: 800, color: "var(--color-text-primary)", fontVariantNumeric: "tabular-nums" }}>
                  {value}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Uncertainty alert ── */}
      {isUncertain && (
        <div style={{
          display: "flex", gap: 10, alignItems: "flex-start",
          background: "#fffbeb", border: "1px solid #fde68a",
          borderRadius: "var(--radius-md, 10px)", padding: "11px 14px",
          marginBottom: 16,
        }}>
          <svg style={{ width: 18, height: 18, color: "#d97706", flexShrink: 0, marginTop: 1 }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
          </svg>
          <div>
            <p style={{ margin: 0, fontWeight: 700, fontSize: "0.82rem", color: "#92400e" }}>
              High Prediction Uncertainty Detected
            </p>
            <p style={{ margin: "3px 0 0", fontSize: "0.75rem", color: "#78350f", lineHeight: 1.5 }}>
              σ={uncertainty.pred_std.toFixed(4)} exceeds the 0.08 threshold — the model changes its answer
              significantly across {uncertainty.mc_samples} runs. This may indicate an ambiguous scan, unusual
              image quality, or a borderline case. <strong>Expert radiologist review is recommended.</strong>
            </p>
          </div>
        </div>
      )}

      {/* ── Probability bars ── */}
      <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
        {CLASS_ORDER.map((cls) => {
          const prob     = probabilities[cls] ?? 0;
          const pct      = (prob * 100).toFixed(2);
          const cfg      = CLASS_CONFIG[cls] || { color: "#6b7280", bg: "#f9fafb", label: cls };
          const isWinner = cls === predictedClass;

          const clsStd  = hasUncertainty ? (uncertainty.class_std[cls]  ?? 0) : null;
          const clsMean = hasUncertainty ? (uncertainty.class_mean[cls] ?? prob) : prob;

          // ±1σ tick positions (clamped 0–100)
          const tickLo = clsStd !== null ? Math.max(0,   (clsMean - clsStd) * 100) : null;
          const tickHi = clsStd !== null ? Math.min(100, (clsMean + clsStd) * 100) : null;

          return (
            <div key={cls}>
              {/* Label row */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6, gap: 8 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                  <span style={{
                    width: 10, height: 10, borderRadius: "50%",
                    background: cfg.color, flexShrink: 0,
                  }} />
                  <span style={{
                    fontSize:   "0.85rem",
                    fontWeight: isWinner ? 700 : 500,
                    color:      isWinner ? cfg.color : "var(--color-text-secondary)",
                  }}>
                    {cfg.label}
                  </span>

                  {/* "Predicted" badge */}
                  {isWinner && (
                    <span style={{
                      fontSize: "0.65rem", fontWeight: 700,
                      padding: "1px 7px", borderRadius: 99,
                      background: cfg.bg, color: cfg.color,
                      textTransform: "uppercase", letterSpacing: "0.04em",
                    }}>
                      Predicted
                    </span>
                  )}
                </div>

                {/* Right side: σ pill + percentage */}
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                  {clsStd !== null && (
                    <span style={{
                      fontSize: "0.68rem", fontWeight: 700,
                      padding: "1px 7px", borderRadius: 99,
                      ...stdPill(clsStd),
                    }}
                    title={`Per-class standard deviation: ${clsStd.toFixed(4)}`}>
                      ±{clsStd.toFixed(3)}
                    </span>
                  )}
                  <span style={{
                    fontSize: "0.85rem",
                    fontWeight: isWinner ? 700 : 400,
                    color: isWinner ? cfg.color : "var(--color-text-light)",
                    fontVariantNumeric: "tabular-nums",
                    minWidth: 48,
                    textAlign: "right",
                  }}>
                    {pct}%
                  </span>
                </div>
              </div>

              {/* Bar track with ±1σ tick markers */}
              <div style={{
                position:     "relative",
                width:        "100%",
                height:       10,
                borderRadius: 99,
                background:   "var(--color-bg-tertiary, #f3f4f6)",
                overflow:     "visible",  // allow ticks to poke out slightly
              }}>
                {/* Main probability bar */}
                <div style={{
                  position:     "absolute",
                  left:         0, top: 0, bottom: 0,
                  width:        `${Math.max(prob * 100, 0.4)}%`,
                  background:   cfg.color,
                  borderRadius: 99,
                  opacity:      isWinner ? 1 : 0.4,
                  transition:   "width 0.7s cubic-bezier(0.4,0,0.2,1)",
                }} />

                {/* ±1σ shaded band (subtle) */}
                {clsStd !== null && clsStd > 0.002 && (
                  <div style={{
                    position:     "absolute",
                    left:         `${tickLo}%`,
                    width:        `${Math.max(tickHi - tickLo, 0.5)}%`,
                    top:          "10%",
                    bottom:       "10%",
                    background:   cfg.color,
                    opacity:      0.18,
                    borderRadius: 99,
                    pointerEvents: "none",
                  }} />
                )}

                {/* −1σ tick */}
                {tickLo !== null && clsStd > 0.002 && (
                  <div
                    title={`−1σ = ${(tickLo).toFixed(1)}%`}
                    style={{
                      position:     "absolute",
                      left:         `${tickLo}%`,
                      top:          -2,
                      bottom:       -2,
                      width:        2,
                      background:   cfg.color,
                      borderRadius: 1,
                      opacity:      0.7,
                      transform:    "translateX(-50%)",
                    }}
                  />
                )}

                {/* +1σ tick */}
                {tickHi !== null && clsStd > 0.002 && (
                  <div
                    title={`+1σ = ${(tickHi).toFixed(1)}%`}
                    style={{
                      position:     "absolute",
                      left:         `${tickHi}%`,
                      top:          -2,
                      bottom:       -2,
                      width:        2,
                      background:   cfg.color,
                      borderRadius: 1,
                      opacity:      0.7,
                      transform:    "translateX(-50%)",
                    }}
                  />
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Legend / footer ── */}
      <div style={{
        marginTop:   16,
        paddingTop:  12,
        borderTop:   "1px solid var(--color-border-light, #e5e7eb)",
        display:     "flex",
        flexWrap:    "wrap",
        gap:         12,
        alignItems:  "center",
        justifyContent: "space-between",
      }}>
        <p style={{ margin: 0, fontSize: "0.72rem", color: "var(--color-text-light)" }}>
          All bars sum to 100% · ResNet50V2 fine-tuned · 224×224
        </p>

        {hasUncertainty && (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {[
              { color: "#dcfce7", textColor: "#14532d", label: "σ<0.03 Confident"  },
              { color: "#fef9c3", textColor: "#854d0e", label: "σ<0.08 Moderate"   },
              { color: "#fee2e2", textColor: "#991b1b", label: "σ≥0.08 Uncertain"  },
            ].map(({ color, textColor, label }) => (
              <span key={label} style={{
                fontSize:   "0.67rem",
                fontWeight: 600,
                padding:    "2px 7px",
                borderRadius: 99,
                background: color,
                color:      textColor,
              }}>
                {label}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default ProbabilityChart;