"use client";
import React, { useState } from "react";
import { useAuth } from "../context/AuthContext";

/**
 * GradCAMComparison.jsx  —  NeuroDL v2.0
 * ────────────────────────────────────────
 * Shows Frozen vs Fine-tuned ResNet50V2 Grad-CAM side by side.
 *
 * The frozen backbone highlights ImageNet features (edges, skull, background).
 * The fine-tuned backbone points to the actual tumour region.
 * This visually proves WHY fine-tuning on brain MRI data matters.
 *
 * Props:
 *   image      (File)    — the MRI file already uploaded by the user
 *   className  (string)  — predicted class from /predict (e.g. "Glioma Tumor")
 *
 * Usage in APIRequest.jsx — add after HeatmapViewer:
 *   {response && !response.error && image && (
 *     <GradCAMComparison image={image} className={response.class_name} />
 *   )}
 */

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5001";

// ── Side-by-side image card ────────────────────────────────────────────────
const HeatmapCard = ({ title, badge, badgeStyle, src, caption, highlight, empty }) => (
  <div style={{
    flex:         1,
    minWidth:     0,
    background:   "white",
    borderRadius: "var(--radius-lg)",
    border:       `1.5px solid ${highlight ? "#86efac" : "var(--color-border-light)"}`,
    overflow:     "hidden",
    boxShadow:    highlight ? "0 0 0 3px #dcfce7" : "none",
  }}>
    {/* Card header */}
    <div style={{
      padding:      "10px 14px",
      background:   "var(--color-bg-tertiary)",
      borderBottom: "1px solid var(--color-border-light)",
      display:      "flex",
      alignItems:   "center",
      justifyContent: "space-between",
      gap:          8,
      flexWrap:     "wrap",
    }}>
      <p style={{ margin: 0, fontWeight: 700, fontSize: "0.85rem", color: "var(--color-text-primary)" }}>
        {title}
      </p>
      <span style={{
        fontSize: "0.65rem", fontWeight: 700, padding: "2px 8px",
        borderRadius: 99, textTransform: "uppercase", letterSpacing: "0.05em",
        ...badgeStyle,
      }}>
        {badge}
      </span>
    </div>

    {/* Image */}
    <div style={{ aspectRatio: "1/1", background: "#000", overflow: "hidden", position: "relative" }}>
      {src ? (
        <img
          src={`data:image/png;base64,${src}`}
          alt={title}
          style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
        />
      ) : (
        <div style={{
          width: "100%", height: "100%",
          display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center", gap: 8,
        }}>
          {empty || (
            <>
              <svg style={{ width: 32, height: 32, color: "#4b5563" }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
              </svg>
              <p style={{ color: "#9ca3af", fontSize: "0.78rem", margin: 0, textAlign: "center", padding: "0 16px" }}>
                Checkpoint not found.<br />Run <code style={{ background: "#1f2937", padding: "1px 5px", borderRadius: 3 }}>train_all_models.py</code> first.
              </p>
            </>
          )}
        </div>
      )}
    </div>

    {/* Caption */}
    <div style={{ padding: "10px 14px" }}>
      <p style={{ margin: 0, fontSize: "0.76rem", color: "var(--color-text-secondary)", lineHeight: 1.5 }}>
        {caption}
      </p>
    </div>
  </div>
);

// ── Main component ─────────────────────────────────────────────────────────
const GradCAMComparison = ({ image, className }) => {
  const { authFetch } = useAuth();

  const [result,   setResult]   = useState(null);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState(null);
  const [expanded, setExpanded] = useState(false);

  const runComparison = async () => {
    setLoading(true); setError(null); setExpanded(true);
    try {
      const formData = new FormData();
      formData.append("image", image);

      const res  = await authFetch(`${API_URL}/compare-gradcam`, {
        method: "POST",
        body:   formData,
      });
      if (!res.ok) throw new Error(`Server error ${res.status}`);
      const data = await res.json();
      setResult(data);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      background:   "white",
      borderRadius: "var(--radius-lg)",
      border:       "1px solid var(--color-border-light)",
      overflow:     "hidden",
      marginTop:    "var(--spacing-lg)",
    }}>

      {/* ── Collapsible header ── */}
      <button
        onClick={() => { if (!expanded) runComparison(); else setExpanded(false); }}
        style={{
          width:      "100%",
          background: expanded ? "var(--color-bg-tertiary)" : "white",
          border:     "none",
          borderBottom: expanded ? "1px solid var(--color-border-light)" : "none",
          padding:    "14px 20px",
          cursor:     "pointer",
          display:    "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap:        12,
          textAlign:  "left",
          transition: "background 0.15s",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {/* Icon */}
          <div style={{
            width: 32, height: 32, borderRadius: "var(--radius-sm)",
            background: "linear-gradient(135deg, #7c3aed, #4f46e5)",
            display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
          }}>
            <svg width="16" height="16" fill="none" stroke="white" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </div>

          <div>
            <p style={{ margin: 0, fontWeight: 700, fontSize: "0.9rem", color: "var(--color-text-primary)" }}>
              Frozen vs Fine-tuned Grad-CAM
            </p>
            <p style={{ margin: "2px 0 0", fontSize: "0.72rem", color: "var(--color-text-light)" }}>
              See exactly what fine-tuning changed in the model's attention
            </p>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
          {!expanded && (
            <span style={{
              fontSize: "0.72rem", fontWeight: 700, padding: "3px 10px", borderRadius: 99,
              background: "#ede9fe", color: "#7c3aed",
            }}>
              Compare →
            </span>
          )}
          <svg
            style={{ width: 16, height: 16, color: "var(--color-text-light)", transform: expanded ? "rotate(180deg)" : "none", transition: "transform 0.2s" }}
            fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {/* ── Content ── */}
      {expanded && (
        <div style={{ padding: "var(--spacing-lg)" }}>

          {/* Loading */}
          {loading && (
            <div style={{ textAlign: "center", padding: 32 }}>
              <div style={{
                width: 36, height: 36, borderRadius: "50%", margin: "0 auto 12px",
                border: "3px solid #ede9fe",
                borderTop: "3px solid #7c3aed",
                animation: "spin 0.8s linear infinite",
              }} />
              <p style={{ color: "var(--color-text-secondary)", fontSize: "0.85rem", margin: "0 0 4px", fontWeight: 600 }}>
                Generating two Grad-CAMs…
              </p>
              <p style={{ color: "var(--color-text-light)", fontSize: "0.78rem", margin: 0 }}>
                Running frozen and fine-tuned ResNet50V2 on the same image
              </p>
              <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            </div>
          )}

          {/* Error */}
          {error && !loading && (
            <div className="alert alert-error">
              <span style={{ fontSize: "0.875rem" }}>Comparison failed: {error}</span>
              <button onClick={runComparison} className="btn btn-sm btn-ghost" style={{ marginLeft: "auto" }}>
                Retry
              </button>
            </div>
          )}

          {/* Results */}
          {result && !loading && (
            <>
              {/* What this shows — explainer banner */}
              <div style={{
                padding: "12px 14px", marginBottom: "var(--spacing-lg)",
                background: "#f5f3ff", border: "1px solid #ddd6fe",
                borderRadius: "var(--radius-md)",
              }}>
                <p style={{ margin: "0 0 4px", fontWeight: 700, fontSize: "0.82rem", color: "#4c1d95" }}>
                  What you're seeing
                </p>
                <p style={{ margin: 0, fontSize: "0.78rem", color: "#5b21b6", lineHeight: 1.6 }}>
                  Both heatmaps were generated from the same MRI using the same predicted class
                  (<strong>{result.class_name}</strong>, {result.confidence} confidence).
                  The only difference is the model weights — one was never trained on brain MRI,
                  the other was fine-tuned at lr=1e-5 for 15 epochs on this exact dataset.
                </p>
              </div>

              {/* Side-by-side heatmaps */}
              <div style={{ display: "flex", gap: "var(--spacing-md)", flexWrap: "wrap", marginBottom: "var(--spacing-lg)" }}>
                <HeatmapCard
                  title="🥶 Frozen ResNet50V2"
                  badge="ImageNet weights only"
                  badgeStyle={{ background: "#fee2e2", color: "#991b1b" }}
                  src={result.frozen}
                  caption="Backbone never trained on brain MRI. Grad-CAM gradients flow through ImageNet features — typically highlights skull edges, ventricles, or background texture rather than the tumour."
                  highlight={false}
                  empty={!result.frozen_available && (
                    <p style={{ color: "#9ca3af", fontSize: "0.72rem", margin: 0, textAlign: "center", padding: "0 12px" }}>
                      Run <code>train_all_models.py</code> and keep the checkpoint at<br />
                      <code>models/checkpoints/ResNet50V2_best.keras</code>
                    </p>
                  )}
                />

                {/* VS divider */}
                <div style={{
                  display: "flex", flexDirection: "column", alignItems: "center",
                  justifyContent: "center", gap: 6, flexShrink: 0, padding: "0 4px",
                }}>
                  <div style={{ width: 1, flex: 1, background: "var(--color-border-light)" }} />
                  <span style={{
                    fontSize: "0.72rem", fontWeight: 800, padding: "4px 8px",
                    borderRadius: 99, background: "white",
                    border: "1.5px solid var(--color-border-light)",
                    color: "var(--color-text-secondary)",
                  }}>VS</span>
                  <div style={{ width: 1, flex: 1, background: "var(--color-border-light)" }} />
                </div>

                <HeatmapCard
                  title="🔥 Fine-tuned ResNet50V2"
                  badge="✓ Trained on brain MRI"
                  badgeStyle={{ background: "#dcfce7", color: "#14532d" }}
                  src={result.finetuned}
                  caption="Backbone fine-tuned at lr=1e-5 on 7K+ brain MRI scans. Grad-CAM gradients now flow through MRI-specific features — heatmap focuses on the tumour region, not background anatomy."
                  highlight={true}
                />
              </div>

              {/* Key insight box */}
              <div style={{
                padding: "14px 16px",
                background: "#f0fdf4", border: "1px solid #bbf7d0",
                borderRadius: "var(--radius-md)",
              }}>
                <p style={{ margin: "0 0 6px", fontWeight: 700, fontSize: "0.82rem", color: "#14532d" }}>
                  Key insight for your presentation
                </p>
                <ul style={{ margin: 0, paddingLeft: 18, fontSize: "0.78rem", color: "#15803d", lineHeight: 1.7 }}>
                  <li>Frozen model accuracy on brain MRI: <strong>82.56%</strong> (transfer learning baseline)</li>
                  <li>Fine-tuned model accuracy: <strong>94.92%</strong> — +12.36 percentage points</li>
                  <li>The Grad-CAM shift is visual evidence of what those extra 12% represent</li>
                  <li>Fine-tuning at a very low learning rate (1e-5) prevented catastrophic forgetting</li>
                </ul>
              </div>

              {/* Jet colormap legend */}
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 12 }}>
                <span style={{ fontSize: "0.68rem", color: "var(--color-text-light)" }}>Low activation</span>
                <div style={{
                  flex: 1, height: 5, borderRadius: 3,
                  background: "linear-gradient(to right,#00008b,#0000ff,#00ffff,#00ff00,#ffff00,#ff7f00,#ff0000)",
                }} />
                <span style={{ fontSize: "0.68rem", color: "var(--color-text-light)" }}>High activation</span>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default GradCAMComparison;