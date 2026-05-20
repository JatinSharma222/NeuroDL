"use client";
import React, { useState } from "react";

/**
 * ReportPanel.jsx
 * ───────────────
 * Renders the detailed ~2-page AI clinical report from Ollama.
 *
 * Handles the 8-section format produced by report.py:
 *   CLINICAL INDICATION, TECHNIQUE, FINDINGS, PATHOLOGICAL CORRELATION,
 *   CLINICAL RISK ASSESSMENT, RECOMMENDATIONS, FOLLOW-UP PLAN,
 *   AI SYSTEM PERFORMANCE NOTE, DISCLAIMER
 *
 * Also renders the patient header block and the decorative separators.
 *
 * Props:
 *   report  (string | null) — raw report text from /predict
 *   loading (bool)          — true while /predict is in flight
 */

// ── Section config — colour + icon per clinical section ──────────
const SECTION_CONFIG = {
  "CLINICAL INDICATION":         { color: "#1e40af", bg: "#eff6ff", icon: "🩺" },
  "TECHNIQUE":                   { color: "#065f46", bg: "#ecfdf5", icon: "⚙️"  },
  "FINDINGS":                    { color: "#991b1b", bg: "#fef2f2", icon: "🔬" },
  "PATHOLOGICAL CORRELATION":    { color: "#7c3aed", bg: "#f5f3ff", icon: "🧬" },
  "CLINICAL RISK ASSESSMENT":    { color: "#92400e", bg: "#fffbeb", icon: "⚠️"  },
  "RECOMMENDATIONS":             { color: "#065f46", bg: "#ecfdf5", icon: "📋" },
  "FOLLOW-UP PLAN":              { color: "#1e40af", bg: "#eff6ff", icon: "📅" },
  "AI SYSTEM PERFORMANCE NOTE":  { color: "#374151", bg: "#f9fafb", icon: "🤖" },
  "DISCLAIMER":                  { color: "#6b7280", bg: "#f9fafb", icon: "⚕️"  },
};

// Lines that are part of the patient header block (render as metadata)
const HEADER_FIELDS = ["PATIENT:", "AGE / GENDER:", "REFERENCE NO:", "DATE OF SCAN:", "REPORTING SYSTEM:"];

// Decorative separators to strip from rendered output
const SEPARATORS = ["━━━", "═══"];

const isSeparator  = (line) => SEPARATORS.some((s) => line.trim().startsWith(s));
const isHeaderLine = (line) => HEADER_FIELDS.some((f) => line.trim().startsWith(f));
const isSectionHeader = (line) =>
  Object.keys(SECTION_CONFIG).some((s) => line.trim().startsWith(s + ":") || line.trim() === s);

// ── Parse report into structured blocks ──────────────────────────
const parseReport = (text) => {
  const lines  = text.split("\n");
  const blocks = [];
  let current  = null;

  for (const raw of lines) {
    const line = raw.trimEnd();

    // Skip decorative separators and the main title line
    if (isSeparator(line)) continue;
    if (line.includes("NEURODL AI-ASSISTED MRI BRAIN REPORT")) continue;
    if (line.includes("END OF REPORT")) continue;

    // Header metadata fields → collect into a "header" block
    if (isHeaderLine(line)) {
      if (!current || current.type !== "header") {
        current = { type: "header", lines: [] };
        blocks.push(current);
      }
      current.lines.push(line.trim());
      continue;
    }

    // Section headers
    const sectionKey = Object.keys(SECTION_CONFIG).find(
      (s) => line.trim().startsWith(s + ":") || line.trim() === s
    );
    if (sectionKey) {
      current = { type: "section", key: sectionKey, lines: [] };
      blocks.push(current);
      // If content is on the same line after the colon, capture it
      const afterColon = line.trim().slice(sectionKey.length + 1).trim();
      if (afterColon) current.lines.push(afterColon);
      continue;
    }

    // Content lines — append to current block
    if (current) {
      current.lines.push(line);
    } else if (line.trim()) {
      // Before any section — treat as preamble
      blocks.push({ type: "preamble", lines: [line] });
      current = blocks[blocks.length - 1];
    }
  }

  return blocks;
};

// ── Render a header metadata block ───────────────────────────────
const HeaderBlock = ({ lines }) => (
  <div
    style={{
      background:   "#f8fafc",
      border:       "1px solid #e2e8f0",
      borderRadius: "var(--radius-md)",
      padding:      "var(--spacing-lg)",
      marginBottom: "var(--spacing-lg)",
      display:      "grid",
      gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
      gap:          "var(--spacing-sm)",
    }}
  >
    {lines.map((line, i) => {
      const colonIdx = line.indexOf(":");
      if (colonIdx === -1) return <p key={i} style={{ margin: 0, fontSize: "0.85rem" }}>{line}</p>;
      const label = line.slice(0, colonIdx).trim();
      const value = line.slice(colonIdx + 1).trim();
      return (
        <div key={i}>
          <span style={{ fontSize: "0.72rem", fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.06em" }}>
            {label}
          </span>
          <p style={{ margin: "2px 0 0", fontSize: "0.88rem", fontWeight: 600, color: "#1e293b" }}>
            {value || "—"}
          </p>
        </div>
      );
    })}
  </div>
);

// ── Render a clinical section block ──────────────────────────────
const SectionBlock = ({ sectionKey, lines }) => {
  const config  = SECTION_CONFIG[sectionKey] || { color: "#374151", bg: "#f9fafb", icon: "📄" };
  const content = lines.join("\n").trim();
  if (!content) return null;

  const isDisclaimer = sectionKey === "DISCLAIMER";

  return (
    <div
      style={{
        background:   config.bg,
        border:       `1px solid ${config.color}22`,
        borderLeft:   `4px solid ${config.color}`,
        borderRadius: "var(--radius-md)",
        padding:      "var(--spacing-lg)",
        marginBottom: "var(--spacing-md)",
        opacity:      isDisclaimer ? 0.85 : 1,
      }}
    >
      {/* Section title */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: "var(--spacing-sm)" }}>
        <span style={{ fontSize: "1.1rem" }}>{config.icon}</span>
        <h4
          style={{
            margin:        0,
            fontSize:      "0.8rem",
            fontWeight:    800,
            color:         config.color,
            textTransform: "uppercase",
            letterSpacing: "0.07em",
          }}
        >
          {sectionKey}
        </h4>
      </div>

      {/* Section body */}
      <div
        style={{
          fontSize:   isDisclaimer ? "0.78rem" : "0.875rem",
          lineHeight: 1.75,
          color:      isDisclaimer ? "#6b7280" : "#1e293b",
          whiteSpace: "pre-wrap",
          fontStyle:  isDisclaimer ? "italic" : "normal",
        }}
      >
        {content}
      </div>
    </div>
  );
};

// ── Main component ────────────────────────────────────────────────
const ReportPanel = ({ report, loading }) => {
  const [isOpen,    setIsOpen]    = useState(true);
  const [copyLabel, setCopyLabel] = useState("Copy Report");

  const handleCopy = () => {
    if (!report) return;
    navigator.clipboard.writeText(report).then(() => {
      setCopyLabel("Copied ✓");
      setTimeout(() => setCopyLabel("Copy Report"), 2000);
    });
  };

  const blocks = report ? parseReport(report) : [];

  return (
    <div className="report-panel fade-in">

      {/* ── Header (always visible) ── */}
      <div
        className="report-header"
        onClick={() => setIsOpen((p) => !p)}
        role="button"
        aria-expanded={isOpen}
        style={{ cursor: "pointer" }}
      >
        <div className="report-header-left">
          <div className="report-header-icon">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: "1rem", fontWeight: 700 }}>
              AI Clinical Radiology Report
            </h3>
            <p style={{ margin: 0, fontSize: "0.78rem", color: "var(--color-text-light)", fontWeight: 400 }}>
              Generated by Ollama / llama3.1:8b · 8-section clinical format · Research purposes only
            </p>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {/* Copy button */}
          {report && isOpen && (
            <button
              onClick={(e) => { e.stopPropagation(); handleCopy(); }}
              className="btn btn-ghost btn-sm"
              style={{ fontSize: "0.75rem", padding: "6px 12px" }}
            >
              <svg width="13" height="13" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              {copyLabel}
            </button>
          )}
          {/* Chevron */}
          <svg
            className={`report-chevron ${isOpen ? "open" : ""}`}
            width="20" height="20"
            fill="none" stroke="currentColor" viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </div>

      {/* ── Body ── */}
      {isOpen && (
        <div style={{ padding: "var(--spacing-lg)" }}>

          {/* Loading state */}
          {loading && (
            <div className="report-loading">
              <svg className="spinning" width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Generating detailed clinical report via Ollama — this may take 20–40 seconds...
            </div>
          )}

          {/* Report rendered */}
          {!loading && report && blocks.length > 0 && (
            <div className="fade-in">
              {blocks.map((block, i) => {
                if (block.type === "header") {
                  return <HeaderBlock key={i} lines={block.lines} />;
                }
                if (block.type === "section") {
                  return <SectionBlock key={i} sectionKey={block.key} lines={block.lines} />;
                }
                // preamble — skip empty, render anything else small
                const text = block.lines.join(" ").trim();
                if (!text) return null;
                return (
                  <p key={i} style={{ fontSize: "0.82rem", color: "var(--color-text-light)", marginBottom: 8 }}>
                    {text}
                  </p>
                );
              })}
            </div>
          )}

          {/* Fallback: raw text if parsing produces nothing */}
          {!loading && report && blocks.length === 0 && (
            <div className="report-body" style={{ whiteSpace: "pre-wrap", fontSize: "0.875rem", lineHeight: 1.75 }}>
              {report}
            </div>
          )}

          {/* Ollama unavailable */}
          {!loading && !report && (
            <div className="report-unavailable">
              <svg style={{ width: 40, height: 40, margin: "0 auto 12px", display: "block", opacity: 0.3 }}
                fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <p style={{ margin: 0, fontSize: "0.9rem" }}>
                Report unavailable — Ollama may not be running.
              </p>
              <p style={{ margin: "6px 0 0", fontSize: "0.8rem", color: "var(--color-text-light)" }}>
                Run{" "}
                <code style={{ background: "#f0f0f0", padding: "2px 6px", borderRadius: 4 }}>
                  ollama serve
                </code>{" "}
                and retry.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ReportPanel;