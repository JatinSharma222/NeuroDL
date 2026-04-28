"use client";
import React, { useState } from "react";

/**
 * HeatmapViewer.jsx
 * ─────────────────
 * Displays the three visual outputs of a prediction side by side:
 *   1. Original MRI scan
 *   2. Grad-CAM heatmap overlay  (if tumour detected)
 *   3. U-Net segmentation overlay (if tumour detected)
 *
 * Also renders a jet-colormap legend below the Grad-CAM card.
 *
 * Props:
 *   image         (File)          — original uploaded image file
 *   gradcamImage  (string | null) — base64 PNG from /predict response
 *   segmentImage  (string | null) — base64 JPEG from /predict response
 *   className     (string)        — predicted class name e.g. "Glioma Tumor"
 */

const HeatmapViewer = ({ image, gradcamImage, segmentImage, className }) => {
  const [activeTab, setActiveTab] = useState("gradcam");

  const originalURL = image ? URL.createObjectURL(image) : null;
  const hasTumour   = gradcamImage || segmentImage;

  return (
    <div className="fade-in" style={{ marginTop: "var(--spacing-xl)" }}>

      {/* ── Section title ── */}
      <div style={{ marginBottom: "var(--spacing-lg)" }}>
        <h3
          style={{
            fontSize: "1.25rem",
            fontWeight: 700,
            color: "var(--color-text-primary)",
            marginBottom: "4px",
          }}
        >
          Visual Analysis
        </h3>
        <p
          style={{
            fontSize: "0.9rem",
            color: "var(--color-text-light)",
            margin: 0,
          }}
        >
          {hasTumour
            ? "Grad-CAM highlights regions that influenced the prediction. Segmentation marks the tumour boundary."
            : "No tumour detected — visual analysis not applicable."}
        </p>
      </div>

      {/* ── No tumour — single centred original ── */}
      {!hasTumour && (
        <div style={{ maxWidth: 360, margin: "0 auto" }}>
          <div className="heatmap-card">
            <h4>Original MRI</h4>
            <div className="heatmap-image">
              {originalURL && (
                <img src={originalURL} alt="Original MRI scan" />
              )}
            </div>
            <p>Uploaded scan — no tumour detected</p>
          </div>
        </div>
      )}

      {/* ── Tumour detected — tab switcher on mobile, grid on desktop ── */}
      {hasTumour && (
        <>
          {/* Mobile tab bar */}
          <div
            className="md:hidden"
            style={{
              display: "flex",
              gap: "var(--spacing-xs)",
              marginBottom: "var(--spacing-md)",
              overflowX: "auto",
              paddingBottom: 4,
            }}
          >
            {[
              { key: "original", label: "Original" },
              gradcamImage  && { key: "gradcam",  label: "Grad-CAM" },
              segmentImage  && { key: "segment",  label: "Segmentation" },
            ]
              .filter(Boolean)
              .map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => setActiveTab(key)}
                  className={`btn btn-sm ${
                    activeTab === key ? "btn-primary" : "btn-ghost"
                  }`}
                  style={{ flexShrink: 0 }}
                >
                  {label}
                </button>
              ))}
          </div>

          {/* Grid (desktop) / single card (mobile via activeTab) */}
          <div className="heatmap-grid">

            {/* ── Card 1: Original ── */}
            <div
              className="heatmap-card"
              style={{
                display:
                  activeTab === "original" || typeof window === "undefined"
                    ? "block"
                    : undefined,
              }}
            >
              <h4>
                <span style={{ marginRight: 6 }}>🧠</span>
                Original MRI
              </h4>
              <div className="heatmap-image">
                {originalURL && (
                  <img src={originalURL} alt="Original MRI scan" />
                )}
              </div>
              <p>Uploaded scan as received</p>
            </div>

            {/* ── Card 2: Grad-CAM ── */}
            {gradcamImage && (
              <div className="heatmap-card">
                <h4>
                  <span style={{ marginRight: 6 }}>🔥</span>
                  Grad-CAM Heatmap
                </h4>
                <div className="heatmap-image">
                  <img
                    src={`data:image/png;base64,${gradcamImage}`}
                    alt="Grad-CAM heatmap overlay"
                  />
                </div>

                {/* Jet colormap legend */}
                <div className="heatmap-legend">
                  <span style={{ fontSize: "0.72rem", whiteSpace: "nowrap" }}>
                    Low activation
                  </span>
                  <div className="heatmap-legend-bar" />
                  <span style={{ fontSize: "0.72rem", whiteSpace: "nowrap" }}>
                    High activation
                  </span>
                </div>

                <p style={{ marginTop: "var(--spacing-xs)" }}>
                  Red regions most influenced the <strong>{className}</strong> prediction
                </p>
              </div>
            )}

            {/* ── Card 3: Segmentation ── */}
            {segmentImage && (
              <div className="heatmap-card">
                <h4>
                  <span style={{ marginRight: 6 }}>🎯</span>
                  Tumour Segmentation
                </h4>
                <div className="heatmap-image">
                  <img
                    src={`data:image/jpeg;base64,${segmentImage}`}
                    alt="U-Net tumour segmentation overlay"
                  />
                </div>

                {/* Yellow mask legend */}
                <div className="heatmap-legend" style={{ gap: 8 }}>
                  <div
                    style={{
                      width: 14,
                      height: 14,
                      borderRadius: 3,
                      background: "#FFFF00",
                      border: "1px solid #ccc",
                      flexShrink: 0,
                    }}
                  />
                  <span style={{ fontSize: "0.72rem" }}>
                    Yellow overlay = detected tumour region (U-Net)
                  </span>
                </div>

                <p style={{ marginTop: "var(--spacing-xs)" }}>
                  Pixel-level boundary from U-Net segmentation model
                </p>
              </div>
            )}
          </div>

          {/* ── Explainability note ── */}
          <div
            className="alert alert-info"
            style={{ marginTop: "var(--spacing-lg)" }}
          >
            <svg
              style={{ width: 20, height: 20, flexShrink: 0 }}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <div>
              <p
                style={{
                  fontWeight: 700,
                  marginBottom: 2,
                  fontSize: "0.9rem",
                }}
              >
                About Grad-CAM
              </p>
              <p style={{ margin: 0, fontSize: "0.82rem", lineHeight: 1.5 }}>
                Gradient-weighted Class Activation Mapping (Grad-CAM) uses
                gradients from the final convolutional layer of ResNet50V2 to
                show which regions of the MRI most strongly activated the
                predicted class. It does not confirm a diagnosis — it explains
                the model&apos;s decision.
              </p>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default HeatmapViewer;