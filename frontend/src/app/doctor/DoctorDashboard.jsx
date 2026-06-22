"use client";
import React, { useState, useEffect, useRef, useCallback } from "react";
import { useAuth } from "../context/AuthContext";

/**
 * DoctorDashboard.jsx  —  NeuroDL v2.0
 * ──────────────────────────────────────
 * Doctor-only view. Shows all patients across all users.
 *
 * Sections:
 *   1. KPI header  — total patients, scans, pending/flagged counts
 *   2. Patient search + list
 *   3. Patient detail panel  — scan info + clinical notes + verdict form
 *
 * Requires role="doctor" in JWT — backend enforces this at /doctor/* routes.
 */

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5001";

const CLASS_CFG = {
  "Glioma Tumor":     { color: "#dc2626", bg: "#fef2f2" },
  "Meningioma Tumor": { color: "#d97706", bg: "#fffbeb" },
  "No Tumor":         { color: "#16a34a", bg: "#f0fdf4" },
  "Pituitary Tumor":  { color: "#2563eb", bg: "#eff6ff" },
};

const VERDICT_CFG = {
  pending:  { label: "Pending review", color: "#d97706", bg: "#fef9c3", border: "#fde68a" },
  approved: { label: "Approved",       color: "#16a34a", bg: "#f0fdf4", border: "#bbf7d0" },
  flagged:  { label: "Flagged",        color: "#dc2626", bg: "#fef2f2", border: "#fca5a5" },
};

// ── Tiny reusable KPI card ─────────────────────────────────────────────────
const KpiCard = ({ label, value, color = "var(--color-primary)", sub }) => (
  <div style={{
    background: "white", borderRadius: "var(--radius-lg)", padding: "16px 20px",
    border: "1px solid var(--color-border-light)", flex: 1, minWidth: 130,
  }}>
    <p style={{ margin: "0 0 4px", fontSize: "0.7rem", fontWeight: 700, color: "var(--color-text-light)", textTransform: "uppercase", letterSpacing: "0.06em" }}>{label}</p>
    <p style={{ margin: 0, fontSize: "1.8rem", fontWeight: 800, color, lineHeight: 1.1 }}>{value ?? "—"}</p>
    {sub && <p style={{ margin: "3px 0 0", fontSize: "0.72rem", color: "var(--color-text-light)" }}>{sub}</p>}
  </div>
);

// ── Verdict badge ──────────────────────────────────────────────────────────
const VerdictBadge = ({ verdict }) => {
  const cfg = VERDICT_CFG[verdict] || VERDICT_CFG.pending;
  return (
    <span style={{
      fontSize: "0.72rem", fontWeight: 700, padding: "2px 9px", borderRadius: 99,
      background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}`,
    }}>
      {verdict === "approved" ? "✓" : verdict === "flagged" ? "⚠" : "○"} {cfg.label}
    </span>
  );
};

// ── Note form ─────────────────────────────────────────────────────────────
const NoteForm = ({ scanId, onAdded, authFetch }) => {
  const [text,    setText]    = useState("");
  const [verdict, setVerdict] = useState("pending");
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState("");

  const submit = async () => {
    if (!text.trim()) { setError("Note text is required"); return; }
    setLoading(true); setError("");
    try {
      const res  = await authFetch(`${API_URL}/doctor/scans/${scanId}/notes`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ note_text: text, verdict }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to add note");
      setText(""); setVerdict("pending");
      onAdded(data.note);
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  };

  return (
    <div style={{ background: "var(--color-bg-tertiary)", borderRadius: "var(--radius-md)", padding: 14, marginTop: 14 }}>
      <p style={{ margin: "0 0 8px", fontWeight: 700, fontSize: "0.82rem", color: "var(--color-text-primary)" }}>
        Add Clinical Note
      </p>

      {/* Verdict selector */}
      <div style={{ display: "flex", gap: 6, marginBottom: 10, flexWrap: "wrap" }}>
        {Object.entries(VERDICT_CFG).map(([key, cfg]) => (
          <button key={key} onClick={() => setVerdict(key)} style={{
            padding: "4px 12px", borderRadius: 99, fontSize: "0.75rem", fontWeight: 700,
            cursor: "pointer",
            background: verdict === key ? cfg.bg : "white",
            color:      verdict === key ? cfg.color : "var(--color-text-secondary)",
            border:     `1.5px solid ${verdict === key ? cfg.border : "var(--color-border-light)"}`,
          }}>
            {key === "approved" ? "✓ Approve" : key === "flagged" ? "⚠ Flag" : "○ Pending"}
          </button>
        ))}
      </div>

      <textarea
        value={text} onChange={e => { setText(e.target.value); setError(""); }}
        placeholder="Enter your clinical observation, recommendation, or concern…"
        rows={3}
        style={{
          width: "100%", boxSizing: "border-box", padding: "9px 12px",
          border: `1.5px solid ${error ? "#fca5a5" : "var(--color-border)"}`,
          borderRadius: "var(--radius-sm)", fontSize: "0.85rem", resize: "vertical",
          outline: "none", fontFamily: "inherit",
        }}
      />
      {error && <p style={{ color: "#dc2626", fontSize: "0.75rem", margin: "4px 0 0" }}>{error}</p>}

      <button
        onClick={submit} disabled={loading}
        className={`btn ${loading ? "btn-disabled" : "btn-primary"} btn-sm`}
        style={{ marginTop: 8 }}
      >
        {loading ? "Saving…" : "Save Note"}
      </button>
    </div>
  );
};

// ── Patient detail panel ───────────────────────────────────────────────────
const PatientPanel = ({ patient, onClose, authFetch }) => {
  const [notes,    setNotes]    = useState([]);
  const [loading,  setLoading]  = useState(true);

  const scan = patient?.scan;

  useEffect(() => {
    if (!scan?.id) { setLoading(false); return; }
    authFetch(`${API_URL}/doctor/scans/${scan.id}/notes`)
      .then(r => r.json())
      .then(d => { setNotes(d.notes || []); setLoading(false); })
      .catch(() => setLoading(false));
  }, [scan?.id]);

  const cls = scan ? (CLASS_CFG[scan.predicted_class] || CLASS_CFG["No Tumor"]) : null;
  const fmt = iso => iso ? new Date(iso).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" }) : "—";

  return (
    <div style={{
      background: "white", borderRadius: "var(--radius-lg)",
      border: "1px solid var(--color-border-light)",
      boxShadow: "var(--shadow-lg)", overflow: "hidden",
    }}>
      {/* Header */}
      <div style={{
        padding: "14px 20px", background: "var(--color-bg-tertiary)",
        borderBottom: "1px solid var(--color-border-light)",
        display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>
        <div>
          <p style={{ margin: 0, fontWeight: 700, fontSize: "0.95rem", color: "var(--color-text-primary)" }}>
            {patient.name}
          </p>
          <p style={{ margin: "2px 0 0", fontSize: "0.75rem", color: "var(--color-text-light)" }}>
            {patient.age} yrs · {patient.gender} · Patient #{patient.id}
          </p>
        </div>
        <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--color-text-light)" }}>
          <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div style={{ padding: "var(--spacing-lg)", overflowY: "auto", maxHeight: "70vh" }}>
        {/* Symptoms */}
        {patient.symptoms && (
          <div style={{ marginBottom: 16, padding: "10px 14px", background: "#f0f9ff", borderRadius: "var(--radius-md)", border: "1px solid #bae6fd" }}>
            <p style={{ margin: "0 0 3px", fontSize: "0.7rem", fontWeight: 700, color: "#0369a1", textTransform: "uppercase", letterSpacing: "0.05em" }}>Presenting symptoms</p>
            <p style={{ margin: 0, fontSize: "0.82rem", color: "#0c4a6e" }}>{patient.symptoms}</p>
          </div>
        )}

        {/* Scan result */}
        {scan ? (
          <div style={{ marginBottom: 16 }}>
            <p style={{ margin: "0 0 10px", fontWeight: 700, fontSize: "0.82rem", color: "var(--color-text-primary)" }}>AI Scan Result</p>
            <div style={{
              border: `2px solid ${cls?.color || "#e5e7eb"}`,
              borderRadius: "var(--radius-md)", padding: 14,
              background: cls?.bg || "white",
            }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
                <span style={{ fontWeight: 800, fontSize: "1rem", color: cls?.color }}>{scan.predicted_class}</span>
                <span style={{ fontWeight: 700, fontSize: "0.85rem", color: cls?.color }}>
                  {(scan.confidence_score * 100).toFixed(2)}%
                </span>
              </div>
              <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
                <span style={{ fontSize: "0.72rem", color: "var(--color-text-light)" }}>{fmt(scan.scan_timestamp)}</span>
                {scan.gradcam_performed      && <span className="badge badge-success" style={{ fontSize: "0.68rem" }}>Grad-CAM</span>}
                {scan.segmentation_performed && <span className="badge badge-info"    style={{ fontSize: "0.68rem" }}>Segmentation</span>}
                {scan.report_text            && <span className="badge badge-primary" style={{ fontSize: "0.68rem" }}>AI Report</span>}
              </div>
            </div>
          </div>
        ) : (
          <div style={{ padding: 14, background: "var(--color-bg-tertiary)", borderRadius: "var(--radius-md)", marginBottom: 16 }}>
            <p style={{ margin: 0, fontSize: "0.82rem", color: "var(--color-text-light)" }}>No scan recorded yet for this patient.</p>
          </div>
        )}

        {/* Existing notes */}
        {scan && (
          <>
            <p style={{ margin: "0 0 10px", fontWeight: 700, fontSize: "0.82rem", color: "var(--color-text-primary)" }}>
              Clinical Notes {notes.length > 0 && <span style={{ color: "var(--color-text-light)", fontWeight: 400 }}>({notes.length})</span>}
            </p>

            {loading && <p style={{ fontSize: "0.82rem", color: "var(--color-text-light)" }}>Loading notes…</p>}

            {!loading && notes.length === 0 && (
              <p style={{ fontSize: "0.82rem", color: "var(--color-text-light)", fontStyle: "italic", marginBottom: 12 }}>
                No clinical notes yet. Be the first to review.
              </p>
            )}

            {!loading && notes.map(note => (
              <div key={note.id} style={{
                borderLeft: `3px solid ${VERDICT_CFG[note.verdict]?.color || "#e5e7eb"}`,
                paddingLeft: 12, marginBottom: 12,
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4, flexWrap: "wrap" }}>
                  <VerdictBadge verdict={note.verdict} />
                  <span style={{ fontSize: "0.72rem", color: "var(--color-text-light)" }}>
                    Dr. {note.doctor_name} · {fmt(note.created_at)}
                  </span>
                </div>
                <p style={{ margin: 0, fontSize: "0.82rem", color: "var(--color-text-secondary)", lineHeight: 1.5 }}>
                  {note.note_text}
                </p>
              </div>
            ))}

            {/* Add note form */}
            <NoteForm
              scanId={scan.id}
              authFetch={authFetch}
              onAdded={note => setNotes(prev => [note, ...prev])}
            />
          </>
        )}
      </div>
    </div>
  );
};

// ── Main dashboard ─────────────────────────────────────────────────────────
export default function DoctorDashboard() {
  const { authFetch, user } = useAuth();

  const [stats,    setStats]    = useState(null);
  const [patients, setPatients] = useState([]);
  const [total,    setTotal]    = useState(0);
  const [page,     setPage]     = useState(1);
  const [search,   setSearch]   = useState("");
  const [query,    setQuery]    = useState("");
  const [loading,  setLoading]  = useState(true);
  const [selected, setSelected] = useState(null);   // patient detail
  const [detail,   setDetail]   = useState(null);   // full patient with scan
  const [detailLoading, setDetailLoading] = useState(false);

  const perPage = 12;
  const debounceRef = useRef(null);

  // Debounce search
  useEffect(() => {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => { setQuery(search); setPage(1); }, 380);
    return () => clearTimeout(debounceRef.current);
  }, [search]);

  // Load stats
  useEffect(() => {
    authFetch(`${API_URL}/doctor/stats`)
      .then(r => r.json())
      .then(setStats)
      .catch(() => {});
  }, []);

  // Load patients
  const loadPatients = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page, per_page: perPage, ...(query && { search: query }) });
      const res    = await authFetch(`${API_URL}/doctor/patients?${params}`);
      const data   = await res.json();
      setPatients(data.patients || []);
      setTotal(data.total || 0);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [page, query]);

  useEffect(() => { loadPatients(); }, [loadPatients]);

  // Load patient detail
  const openPatient = async (p) => {
    setSelected(p); setDetail(null); setDetailLoading(true);
    try {
      const res  = await authFetch(`${API_URL}/doctor/patients/${p.id}`);
      const data = await res.json();
      setDetail(data);
    } catch (e) { console.error(e); }
    finally { setDetailLoading(false); }
  };

  const totalPages = Math.ceil(total / perPage);

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto", padding: "var(--spacing-xl)" }}>

      {/* ── Header ── */}
      <div style={{ marginBottom: "var(--spacing-xl)" }}>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "4px 12px", borderRadius: 99, background: "#eff6ff", color: "#2563eb", fontSize: "0.72rem", fontWeight: 700, marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.05em" }}>
          <svg width="12" height="12" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
          </svg>
          Doctor Portal
        </div>
        <h1 style={{ fontSize: "clamp(1.5rem, 3vw, 2rem)", fontWeight: 800, color: "var(--color-text-primary)", margin: "0 0 4px" }}>
          Patient Overview
        </h1>
        <p style={{ margin: 0, color: "var(--color-text-light)", fontSize: "0.9rem" }}>
          Welcome, Dr. {user?.full_name} — reviewing all patients across NeuroDL
        </p>
      </div>

      {/* ── KPI row ── */}
      {stats && (
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: "var(--spacing-xl)" }}>
          <KpiCard label="Total Patients" value={stats.total_patients} color="var(--color-primary)" />
          <KpiCard label="Total Scans"    value={stats.total_scans}    color="#2563eb" />
          <KpiCard label="Pending Review" value={stats.notes.pending}  color="#d97706"
            sub={stats.notes.pending > 0 ? "Need your attention" : "All reviewed"} />
          <KpiCard label="Approved"       value={stats.notes.approved} color="#16a34a" />
          <KpiCard label="Flagged"        value={stats.notes.flagged}  color="#dc2626"
            sub={stats.notes.flagged > 0 ? "Follow-up required" : ""} />
        </div>
      )}

      {/* ── Layout: list + detail ── */}
      <div style={{ display: "grid", gridTemplateColumns: selected ? "1fr 1.2fr" : "1fr", gap: "var(--spacing-lg)", alignItems: "start" }}>

        {/* ── Patient list ── */}
        <div>
          {/* Search bar */}
          <div style={{ position: "relative", marginBottom: 14 }}>
            <svg style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)", width: 14, height: 14, color: "var(--color-text-light)" }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              placeholder="Search patients by name…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{
                width: "100%", boxSizing: "border-box", paddingLeft: 32, padding: "9px 12px 9px 32px",
                border: "1.5px solid var(--color-border)", borderRadius: "var(--radius-sm)",
                fontSize: "0.85rem", outline: "none",
              }}
              onFocus={e  => (e.target.style.borderColor = "var(--color-primary)")}
              onBlur={e   => (e.target.style.borderColor = "var(--color-border)")}
            />
          </div>

          {/* Count */}
          <p style={{ fontSize: "0.78rem", color: "var(--color-text-light)", margin: "0 0 10px" }}>
            {loading ? "Loading…" : `${total} patient${total !== 1 ? "s" : ""}${query ? ` matching "${query}"` : ""}`}
          </p>

          {/* Patient cards grid */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 10 }}>
            {loading && Array.from({ length: 8 }).map((_, i) => (
              <div key={i} style={{ height: 100, borderRadius: "var(--radius-md)", background: "var(--color-bg-tertiary)", animation: "pulse 1.5s ease-in-out infinite" }} />
            ))}

            {!loading && patients.map(p => {
              const scan   = p.scan;
              const cls    = scan ? (CLASS_CFG[scan.predicted_class] || CLASS_CFG["No Tumor"]) : null;
              const active = selected?.id === p.id;

              return (
                <div
                  key={p.id}
                  onClick={() => openPatient(p)}
                  style={{
                    background:   "white",
                    border:       `1.5px solid ${active ? "var(--color-primary)" : "var(--color-border-light)"}`,
                    borderRadius: "var(--radius-md)",
                    padding:      "12px 14px",
                    cursor:       "pointer",
                    transition:   "border-color 0.15s, box-shadow 0.15s",
                    boxShadow:    active ? "0 0 0 3px rgba(230,0,35,0.12)" : "none",
                  }}
                  onMouseEnter={e => { if (!active) e.currentTarget.style.borderColor = "#d1d5db"; }}
                  onMouseLeave={e => { if (!active) e.currentTarget.style.borderColor = "var(--color-border-light)"; }}
                >
                  {/* Avatar + name */}
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                    <div style={{
                      width: 32, height: 32, borderRadius: "50%", flexShrink: 0,
                      background: "linear-gradient(135deg, var(--color-primary), var(--color-primary-hover))",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      color: "white", fontWeight: 700, fontSize: "0.85rem",
                    }}>
                      {p.name.charAt(0).toUpperCase()}
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <p style={{ margin: 0, fontWeight: 700, fontSize: "0.85rem", color: "var(--color-text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {p.name}
                      </p>
                      <p style={{ margin: 0, fontSize: "0.7rem", color: "var(--color-text-light)" }}>
                        {p.age}y · {p.gender} · #{p.id}
                      </p>
                    </div>
                  </div>

                  {/* Scan badge */}
                  {scan ? (
                    <span style={{
                      display: "inline-flex", alignItems: "center", gap: 4,
                      padding: "2px 8px", borderRadius: 99, fontSize: "0.7rem", fontWeight: 700,
                      background: cls?.bg, color: cls?.color,
                    }}>
                      <span style={{ width: 6, height: 6, borderRadius: "50%", background: cls?.color }} />
                      {scan.predicted_class}
                    </span>
                  ) : (
                    <span style={{ fontSize: "0.7rem", color: "var(--color-text-light)", fontStyle: "italic" }}>
                      No scan yet
                    </span>
                  )}
                </div>
              );
            })}

            {!loading && patients.length === 0 && (
              <div style={{ gridColumn: "1/-1", textAlign: "center", padding: 40, color: "var(--color-text-light)" }}>
                <p style={{ margin: 0 }}>No patients found{query ? ` for "${query}"` : ""}.</p>
              </div>
            )}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div style={{ display: "flex", justifyContent: "center", gap: 6, marginTop: 16 }}>
              <button className="btn btn-ghost btn-sm" disabled={page === 1} onClick={() => setPage(p => p - 1)}>‹</button>
              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter(p => p === 1 || p === totalPages || Math.abs(p - page) <= 1)
                .reduce((acc, p, i, arr) => { if (i > 0 && p - arr[i-1] > 1) acc.push("..."); acc.push(p); return acc; }, [])
                .map((item, i) => item === "..."
                  ? <span key={`e${i}`} style={{ padding: "0 4px", color: "var(--color-text-light)" }}>…</span>
                  : <button key={item} className={`btn btn-ghost btn-sm ${page === item ? "btn-primary" : ""}`} onClick={() => setPage(item)}>{item}</button>
                )}
              <button className="btn btn-ghost btn-sm" disabled={page === totalPages} onClick={() => setPage(p => p + 1)}>›</button>
            </div>
          )}
        </div>

        {/* ── Patient detail panel ── */}
        {selected && (
          <div>
            {detailLoading ? (
              <div style={{ background: "white", borderRadius: "var(--radius-lg)", padding: 32, textAlign: "center", border: "1px solid var(--color-border-light)" }}>
                <div style={{ width: 32, height: 32, borderRadius: "50%", border: "3px solid var(--color-border)", borderTop: "3px solid var(--color-primary)", animation: "spin 0.8s linear infinite", margin: "0 auto 12px" }} />
                <p style={{ color: "var(--color-text-light)", fontSize: "0.85rem", margin: 0 }}>Loading patient…</p>
                <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
              </div>
            ) : (
              <PatientPanel
                patient={detail || selected}
                onClose={() => { setSelected(null); setDetail(null); }}
                authFetch={authFetch}
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}