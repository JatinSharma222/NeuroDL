"use client";
import React, { useState, useEffect, useCallback, useRef } from "react";
import ScanCompare from "./ScanCompare";
import { useAuth } from "../context/AuthContext";

/**
 * HistoryTable.jsx  —  NeuroDL v2.0
 * ────────────────────────────────────
 * Improvements over v1:
 *   • Class filter chips  (replaces dropdown)
 *   • Live debounced search by patient ID or scan ID
 *   • Active-filter tag row  — see & remove each filter individually
 *   • Confidence range filter  (min % slider)
 *   • CSV export  — downloads all current-filter results as a .csv
 *   • Collapsible advanced filter panel  (dates + confidence)
 *
 * All existing features kept:
 *   expandable report rows, delete modal, compare float bar, pagination
 */

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5001";

// ── Config ────────────────────────────────────────────────────────
const CLASS_CHIPS = [
  { label: "Glioma",      value: "Glioma",      color: "#dc2626", bg: "#fef2f2", border: "#fca5a5" },
  { label: "Meningioma",  value: "Meningioma",  color: "#d97706", bg: "#fffbeb", border: "#fcd34d" },
  { label: "Pituitary",   value: "Pituitary",   color: "#2563eb", bg: "#eff6ff", border: "#93c5fd" },
  { label: "No Tumor",    value: "No Tumor",    color: "#16a34a", bg: "#f0fdf4", border: "#86efac" },
];

const CLASS_BADGE_MAP = {
  "Glioma Tumor":     { dot: "#dc2626", bg: "#fef2f2", text: "#991b1b" },
  "Meningioma Tumor": { dot: "#d97706", bg: "#fffbeb", text: "#92400e" },
  "Pituitary Tumor":  { dot: "#2563eb", bg: "#eff6ff", text: "#1e3a8a" },
  "No Tumor":         { dot: "#16a34a", bg: "#f0fdf4", text: "#14532d" },
};

const formatDate = (iso) => {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-IN", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
};

const fmt = (score) => score != null ? `${(score * 100).toFixed(1)}%` : "—";

// ── Skeleton ──────────────────────────────────────────────────────
const SkeletonRow = () => (
  <tr>
    {[40, 55, 70, 40, 35, 60, 50].map((w, i) => (
      <td key={i}>
        <div style={{ height: 13, borderRadius: 6, background: "var(--color-bg-tertiary, #f3f4f6)", width: `${w}%`, animation: "pulse 1.5s ease-in-out infinite" }} />
      </td>
    ))}
  </tr>
);

// ── CSV helper ─────────────────────────────────────────────────────
function toCSV(scans) {
  const cols = ["id", "scan_timestamp", "predicted_class", "confidence_score", "patient_id",
                "segmentation_performed", "gradcam_performed", "file_name"];
  const header = cols.join(",");
  const rows = scans.map(s =>
    cols.map(c => {
      const v = s[c] ?? "";
      return typeof v === "string" && v.includes(",") ? `"${v}"` : v;
    }).join(",")
  );
  return [header, ...rows].join("\n");
}

function downloadCSV(content, filename) {
  const blob = new Blob([content], { type: "text/csv" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

// ── Main ──────────────────────────────────────────────────────────
const HistoryTable = () => {
  const { authFetch } = useAuth();

  // ── Data state ─────────────────────────────────────────────────
  const [scans,       setScans]       = useState([]);
  const [total,       setTotal]       = useState(0);
  const [page,        setPage]        = useState(1);
  const perPage                        = 10;
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState(null);
  const [expandedId,  setExpandedId]  = useState(null);
  const [deleteId,    setDeleteId]    = useState(null);
  const [deleting,    setDeleting]    = useState(false);
  const [compareIds,  setCompareIds]  = useState([]);
  const [showCompare, setShowCompare] = useState(false);
  const [exporting,   setExporting]   = useState(false);

  // ── Filter state ────────────────────────────────────────────────
  const [filterClass,    setFilterClass]    = useState("");
  const [filterFrom,     setFilterFrom]     = useState("");
  const [filterTo,       setFilterTo]       = useState("");
  const [searchInput,    setSearchInput]    = useState("");  // raw input
  const [searchQuery,    setSearchQuery]    = useState("");  // debounced
  const [minConfidence,  setMinConfidence]  = useState(0);  // 0–100
  const [showAdvanced,   setShowAdvanced]   = useState(false);

  const totalPages   = Math.ceil(total / perPage);
  const hasFilters   = !!(filterClass || filterFrom || filterTo || searchQuery || minConfidence > 0);

  // Debounce search
  const debounceRef = useRef(null);
  useEffect(() => {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setSearchQuery(searchInput), 380);
    return () => clearTimeout(debounceRef.current);
  }, [searchInput]);

  // Reset to page 1 on filter change
  useEffect(() => { setPage(1); }, [filterClass, filterFrom, filterTo, searchQuery, minConfidence]);

  // ── Fetch ───────────────────────────────────────────────────────
  const fetchScans = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const params = new URLSearchParams({
        page,
        per_page: perPage,
        ...(filterClass   && { class_name: filterClass }),
        ...(filterFrom    && { date_from:  filterFrom  }),
        ...(filterTo      && { date_to:    filterTo    }),
        ...(searchQuery   && { search:     searchQuery }),
        ...(minConfidence && { min_confidence: (minConfidence / 100).toFixed(2) }),
      });
      const res  = await authFetch(`${API_URL}/history?${params}`);
      if (!res.ok) throw new Error(`Server error ${res.status}`);
      const data = await res.json();
      setScans(data.scans || []);
      setTotal(data.total || 0);
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  }, [page, perPage, filterClass, filterFrom, filterTo, searchQuery, minConfidence]);

  useEffect(() => { fetchScans(); }, [fetchScans]);

  // ── Export CSV ──────────────────────────────────────────────────
  const handleExport = async () => {
    setExporting(true);
    try {
      // Fetch ALL matching scans (large per_page)
      const params = new URLSearchParams({
        page: 1, per_page: 1000,
        ...(filterClass && { class_name: filterClass }),
        ...(filterFrom  && { date_from:  filterFrom  }),
        ...(filterTo    && { date_to:    filterTo    }),
        ...(searchQuery && { search:     searchQuery }),
      });
      const res  = await authFetch(`${API_URL}/history?${params}`);
      const data = await res.json();
      downloadCSV(toCSV(data.scans || []), `neurodl_scans_${new Date().toISOString().slice(0,10)}.csv`);
    } catch (e) { alert("Export failed: " + e.message); }
    finally { setExporting(false); }
  };

  // ── Delete ──────────────────────────────────────────────────────
  const confirmDelete = async () => {
    setDeleting(true);
    try {
      const res = await authFetch(`${API_URL}/history/${deleteId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Delete failed");
      setDeleteId(null);
      fetchScans();
    } catch (err) { alert(`Could not delete: ${err.message}`); }
    finally { setDeleting(false); }
  };

  const clearAll = () => {
    setFilterClass(""); setFilterFrom(""); setFilterTo("");
    setSearchInput(""); setSearchQuery(""); setMinConfidence(0);
  };

  // ── Styles ──────────────────────────────────────────────────────
  const chipBase = (chip, active) => ({
    display:       "inline-flex",
    alignItems:    "center",
    gap:           5,
    padding:       "4px 12px",
    borderRadius:  99,
    fontSize:      "0.78rem",
    fontWeight:    700,
    cursor:        "pointer",
    border:        `1.5px solid ${active ? chip.border : "var(--color-border-light, #e5e7eb)"}`,
    background:    active ? chip.bg : "white",
    color:         active ? chip.color : "var(--color-text-secondary)",
    transition:    "all 0.12s",
    userSelect:    "none",
    whiteSpace:    "nowrap",
  });

  const inputStyle = {
    padding:      "7px 11px",
    border:       "1.5px solid var(--color-border, #d1d5db)",
    borderRadius: "var(--radius-sm, 8px)",
    fontSize:     "0.82rem",
    outline:      "none",
    color:        "var(--color-text-primary)",
    background:   "white",
    transition:   "border-color 0.15s",
  };

  // ── Active filter tags ──────────────────────────────────────────
  const activeTags = [
    filterClass    && { label: `Class: ${filterClass}`,      onRemove: () => setFilterClass("")    },
    filterFrom     && { label: `From: ${filterFrom}`,        onRemove: () => setFilterFrom("")     },
    filterTo       && { label: `To: ${filterTo}`,            onRemove: () => setFilterTo("")       },
    searchQuery    && { label: `Search: "${searchQuery}"`,   onRemove: () => { setSearchInput(""); setSearchQuery(""); } },
    minConfidence > 0 && { label: `Min confidence: ${minConfidence}%`, onRemove: () => setMinConfidence(0) },
  ].filter(Boolean);

  // ── Render ──────────────────────────────────────────────────────
  return (
    <div>
      <div className="history-container">

        {/* ════════ FILTER BAR ════════ */}
        <div style={{ padding: "var(--spacing-md, 14px) var(--spacing-lg, 20px)", borderBottom: "1px solid var(--color-border-light, #e5e7eb)" }}>

          {/* Row 1: search + actions */}
          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginBottom: 12 }}>
            {/* Search */}
            <div style={{ position: "relative", flex: 1, minWidth: 180 }}>
              <svg style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", width: 14, height: 14, color: "var(--color-text-light)" }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                placeholder="Search by patient ID or scan ID…"
                value={searchInput}
                onChange={e => setSearchInput(e.target.value)}
                style={{ ...inputStyle, width: "100%", paddingLeft: 30, boxSizing: "border-box" }}
                onFocus={e => (e.target.style.borderColor = "var(--color-primary, #e60023)")}
                onBlur={e  => (e.target.style.borderColor = "var(--color-border, #d1d5db)")}
              />
              {searchInput && (
                <button onClick={() => setSearchInput("")} style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "var(--color-text-light)", padding: 0 }}>
                  <svg width="13" height="13" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>

            {/* Advanced toggle */}
            <button
              onClick={() => setShowAdvanced(p => !p)}
              style={{
                ...inputStyle,
                display: "flex", alignItems: "center", gap: 5,
                cursor: "pointer", whiteSpace: "nowrap",
                background: showAdvanced ? "var(--color-bg-tertiary, #f3f4f6)" : "white",
                fontWeight: showAdvanced ? 700 : 500,
              }}
            >
              <svg width="13" height="13" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2a1 1 0 01-.293.707L13 13.414V19a1 1 0 01-.553.894l-4 2A1 1 0 017 21v-7.586L3.293 6.707A1 1 0 013 6V4z" />
              </svg>
              Filters {hasFilters && <span style={{ background: "var(--color-primary, #e60023)", color: "white", borderRadius: 99, padding: "0 5px", fontSize: "0.65rem", fontWeight: 800 }}>{activeTags.length}</span>}
            </button>

            {/* Export CSV */}
            <button
              onClick={handleExport}
              disabled={exporting}
              style={{ ...inputStyle, display: "flex", alignItems: "center", gap: 5, cursor: "pointer", whiteSpace: "nowrap", fontWeight: 600, color: "#16a34a", borderColor: "#86efac" }}
            >
              {exporting
                ? <svg className="spinning" width="13" height="13" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                : <svg width="13" height="13" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3M3 17V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" /></svg>
              }
              {exporting ? "Exporting…" : "Export CSV"}
            </button>

            {/* Refresh */}
            <button className="btn btn-ghost btn-sm" onClick={fetchScans} title="Refresh" style={{ flexShrink: 0 }}>
              <svg className={loading ? "spinning" : ""} width="15" height="15" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
          </div>

          {/* Row 2: class chips (always visible) */}
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
            <span style={{ fontSize: "0.72rem", fontWeight: 700, color: "var(--color-text-light)", textTransform: "uppercase", letterSpacing: "0.05em", marginRight: 2 }}>
              Class:
            </span>
            {CLASS_CHIPS.map(chip => {
              const active = filterClass === chip.value;
              return (
                <button
                  key={chip.value}
                  onClick={() => setFilterClass(active ? "" : chip.value)}
                  style={chipBase(chip, active)}
                >
                  <span style={{ width: 7, height: 7, borderRadius: "50%", background: chip.color, flexShrink: 0 }} />
                  {chip.label}
                  {active && (
                    <svg width="10" height="10" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ marginLeft: 1 }}>
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  )}
                </button>
              );
            })}
          </div>

          {/* Row 3: advanced panel (dates + confidence slider) */}
          {showAdvanced && (
            <div style={{
              marginTop: 12, padding: "12px 14px",
              background: "var(--color-bg-tertiary, #f9fafb)",
              borderRadius: "var(--radius-md, 10px)",
              border: "1px solid var(--color-border-light, #e5e7eb)",
              display: "flex", gap: 20, flexWrap: "wrap", alignItems: "flex-end",
            }}>
              {/* Date range */}
              <div>
                <label style={{ display: "block", fontSize: "0.72rem", fontWeight: 700, color: "var(--color-text-light)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 5 }}>
                  Date range
                </label>
                <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                  <input type="date" value={filterFrom} onChange={e => setFilterFrom(e.target.value)}
                    style={inputStyle}
                    onFocus={e => (e.target.style.borderColor = "var(--color-primary)")}
                    onBlur={e  => (e.target.style.borderColor = "var(--color-border, #d1d5db)")} />
                  <span style={{ color: "var(--color-text-light)", fontSize: "0.8rem" }}>→</span>
                  <input type="date" value={filterTo} onChange={e => setFilterTo(e.target.value)}
                    style={inputStyle}
                    onFocus={e => (e.target.style.borderColor = "var(--color-primary)")}
                    onBlur={e  => (e.target.style.borderColor = "var(--color-border, #d1d5db)")} />
                </div>
              </div>

              {/* Confidence slider */}
              <div style={{ flex: 1, minWidth: 180 }}>
                <label style={{ display: "flex", justifyContent: "space-between", fontSize: "0.72rem", fontWeight: 700, color: "var(--color-text-light)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 5 }}>
                  <span>Min confidence</span>
                  <span style={{ color: minConfidence > 0 ? "var(--color-primary)" : "var(--color-text-light)", fontVariantNumeric: "tabular-nums" }}>
                    {minConfidence}%
                  </span>
                </label>
                <input
                  type="range" min="0" max="99" step="5" value={minConfidence}
                  onChange={e => setMinConfidence(Number(e.target.value))}
                  style={{ width: "100%", accentColor: "var(--color-primary, #e60023)" }}
                />
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.65rem", color: "var(--color-text-light)", marginTop: 2 }}>
                  <span>0% (all)</span><span>50%</span><span>99%</span>
                </div>
              </div>

              {/* Clear advanced */}
              {(filterFrom || filterTo || minConfidence > 0) && (
                <button
                  onClick={() => { setFilterFrom(""); setFilterTo(""); setMinConfidence(0); }}
                  className="btn btn-ghost btn-sm"
                  style={{ marginBottom: 2 }}
                >
                  Clear dates & confidence
                </button>
              )}
            </div>
          )}

          {/* Row 4: active filter tags */}
          {activeTags.length > 0 && (
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center", marginTop: 10 }}>
              <span style={{ fontSize: "0.7rem", color: "var(--color-text-light)" }}>Active:</span>
              {activeTags.map((tag, i) => (
                <span key={i} style={{
                  display: "inline-flex", alignItems: "center", gap: 5,
                  fontSize: "0.72rem", fontWeight: 600,
                  padding: "2px 8px", borderRadius: 99,
                  background: "var(--color-bg-tertiary, #f3f4f6)",
                  color: "var(--color-text-secondary)",
                  border: "1px solid var(--color-border-light, #e5e7eb)",
                }}>
                  {tag.label}
                  <button onClick={tag.onRemove} style={{ background: "none", border: "none", cursor: "pointer", padding: 0, color: "var(--color-text-light)", display: "flex" }}>
                    <svg width="10" height="10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </span>
              ))}
              <button onClick={clearAll} style={{ fontSize: "0.72rem", fontWeight: 700, color: "var(--color-primary)", background: "none", border: "none", cursor: "pointer", padding: "2px 4px" }}>
                Clear all
              </button>
            </div>
          )}
        </div>

        {/* ── Result count bar ── */}
        <div style={{ padding: "8px var(--spacing-lg, 20px)", background: "var(--color-bg-tertiary, #f9fafb)", borderBottom: "1px solid var(--color-border-light, #e5e7eb)", fontSize: "0.8rem", color: "var(--color-text-secondary)", display: "flex", justifyContent: "space-between" }}>
          <span>
            {loading ? "Loading…" : `${total} scan${total !== 1 ? "s" : ""} ${hasFilters ? "matching filters" : "total"}`}
          </span>
          {!loading && total > 0 && (
            <span style={{ color: "var(--color-text-light)" }}>
              Page {page} of {totalPages || 1}
            </span>
          )}
        </div>

        {/* ── Error ── */}
        {error && (
          <div className="alert alert-error" style={{ margin: "var(--spacing-md)", borderRadius: "var(--radius-sm)" }}>
            <svg width="18" height="18" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
            <span style={{ fontSize: "0.875rem" }}>Could not load history: {error}</span>
          </div>
        )}

        {/* ── Table ── */}
        <div className="history-table-wrap">
          <table className="history-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Date &amp; Time</th>
                <th>Diagnosis</th>
                <th>Confidence</th>
                <th>Patient ID</th>
                <th>Extras</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading && Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} />)}

              {!loading && !error && scans.length === 0 && (
                <tr>
                  <td colSpan={7}>
                    <div className="history-empty">
                      <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                      </svg>
                      <p style={{ margin: 0, fontWeight: 600 }}>No scans found</p>
                      <p style={{ margin: "4px 0 0", fontSize: "0.875rem", color: "var(--color-text-light)" }}>
                        {hasFilters ? (
                          <>No results match your filters. <button onClick={clearAll} style={{ color: "var(--color-primary)", background: "none", border: "none", cursor: "pointer", fontWeight: 700, padding: 0 }}>Clear all filters</button></>
                        ) : "Upload an MRI scan to get started."}
                      </p>
                    </div>
                  </td>
                </tr>
              )}

              {!loading && scans.map(scan => {
                const badgeCfg = CLASS_BADGE_MAP[scan.predicted_class] || CLASS_BADGE_MAP["No Tumor"];
                const isExpanded = expandedId === scan.id;
                const inCompare  = compareIds.includes(scan.id);

                return (
                  <React.Fragment key={scan.id}>
                    <tr onClick={() => setExpandedId(isExpanded ? null : scan.id)} style={{ cursor: "pointer" }}>

                      <td style={{ fontWeight: 600, color: "var(--color-text-primary)", fontSize: "0.85rem" }}>
                        #{scan.id}
                      </td>

                      <td style={{ fontSize: "0.82rem", whiteSpace: "nowrap" }}>
                        {formatDate(scan.scan_timestamp)}
                      </td>

                      <td>
                        <span style={{
                          display: "inline-flex", alignItems: "center", gap: 5,
                          padding: "3px 9px", borderRadius: 99, fontSize: "0.78rem", fontWeight: 700,
                          background: badgeCfg.bg, color: badgeCfg.text,
                        }}>
                          <span style={{ width: 7, height: 7, borderRadius: "50%", background: badgeCfg.dot, flexShrink: 0 }} />
                          {scan.predicted_class}
                        </span>
                      </td>

                      {/* Confidence with colour coding */}
                      <td>
                        <span style={{
                          fontWeight: 700, fontSize: "0.85rem",
                          color: scan.confidence_score >= 0.9 ? "#16a34a"
                               : scan.confidence_score >= 0.7 ? "#d97706"
                               : "#dc2626",
                        }}>
                          {fmt(scan.confidence_score)}
                        </span>
                      </td>

                      <td style={{ fontSize: "0.82rem", color: "var(--color-text-light)" }}>
                        {scan.patient_id ? `#${scan.patient_id}` : "—"}
                      </td>

                      <td>
                        <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                          {scan.segmentation_performed && (
                            <span className="badge badge-info" style={{ fontSize: "0.68rem", padding: "2px 7px" }}>Seg</span>
                          )}
                          {scan.gradcam_performed && (
                            <span className="badge badge-success" style={{ fontSize: "0.68rem", padding: "2px 7px" }}>CAM</span>
                          )}
                          {scan.report_text && (
                            <span className="badge badge-primary" style={{ fontSize: "0.68rem", padding: "2px 7px" }}>Report</span>
                          )}
                        </div>
                      </td>

                      <td onClick={e => e.stopPropagation()}>
                        <div style={{ display: "flex", gap: 5 }}>
                          {scan.report_text && (
                            <button className="btn btn-ghost btn-sm" title="View report"
                              onClick={() => setExpandedId(isExpanded ? null : scan.id)}>
                              <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                              </svg>
                            </button>
                          )}
                          <button className="btn btn-ghost btn-sm" title={inCompare ? "Remove from compare" : "Add to compare"}
                            onClick={() => {
                              setCompareIds(prev =>
                                prev.includes(scan.id) ? prev.filter(id => id !== scan.id)
                                : prev.length >= 2 ? [prev[1], scan.id]
                                : [...prev, scan.id]
                              );
                            }}
                            style={{ background: inCompare ? "#eff6ff" : undefined, color: inCompare ? "#2563eb" : undefined, borderColor: inCompare ? "#93c5fd" : undefined }}>
                            <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                            </svg>
                          </button>
                          <button className="btn btn-danger btn-sm" title="Delete" onClick={() => setDeleteId(scan.id)}>
                            <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      </td>
                    </tr>

                    {/* Expanded report */}
                    {isExpanded && scan.report_text && (
                      <tr className="history-row-expanded">
                        <td colSpan={7} style={{ padding: "var(--spacing-md) var(--spacing-lg)" }}>
                          <p style={{ fontWeight: 700, fontSize: "0.8rem", marginBottom: 8, color: "var(--color-text-primary)" }}>
                            AI Radiology Report — Scan #{scan.id}
                          </p>
                          <div className="history-report-preview">{scan.report_text}</div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
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
              <button className="pagination-btn" disabled={page === 1} onClick={() => setPage(p => p - 1)}>‹</button>
              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter(p => p === 1 || p === totalPages || Math.abs(p - page) <= 1)
                .reduce((acc, p, idx, arr) => {
                  if (idx > 0 && p - arr[idx - 1] > 1) acc.push("...");
                  acc.push(p); return acc;
                }, [])
                .map((item, idx) =>
                  item === "..." ? (
                    <span key={`e${idx}`} style={{ padding: "0 4px", color: "var(--color-text-light)" }}>…</span>
                  ) : (
                    <button key={item} className={`pagination-btn ${page === item ? "active" : ""}`} onClick={() => setPage(item)}>
                      {item}
                    </button>
                  )
                )}
              <button className="pagination-btn" disabled={page === totalPages} onClick={() => setPage(p => p + 1)}>›</button>
            </div>
          </div>
        )}
      </div>

      {/* ── Compare float bar ── */}
      {compareIds.length > 0 && (
        <div style={{
          position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)",
          zIndex: 1000, background: "#1e3a8a", color: "white",
          borderRadius: "var(--radius-full)", padding: "12px 20px",
          display: "flex", alignItems: "center", gap: 14,
          boxShadow: "0 8px 32px rgba(0,0,0,0.25)", fontSize: "0.875rem", fontWeight: 600, whiteSpace: "nowrap",
        }}>
          <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
          {compareIds.length === 1 ? "Select one more scan to compare"
            : `Comparing Scan #${compareIds[0]} vs #${compareIds[1]}`}
          {compareIds.length === 2 && (
            <button onClick={() => setShowCompare(true)}
              style={{ background: "white", color: "#1e3a8a", border: "none", borderRadius: "var(--radius-sm)", padding: "5px 14px", fontWeight: 700, cursor: "pointer", fontSize: "0.82rem" }}>
              Compare →
            </button>
          )}
          <button onClick={() => { setCompareIds([]); setShowCompare(false); }}
            style={{ background: "none", border: "none", color: "rgba(255,255,255,0.7)", cursor: "pointer", padding: 2 }}>
            <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {/* ── ScanCompare modal ── */}
      {showCompare && compareIds.length === 2 && (
        <ScanCompare scanIds={compareIds} onClose={() => setShowCompare(false)} />
      )}

      {/* ── Delete modal ── */}
      {deleteId && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: "var(--spacing-lg)" }}
          onClick={() => !deleting && setDeleteId(null)}>
          <div className="card" style={{ maxWidth: 420, width: "100%" }} onClick={e => e.stopPropagation()}>
            <h3 style={{ fontSize: "1.25rem", marginBottom: "var(--spacing-sm)" }}>Delete Scan #{deleteId}?</h3>
            <p style={{ color: "var(--color-text-secondary)", marginBottom: "var(--spacing-lg)" }}>
              This permanently removes the scan record and its AI report. This cannot be undone.
            </p>
            <div style={{ display: "flex", gap: "var(--spacing-sm)", justifyContent: "flex-end" }}>
              <button className="btn btn-ghost" onClick={() => setDeleteId(null)} disabled={deleting}>Cancel</button>
              <button className="btn btn-danger" onClick={confirmDelete} disabled={deleting}>
                {deleting ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default HistoryTable;