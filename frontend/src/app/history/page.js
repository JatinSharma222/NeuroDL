"use client";
import React from "react";
import Link from "next/link";
import HistoryTable from "../components/HistoryTable";
import AnalyticsDashboard from "../components/AnalyticsDashboard";
import ProtectedRoute from "../components/ProtectedRoute";
import PatientTimeline from "../../components/PatientTimeline";

/**
 * history/page.js
 * ───────────────
 * Scan history dashboard — now includes AnalyticsDashboard above the table.
 * Route: /history
 */

const HistoryPage = () => {
  return (
    <ProtectedRoute>
    <div className="min-h-screen bg-gray-50">

      {/* ── Page Header ── */}
      <section className="bg-white border-b border-gray-100 pt-28 pb-10">
        <div className="container">
          <div className="max-w-6xl mx-auto">

            <Link
              href="/"
              className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-900 mb-6 transition-colors"
            >
              <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Back to Analysis
            </Link>

            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-red-50 rounded-full text-red-600 text-sm font-semibold mb-4">
                  <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M3 4a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1V4zM3 10a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H4a1 1 0 01-1-1v-6zM14 9a1 1 0 00-1 1v6a1 1 0 001 1h2a1 1 0 001-1v-6a1 1 0 00-1-1h-2z" />
                  </svg>
                  Scan History
                </div>
                <h1 style={{
                  fontSize: "clamp(2rem, 4vw, 2.75rem)",
                  fontWeight: 800, color: "var(--color-text-primary)",
                  margin: 0, lineHeight: 1.15,
                }}>
                  Patient Scan Records
                </h1>
                <p style={{ marginTop: "0.5rem", marginBottom: 0, color: "var(--color-text-secondary)", fontSize: "1.05rem" }}>
                  Every MRI analysis is automatically saved with its AI report,
                  confidence score, and visual outputs.
                </p>
              </div>
              <Link href="/#analyze" className="btn btn-primary" style={{ flexShrink: 0 }}>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                New Scan
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── Legend ── */}
      <section className="bg-white border-b border-gray-100 py-4">
        <div className="container">
          <div className="max-w-6xl mx-auto">
            <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--spacing-md)", alignItems: "center" }}>
              <span style={{ fontSize: "0.8rem", fontWeight: 700, color: "var(--color-text-light)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                Diagnosis Key:
              </span>
              {[
                { label: "Glioma Tumor",     cls: "class-badge class-badge-glioma"     },
                { label: "Meningioma Tumor", cls: "class-badge class-badge-meningioma" },
                { label: "Pituitary Tumor",  cls: "class-badge class-badge-pituitary"  },
                { label: "No Tumor",         cls: "class-badge class-badge-no-tumor"   },
              ].map(({ label, cls }) => (
                <span key={label} className={cls}>
                  <span className="class-badge-dot" />
                  {label}
                </span>
              ))}
              <span style={{ marginLeft: "auto", fontSize: "0.8rem", color: "var(--color-text-light)" }}>
                <strong>Seg</strong> = Segmentation &nbsp;|&nbsp;
                <strong>CAM</strong> = Grad-CAM &nbsp;|&nbsp;
                <strong>Report</strong> = AI Report
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* ── Analytics Dashboard ── */}
      <section className="section-sm" style={{ paddingBottom: 0 }}>
        <div className="container">
          <div className="max-w-6xl mx-auto">
            <AnalyticsDashboard />
          </div>
        </div>
      </section>

      {/* ── History Table ── */}
      <section className="section-sm">
        <div className="container">
          <div className="max-w-6xl mx-auto">
            <PatientTimeline />
            <HistoryTable />
          </div>
        </div>
      </section>

      {/* ── Disclaimer ── */}
      <section style={{ paddingBottom: "var(--spacing-3xl)" }}>
        <div className="container">
          <div className="max-w-6xl mx-auto">
            <div className="alert alert-warning">
              <svg style={{ width: 20, height: 20, flexShrink: 0 }} fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              <div>
                <p style={{ fontWeight: 700, marginBottom: 2, fontSize: "0.9rem" }}>Data &amp; Privacy Notice</p>
                <p style={{ margin: 0, fontSize: "0.82rem", lineHeight: 1.5 }}>
                  Scan records are stored locally in <code style={{ background: "#f0f0f0", padding: "1px 5px", borderRadius: 3 }}>neurodl.db</code> on
                  your server. No data is transmitted to external services.
                  AI reports are generated locally via Ollama — for research and educational purposes only.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
    </ProtectedRoute>
  );
};

export default HistoryPage;