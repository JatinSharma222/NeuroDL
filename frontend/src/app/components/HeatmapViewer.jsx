"use client";
import React, { useState, useRef, useCallback, useEffect } from "react";

/**
 * HeatmapViewer.jsx  —  NeuroDL v2.0
 * ────────────────────────────────────
 * Before/after drag slider replaces the old 3-card tab layout.
 *
 * Left side  = original MRI (always)
 * Right side = Segmentation overlay OR Grad-CAM  (toggle via pill buttons)
 *
 * The divider is draggable on both desktop (mousemove) and mobile (touchmove).
 * A range input sits invisibly over the whole card as the drag target so
 * native touch/pointer handling works without custom event math.
 *
 * Props:
 *   image         (File)          — original uploaded image file
 *   gradcamImage  (string | null) — base64 PNG from /predict
 *   segmentImage  (string | null) — base64 JPEG from /predict
 *   className     (string)        — predicted class name e.g. "Glioma Tumor"
 */

const LABELS = {
  segment: { icon: "🎯", text: "Tumour region",    badge: "Primary output",   badgeStyle: { background: "#dcfce7", color: "#14532d" } },
  gradcam: { icon: "🔥", text: "Grad-CAM heatmap", badge: "Explainability",   badgeStyle: { background: "#fef9c3", color: "#854d0e" } },
};

const HeatmapViewer = ({ image, gradcamImage, segmentImage, className }) => {
  const [pos,        setPos]        = useState(50);   // 0–100 %
  const [overlay,    setOverlay]    = useState("segment");
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef(null);
  const originalURL  = image ? URL.createObjectURL(image) : null;
  const hasTumour    = gradcamImage || segmentImage;

  // Cleanup object URL on unmount
  useEffect(() => () => { if (originalURL) URL.revokeObjectURL(originalURL); }, []);

  // Fallback: if segment is missing but gradcam is present, switch view
  useEffect(() => {
    if (!segmentImage && gradcamImage) setOverlay("gradcam");
  }, [segmentImage, gradcamImage]);

  const overlayDataURL =
    overlay === "segment" && segmentImage
      ? `data:image/jpeg;base64,${segmentImage}`
      : overlay === "gradcam" && gradcamImage
      ? `data:image/png;base64,${gradcamImage}`
      : null;

  // ── Shared slider handler ──────────────────────────────────────
  const handleMove = useCallback((clientX) => {
    if (!containerRef.current) return;
    const { left, width } = containerRef.current.getBoundingClientRect();
    const pct = Math.min(100, Math.max(0, ((clientX - left) / width) * 100));
    setPos(Math.round(pct));
  }, []);

  const onMouseDown = () => setIsDragging(true);
  const onMouseUp   = () => setIsDragging(false);
  const onMouseMove = (e) => { if (isDragging) handleMove(e.clientX); };

  // ── Styles ────────────────────────────────────────────────────
  const card = {
    background:   "white",
    borderRadius: "var(--radius-lg, 16px)",
    border:       "1px solid var(--color-border-light, #e5e7eb)",
    overflow:     "hidden",
  };

  const imgStyle = {
    position:  "absolute",
    inset:     0,
    width:     "100%",
    height:    "100%",
    objectFit: "cover",
    display:   "block",
    userSelect:"none",
    draggable: false,
  };

  const pillBase = {
    display:       "inline-flex",
    alignItems:    "center",
    gap:           5,
    padding:       "5px 12px",
    borderRadius:  99,
    fontSize:      "0.78rem",
    fontWeight:    700,
    cursor:        "pointer",
    border:        "1.5px solid transparent",
    transition:    "all 0.15s",
    userSelect:    "none",
  };

  // ── No tumour: just show original ─────────────────────────────
  if (!hasTumour) {
    return (
      <div style={{ marginTop: "var(--spacing-xl, 28px)" }}>
        <h3 style={{ fontSize: "1.15rem", fontWeight: 700, color: "var(--color-text-primary)", marginBottom: 8 }}>
          Visual Analysis
        </h3>
        <p style={{ fontSize: "0.875rem", color: "var(--color-text-light)", marginBottom: 16 }}>
          No tumour detected — visual analysis not applicable.
        </p>
        <div style={{ ...card, maxWidth: 380 }}>
          <div style={{ aspectRatio: "1/1", position: "relative", background: "#000" }}>
            {originalURL && <img src={originalURL} alt="Original MRI" style={imgStyle} />}
          </div>
          <div style={{ padding: "10px 14px", fontSize: "0.8rem", color: "var(--color-text-light)" }}>
            Uploaded scan — no abnormality detected
          </div>
        </div>
      </div>
    );
  }

  const label = LABELS[overlay] || LABELS.segment;

  return (
    <div style={{ marginTop: "var(--spacing-xl, 28px)" }}
         onMouseMove={onMouseMove}
         onMouseUp={onMouseUp}
         onMouseLeave={onMouseUp}>

      {/* ── Section header ── */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10, marginBottom: 14 }}>
        <div>
          <h3 style={{ fontSize: "1.15rem", fontWeight: 700, color: "var(--color-text-primary)", margin: 0 }}>
            Visual Analysis
          </h3>
          <p style={{ fontSize: "0.82rem", color: "var(--color-text-light)", margin: "3px 0 0" }}>
            Drag the slider to compare original scan with the overlay
          </p>
        </div>

        {/* Toggle pills — only show if both overlays exist */}
        {segmentImage && gradcamImage && (
          <div style={{ display: "flex", gap: 6 }}>
            {["segment", "gradcam"].map((key) => {
              const l      = LABELS[key];
              const active = overlay === key;
              return (
                <button
                  key={key}
                  onClick={() => setOverlay(key)}
                  style={{
                    ...pillBase,
                    background:   active ? (key === "segment" ? "#f0fdf4" : "#fefce8") : "var(--color-bg-tertiary, #f3f4f6)",
                    color:        active ? (key === "segment" ? "#15803d" : "#854d0e") : "var(--color-text-secondary)",
                    borderColor:  active ? (key === "segment" ? "#86efac" : "#fde047") : "transparent",
                  }}
                >
                  {l.icon} {l.text}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Before/after slider card ── */}
      <div
        ref={containerRef}
        style={{ ...card, position: "relative", aspectRatio: "4/3", background: "#000", cursor: "ew-resize", maxHeight: 520 }}
        onMouseDown={onMouseDown}
        onTouchMove={(e) => handleMove(e.touches[0].clientX)}
        onTouchStart={() => setIsDragging(true)}
        onTouchEnd={() => setIsDragging(false)}
      >
        {/* Layer 1: original MRI (full width, underneath) */}
        {originalURL && (
          <img src={originalURL} alt="Original MRI" style={imgStyle} draggable={false} />
        )}

        {/* Layer 2: overlay clipped to left portion */}
        {overlayDataURL && (
          <div style={{
            position:  "absolute",
            inset:     0,
            clipPath:  `inset(0 0 0 ${100 - pos}%)`,
            transition: isDragging ? "none" : "clip-path 0.05s",
          }}>
            <img
              src={overlayDataURL}
              alt={label.text}
              style={imgStyle}
              draggable={false}
            />
          </div>
        )}

        {/* ── Divider line ── */}
        <div style={{
          position:         "absolute",
          top:              0,
          bottom:           0,
          left:             `${pos}%`,
          width:            2,
          background:       "white",
          transform:        "translateX(-50%)",
          boxShadow:        "0 0 6px rgba(0,0,0,0.4)",
          pointerEvents:    "none",
          transition:       isDragging ? "none" : "left 0.05s",
        }} />

        {/* ── Drag handle circle ── */}
        <div style={{
          position:      "absolute",
          top:           "50%",
          left:          `${pos}%`,
          transform:     "translate(-50%, -50%)",
          width:          38,
          height:         38,
          borderRadius:  "50%",
          background:    "white",
          boxShadow:     "0 2px 8px rgba(0,0,0,0.35)",
          display:       "flex",
          alignItems:    "center",
          justifyContent:"center",
          pointerEvents: "none",
          transition:    isDragging ? "none" : "left 0.05s",
        }}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M5 4L2 8L5 12" stroke="#374151" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M11 4L14 8L11 12" stroke="#374151" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>

        {/* ── Corner labels ── */}
        <div style={{
          position:     "absolute",
          top:          10,
          left:         10,
          padding:      "3px 8px",
          borderRadius: 99,
          background:   "rgba(0,0,0,0.55)",
          color:        "white",
          fontSize:     "0.72rem",
          fontWeight:   700,
          backdropFilter: "blur(4px)",
          pointerEvents: "none",
        }}>
          🧠 Original
        </div>

        <div style={{
          position:     "absolute",
          top:          10,
          right:        10,
          padding:      "3px 8px",
          borderRadius: 99,
          background:   "rgba(0,0,0,0.55)",
          color:        "white",
          fontSize:     "0.72rem",
          fontWeight:   700,
          backdropFilter: "blur(4px)",
          pointerEvents: "none",
          ...label.badgeStyle,
        }}>
          {label.icon} {label.badge}
        </div>

        {/* ── Invisible full-area range input for accessibility + mobile ── */}
        <input
          type="range"
          min="0"
          max="100"
          value={pos}
          onChange={(e) => setPos(Number(e.target.value))}
          aria-label="Slide to compare original and overlay"
          style={{
            position:  "absolute",
            inset:     0,
            width:     "100%",
            height:    "100%",
            opacity:   0,
            cursor:    "ew-resize",
            margin:    0,
          }}
        />
      </div>

      {/* ── Slider position indicator ── */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10 }}>
        <span style={{ fontSize: "0.72rem", color: "var(--color-text-light)", minWidth: 52 }}>
          🧠 Original
        </span>
        {/* Two-tone track: grey=original left, red=overlay right */}
        <div style={{ flex: 1, height: 3, background: "var(--color-bg-tertiary, #f3f4f6)", borderRadius: 99, overflow: "hidden", position: "relative" }}>
          <div style={{
            position: "absolute", left: 0, top: 0, bottom: 0,
            width:      `${pos}%`,
            background: "#9ca3af",
            borderRadius: 99,
            transition: isDragging ? "none" : "width 0.05s",
          }} />
          <div style={{
            position: "absolute", right: 0, top: 0, bottom: 0,
            width:      `${100 - pos}%`,
            background: "var(--color-primary, #e60023)",
            borderRadius: 99,
            transition: isDragging ? "none" : "width 0.05s",
          }} />
        </div>
        <span style={{ fontSize: "0.72rem", color: "var(--color-text-light)", minWidth: 68, textAlign: "right" }}>
          {label.icon} {label.badge}
        </span>
      </div>

      {/* ── Info boxes ── */}
      <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 8 }}>
        {overlay === "segment" && segmentImage && (
          <div style={{
            display: "flex", gap: 10, alignItems: "flex-start",
            background: "#f0fdf4", border: "1px solid #bbf7d0",
            borderRadius: "var(--radius-md, 10px)", padding: "11px 14px",
          }}>
            <svg style={{ width: 16, height: 16, flexShrink: 0, marginTop: 2, color: "#16a34a" }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
            </svg>
            <p style={{ margin: 0, fontSize: "0.78rem", color: "#14532d", lineHeight: 1.55 }}>
              The <strong>yellow overlay</strong> shows the high-activation region derived by thresholding the Grad-CAM heatmap — where ResNet50V2 focused to predict <strong>{className}</strong>. This is the approximate tumour region, not a pixel-level boundary.
            </p>
          </div>
        )}

        {overlay === "gradcam" && gradcamImage && (
          <div style={{
            display: "flex", gap: 10, alignItems: "flex-start",
            background: "#fffbeb", border: "1px solid #fde68a",
            borderRadius: "var(--radius-md, 10px)", padding: "11px 14px",
          }}>
            <svg style={{ width: 16, height: 16, flexShrink: 0, marginTop: 2, color: "#d97706" }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
            </svg>
            <div>
              <p style={{ margin: 0, fontSize: "0.78rem", color: "#78350f", lineHeight: 1.55 }}>
                Grad-CAM from <code style={{ background: "rgba(0,0,0,0.07)", padding: "1px 5px", borderRadius: 3 }}>conv5_block3_out</code> — shows classifier attention, <strong>not anatomical tumour boundary</strong>. Use the Tumour Region overlay for localisation.
              </p>
              {/* Jet colormap legend */}
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 7 }}>
                <span style={{ fontSize: "0.68rem", color: "#92400e" }}>Low</span>
                <div style={{ flex: 1, height: 5, borderRadius: 3, background: "linear-gradient(to right,#00008b,#0000ff,#00ffff,#00ff00,#ffff00,#ff7f00,#ff0000)" }} />
                <span style={{ fontSize: "0.68rem", color: "#92400e" }}>High</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default HeatmapViewer;