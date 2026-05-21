"use client";
import React, { useState } from "react";
import { useAuth } from "../context/AuthContext";

const GENDERS = ["Male", "Female", "Other"];

const fieldStyle = {
  width:        "100%",
  padding:      "11px 14px",
  border:       "1.5px solid var(--color-border)",
  borderRadius: "var(--radius-sm)",
  fontSize:     "0.95rem",
  outline:      "none",
  background:   "white",
  color:        "var(--color-text-primary)",
  transition:   "border-color 0.2s",
};

const labelStyle = {
  display:      "block",
  fontWeight:   700,
  fontSize:     "0.85rem",
  marginBottom: "6px",
  color:        "var(--color-text-primary)",
};

const optionalStyle = {
  fontWeight: 400,
  fontSize:   "0.78rem",
  color:      "var(--color-text-light)",
  marginLeft: 5,
};

const PatientForm = ({ onSuccess }) => {
  const { authFetch } = useAuth();
  const [form, setForm] = useState({
    name:     "",
    age:      "",
    gender:   "",
    phone:    "",
    symptoms: "",
  });
  const [errors,   setErrors]   = useState({});
  const [loading,  setLoading]  = useState(false);
  const [apiError, setApiError] = useState("");

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: "" }));
  };

  const validate = () => {
    const errs = {};
    if (!form.name.trim())
      errs.name = "Patient name is required";
    if (!form.age)
      errs.age = "Age is required";
    else if (isNaN(form.age) || +form.age < 1 || +form.age > 129)
      errs.age = "Enter a valid age (1–129)";
    if (!form.gender)
      errs.gender = "Please select a gender";
    if (form.phone && !/^[\d\s\+\-\(\)]{7,15}$/.test(form.phone))
      errs.phone = "Enter a valid phone number";
    return errs;
  };

  const handleSubmit = async () => {
    setApiError("");
    const errs = validate();
    if (Object.keys(errs).length) {
      setErrors(errs);
      return;
    }

    setLoading(true);
    try {
      const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5001";
      const res = await authFetch(`${API_URL}/patients`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          name:     form.name.trim(),
          age:      parseInt(form.age),
          gender:   form.gender,
          phone:    form.phone.trim() || null,
          symptoms: form.symptoms.trim() || null,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setApiError(data.error || "Failed to register patient. Please try again.");
        return;
      }

      onSuccess(data.patient_id, form.name.trim());
    } catch {
      setApiError("Cannot reach the server. Make sure the backend is running.");
    } finally {
      setLoading(false);
    }
  };

  const onFocus = (e) => (e.target.style.borderColor = "var(--color-primary)");
  const onBlur  = (e) => (e.target.style.borderColor = errors[e.target.name] ? "#dc2626" : "var(--color-border)");

  return (
    <div className="fade-in">

      {/* Header */}
      <div style={{ textAlign: "center", marginBottom: "var(--spacing-xl)" }}>
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
          <span>Step 1 of 2</span>
        </div>
        <h2
          style={{
            fontSize:   "clamp(1.5rem, 3vw, 2rem)",
            fontWeight: 800,
            color:      "var(--color-text-primary)",
            margin:     0,
          }}
        >
          Patient Details
        </h2>
        <p
          style={{
            marginTop:    "0.5rem",
            marginBottom: 0,
            color:        "var(--color-text-light)",
            fontSize:     "0.95rem",
          }}
        >
          Fill in the patient information before uploading the MRI scan
        </p>
      </div>

      {/* Form grid */}
      <div
        style={{
          display:             "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
          gap:                 "var(--spacing-lg)",
          marginBottom:        "var(--spacing-lg)",
        }}
      >
        {/* Name */}
        <div>
          <label style={labelStyle}>
            Full Name
            <span style={{ color: "var(--color-primary)", marginLeft: 2 }}>*</span>
          </label>
          <input
            name="name"
            value={form.name}
            onChange={handleChange}
            onFocus={onFocus}
            onBlur={onBlur}
            placeholder="Name"
            maxLength={150}
            disabled={loading}
            style={{ ...fieldStyle, borderColor: errors.name ? "#dc2626" : "var(--color-border)" }}
          />
          {errors.name && (
            <p style={{ color: "#dc2626", fontSize: "0.78rem", marginTop: 4 }}>{errors.name}</p>
          )}
        </div>

        {/* Age */}
        <div>
          <label style={labelStyle}>
            Age
            <span style={{ color: "var(--color-primary)", marginLeft: 2 }}>*</span>
          </label>
          <input
            name="age"
            type="number"
            value={form.age}
            onChange={handleChange}
            onFocus={onFocus}
            onBlur={onBlur}
            placeholder="Age"
            min={1}
            max={129}
            disabled={loading}
            style={{ ...fieldStyle, borderColor: errors.age ? "#dc2626" : "var(--color-border)" }}
          />
          {errors.age && (
            <p style={{ color: "#dc2626", fontSize: "0.78rem", marginTop: 4 }}>{errors.age}</p>
          )}
        </div>

        {/* Gender */}
        <div>
          <label style={labelStyle}>
            Gender
            <span style={{ color: "var(--color-primary)", marginLeft: 2 }}>*</span>
          </label>
          <select
            name="gender"
            value={form.gender}
            onChange={handleChange}
            onFocus={onFocus}
            onBlur={onBlur}
            disabled={loading}
            style={{
              ...fieldStyle,
              borderColor:       errors.gender ? "#dc2626" : "var(--color-border)",
              appearance:        "none",
              backgroundImage:   `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%23767676' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E")`,
              backgroundRepeat:  "no-repeat",
              backgroundPosition:"right 12px center",
              paddingRight:      "36px",
              cursor:            "pointer",
            }}
          >
            <option value="">Select gender</option>
            {GENDERS.map((g) => <option key={g} value={g}>{g}</option>)}
          </select>
          {errors.gender && (
            <p style={{ color: "#dc2626", fontSize: "0.78rem", marginTop: 4 }}>{errors.gender}</p>
          )}
        </div>

        {/* Phone */}
        <div>
          <label style={labelStyle}>
            Phone<span style={optionalStyle}>(optional)</span>
          </label>
          <input
            name="phone"
            type="tel"
            value={form.phone}
            onChange={handleChange}
            onFocus={onFocus}
            onBlur={onBlur}
            placeholder="Phone number"
            maxLength={15}
            disabled={loading}
            style={{ ...fieldStyle, borderColor: errors.phone ? "#dc2626" : "var(--color-border)" }}
          />
          {errors.phone && (
            <p style={{ color: "#dc2626", fontSize: "0.78rem", marginTop: 4 }}>{errors.phone}</p>
          )}
        </div>
      </div>

      {/* Symptoms */}
      <div style={{ marginBottom: "var(--spacing-xl)" }}>
        <label style={labelStyle}>
          Symptoms / Reason for Scan<span style={optionalStyle}>(optional)</span>
        </label>
        <textarea
          name="symptoms"
          value={form.symptoms}
          onChange={handleChange}
          onFocus={onFocus}
          onBlur={onBlur}
          placeholder="e.g. Persistent headaches, blurred vision, dizziness for 3 weeks..."
          maxLength={500}
          rows={3}
          disabled={loading}
          style={{
            ...fieldStyle,
            resize:     "vertical",
            lineHeight: 1.6,
            minHeight:  90,
          }}
        />
        <p style={{ fontSize: "0.75rem", color: "var(--color-text-light)", marginTop: 4 }}>
          {form.symptoms.length}/500
        </p>
      </div>

      {/* API error */}
      {apiError && (
        <div className="alert alert-error" style={{ marginBottom: "var(--spacing-lg)" }}>
          <svg className="w-5 h-5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
              clipRule="evenodd" />
          </svg>
          <span style={{ fontSize: "0.875rem" }}>{apiError}</span>
        </div>
      )}

      {/* Submit */}
      <div style={{ textAlign: "center" }}>
        <button
          onClick={handleSubmit}
          disabled={loading}
          className={`btn ${loading ? "btn-disabled" : "btn-primary"} text-lg px-12 py-4`}
        >
          {loading ? (
            <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <svg className="spinning" width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Registering...
            </span>
          ) : (
            <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M9 5l7 7-7 7" />
              </svg>
              Continue to MRI Upload
            </span>
          )}
        </button>

        <p style={{ marginTop: "var(--spacing-sm)", fontSize: "0.78rem", color: "var(--color-text-light)" }}>
          Fields marked <span style={{ color: "var(--color-primary)" }}>*</span> are required
        </p>
      </div>
    </div>
  );
};

export default PatientForm;