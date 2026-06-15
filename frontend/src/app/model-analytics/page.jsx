/**
 * src/app/model-analytics/page.jsx
 * ─────────────────────────────────
 * Dedicated page for model evaluation metrics.
 * Place at: frontend/src/app/model-analytics/page.jsx
 *
 * Shows:
 *   1. Model accuracy comparison cards
 *   2. Interactive confusion matrix
 *   3. ROC curves
 *
 * Data source: GET /model-performance (served from pre-computed JSON)
 * Run evaluate_models.py first to generate the data.
 */
"use client";
import React, { useEffect, useState } from "react";
import Navbar from "../components/Navbar";
import InteractiveConfusionMatrix from "../components/InteractiveConfusionMatrix";
import ROCCurves from "../components/ROCCurves";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5001";

export default function ModelAnalyticsPage() {
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);

  useEffect(() => {
    fetch(`${API_URL}/model-performance`)
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false); })
      .catch(e => { setError(e.message); setLoading(false); });
  }, []);

  const card = {
    background: "white", borderRadius: "var(--radius-lg)",
    border: "1px solid var(--color-border-light)", padding: "var(--spacing-lg)",
  };

  return (
    <>
      <Navbar />
      <main style={{ paddingTop: 96, paddingBottom: 60, minHeight: "100vh", background: "var(--color-bg-secondary)" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto", padding: "0 var(--spacing-lg)" }}>

          {/* ── Page header ── */}
          <div style={{ marginBottom: "var(--spacing-xl)" }}>
            <div style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              padding: "4px 12px", borderRadius: 99,
              background: "rgba(230,0,35,0.07)", color: "var(--color-primary)",
              fontSize: "0.72rem", fontWeight: 700, marginBottom: 8,
              textTransform: "uppercase", letterSpacing: "0.05em",
            }}>
              Model Evaluation
            </div>
            <h1 style={{ fontSize: "clamp(1.6rem, 3vw, 2.2rem)", fontWeight: 800, color: "var(--color-text-primary)", margin: "0 0 6px" }}>
              Model Performance Analytics
            </h1>
            <p style={{ margin: 0, color: "var(--color-text-light)", fontSize: "0.9rem" }}>
              Evaluated on held-out test set · Run <code style={{ background: "var(--color-bg-tertiary)", padding: "1px 6px", borderRadius: 4 }}>python evaluate_models.py</code> to refresh
            </p>
          </div>

          {/* ── Loading ── */}
          {loading && (
            <div style={{ textAlign: "center", padding: 60 }}>
              <div style={{
                width: 36, height: 36, borderRadius: "50%", margin: "0 auto 14px",
                border: "3px solid var(--color-border)",
                borderTop: "3px solid var(--color-primary)",
                animation: "spin 0.8s linear infinite",
              }} />
              <p style={{ color: "var(--color-text-light)", margin: 0 }}>Loading evaluation data…</p>
              <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            </div>
          )}

          {/* ── Not yet computed ── */}
          {!loading && data?.available === false && (
            <div className="alert alert-warning" style={{ maxWidth: 560 }}>
              <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
              </svg>
              <div>
                <p style={{ fontWeight: 700, marginBottom: 4 }}>No evaluation data yet</p>
                <p style={{ fontSize: "0.82rem", margin: 0 }}>
                  Run <code>python evaluate_models.py</code> from the project root to generate performance metrics.
                </p>
              </div>
            </div>
          )}

          {/* ── Error ── */}
          {error && !loading && (
            <div className="alert alert-error">Could not load data: {error}</div>
          )}

          {/* ── Data loaded ── */}
          {data?.available && !loading && (
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--spacing-xl)" }}>

              {/* ── Accuracy KPI row ── */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "var(--spacing-md)" }}>
                {[
                  { label: "ResNet50V2 (frozen)",    value: data.accuracy.resnet,     note: "Transfer learning baseline", color: "#2563eb" },
                  { label: "ResNet50V2 (fine-tuned)", value: data.accuracy.resnet,     note: "Primary classifier + Grad-CAM", color: "var(--color-primary)", best: false },
                  { label: "Custom CNN",              value: data.accuracy.custom_cnn, note: "GlobalAveragePooling2D",        color: "#d97706" },
                  { label: "Meta-Model (Ensemble)",   value: data.accuracy.meta_model, note: "ResNet + CNN stacked",         color: "#16a34a", best: true },
                ].map(({ label, value, note, color, best }) => (
                  <div key={label} style={{
                    ...card,
                    border: best ? "2px solid #16a34a" : "1px solid var(--color-border-light)",
                    boxShadow: best ? "0 0 0 3px #dcfce7" : "none",
                    position: "relative",
                  }}>
                    {best && (
                      <span style={{
                        position: "absolute", top: -10, right: 12,
                        fontSize: "0.65rem", fontWeight: 800, padding: "2px 8px",
                        borderRadius: 99, background: "#16a34a", color: "white",
                        textTransform: "uppercase", letterSpacing: "0.05em",
                      }}>Best</span>
                    )}
                    <p style={{ margin: "0 0 4px", fontSize: "0.72rem", fontWeight: 700, color: "var(--color-text-light)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                      {label}
                    </p>
                    <p style={{ margin: "0 0 4px", fontSize: "2rem", fontWeight: 800, color, lineHeight: 1.1 }}>
                      {(value * 100).toFixed(2)}%
                    </p>
                    <p style={{ margin: 0, fontSize: "0.72rem", color: "var(--color-text-light)" }}>{note}</p>
                  </div>
                ))}
              </div>

              {/* ── Confusion matrix ── */}
              <div style={card}>
                <InteractiveConfusionMatrix data={data} />
              </div>

              {/* ── ROC curves ── */}
              <div style={card}>
                <ROCCurves data={data} />
              </div>
            </div>
          )}
        </div>
      </main>
    </>
  );
}