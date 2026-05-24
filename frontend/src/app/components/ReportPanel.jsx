"use client";
import React, { useState, useRef } from "react";

/**
 * ReportPanel.jsx
 * ───────────────
 * Renders the detailed AI clinical report with:
 *   - 8-section colour-coded layout
 *   - Copy to clipboard
 *   - Download as PDF (print-to-PDF via hidden iframe)
 *
 * Props:
 *   report  (string | null) — raw report text from /predict
 *   loading (bool)          — true while /predict is in flight
 */

// ── Section config ────────────────────────────────────────────────
const SECTION_CONFIG = {
  "CLINICAL INDICATION":        { color: "#1e40af", bg: "#eff6ff", border: "#bfdbfe", icon: "🩺" },
  "TECHNIQUE":                  { color: "#065f46", bg: "#ecfdf5", border: "#a7f3d0", icon: "⚙️"  },
  "FINDINGS":                   { color: "#991b1b", bg: "#fef2f2", border: "#fecaca", icon: "🔬" },
  "PATHOLOGICAL CORRELATION":   { color: "#7c3aed", bg: "#f5f3ff", border: "#ddd6fe", icon: "🧬" },
  "CLINICAL RISK ASSESSMENT":   { color: "#92400e", bg: "#fffbeb", border: "#fde68a", icon: "⚠️"  },
  "RECOMMENDATIONS":            { color: "#065f46", bg: "#ecfdf5", border: "#a7f3d0", icon: "📋" },
  "FOLLOW-UP PLAN":             { color: "#1e40af", bg: "#eff6ff", border: "#bfdbfe", icon: "📅" },
  "AI SYSTEM PERFORMANCE NOTE": { color: "#374151", bg: "#f9fafb", border: "#e5e7eb", icon: "🤖" },
  "DISCLAIMER":                 { color: "#6b7280", bg: "#f9fafb", border: "#e5e7eb", icon: "⚕️"  },
};

const HEADER_FIELDS = ["PATIENT:", "AGE / GENDER:", "REFERENCE NO:", "DATE OF SCAN:", "REPORTING SYSTEM:"];
const SEPARATORS    = ["━━━", "═══"];

const isSeparator  = (line) => SEPARATORS.some((s) => line.trim().startsWith(s));
const isHeaderLine = (line) => HEADER_FIELDS.some((f) => line.trim().startsWith(f));

// ── Parse report text into typed blocks ──────────────────────────
const parseReport = (text) => {
  const lines  = text.split("\n");
  const blocks = [];
  let current  = null;

  for (const raw of lines) {
    const line = raw.trimEnd();
    if (isSeparator(line)) continue;
    if (line.includes("NEURODL AI-ASSISTED MRI BRAIN REPORT")) continue;
    if (line.includes("END OF REPORT")) continue;

    if (isHeaderLine(line)) {
      if (!current || current.type !== "header") {
        current = { type: "header", lines: [] };
        blocks.push(current);
      }
      current.lines.push(line.trim());
      continue;
    }

    const sectionKey = Object.keys(SECTION_CONFIG).find(
      (s) => line.trim().startsWith(s + ":") || line.trim() === s
    );
    if (sectionKey) {
      current = { type: "section", key: sectionKey, lines: [] };
      blocks.push(current);
      const afterColon = line.trim().slice(sectionKey.length + 1).trim();
      if (afterColon) current.lines.push(afterColon);
      continue;
    }

    if (current) {
      current.lines.push(line);
    } else if (line.trim()) {
      blocks.push({ type: "preamble", lines: [line] });
      current = blocks[blocks.length - 1];
    }
  }
  return blocks;
};

// ── Extract patient name from parsed blocks ───────────────────────
const extractPatientName = (blocks) => {
  const header = blocks.find((b) => b.type === "header");
  if (!header) return "Patient";
  const patientLine = header.lines.find((l) => l.startsWith("PATIENT:"));
  if (!patientLine) return "Patient";
  return patientLine.replace("PATIENT:", "").trim() || "Patient";
};

const extractDate = (blocks) => {
  const header = blocks.find((b) => b.type === "header");
  if (!header) return "";
  const dateLine = header.lines.find((l) => l.startsWith("DATE OF SCAN:"));
  if (!dateLine) return "";
  return dateLine.replace("DATE OF SCAN:", "").trim();
};

// ── Build the full PDF HTML content ──────────────────────────────
const buildPDFHTML = (blocks, report) => {
  const sectionColors = {
    "CLINICAL INDICATION":        { color: "#1e40af", bg: "#eff6ff", border: "#bfdbfe" },
    "TECHNIQUE":                  { color: "#065f46", bg: "#ecfdf5", border: "#a7f3d0" },
    "FINDINGS":                   { color: "#991b1b", bg: "#fef2f2", border: "#fecaca" },
    "PATHOLOGICAL CORRELATION":   { color: "#7c3aed", bg: "#f5f3ff", border: "#ddd6fe" },
    "CLINICAL RISK ASSESSMENT":   { color: "#92400e", bg: "#fffbeb", border: "#fde68a" },
    "RECOMMENDATIONS":            { color: "#065f46", bg: "#ecfdf5", border: "#a7f3d0" },
    "FOLLOW-UP PLAN":             { color: "#1e40af", bg: "#eff6ff", border: "#bfdbfe" },
    "AI SYSTEM PERFORMANCE NOTE": { color: "#374151", bg: "#f9fafb", border: "#e5e7eb" },
    "DISCLAIMER":                 { color: "#6b7280", bg: "#f9fafb", border: "#e5e7eb" },
  };

  const headerBlock = blocks.find((b) => b.type === "header");
  let headerHTML = "";
  if (headerBlock) {
    const fields = headerBlock.lines.map((line) => {
      const colonIdx = line.indexOf(":");
      if (colonIdx === -1) return "";
      const label = line.slice(0, colonIdx).trim();
      const value = line.slice(colonIdx + 1).trim();
      return `
        <div class="meta-item">
          <div class="meta-label">${label}</div>
          <div class="meta-value">${value || "—"}</div>
        </div>`;
    }).join("");
    headerHTML = `<div class="meta-grid">${fields}</div>`;
  }

  const sectionsHTML = blocks
    .filter((b) => b.type === "section")
    .map((b) => {
      const cfg     = sectionColors[b.key] || { color: "#374151", bg: "#f9fafb", border: "#e5e7eb" };
      const content = b.lines.join("\n").trim();
      const isDisclaimer = b.key === "DISCLAIMER";
      return `
        <div class="section" style="background:${cfg.bg};border-left:4px solid ${cfg.color};border:1px solid ${cfg.border};border-left-width:4px">
          <div class="section-title" style="color:${cfg.color}">${b.key}</div>
          <div class="section-body" style="font-style:${isDisclaimer ? "italic" : "normal"};color:${isDisclaimer ? "#6b7280" : "#1e293b"}">${content.replace(/\n/g, "<br>")}</div>
        </div>`;
    }).join("");

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>NeuroDL Clinical Report</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Segoe UI', Arial, sans-serif;
      font-size: 11pt;
      color: #1e293b;
      background: white;
      padding: 0;
    }

    /* ── Page header ── */
    .page-header {
      background: linear-gradient(135deg, #dc2626, #991b1b);
      color: white;
      padding: 24px 40px;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .logo-area { display: flex; align-items: center; gap: 12px; }
    .logo-box {
      width: 44px; height: 44px;
      background: rgba(255,255,255,0.2);
      border-radius: 10px;
      display: flex; align-items: center; justify-content: center;
      font-size: 20px;
    }
    .logo-text { font-size: 22pt; font-weight: 800; letter-spacing: -0.5px; }
    .logo-sub  { font-size: 9pt; opacity: 0.85; margin-top: 2px; }
    .header-right { text-align: right; font-size: 9pt; opacity: 0.9; line-height: 1.6; }

    /* ── Research banner ── */
    .research-banner {
      background: #fef3c7;
      border-bottom: 2px solid #f59e0b;
      padding: 8px 40px;
      font-size: 8.5pt;
      color: #92400e;
      font-weight: 600;
      text-align: center;
      letter-spacing: 0.03em;
    }

    /* ── Report title ── */
    .report-title-section {
      padding: 24px 40px 16px;
      border-bottom: 2px solid #e2e8f0;
    }
    .report-title {
      font-size: 16pt;
      font-weight: 800;
      color: #0f172a;
      margin-bottom: 4px;
    }
    .report-subtitle {
      font-size: 9pt;
      color: #64748b;
    }

    /* ── Meta grid ── */
    .meta-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 16px;
      padding: 20px 40px;
      background: #f8fafc;
      border-bottom: 1px solid #e2e8f0;
    }
    .meta-item {}
    .meta-label {
      font-size: 7.5pt;
      font-weight: 700;
      color: #94a3b8;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      margin-bottom: 3px;
    }
    .meta-value {
      font-size: 10pt;
      font-weight: 600;
      color: #1e293b;
    }

    /* ── Sections ── */
    .sections-container { padding: 20px 40px; }
    .section {
      border-radius: 8px;
      padding: 14px 18px;
      margin-bottom: 12px;
      page-break-inside: avoid;
    }
    .section-title {
      font-size: 8pt;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      margin-bottom: 8px;
    }
    .section-body {
      font-size: 10pt;
      line-height: 1.7;
      white-space: pre-wrap;
    }

    /* ── Footer ── */
    .page-footer {
      padding: 16px 40px;
      border-top: 2px solid #e2e8f0;
      display: flex;
      justify-content: space-between;
      align-items: center;
      background: #f8fafc;
      margin-top: 8px;
    }
    .footer-left { font-size: 8pt; color: #64748b; }
    .footer-right { font-size: 8pt; color: #94a3b8; }
    .watermark {
      position: fixed;
      bottom: 80px;
      right: 40px;
      font-size: 48pt;
      font-weight: 900;
      color: rgba(220, 38, 38, 0.04);
      transform: rotate(-30deg);
      pointer-events: none;
      z-index: 0;
      letter-spacing: -2px;
    }

    @media print {
      body { padding: 0; }
      .page-header { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .research-banner { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .section { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      @page { margin: 0; size: A4; }
    }
  </style>
</head>
<body>

  <!-- Watermark -->
  <div class="watermark">RESEARCH</div>

  <!-- Header -->
  <div class="page-header">
    <div class="logo-area">
      <div class="logo-box">🧠</div>
      <div>
        <div class="logo-text">NeuroDL</div>
        <div class="logo-sub">AI-Assisted Brain MRI Analysis Platform</div>
      </div>
    </div>
    <div class="header-right">
      <div>NeuroDL v2.0 · ResNet50V2</div>
      <div>Accuracy: 94.92%</div>
    </div>
  </div>

  <!-- Research disclaimer banner -->
  <div class="research-banner">
    ⚠ FOR RESEARCH AND EDUCATIONAL PURPOSES ONLY — NOT FOR CLINICAL DIAGNOSIS — MUST BE VERIFIED BY A QUALIFIED MEDICAL PROFESSIONAL
  </div>

  <!-- Report title -->
  <div class="report-title-section">
    <div class="report-title">AI-Assisted MRI Brain Report</div>
    <div class="report-subtitle">Generated by NeuroDL v2.0 using llama3.1:8b via Ollama · 8-Section Clinical Format</div>
  </div>

  <!-- Patient metadata -->
  ${headerHTML}

  <!-- Clinical sections -->
  <div class="sections-container">
    ${sectionsHTML}
  </div>

  <!-- Footer -->
  <div class="page-footer">
    <div class="footer-left">
      <strong>NeuroDL v2.0</strong> · AI-Assisted Radiology Report<br>
      This document is generated by an AI system and is not a substitute for professional medical advice.
    </div>
    <div class="footer-right">
      neurodl.ai · Research Use Only
    </div>
  </div>

</body>
</html>`;
};

// ── Header metadata block ─────────────────────────────────────────
const HeaderBlock = ({ lines }) => (
  <div
    style={{
      background:          "#f8fafc",
      border:              "1px solid #e2e8f0",
      borderRadius:        "var(--radius-md)",
      padding:             "var(--spacing-lg)",
      marginBottom:        "var(--spacing-lg)",
      display:             "grid",
      gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
      gap:                 "var(--spacing-md)",
    }}
  >
    {lines.map((line, i) => {
      const colonIdx = line.indexOf(":");
      if (colonIdx === -1) return null;
      const label = line.slice(0, colonIdx).trim();
      const value = line.slice(colonIdx + 1).trim();
      return (
        <div key={i}>
          <span style={{ fontSize: "0.7rem", fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.07em" }}>
            {label}
          </span>
          <p style={{ margin: "3px 0 0", fontSize: "0.88rem", fontWeight: 600, color: "#1e293b", lineHeight: 1.4 }}>
            {value || "—"}
          </p>
        </div>
      );
    })}
  </div>
);

// ── Clinical section block ────────────────────────────────────────
const SectionBlock = ({ sectionKey, lines }) => {
  const config      = SECTION_CONFIG[sectionKey] || { color: "#374151", bg: "#f9fafb", border: "#e5e7eb", icon: "📄" };
  const content     = lines.join("\n").trim();
  const isDisclaimer = sectionKey === "DISCLAIMER";
  if (!content) return null;

  return (
    <div
      style={{
        background:   config.bg,
        border:       `1px solid ${config.border}`,
        borderLeft:   `4px solid ${config.color}`,
        borderRadius: "var(--radius-md)",
        padding:      "var(--spacing-lg)",
        marginBottom: "var(--spacing-md)",
        opacity:      isDisclaimer ? 0.9 : 1,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: "var(--spacing-sm)" }}>
        <span style={{ fontSize: "1.05rem" }}>{config.icon}</span>
        <h4 style={{
          margin: 0, fontSize: "0.78rem", fontWeight: 800,
          color: config.color, textTransform: "uppercase", letterSpacing: "0.08em",
        }}>
          {sectionKey}
        </h4>
      </div>
      <div style={{
        fontSize:   isDisclaimer ? "0.78rem" : "0.875rem",
        lineHeight: 1.75,
        color:      isDisclaimer ? "#6b7280" : "#1e293b",
        whiteSpace: "pre-wrap",
        fontStyle:  isDisclaimer ? "italic" : "normal",
      }}>
        {content}
      </div>
    </div>
  );
};

// ── Main ReportPanel ──────────────────────────────────────────────
const ReportPanel = ({ report, loading }) => {
  const [isOpen,      setIsOpen]      = useState(true);
  const [copyLabel,   setCopyLabel]   = useState("Copy");
  const [downloading, setDownloading] = useState(false);

  const blocks      = report ? parseReport(report) : [];
  const patientName = blocks.length ? extractPatientName(blocks) : "Patient";
  const scanDate    = blocks.length ? extractDate(blocks).replace(/,.*/, "").trim() : "";
  const fileName    = `NeuroDL_Report_${patientName.replace(/\s+/g, "_")}${scanDate ? "_" + scanDate.replace(/\s+/g, "_") : ""}.pdf`;

  // ── Copy handler ──────────────────────────────────────────────
  const handleCopy = () => {
    if (!report) return;
    navigator.clipboard.writeText(report).then(() => {
      setCopyLabel("Copied ✓");
      setTimeout(() => setCopyLabel("Copy"), 2000);
    });
  };

  // ── PDF download via hidden iframe + print dialog ─────────────
  const handleDownloadPDF = () => {
    if (!report || !blocks.length) return;
    setDownloading(true);

    const htmlContent = buildPDFHTML(blocks, report);

    // Create hidden iframe
    const iframe = document.createElement("iframe");
    iframe.style.position = "fixed";
    iframe.style.top      = "-9999px";
    iframe.style.left     = "-9999px";
    iframe.style.width    = "210mm";
    iframe.style.height   = "297mm";
    document.body.appendChild(iframe);

    const iframeDoc = iframe.contentWindow.document;
    iframeDoc.open();
    iframeDoc.write(htmlContent);
    iframeDoc.close();

    // Wait for content to render then print
    iframe.onload = () => {
      setTimeout(() => {
        try {
          iframe.contentWindow.focus();
          iframe.contentWindow.print();
        } finally {
          setTimeout(() => {
            document.body.removeChild(iframe);
            setDownloading(false);
          }, 1000);
        }
      }, 500);
    };
  };

  return (
    <div className="report-panel fade-in">

      {/* ── Panel header ── */}
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
              Ollama / llama3.1:8b · 8-section clinical format · Research purposes only
            </p>
          </div>
        </div>

        {/* Action buttons */}
        <div style={{ display: "flex", alignItems: "center", gap: 6 }} onClick={(e) => e.stopPropagation()}>

          {/* Copy */}
          {report && isOpen && (
            <button
              onClick={handleCopy}
              className="btn btn-ghost btn-sm"
              style={{ fontSize: "0.75rem", padding: "6px 10px", gap: 5 }}
            >
              <svg width="13" height="13" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              {copyLabel}
            </button>
          )}

          {/* Download PDF */}
          {report && isOpen && (
            <button
              onClick={handleDownloadPDF}
              disabled={downloading}
              className="btn btn-primary btn-sm"
              style={{ fontSize: "0.75rem", padding: "6px 12px", gap: 6 }}
            >
              {downloading ? (
                <>
                  <svg className="spinning" width="13" height="13" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Preparing...
                </>
              ) : (
                <>
                  <svg width="13" height="13" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  Download PDF
                </>
              )}
            </button>
          )}

          {/* Chevron */}
          <svg
            className={`report-chevron ${isOpen ? "open" : ""}`}
            width="20" height="20"
            fill="none" stroke="currentColor" viewBox="0 0 24 24"
            style={{ cursor: "pointer" }}
            onClick={() => setIsOpen((p) => !p)}
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </div>

      {/* ── Panel body ── */}
      {isOpen && (
        <div style={{ padding: "var(--spacing-lg)" }}>

          {/* Loading */}
          {loading && (
            <div className="report-loading">
              <svg className="spinning" width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Generating detailed clinical report via Ollama — this may take 20–40 seconds...
            </div>
          )}

          {/* Report */}
          {!loading && report && blocks.length > 0 && (
            <div className="fade-in">
              {blocks.map((block, i) => {
                if (block.type === "header")  return <HeaderBlock  key={i} lines={block.lines} />;
                if (block.type === "section") return <SectionBlock key={i} sectionKey={block.key} lines={block.lines} />;
                const text = block.lines.join(" ").trim();
                if (!text) return null;
                return <p key={i} style={{ fontSize: "0.82rem", color: "var(--color-text-light)", marginBottom: 8 }}>{text}</p>;
              })}
            </div>
          )}

          {/* Fallback raw */}
          {!loading && report && blocks.length === 0 && (
            <div style={{ whiteSpace: "pre-wrap", fontSize: "0.875rem", lineHeight: 1.75 }}>{report}</div>
          )}

          {/* Ollama unavailable */}
          {!loading && !report && (
            <div className="report-unavailable">
              <svg style={{ width: 40, height: 40, margin: "0 auto 12px", display: "block", opacity: 0.3 }}
                fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <p style={{ margin: 0, fontSize: "0.9rem" }}>Report unavailable — Ollama may not be running.</p>
              <p style={{ margin: "6px 0 0", fontSize: "0.8rem", color: "var(--color-text-light)" }}>
                Run <code style={{ background: "#f0f0f0", padding: "2px 6px", borderRadius: 4 }}>ollama serve</code> and retry.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ReportPanel;