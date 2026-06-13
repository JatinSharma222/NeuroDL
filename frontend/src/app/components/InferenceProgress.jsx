"use client";
import React, { useEffect, useState, useRef } from "react";

/**
 * InferenceProgress.jsx  —  NeuroDL v2.0
 * ────────────────────────────────────────
 * Animated step-by-step progress UI shown while /predict is running.
 * Receives `steps` array from APIRequest (updated via socket events).
 *
 * Props:
 *   steps   — array of { id, label, icon, status, duration }
 *             status: 'idle' | 'running' | 'done' | 'error'
 *   elapsed — total seconds elapsed (number, updated every 100ms by parent)
 */

const STEP_DEFINITIONS = [
  { id: "preprocess",    label: "Preprocessing MRI",         icon: "🔬", hint: "Resizing to 224×224, normalising pixel values" },
  { id: "resnet",        label: "ResNet50V2 classifier",     icon: "🧠", hint: "Fine-tuned backbone — 24.1M parameters"         },
  { id: "custom_cnn",    label: "Custom CNN classifier",     icon: "⚡", hint: "4-block CNN with GlobalAveragePooling2D"         },
  { id: "meta_model",    label: "Ensemble meta-model",       icon: "🎯", hint: "Stacking ResNet + CNN predictions — 0.04M params" },
  { id: "gradcam",       label: "Grad-CAM heatmap",          icon: "🔥", hint: "Gradients from conv5_block3_out (7×7 map)"      },
  { id: "segmentation",  label: "Tumour region overlay",     icon: "🗺️", hint: "Thresholding Grad-CAM for tumour localisation"  },
  { id: "report",        label: "AI radiology report",       icon: "📋", hint: "llama3.1:8b via Ollama — 8-section clinical format" },
];

export { STEP_DEFINITIONS };

const StatusIcon = ({ status }) => {
  if (status === "done") return (
    <div style={{
      width: 24, height: 24, borderRadius: "50%",
      background: "#dcfce7", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
    }}>
      <svg width="13" height="13" fill="none" stroke="#16a34a" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
      </svg>
    </div>
  );

  if (status === "running") return (
    <div style={{
      width: 24, height: 24, borderRadius: "50%",
      border: "2.5px solid #e5e7eb",
      borderTop: "2.5px solid var(--color-primary, #e60023)",
      animation: "spin 0.7s linear infinite",
      flexShrink: 0,
    }} />
  );

  if (status === "error") return (
    <div style={{
      width: 24, height: 24, borderRadius: "50%",
      background: "#fee2e2", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
    }}>
      <svg width="12" height="12" fill="none" stroke="#dc2626" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
      </svg>
    </div>
  );

  // idle
  return (
    <div style={{
      width: 24, height: 24, borderRadius: "50%",
      border: "2px solid #e5e7eb",
      background: "white", flexShrink: 0,
    }} />
  );
};

const InferenceProgress = ({ steps, elapsed }) => {
  const doneCount    = steps.filter(s => s.status === "done").length;
  const totalSteps   = steps.length;
  const runningStep  = steps.find(s => s.status === "running");
  const hasError     = steps.some(s => s.status === "error");
  const progressPct  = Math.round((doneCount / totalSteps) * 100);

  // Smooth animated percent
  const [displayPct, setDisplayPct] = useState(0);
  useEffect(() => {
    const timer = setTimeout(() => setDisplayPct(progressPct), 50);
    return () => clearTimeout(timer);
  }, [progressPct]);

  return (
    <div style={{
      background:   "white",
      border:       `1.5px solid ${hasError ? "#fca5a5" : "var(--color-border-light, #e5e7eb)"}`,
      borderRadius: "var(--radius-lg, 16px)",
      overflow:     "hidden",
      marginTop:    "var(--spacing-lg, 16px)",
    }}>
      {/* ── Header ── */}
      <div style={{
        padding:    "14px 20px",
        background: "var(--color-bg-tertiary, #f9fafb)",
        borderBottom: "1px solid var(--color-border-light, #e5e7eb)",
        display:    "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {/* Pulse dot */}
          {!hasError && doneCount < totalSteps && (
            <span style={{ position: "relative", display: "inline-flex" }}>
              <span style={{
                width: 10, height: 10, borderRadius: "50%",
                background: "var(--color-primary, #e60023)",
                animation: "ping 1.2s cubic-bezier(0,0,0.2,1) infinite",
                position: "absolute", opacity: 0.6,
              }} />
              <span style={{
                width: 10, height: 10, borderRadius: "50%",
                background: "var(--color-primary, #e60023)",
                position: "relative",
              }} />
            </span>
          )}
          <span style={{ fontWeight: 700, fontSize: "0.9rem", color: "var(--color-text-primary)" }}>
            {hasError ? "Analysis failed" :
             doneCount === totalSteps ? "Analysis complete" :
             runningStep ? `${runningStep.label}…` : "Starting…"}
          </span>
        </div>

        {/* Timer */}
        <span style={{
          fontVariantNumeric: "tabular-nums",
          fontSize:   "0.82rem",
          fontWeight: 600,
          color:      "var(--color-text-light)",
          background: "white",
          border:     "1px solid var(--color-border-light, #e5e7eb)",
          borderRadius: 99,
          padding:    "2px 10px",
        }}>
          {elapsed.toFixed(1)}s
        </span>
      </div>

      {/* ── Progress bar ── */}
      <div style={{ height: 3, background: "var(--color-bg-tertiary, #f3f4f6)" }}>
        <div style={{
          height:     "100%",
          width:      `${displayPct}%`,
          background: hasError
            ? "#dc2626"
            : `linear-gradient(90deg, var(--color-primary, #e60023), #f97316)`,
          transition: "width 0.4s cubic-bezier(0.4,0,0.2,1)",
          borderRadius: "0 99px 99px 0",
        }} />
      </div>

      {/* ── Steps list ── */}
      <div style={{ padding: "12px 20px 16px" }}>
        {steps.map((step, idx) => {
          const def      = STEP_DEFINITIONS.find(d => d.id === step.id) || {};
          const isActive = step.status === "running";
          const isDone   = step.status === "done";
          const isIdle   = step.status === "idle";

          return (
            <div
              key={step.id}
              style={{
                display:    "flex",
                alignItems: "flex-start",
                gap:        12,
                padding:    "8px 0",
                borderBottom: idx < steps.length - 1 ? "1px solid var(--color-border-light, #f3f4f6)" : "none",
                opacity:    isIdle ? 0.45 : 1,
                transition: "opacity 0.3s",
              }}
            >
              {/* Step connector line */}
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 0, flexShrink: 0 }}>
                <StatusIcon status={step.status} />
                {idx < steps.length - 1 && (
                  <div style={{
                    width: 2, height: 18, marginTop: 3,
                    background: isDone ? "#bbf7d0" : "var(--color-border-light, #e5e7eb)",
                    transition: "background 0.4s",
                  }} />
                )}
              </div>

              {/* Content */}
              <div style={{ flex: 1, minWidth: 0, paddingBottom: idx < steps.length - 1 ? 18 : 0 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                  <span style={{
                    fontSize:   "0.85rem",
                    fontWeight: isActive ? 700 : isDone ? 600 : 500,
                    color:      isActive ? "var(--color-primary, #e60023)"
                               : isDone  ? "var(--color-text-primary)"
                               : "var(--color-text-secondary)",
                  }}>
                    {def.icon} {step.label || def.label}
                  </span>

                  {/* Duration */}
                  {isDone && step.duration != null && (
                    <span style={{
                      fontSize:   "0.72rem",
                      fontWeight: 600,
                      color:      "#16a34a",
                      fontVariantNumeric: "tabular-nums",
                      flexShrink: 0,
                    }}>
                      {step.duration.toFixed(1)}s
                    </span>
                  )}
                  {isActive && (
                    <span style={{ fontSize: "0.72rem", color: "var(--color-text-light)", flexShrink: 0 }}>
                      running…
                    </span>
                  )}
                </div>

                {/* Hint text */}
                {(isActive || isDone) && def.hint && (
                  <p style={{ margin: "2px 0 0", fontSize: "0.72rem", color: "var(--color-text-light)", lineHeight: 1.4 }}>
                    {def.hint}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Step count footer ── */}
      <div style={{
        padding:    "8px 20px",
        background: "var(--color-bg-tertiary, #f9fafb)",
        borderTop:  "1px solid var(--color-border-light, #e5e7eb)",
        display:    "flex",
        justifyContent: "space-between",
        fontSize:   "0.72rem",
        color:      "var(--color-text-light)",
      }}>
        <span>{doneCount} of {totalSteps} steps complete</span>
        <span>{displayPct}%</span>
      </div>

      <style>{`
        @keyframes ping {
          0%   { transform: scale(1);   opacity: 0.6; }
          75%  { transform: scale(2);   opacity: 0;   }
          100% { transform: scale(2);   opacity: 0;   }
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export default InferenceProgress;