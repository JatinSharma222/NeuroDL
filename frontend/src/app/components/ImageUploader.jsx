"use client";
import React, { useState, useEffect } from "react";
import APIRequest from "./APIRequest";

/**
 * ImageUploader.jsx
 * ─────────────────
 * Step 2 of the diagnosis flow.
 * Accepts patientId prop from InferenceForm and forwards it to APIRequest
 * so the scan is saved linked to the correct patient.
 *
 * Props:
 *   patientId (int | null) — patient FK from /patients POST
 */

const MAX_FILE_MB    = 16;
const MAX_FILE_BYTES = MAX_FILE_MB * 1024 * 1024;

const SAMPLE_IMAGES = [
  { src: "/sample_g1.jpg", label: "Glioma",     type: "glioma"     },
  { src: "/sample_g2.jpg", label: "Glioma",     type: "glioma"     },
  { src: "/sample_g3.jpg", label: "Glioma",     type: "glioma"     },
  { src: "/sample_g4.jpg", label: "Glioma",     type: "glioma"     },
  { src: "/sample_m1.jpg", label: "Meningioma", type: "meningioma" },
  { src: "/sample_m2.jpg", label: "Meningioma", type: "meningioma" },
  { src: "/sample_m3.jpg", label: "Meningioma", type: "meningioma" },
  { src: "/sample_m4.jpg", label: "Meningioma", type: "meningioma" },
  { src: "/sample_p1.jpg", label: "Pituitary",  type: "pituitary"  },
  { src: "/sample_p2.jpg", label: "Pituitary",  type: "pituitary"  },
  { src: "/sample_p3.jpg", label: "Pituitary",  type: "pituitary"  },
  { src: "/sample_p4.jpg", label: "Pituitary",  type: "pituitary"  },
  { src: "/sample_n1.jpg", label: "No Tumor",   type: "notumor"    },
  { src: "/sample_n2.jpg", label: "No Tumor",   type: "notumor"    },
  { src: "/sample_n3.jpg", label: "No Tumor",   type: "notumor"    },
];

const isDicom = (file) =>
  file?.name?.toLowerCase().endsWith(".dcm") || file?.type === "application/dicom";

const ImageUploader = ({ patientId = null }) => {
  const [selectedImage, setSelectedImage] = useState(null);
  const [sizeError,     setSizeError]     = useState("");
  const [isMounted,     setIsMounted]     = useState(false);

  useEffect(() => { setIsMounted(true); }, []);

  const handleFile = (file) => {
    setSizeError("");
    if (!file) return;
    if (file.size > MAX_FILE_BYTES) {
      setSizeError(
        `File is too large (${(file.size / 1024 / 1024).toFixed(1)} MB). Max allowed: ${MAX_FILE_MB} MB.`
      );
      return;
    }
    setSelectedImage(file);
  };

  const handleImageChange = (e) => {
    if (e.target.files?.[0]) handleFile(e.target.files[0]);
  };

  const handleSampleClick = async (imagePath) => {
    try {
      const response = await fetch(imagePath);
      const blob     = await response.blob();
      const fileName = imagePath.split("/").pop();
      const file     = new File([blob], fileName, { type: "image/jpeg" });
      setSelectedImage(file);
      setSizeError("");
    } catch (error) {
      console.error("Error loading sample:", error);
    }
  };

  if (!isMounted) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="loading text-gray-500">Loading...</div>
      </div>
    );
  }

  return (
    <div className="space-y-8">

      {/* ── Sample Images ── */}
      <div className="text-center">
        <h3 className="text-xl font-bold text-black mb-2">
          Try with Sample Images
        </h3>
        <p style={{ fontSize: "0.85rem", color: "var(--color-text-light)", marginBottom: "var(--spacing-lg)" }}>
          Real MRI scans from the test dataset — one click to analyse
        </p>

        {/* Class colour key */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "center", marginBottom: "var(--spacing-lg)" }}>
          {[
            { type: "glioma",     label: "Glioma",     color: "#fecaca", text: "#991b1b" },
            { type: "meningioma", label: "Meningioma", color: "#fed7aa", text: "#9a3412" },
            { type: "pituitary",  label: "Pituitary",  color: "#bbf7d0", text: "#14532d" },
            { type: "notumor",    label: "No Tumor",   color: "#bfdbfe", text: "#1e3a8a" },
          ].map(({ type, label, color, text }) => (
            <span key={type} style={{
              display: "inline-flex", alignItems: "center", gap: 5,
              padding: "3px 10px", borderRadius: 99,
              background: color, color: text,
              fontSize: "0.75rem", fontWeight: 700,
            }}>
              <span style={{ width: 7, height: 7, borderRadius: "50%", background: text }} />
              {label}
            </span>
          ))}
        </div>

        {/* Image grid */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: "var(--spacing-sm)",
          maxWidth: 520,
          margin: "0 auto",
        }}>
          {SAMPLE_IMAGES.map((sample, index) => {
            const colorMap = {
              glioma:     { bg: "#fecaca", border: "#f87171", text: "#991b1b" },
              meningioma: { bg: "#fed7aa", border: "#fb923c", text: "#9a3412" },
              pituitary:  { bg: "#bbf7d0", border: "#4ade80", text: "#14532d" },
              notumor:    { bg: "#bfdbfe", border: "#60a5fa", text: "#1e3a8a" },
            };
            const c = colorMap[sample.type] || colorMap.notumor;
            return (
              <div
                key={index}
                onClick={() => handleSampleClick(sample.src)}
                title={`${sample.label} — click to analyse`}
                style={{
                  cursor: "pointer",
                  borderRadius: "var(--radius-md, 10px)",
                  overflow: "hidden",
                  border: `2px solid ${c.border}`,
                  transition: "transform 0.15s, box-shadow 0.15s",
                  background: "#000",
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.transform = "scale(1.05)";
                  e.currentTarget.style.boxShadow = `0 4px 12px ${c.border}88`;
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.transform = "scale(1)";
                  e.currentTarget.style.boxShadow = "none";
                }}
              >
                <div style={{ aspectRatio: "1/1", overflow: "hidden" }}>
                  <img
                    src={sample.src}
                    alt={sample.label}
                    style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                  />
                </div>
                <div style={{
                  background: c.bg, color: c.text,
                  fontSize: "0.62rem", fontWeight: 700,
                  textAlign: "center", padding: "3px 4px",
                  letterSpacing: "0.02em",
                }}>
                  {sample.label}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Upload Area ── */}
      <div className="text-center">
        <h3 className="text-xl font-bold text-black mb-2">
          Or Upload Your Own MRI
        </h3>
        <p style={{ fontSize: "0.875rem", color: "var(--color-text-light)", marginBottom: "var(--spacing-lg)" }}>
          Supports JPEG, PNG, and DICOM (.dcm) files
        </p>

        <label className="cursor-pointer block">
          <input
            type="file"
            accept="image/*,.dcm,application/dicom"
            onChange={handleImageChange}
            className="sr-only"
          />

          <div className={`upload-area ${selectedImage ? "active" : ""}`}>
            {selectedImage ? (
              <div className="fade-in">
                <div className="upload-icon">
                  {isDicom(selectedImage) ? (
                    <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M9 3H5a2 2 0 00-2 2v4m6-6h10a2 2 0 012 2v4M9 3v18m0 0h10a2 2 0 002-2V9M9 21H5a2 2 0 01-2-2V9m0 0h18" />
                    </svg>
                  ) : (
                    <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </div>

                <h4 className="text-xl font-bold text-black mb-1">
                  {selectedImage.name}
                </h4>

                <div style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap", marginBottom: 8 }}>
                  {isDicom(selectedImage) && (
                    <span className="badge badge-info" style={{ fontSize: "0.75rem" }}>DICOM</span>
                  )}
                  <span
                    className="badge"
                    style={{
                      background: "var(--color-bg-tertiary)",
                      color:      "var(--color-text-secondary)",
                      fontSize:   "0.75rem",
                    }}
                  >
                    {(selectedImage.size / 1024).toFixed(0)} KB
                  </span>
                </div>

                <p className="text-gray-600">Click to change file</p>
              </div>
            ) : (
              <div>
                <div className="upload-icon">
                  <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                </div>
                <h4 className="text-xl font-bold text-black mb-2">
                  Click to Upload MRI Scan
                </h4>
                <p className="text-gray-600">
                  PNG, JPG, JPEG or DICOM .dcm &nbsp;·&nbsp; Max {MAX_FILE_MB} MB
                </p>
              </div>
            )}
          </div>
        </label>

        {/* File size error */}
        {sizeError && (
          <div className="alert alert-error" style={{ marginTop: "var(--spacing-md)", textAlign: "left" }}>
            <svg className="w-5 h-5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                clipRule="evenodd" />
            </svg>
            <span style={{ fontSize: "0.875rem" }}>{sizeError}</span>
          </div>
        )}
      </div>

      {/* ── Analysis — pass patientId to APIRequest ── */}
      {selectedImage && !sizeError && (
        <APIRequest image={selectedImage} patientId={patientId} />
      )}
    </div>
  );
};

export default ImageUploader;