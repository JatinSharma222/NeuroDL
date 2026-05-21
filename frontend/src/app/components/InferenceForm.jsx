"use client";
import React, { useState } from "react";
import PatientForm from "./PatientForm";
import ImageUploader from "./ImageUploader";

/**
 * InferenceForm.jsx
 * ─────────────────
 * Two-step diagnosis flow:
 *   Step 1 — PatientForm   : collect patient details → POST /patients
 *   Step 2 — ImageUploader : upload MRI → POST /predict (with patient_id)
 */

const InferenceForm = () => {
  const [step,        setStep]        = useState(1);
  const [patientId,   setPatientId]   = useState(null);
  const [patientName, setPatientName] = useState("");

  const handlePatientSuccess = (id, name) => {
    setPatientId(id);
    setPatientName(name);
    setStep(2);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div className="space-y-8">

      {/* ── Step indicator ── */}
      <div
        style={{
          display:        "flex",
          alignItems:     "center",
          justifyContent: "center",
          gap:            0,
          marginBottom:   "var(--spacing-xl)",
        }}
      >
        {/* Step 1 bubble */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
          <div
            style={{
              width:          40,
              height:         40,
              borderRadius:   "50%",
              background:     step >= 1 ? "var(--color-primary)" : "var(--color-bg-tertiary)",
              color:          step >= 1 ? "white" : "var(--color-text-light)",
              display:        "flex",
              alignItems:     "center",
              justifyContent: "center",
              fontWeight:     700,
              fontSize:       "0.95rem",
              transition:     "all 0.3s",
              boxShadow:      step === 1 ? "0 4px 12px rgba(230,0,35,0.3)" : "none",
            }}
          >
            {step > 1 ? (
              <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
              </svg>
            ) : "1"}
          </div>
          <span style={{ fontSize: "0.75rem", fontWeight: 600, color: step >= 1 ? "var(--color-primary)" : "var(--color-text-light)" }}>
            Patient Details
          </span>
        </div>

        {/* Connector line */}
        <div
          style={{
            width:        80,
            height:       2,
            marginBottom: 22,
            background:   step > 1 ? "var(--color-primary)" : "var(--color-border)",
            transition:   "background 0.3s",
          }}
        />

        {/* Step 2 bubble */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
          <div
            style={{
              width:          40,
              height:         40,
              borderRadius:   "50%",
              background:     step === 2 ? "var(--color-primary)" : "var(--color-bg-tertiary)",
              color:          step === 2 ? "white" : "var(--color-text-light)",
              display:        "flex",
              alignItems:     "center",
              justifyContent: "center",
              fontWeight:     700,
              fontSize:       "0.95rem",
              transition:     "all 0.3s",
              boxShadow:      step === 2 ? "0 4px 12px rgba(230,0,35,0.3)" : "none",
            }}
          >
            2
          </div>
          <span style={{ fontSize: "0.75rem", fontWeight: 600, color: step === 2 ? "var(--color-primary)" : "var(--color-text-light)" }}>
            MRI Upload
          </span>
        </div>
      </div>

      {/* ── Step 1: Patient Form ── */}
      {step === 1 && (
        <PatientForm onSuccess={handlePatientSuccess} />
      )}

      {/* ── Step 2: MRI Upload ── */}
      {step === 2 && (
        <div className="fade-in">

          {/* Patient info banner — no Change Patient button */}
          <div
            style={{
              display:        "flex",
              alignItems:     "center",
              gap:            "var(--spacing-sm)",
              padding:        "var(--spacing-md) var(--spacing-lg)",
              background:     "#f0fdf4",
              border:         "1px solid #bbf7d0",
              borderRadius:   "var(--radius-md)",
              marginBottom:   "var(--spacing-xl)",
            }}
          >
            {/* Avatar */}
            <div
              style={{
                width:          40,
                height:         40,
                borderRadius:   "50%",
                background:     "linear-gradient(135deg, var(--color-primary), var(--color-primary-hover))",
                display:        "flex",
                alignItems:     "center",
                justifyContent: "center",
                color:          "white",
                fontWeight:     700,
                fontSize:       "1rem",
                flexShrink:     0,
              }}
            >
              {patientName.charAt(0).toUpperCase()}
            </div>
            <div>
              <p style={{ margin: 0, fontWeight: 700, fontSize: "0.95rem", color: "#14532d" }}>
                {patientName}
              </p>
              <p style={{ margin: 0, fontSize: "0.78rem", color: "#16a34a" }}>
                Patient ID #{patientId} · Step 2 of 2
              </p>
            </div>
          </div>

          {/* Step 2 header */}
          <div className="text-center" style={{ marginBottom: "var(--spacing-xl)" }}>
            <div
              style={{
                display:       "inline-flex",
                alignItems:    "center",
                gap:           8,
                padding:       "6px 16px",
                background:    "rgba(230,0,35,0.07)",
                borderRadius:  "var(--radius-full)",
                color:         "var(--color-primary)",
                fontSize:      "0.82rem",
                fontWeight:    700,
                marginBottom:  "var(--spacing-md)",
                letterSpacing: "0.04em",
                textTransform: "uppercase",
              }}
            >
              Step 2 of 2
            </div>
            <h2
              style={{
                fontSize:   "clamp(1.5rem, 3vw, 2rem)",
                fontWeight: 800,
                color:      "var(--color-text-primary)",
                margin:     0,
              }}
            >
              Upload MRI Scan
            </h2>
            <p style={{ marginTop: "0.5rem", marginBottom: 0, color: "var(--color-text-light)", fontSize: "0.95rem" }}>
              Select a sample or upload an MRI — results will be saved under{" "}
              <strong style={{ color: "var(--color-text-primary)" }}>{patientName}</strong>
            </p>
          </div>

          <ImageUploader patientId={patientId} />
        </div>
      )}
    </div>
  );
};

export default InferenceForm;