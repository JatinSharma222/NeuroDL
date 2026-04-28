"use client";
import React, { useState, useEffect } from "react";
import APIRequest from "./APIRequest";

/**
 * ImageUploader.jsx
 * ─────────────────
 * Updated for NeuroDL v2.0.
 *
 * Changes vs v1.0:
 *   - File accept now includes .dcm (DICOM)
 *   - DICOM file shows a distinct icon + label
 *   - Max file size client-side guard (16 MB)
 */

const MAX_FILE_MB  = 16;
const MAX_FILE_BYTES = MAX_FILE_MB * 1024 * 1024;

const SAMPLE_IMAGES = [
  "/gg (26).jpg",  "/image (11).jpg", "/p (28).jpg",   "/gg (498).jpg",
  "/m (7).jpg",    "/p (131).jpg",    "/gg (544).jpg",  "/p (210).jpg",
  "/gg (37).jpg",  "/p (199).jpg",    "/image (46).jpg","/gg (340).jpg",
];

const isDicom = (file) =>
  file?.name?.toLowerCase().endsWith(".dcm") || file?.type === "application/dicom";


const ImageUploader = () => {
  const [selectedImage, setSelectedImage] = useState(null);
  const [sizeError,     setSizeError]     = useState("");
  const [isMounted,     setIsMounted]     = useState(false);

  useEffect(() => { setIsMounted(true); }, []);

  const handleFile = (file) => {
    setSizeError("");
    if (!file) return;
    if (file.size > MAX_FILE_BYTES) {
      setSizeError(`File is too large (${(file.size / 1024 / 1024).toFixed(1)} MB). Max allowed: ${MAX_FILE_MB} MB.`);
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
      const file     = new File([blob], "sample.jpg", { type: blob.type });
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
        <h3 className="text-xl font-bold text-black mb-6">
          Try with Sample Images
        </h3>
        <div className="sample-grid">
          {SAMPLE_IMAGES.map((image, index) => (
            <div
              key={index}
              className="sample-image"
              onClick={() => handleSampleClick(image)}
              title={`Sample ${index + 1}`}
            >
              <img src={image} alt={`Sample ${index + 1}`} />
            </div>
          ))}
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
                    /* DICOM icon */
                    <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M9 3H5a2 2 0 00-2 2v4m6-6h10a2 2 0 012 2v4M9 3v18m0 0h10a2 2 0 002-2V9M9 21H5a2 2 0 01-2-2V9m0 0h18" />
                    </svg>
                  ) : (
                    /* Checkmark icon */
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
                    <span className="badge badge-info" style={{ fontSize: "0.75rem" }}>
                      DICOM
                    </span>
                  )}
                  <span
                    className="badge"
                    style={{
                      background: "var(--color-bg-tertiary)",
                      color: "var(--color-text-secondary)",
                      fontSize: "0.75rem",
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

      {/* ── Analysis ── */}
      {selectedImage && !sizeError && (
        <APIRequest image={selectedImage} />
      )}
    </div>
  );
};

export default ImageUploader;