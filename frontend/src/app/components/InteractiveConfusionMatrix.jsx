"use client";
import React, { useState } from "react";

/**
 * InteractiveConfusionMatrix.jsx  —  NeuroDL v2.0
 * ─────────────────────────────────────────────────
 * Renders a 4×4 confusion matrix with:
 *   • Colour intensity scaled per row (shows where each class goes wrong)
 *   • Click any cell → expand detail panel with count, %, and interpretation
 *   • Diagonal (correct) cells highlighted in blue
 *   • Off-diagonal (wrong) cells in red, intensity ∝ count
 *
 * Props:
 *   data  — from /model-performance:
 *     { confusion_matrix: { matrix, labels, total } }
 */

const CLASS_COLOR = {
  "glioma":      "#dc2626",
  "meningioma":  "#d97706",
  "notumor":     "#16a34a",
  "pituitary":   "#2563eb",
};

// Normalise label to key
const toKey = (label) => label.toLowerCase().replace(/\s+/g, "").replace("tumor", "");

const InteractiveConfusionMatrix = ({ data }) => {
  const [selected, setSelected] = useState(null);   // { row, col }

  if (!data?.confusion_matrix) return null;

  const { matrix, labels, total } = data.confusion_matrix;
  const n = labels.length;

  // Row sums for per-row normalisation
  const rowSums = matrix.map(row => row.reduce((a, b) => a + b, 0));

  // Find max off-diagonal value for colour scaling
  const offDiagMax = Math.max(
    ...matrix.flatMap((row, i) => row.filter((_, j) => j !== i))
  ) || 1;

  const cellSize  = 72;
  const labelW    = 110;

  const getCellStyle = (i, j, count) => {
    const isDiag     = i === j;
    const rowTotal   = rowSums[i] || 1;
    const intensity  = isDiag
      ? count / rowTotal           // 0–1 for diagonal
      : count / offDiagMax;        // 0–1 for off-diagonal
    const isSelected = selected?.row === i && selected?.col === j;

    let bg, textColor;
    if (isDiag) {
      // Blue scale for correct predictions
      const alpha = 0.15 + intensity * 0.7;
      bg        = `rgba(37,99,235,${alpha})`;
      textColor = intensity > 0.5 ? "white" : "#1e3a8a";
    } else {
      // Red scale for misclassifications
      const alpha = count === 0 ? 0 : 0.1 + intensity * 0.65;
      bg        = `rgba(220,38,38,${alpha})`;
      textColor = intensity > 0.45 ? "white" : "#7f1d1d";
    }

    return {
      width:      cellSize,
      height:     cellSize,
      background: bg,
      color:      count === 0 ? "var(--color-text-light)" : textColor,
      display:    "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      cursor:     "pointer",
      border:     isSelected
        ? "2.5px solid var(--color-primary)"
        : "1px solid var(--color-border-light)",
      borderRadius: 6,
      transition: "transform 0.1s, box-shadow 0.1s",
      boxShadow:  isSelected ? "0 0 0 3px rgba(230,0,35,0.15)" : "none",
      userSelect: "none",
      flexShrink: 0,
    };
  };

  // Interpretation for selected cell
  const getInterpretation = (i, j, count) => {
    const trueLabel = labels[i];
    const predLabel = labels[j];
    const pct = rowSums[i] > 0 ? (count / rowSums[i] * 100).toFixed(1) : "0.0";

    if (i === j) {
      return `The model correctly identified ${count} out of ${rowSums[i]} ${trueLabel} scans (${pct}%). This is a true positive.`;
    }
    if (count === 0) {
      return `No ${trueLabel} scans were misclassified as ${predLabel}. Perfect separation for this pair.`;
    }
    return `${count} ${trueLabel} scan${count !== 1 ? "s" : ""} were incorrectly predicted as ${predLabel} (${pct}% of all ${trueLabel} cases). This is a false positive for ${predLabel}.`;
  };

  const sel = selected;
  const selCount = sel ? matrix[sel.row][sel.col] : 0;

  // Overall accuracy from diagonal
  const diagSum = matrix.reduce((sum, row, i) => sum + row[i], 0);
  const overallAcc = total > 0 ? (diagSum / total * 100).toFixed(2) : "—";

  return (
    <div>
      {/* ── Header ── */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14, flexWrap: "wrap", gap: 8 }}>
        <div>
          <h3 style={{ margin: "0 0 2px", fontSize: "1rem", fontWeight: 700, color: "var(--color-text-primary)" }}>
            Confusion Matrix
          </h3>
          <p style={{ margin: 0, fontSize: "0.75rem", color: "var(--color-text-light)" }}>
            Meta-model · {total?.toLocaleString()} test images · click any cell for details
          </p>
        </div>
        <span style={{
          fontSize: "1rem", fontWeight: 800, padding: "4px 14px",
          borderRadius: 99, background: "#dcfce7", color: "#14532d",
        }}>
          {overallAcc}% overall
        </span>
      </div>

      {/* ── Matrix grid ── */}
      <div style={{ overflowX: "auto" }}>
        <div style={{ display: "inline-block", minWidth: labelW + cellSize * n + 8 }}>

          {/* Column headers */}
          <div style={{ display: "flex", marginLeft: labelW, marginBottom: 4, gap: 3 }}>
            {labels.map((lbl, j) => {
              const key   = toKey(lbl);
              const color = CLASS_COLOR[key] || "#6b7280";
              return (
                <div key={j} style={{
                  width: cellSize, textAlign: "center",
                  fontSize: "0.68rem", fontWeight: 700, color,
                  flexShrink: 0,
                }}>
                  {lbl.replace(" Tumor", "")}
                </div>
              );
            })}
          </div>

          {/* "Predicted" label */}
          <div style={{ display: "flex", marginLeft: labelW, marginBottom: 6 }}>
            <div style={{
              width: cellSize * n, textAlign: "center",
              fontSize: "0.65rem", fontWeight: 700,
              color: "var(--color-text-light)", letterSpacing: "0.05em",
              textTransform: "uppercase",
            }}>
              ← Predicted →
            </div>
          </div>

          {/* Rows */}
          {matrix.map((row, i) => {
            const key   = toKey(labels[i]);
            const color = CLASS_COLOR[key] || "#6b7280";
            return (
              <div key={i} style={{ display: "flex", alignItems: "center", marginBottom: 3, gap: 3 }}>
                {/* Row label */}
                <div style={{
                  width: labelW, paddingRight: 10,
                  fontSize: "0.72rem", fontWeight: 700,
                  color, textAlign: "right", flexShrink: 0,
                  lineHeight: 1.2,
                }}>
                  {labels[i].replace(" Tumor", "")}
                </div>

                {/* Cells */}
                {row.map((count, j) => {
                  const pct = rowSums[i] > 0
                    ? (count / rowSums[i] * 100).toFixed(0)
                    : "0";
                  return (
                    <div
                      key={j}
                      style={getCellStyle(i, j, count)}
                      onClick={() => setSelected(
                        selected?.row === i && selected?.col === j ? null : { row: i, col: j }
                      )}
                      onMouseEnter={e => { e.currentTarget.style.transform = "scale(1.06)"; }}
                      onMouseLeave={e => { e.currentTarget.style.transform = "scale(1)"; }}
                      title={`True: ${labels[i]} → Predicted: ${labels[j]}`}
                    >
                      <span style={{ fontWeight: 800, fontSize: "1rem", lineHeight: 1 }}>{count}</span>
                      <span style={{ fontSize: "0.62rem", opacity: 0.8, marginTop: 2 }}>{pct}%</span>
                    </div>
                  );
                })}
              </div>
            );
          })}

          {/* "True" label (rotated) */}
          <div style={{ display: "flex", marginTop: 8, marginLeft: labelW }}>
            <div style={{
              width: cellSize * n, textAlign: "center",
              fontSize: "0.65rem", fontWeight: 700,
              color: "var(--color-text-light)", letterSpacing: "0.05em",
              textTransform: "uppercase",
            }}>
              ↑ True Label ↑
            </div>
          </div>
        </div>
      </div>

      {/* ── Legend ── */}
      <div style={{ display: "flex", gap: 14, marginTop: 12, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <div style={{ width: 14, height: 14, borderRadius: 3, background: "rgba(37,99,235,0.6)" }} />
          <span style={{ fontSize: "0.72rem", color: "var(--color-text-secondary)" }}>Correct (diagonal)</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <div style={{ width: 14, height: 14, borderRadius: 3, background: "rgba(220,38,38,0.5)" }} />
          <span style={{ fontSize: "0.72rem", color: "var(--color-text-secondary)" }}>Misclassified (darker = more)</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <div style={{ width: 14, height: 14, borderRadius: 3, background: "var(--color-bg-tertiary)", border: "1px solid var(--color-border)" }} />
          <span style={{ fontSize: "0.72rem", color: "var(--color-text-secondary)" }}>Zero errors</span>
        </div>
      </div>

      {/* ── Selected cell detail ── */}
      {sel && (
        <div style={{
          marginTop: 14, padding: "12px 16px",
          background: matrix[sel.row][sel.col] > 0 && sel.row !== sel.col
            ? "#fef2f2" : "#f0fdf4",
          border: `1px solid ${matrix[sel.row][sel.col] > 0 && sel.row !== sel.col ? "#fca5a5" : "#bbf7d0"}`,
          borderRadius: "var(--radius-md)",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6, flexWrap: "wrap" }}>
            <span style={{
              fontWeight: 800, fontSize: "1.2rem",
              color: sel.row === sel.col ? "#2563eb" : "#dc2626",
            }}>
              {selCount}
            </span>
            <span style={{ fontSize: "0.82rem", fontWeight: 600, color: "var(--color-text-primary)" }}>
              {sel.row === sel.col ? "✓ Correct" : "✗ Misclassified"}
            </span>
            <span style={{ fontSize: "0.75rem", color: "var(--color-text-light)" }}>
              True: <strong>{labels[sel.row]}</strong> → Predicted: <strong>{labels[sel.col]}</strong>
            </span>
          </div>
          <p style={{ margin: 0, fontSize: "0.78rem", color: "var(--color-text-secondary)", lineHeight: 1.55 }}>
            {getInterpretation(sel.row, sel.col, selCount)}
          </p>
        </div>
      )}

      {/* ── Per-class accuracy ── */}
      {data.per_class_accuracy && (
        <div style={{ marginTop: 16 }}>
          <p style={{ margin: "0 0 8px", fontSize: "0.75rem", fontWeight: 700, color: "var(--color-text-light)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
            Per-class accuracy
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {labels.map(cls => {
              const acc   = data.per_class_accuracy[cls] ?? 0;
              const key   = toKey(cls);
              const color = CLASS_COLOR[key] || "#6b7280";
              return (
                <div key={cls} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontSize: "0.75rem", fontWeight: 600, color, minWidth: 100 }}>
                    {cls.replace(" Tumor", "")}
                  </span>
                  <div style={{ flex: 1, height: 7, background: "var(--color-bg-tertiary)", borderRadius: 99, overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${acc * 100}%`, background: color, borderRadius: 99, transition: "width 0.6s ease" }} />
                  </div>
                  <span style={{ fontSize: "0.75rem", fontWeight: 700, color, minWidth: 42, textAlign: "right" }}>
                    {(acc * 100).toFixed(1)}%
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default InteractiveConfusionMatrix;