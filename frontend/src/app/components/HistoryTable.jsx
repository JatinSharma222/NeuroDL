"use client";
import React, { useState, useEffect, useCallback } from "react";
import ScanCompare from "./ScanCompare";

/**
 * HistoryTable.jsx
 * ────────────────
 * Paginated, filterable scan history table for NeuroDL v2.0.
 *
 * Features:
 *   - Fetches from GET /history with page, per_page, class_name, date_from, date_to
 *   - Colour-coded class badges per tumour type
 *   - Expandable rows showing the full LLM report
 *   - Delete scan with confirmation
 *   - Pagination controls
 *   - Empty state + loading skeleton
 */

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5001";

// ── Helpers ───────────────────────────────────────────────────────

const CLASS_BADGE_MAP = {
  "Glioma Tumor":     "class-badge class-badge-glioma",
  "Meningioma Tumor": "class-badge class-badge-meningioma",
  "Pituitary Tumor":  "class-badge class-badge-pituitary",
  "No Tumor":         "class-badge class-badge-no-tumor",
};

const getBadgeClass = (className) =>
  CLASS_BADGE_MAP[className] || "class-badge class-badge-no-tumor";

const formatDate = (isoString) => {
  if (!isoString) return "—";
  return new Date(isoString).toLocaleString("en-IN", {
    day:    "2-digit",
    month:  "short",
    year:   "numeric",
    hour:   "2-digit",
    minute: "2-digit",
  });
};

const formatConfidence = (score) =>
  score != null ? `${(score * 100).toFixed(1)}%` : "—";

// ── Skeleton row ──────────────────────────────────────────────────
const SkeletonRow = () => (
  <tr>
    {[1, 2, 3, 4, 5, 6].map((i) => (
      <td key={i}>
        <div
          className="loading"
          style={{
            height: 14,
            borderRadius: 6,
            background: "var(--color-bg-tertiary)",
            width: i === 1 ? "40%" : i === 3 ? "70%" : "55%",
          }}
        />
      </td>
    ))}
  </tr>
);


// ── Main Component ────────────────────────────────────────────────

const HistoryTable = () => {
  // ── State ──────────────────────────────────────────────────────
  const [scans,       setScans]       = useState([]);
  const [total,       setTotal]       = useState(0);
  const [page,        setPage]        = useState(1);
  const [perPage]                     = useState(10);
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState(null);
  const [expandedId,  setExpandedId]  = useState(null);   // expanded report row
  const [deleteId,    setDeleteId]    = useState(null);   // confirm-delete target
  const [deleting,    setDeleting]    = useState(false);
  const [compareIds,  setCompareIds]  = useState([]);    // up to 2 scan IDs for comparison
  const [showCompare, setShowCompare] = useState(false);

  // Filters
  const [filterClass, setFilterClass] = useState("");
  const [filterFrom,  setFilterFrom]  = useState("");
  const [filterTo,    setFilterTo]    = useState("");

  const totalPages = Math.ceil(total / perPage);

  // ── Fetch ───────────────────────────────────────────────────────
  const fetchScans = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        page,
        per_page: perPage,
        ...(filterClass && { class_name: filterClass }),
        ...(filterFrom  && { date_from:  filterFrom  }),
        ...(filterTo    && { date_to:    filterTo    }),
      });

      const res = await fetch(`${API_URL}/history?${params}`);
      if (!res.ok) throw new Error(`Server error: ${res.status}`);

      const data = await res.json();
      setScans(data.scans || []);
      setTotal(data.total || 0);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [page, perPage, filterClass, filterFrom, filterTo]);

  useEffect(() => { fetchScans(); }, [fetchScans]);

  // Reset to page 1 when filters change
  useEffect(() => { setPage(1); }, [filterClass, filterFrom, filterTo]);

  // ── Delete ──────────────────────────────────────────────────────
  const confirmDelete = async () => {
    if (!deleteId) return;
    setDeleting(true);
    try {
      const res = await fetch(`${API_URL}/history/${deleteId}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Delete failed");
      setDeleteId(null);
      fetchScans();
    } catch (err) {
      alert(`Could not delete scan: ${err.message}`);
    } finally {
      setDeleting(false);
    }
  };

  // ── Render ──────────────────────────────────────────────────────
  return (
    <div>
      <div className="history-container">

        {/* ── Toolbar ── */}
        <div className="history-toolbar">
          <div>
            <p style={{ margin: 0, fontWeight: 700, fontSize: "0.95rem" }}>
              {loading ? "Loading..." : `${total} scan${total !== 1 ? "s" : ""} recorded`}
            </p>
          </div>

          <div className="history-filters">
            {/* Class filter */}
            <select
              className="history-filter-select"
              value={filterClass}
              onChange={(e) => setFilterClass(e.target.value)}
            >
              <option value="">All Classes</option>
              <option value="Glioma">Glioma Tumor</option>
              <option value="Meningioma">Meningioma Tumor</option>
              <option value="Pituitary">Pituitary Tumor</option>
              <option value="No Tumor">No Tumor</option>
            </select>

            {/* Date from */}
            <input
              type="date"
              className="history-filter-input"
              value={filterFrom}
              onChange={(e) => setFilterFrom(e.target.value)}
              title="From date"
            />

            {/* Date to */}
            <input
              type="date"
              className="history-filter-input"
              value={filterTo}
              onChange={(e) => setFilterTo(e.target.value)}
              title="To date"
            />

            {/* Clear filters */}
            {(filterClass || filterFrom || filterTo) && (
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => {
                  setFilterClass("");
                  setFilterFrom("");
                  setFilterTo("");
                }}
              >
                Clear
              </button>
            )}

            {/* Refresh */}
            <button
              className="btn btn-ghost btn-sm"
              onClick={fetchScans}
              title="Refresh"
            >
              <svg
                className={loading ? "spinning" : ""}
                width="16"
                height="16"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
            </button>
          </div>
        </div>

        {/* ── Error banner ── */}
        {error && (
          <div className="alert alert-error" style={{ margin: "var(--spacing-md)", borderRadius: "var(--radius-sm)" }}>
            <svg width="18" height="18" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
            <span style={{ fontSize: "0.875rem" }}>
              Could not load history: {error}. Is the Flask server running?
            </span>
          </div>
        )}

        {/* ── Table ── */}
        <div className="history-table-wrap">
          <table className="history-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Date & Time</th>
                <th>Diagnosis</th>
                <th>Confidence</th>
                <th>Patient ID</th>
                <th>Extras</th>
                <th>Actions</th>
              </tr>
            </thead>

            <tbody>
              {/* Loading skeletons */}
              {loading && Array.from({ length: 5 }).map((_, i) => (
                <SkeletonRow key={i} />
              ))}

              {/* Empty state */}
              {!loading && !error && scans.length === 0 && (
                <tr>
                  <td colSpan={7}>
                    <div className="history-empty">
                      <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                          d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                      </svg>
                      <p style={{ margin: 0, fontWeight: 600 }}>No scans found</p>
                      <p style={{ margin: "4px 0 0", fontSize: "0.875rem" }}>
                        {filterClass || filterFrom || filterTo
                          ? "Try clearing the filters."
                          : "Upload an MRI scan to get started."}
                      </p>
                    </div>
                  </td>
                </tr>
              )}

              {/* Data rows */}
              {!loading && scans.map((scan) => (
                <React.Fragment key={scan.id}>
                  {/* Main row */}
                  <tr
                    onClick={() =>
                      setExpandedId(expandedId === scan.id ? null : scan.id)
                    }
                    style={{ cursor: "pointer" }}
                  >
                    {/* ID */}
                    <td style={{ fontWeight: 600, color: "var(--color-text-primary)", fontSize: "0.85rem" }}>
                      #{scan.id}
                    </td>

                    {/* Timestamp */}
                    <td style={{ fontSize: "0.85rem", whiteSpace: "nowrap" }}>
                      {formatDate(scan.scan_timestamp)}
                    </td>

                    {/* Diagnosis badge */}
                    <td>
                      <span className={getBadgeClass(scan.predicted_class)}>
                        <span className="class-badge-dot" />
                        {scan.predicted_class}
                      </span>
                    </td>

                    {/* Confidence */}
                    <td style={{ fontWeight: 600 }}>
                      {formatConfidence(scan.confidence_score)}
                    </td>

                    {/* Patient ID */}
                    <td style={{ fontSize: "0.85rem", color: "var(--color-text-light)" }}>
                      {scan.patient_id || "—"}
                    </td>

                    {/* Extras chips */}
                    <td>
                      <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                        {scan.segmentation_performed && (
                          <span className="badge badge-info" style={{ fontSize: "0.7rem", padding: "3px 8px" }}>
                            Seg
                          </span>
                        )}
                        {scan.gradcam_performed && (
                          <span className="badge badge-success" style={{ fontSize: "0.7rem", padding: "3px 8px" }}>
                            CAM
                          </span>
                        )}
                        {scan.report_text && (
                          <span className="badge badge-primary" style={{ fontSize: "0.7rem", padding: "3px 8px" }}>
                            Report
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Actions */}
                    <td onClick={(e) => e.stopPropagation()}>
                      <div style={{ display: "flex", gap: 6 }}>
                        {/* Expand report */}
                        {scan.report_text && (
                          <button
                            className="btn btn-ghost btn-sm"
                            title="View report"
                            onClick={() =>
                              setExpandedId(expandedId === scan.id ? null : scan.id)
                            }
                          >
                            <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                          </button>
                        )}

                        {/* Compare toggle */}
                        <button
                          className="btn btn-ghost btn-sm"
                          title={compareIds.includes(scan.id) ? "Remove from comparison" : "Add to comparison"}
                          onClick={() => {
                            setCompareIds(prev => {
                              if (prev.includes(scan.id)) return prev.filter(id => id !== scan.id);
                              if (prev.length >= 2)        return [prev[1], scan.id];
                              return [...prev, scan.id];
                            });
                          }}
                          style={{
                            background:  compareIds.includes(scan.id) ? "#eff6ff" : undefined,
                            color:       compareIds.includes(scan.id) ? "#2563eb" : undefined,
                            borderColor: compareIds.includes(scan.id) ? "#2563eb" : undefined,
                          }}
                        >
                          <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                              d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                          </svg>
                        </button>

                        {/* Delete */}
                        <button
                          className="btn btn-danger btn-sm"
                          title="Delete scan"
                          onClick={() => setDeleteId(scan.id)}
                        >
                          <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </td>
                  </tr>

                  {/* Expanded report row */}
                  {expandedId === scan.id && scan.report_text && (
                    <tr className="history-row-expanded">
                      <td colSpan={7} style={{ padding: "var(--spacing-md) var(--spacing-lg)" }}>
                        <p style={{ fontWeight: 700, fontSize: "0.8rem", marginBottom: 8, color: "var(--color-text-primary)" }}>
                          AI Radiology Report — Scan #{scan.id}
                        </p>
                        <div className="history-report-preview">
                          {scan.report_text}
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>

        {/* ── Pagination ── */}
        {!loading && totalPages > 1 && (
          <div className="pagination">
            <span className="pagination-info">
              Showing {(page - 1) * perPage + 1}–{Math.min(page * perPage, total)} of {total}
            </span>

            <div className="pagination-controls">
              {/* Prev */}
              <button
                className="pagination-btn"
                disabled={page === 1}
                onClick={() => setPage((p) => p - 1)}
              >
                ‹
              </button>

              {/* Page numbers */}
              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter((p) => p === 1 || p === totalPages || Math.abs(p - page) <= 1)
                .reduce((acc, p, idx, arr) => {
                  if (idx > 0 && p - arr[idx - 1] > 1) {
                    acc.push("...");
                  }
                  acc.push(p);
                  return acc;
                }, [])
                .map((item, idx) =>
                  item === "..." ? (
                    <span key={`ellipsis-${idx}`} style={{ padding: "0 4px", color: "var(--color-text-light)" }}>
                      …
                    </span>
                  ) : (
                    <button
                      key={item}
                      className={`pagination-btn ${page === item ? "active" : ""}`}
                      onClick={() => setPage(item)}
                    >
                      {item}
                    </button>
                  )
                )}

              {/* Next */}
              <button
                className="pagination-btn"
                disabled={page === totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                ›
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Compare floating bar ── */}
      {compareIds.length > 0 && (
        <div style={{
          position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)",
          zIndex: 1000, background: "#1e3a8a", color: "white",
          borderRadius: "var(--radius-full)", padding: "12px 20px",
          display: "flex", alignItems: "center", gap: 14,
          boxShadow: "0 8px 32px rgba(0,0,0,0.25)",
          fontSize: "0.875rem", fontWeight: 600,
          whiteSpace: "nowrap",
        }}>
          <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
          {compareIds.length === 1
            ? "Select one more scan to compare"
            : `Comparing Scan #${compareIds[0]} vs #${compareIds[1]}`}
          {compareIds.length === 2 && (
            <button
              onClick={() => setShowCompare(true)}
              style={{ background: "white", color: "#1e3a8a", border: "none", borderRadius: "var(--radius-sm)", padding: "5px 14px", fontWeight: 700, cursor: "pointer", fontSize: "0.82rem" }}
            >
              Compare →
            </button>
          )}
          <button
            onClick={() => { setCompareIds([]); setShowCompare(false); }}
            style={{ background: "none", border: "none", color: "rgba(255,255,255,0.7)", cursor: "pointer", padding: 2, marginLeft: 4 }}
          >
            <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {/* ── ScanCompare modal ── */}
      {showCompare && compareIds.length === 2 && (
        <ScanCompare
          scanIds={compareIds}
          onClose={() => setShowCompare(false)}
        />
      )}

      {/* ── Delete confirmation modal ── */}
      {deleteId && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            padding: "var(--spacing-lg)",
          }}
          onClick={() => !deleting && setDeleteId(null)}
        >
          <div
            className="card"
            style={{ maxWidth: 420, width: "100%" }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ fontSize: "1.25rem", marginBottom: "var(--spacing-sm)" }}>
              Delete Scan #{deleteId}?
            </h3>
            <p style={{ color: "var(--color-text-secondary)", marginBottom: "var(--spacing-lg)" }}>
              This will permanently remove the scan record and its report from the database. This cannot be undone.
            </p>
            <div style={{ display: "flex", gap: "var(--spacing-sm)", justifyContent: "flex-end" }}>
              <button
                className="btn btn-ghost"
                onClick={() => setDeleteId(null)}
                disabled={deleting}
              >
                Cancel
              </button>
              <button
                className="btn btn-danger"
                onClick={confirmDelete}
                disabled={deleting}
              >
                {deleting ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default HistoryTable;