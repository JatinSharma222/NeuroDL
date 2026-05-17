"use client";
import React, { useState } from "react";

/**
 * HeatmapViewer.jsx  —  NeuroDL v2.0
 * ────────────────────────────────────
 * Displays three visual outputs side-by-side:
 *   1. Original MRI scan
 *   2. U-Net Tumour Segmentation  ← PRIMARY (dedicated trained model)
 *   3. Grad-CAM heatmap           ← SECONDARY (classifier explainability only)
 *
 * Order change rationale:
 *   The ResNet50V2 backbone was fine-tuned after initial training, but Grad-CAM
 *   gradients still reflect the classifier's attention — NOT the anatomical tumour
 *   boundary. The VGG16-U-Net segmentation model was trained specifically on
 *   brain MRI with pixel-level masks and is the reliable localisation output.
 *   Grad-CAM is preserved as an explainability tool, clearly labelled as such.
 *
 * Props:
 *   image         (File)          — original uploaded image file
 *   gradcamImage  (string | null) — base64 PNG from /predict response
 *   segmentImage  (string | null) — base64 JPEG from /predict response
 *   className     (string)        — predicted class name e.g. "Glioma Tumor"
 */

const HeatmapViewer = ({ image, gradcamImage, segmentImage, className }) => {
  // Default to segmentation tab — it's the primary localisation output
  const [activeTab, setActiveTab] = useState("segment");

  const originalURL = image ? URL.createObjectURL(image) : null;
  const hasTumour   = gradcamImage || segmentImage;

  // ── Shared card style ──────────────────────────────────────────
  const cardStyle = {
    background:   "white",
    borderRadius: "var(--radius-lg, 16px)",
    border:       "1px solid var(--color-border-light, #e5e7eb)",
    padding:      "var(--spacing-lg, 20px)",
    display:      "flex",
    flexDirection:"column",
    gap:          "var(--spacing-sm, 10px)",
  };

  const imgWrapStyle = {
    borderRadius: "var(--radius-md, 10px)",
    overflow:     "hidden",
    background:   "#000",
    aspectRatio:  "1 / 1",
    display:      "flex",
    alignItems:   "center",
    justifyContent:"center",
  };

  const imgStyle = {
    width:     "100%",
    height:    "100%",
    objectFit: "cover",
    display:   "block",
  };

  const cardTitleStyle = {
    fontSize:   "0.95rem",
    fontWeight: 700,
    color:      "var(--color-text-primary, #111)",
    margin:     0,
    display:    "flex",
    alignItems: "center",
    gap:        6,
  };

  const captionStyle = {
    fontSize:  "0.78rem",
    color:     "var(--color-text-light, #9ca3af)",
    margin:    0,
    lineHeight: 1.4,
  };

  // ── Primary badge (segmentation) ──────────────────────────────
  const primaryBadge = {
    display:      "inline-flex",
    alignItems:   "center",
    gap:          4,
    fontSize:     "0.68rem",
    fontWeight:   700,
    padding:      "2px 8px",
    borderRadius: 99,
    background:   "#dcfce7",
    color:        "#15803d",
    letterSpacing:"0.03em",
    textTransform:"uppercase",
  };

  // ── Explainability badge (Grad-CAM) ───────────────────────────
  const explainBadge = {
    display:      "inline-flex",
    alignItems:   "center",
    gap:          4,
    fontSize:     "0.68rem",
    fontWeight:   700,
    padding:      "2px 8px",
    borderRadius: 99,
    background:   "#fef9c3",
    color:        "#854d0e",
    letterSpacing:"0.03em",
    textTransform:"uppercase",
  };

  return (
    <div className="fade-in" style={{ marginTop: "var(--spacing-xl, 28px)" }}>

      {/* ── Section header ── */}
      <div style={{ marginBottom: "var(--spacing-lg, 20px)" }}>
        <h3 style={{ fontSize:"1.25rem", fontWeight:700, color:"var(--color-text-primary,#111)", marginBottom:4 }}>
          Visual Analysis
        </h3>
        <p style={{ fontSize:"0.88rem", color:"var(--color-text-light,#6b7280)", margin:0 }}>
          {hasTumour
            ? "The yellow region shows where the classifier focused (Grad-CAM thresholded). The Grad-CAM heatmap shows the full activation map."
            : "No tumour detected — visual analysis not applicable."}
        </p>
      </div>

      {/* ── No tumour ── */}
      {!hasTumour && (
        <div style={{ maxWidth:360, margin:"0 auto" }}>
          <div style={cardStyle}>
            <p style={cardTitleStyle}>🧠 Original MRI</p>
            <div style={imgWrapStyle}>
              {originalURL && <img src={originalURL} alt="Original MRI scan" style={imgStyle} />}
            </div>
            <p style={captionStyle}>Uploaded scan — no tumour detected</p>
          </div>
        </div>
      )}

      {/* ── Tumour detected ── */}
      {hasTumour && (
        <>
          {/* Mobile tab bar — default is "segment" */}
          <div
            className="md:hidden"
            style={{
              display:"flex", gap:6,
              marginBottom:"var(--spacing-md,16px)",
              overflowX:"auto", paddingBottom:4,
            }}
          >
            {[
              { key:"original",  label:"Original"      },
              segmentImage && { key:"segment",   label:"Segmentation" },
              gradcamImage && { key:"gradcam",   label:"Grad-CAM"     },
            ]
              .filter(Boolean)
              .map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => setActiveTab(key)}
                  className={`btn btn-sm ${activeTab === key ? "btn-primary" : "btn-ghost"}`}
                  style={{ flexShrink:0 }}
                >
                  {label}
                </button>
              ))}
          </div>

          {/* Desktop grid — 3 columns */}
          <div
            style={{
              display:"grid",
              gridTemplateColumns:"repeat(auto-fit, minmax(260px, 1fr))",
              gap:"var(--spacing-lg,20px)",
            }}
          >

            {/* ── Card 1: Original ── */}
            <div style={cardStyle}>
              <p style={cardTitleStyle}>
                <span>🧠</span> Original MRI
              </p>
              <div style={imgWrapStyle}>
                {originalURL && (
                  <img src={originalURL} alt="Original MRI scan" style={imgStyle} />
                )}
              </div>
              <p style={captionStyle}>Uploaded scan — unprocessed</p>
            </div>

            {/* ── Card 2: Segmentation (PRIMARY) ── */}
            {segmentImage && (
              <div
                style={{
                  ...cardStyle,
                  border:"2px solid #16a34a",
                  boxShadow:"0 0 0 4px #dcfce7",
                }}
              >
                <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", flexWrap:"wrap", gap:6 }}>
                  <p style={cardTitleStyle}>
                    <span>🎯</span> Tumour Region
                  </p>
                  <span style={primaryBadge}>
                    ✓ Primary Output
                  </span>
                </div>

                <div style={imgWrapStyle}>
                  <img
                    src={`data:image/jpeg;base64,${segmentImage}`}
                    alt="Tumour region overlay"
                    style={imgStyle}
                  />
                </div>

                {/* Yellow swatch legend */}
                <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                  <div style={{
                    width:12, height:12, borderRadius:3, flexShrink:0,
                    background:"#FFE000",
                    border:"1.5px solid #b45309",
                  }} />
                  <span style={captionStyle}>Yellow = high-activation region</span>
                </div>

                <p style={{ ...captionStyle, color:"var(--color-text-secondary,#374151)" }}>
                  Region where the classifier focused most strongly — derived from Grad-CAM thresholding.
                </p>
              </div>
            )}

            {/* ── Card 3: Grad-CAM (EXPLAINABILITY) ── */}
            {gradcamImage && (
              <div style={{ ...cardStyle, opacity:0.92 }}>
                {/* Header row */}
                <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", flexWrap:"wrap", gap:6 }}>
                  <p style={cardTitleStyle}>
                    <span>🔥</span> Grad-CAM
                  </p>
                  <span style={explainBadge}>
                    Explainability only
                  </span>
                </div>

                <div style={imgWrapStyle}>
                  <img
                    src={`data:image/png;base64,${gradcamImage}`}
                    alt="Grad-CAM heatmap overlay"
                    style={imgStyle}
                  />
                </div>

                {/* Jet legend */}
                <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                  <span style={captionStyle}>Low</span>
                  <div style={{
                    flex:1, height:6, borderRadius:3,
                    background:"linear-gradient(to right,#00008b,#0000ff,#00ffff,#00ff00,#ffff00,#ff7f00,#ff0000)",
                  }} />
                  <span style={captionStyle}>High</span>
                </div>

                <p style={{ ...captionStyle, color:"var(--color-text-secondary,#374151)" }}>
                  Shows which regions of the scan activated the <strong>{className}</strong> classifier.{" "}
                  <strong>Does not indicate tumour location</strong> — use Segmentation for that.
                </p>
              </div>
            )}
          </div>

          {/* ── Info boxes ── */}
          <div style={{ marginTop:"var(--spacing-lg,20px)", display:"flex", flexDirection:"column", gap:10 }}>

            {/* Segmentation info */}
            <div
              className="alert"
              style={{
                background:"#f0fdf4",
                border:"1px solid #bbf7d0",
                color:"#14532d",
                display:"flex", gap:10, alignItems:"flex-start",
                padding:"12px 16px", borderRadius:"var(--radius-md,10px)",
              }}
            >
              <svg style={{ width:18, height:18, flexShrink:0, marginTop:2 }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div>
                <p style={{ fontWeight:700, marginBottom:2, fontSize:"0.875rem" }}>
                  About Tumour Region Overlay
                </p>
                <p style={{ margin:0, fontSize:"0.8rem", lineHeight:1.5 }}>
                  The yellow overlay is derived by thresholding the <strong>Grad-CAM heatmap</strong> from
                  ResNet50V2 — the same model that made the classification. The high-activation region
                  (where the classifier focused most) is extracted, smoothed, and overlaid. This is
                  technically consistent: one model, one image, no dataset mismatch. It shows the
                  approximate tumour region, not a precise pixel-level boundary.
                </p>
              </div>
            </div>

            {/* Grad-CAM warning */}
            <div
              className="alert"
              style={{
                background:"#fffbeb",
                border:"1px solid #fde68a",
                color:"#78350f",
                display:"flex", gap:10, alignItems:"flex-start",
                padding:"12px 16px", borderRadius:"var(--radius-md,10px)",
              }}
            >
              <svg style={{ width:18, height:18, flexShrink:0, marginTop:2 }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div>
                <p style={{ fontWeight:700, marginBottom:2, fontSize:"0.875rem" }}>
                  About Grad-CAM (Explainability Tool)
                </p>
                <p style={{ margin:0, fontSize:"0.8rem", lineHeight:1.5 }}>
                  Grad-CAM uses gradients from <code style={{ background:"rgba(0,0,0,0.08)", padding:"1px 5px", borderRadius:3 }}>conv5_block3_out</code> of
                  ResNet50V2 to show which regions most activated the predicted class. It reflects the
                  classifier's attention — <strong>not the anatomical tumour boundary</strong>.
                  The heatmap may highlight areas outside the tumour; this is expected behaviour
                  for an ImageNet-pretrained backbone. Use the Segmentation output for tumour localisation.
                </p>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default HeatmapViewer;