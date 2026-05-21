"use client";
import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "../context/AuthContext";

/**
 * RegisterForm.jsx
 * ────────────────
 * Patient registration form. POSTs to /auth/register, stores JWT via AuthContext.
 */

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5001";

const inputStyle = {
  width:        "100%",
  padding:      "12px 16px",
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

const PasswordStrength = ({ password }) => {
  const checks = [
    { label: "8+ characters", pass: password.length >= 8 },
    { label: "Uppercase letter", pass: /[A-Z]/.test(password) },
    { label: "Number", pass: /\d/.test(password) },
  ];
  if (!password) return null;
  return (
    <div style={{ display: "flex", gap: 8, marginTop: 6, flexWrap: "wrap" }}>
      {checks.map(({ label, pass }) => (
        <span
          key={label}
          style={{
            fontSize:   "0.72rem",
            fontWeight: 600,
            padding:    "2px 8px",
            borderRadius: 99,
            background: pass ? "#dcfce7" : "#fee2e2",
            color:      pass ? "#15803d" : "#dc2626",
          }}
        >
          {pass ? "✓" : "✗"} {label}
        </span>
      ))}
    </div>
  );
};

const RegisterForm = () => {
  const { login } = useAuth();
  const router    = useRouter();

  const [form, setForm]         = useState({ full_name: "", email: "", password: "", confirm: "" });
  const [errors, setErrors]     = useState({});
  const [apiError, setApiError] = useState("");
  const [loading, setLoading]   = useState(false);
  const [showPass, setShowPass] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((p) => ({ ...p, [name]: value }));
    if (errors[name]) setErrors((p) => ({ ...p, [name]: "" }));
    setApiError("");
  };

  const validate = () => {
    const errs = {};
    if (!form.full_name.trim())                errs.full_name = "Full name is required";
    if (!form.email || !form.email.includes("@")) errs.email  = "Valid email is required";
    if (form.password.length < 8)              errs.password  = "Minimum 8 characters";
    if (form.password !== form.confirm)        errs.confirm   = "Passwords do not match";
    return errs;
  };

  const handleSubmit = async () => {
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }

    setLoading(true);
    setApiError("");
    try {
      const res  = await fetch(`${API_URL}/auth/register`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          full_name: form.full_name.trim(),
          email:     form.email.trim(),
          password:  form.password,
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        setApiError(data.error || "Registration failed. Please try again.");
        return;
      }

      login(data.token, data.user);
      router.push("/");
    } catch {
      setApiError("Cannot reach the server. Make sure the backend is running.");
    } finally {
      setLoading(false);
    }
  };

  const onKeyDown = (e) => { if (e.key === "Enter") handleSubmit(); };
  const onFocus   = (e) => (e.target.style.borderColor = "var(--color-primary)");
  const onBlur    = (e) => (e.target.style.borderColor = errors[e.target.name] ? "#dc2626" : "var(--color-border)");

  return (
    <div className="fade-in" style={{ width: "100%", maxWidth: 440, margin: "0 auto" }}>

      {/* Header */}
      <div style={{ textAlign: "center", marginBottom: "var(--spacing-xl)" }}>
        <div
          style={{
            width:          56,
            height:         56,
            borderRadius:   "var(--radius-lg)",
            background:     "linear-gradient(135deg, var(--color-primary), var(--color-primary-hover))",
            display:        "flex",
            alignItems:     "center",
            justifyContent: "center",
            margin:         "0 auto var(--spacing-md)",
            boxShadow:      "0 8px 24px rgba(230,0,35,0.25)",
          }}
        >
          <svg width="28" height="28" fill="none" stroke="white" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
          </svg>
        </div>
        <h1 style={{ fontSize: "1.75rem", fontWeight: 800, color: "var(--color-text-primary)", margin: 0 }}>
          Create account
        </h1>
        <p style={{ marginTop: 6, color: "var(--color-text-light)", fontSize: "0.95rem" }}>
          Join NeuroDL to analyse your MRI scans
        </p>
      </div>

      {/* Card */}
      <div
        style={{
          background:   "white",
          borderRadius: "var(--radius-lg)",
          border:       "1px solid var(--color-border-light)",
          padding:      "var(--spacing-xl)",
          boxShadow:    "var(--shadow-md)",
        }}
      >
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

        {/* Full name */}
        <div style={{ marginBottom: "var(--spacing-md)" }}>
          <label style={labelStyle}>Full name</label>
          <input
            name="full_name"
            type="text"
            value={form.full_name}
            onChange={handleChange}
            onFocus={onFocus}
            onBlur={onBlur}
            onKeyDown={onKeyDown}
            placeholder="Rajan Sharma"
            disabled={loading}
            autoComplete="name"
            style={{ ...inputStyle, borderColor: errors.full_name ? "#dc2626" : "var(--color-border)" }}
          />
          {errors.full_name && (
            <p style={{ color: "#dc2626", fontSize: "0.78rem", marginTop: 4 }}>{errors.full_name}</p>
          )}
        </div>

        {/* Email */}
        <div style={{ marginBottom: "var(--spacing-md)" }}>
          <label style={labelStyle}>Email address</label>
          <input
            name="email"
            type="email"
            value={form.email}
            onChange={handleChange}
            onFocus={onFocus}
            onBlur={onBlur}
            onKeyDown={onKeyDown}
            placeholder="you@example.com"
            disabled={loading}
            autoComplete="email"
            style={{ ...inputStyle, borderColor: errors.email ? "#dc2626" : "var(--color-border)" }}
          />
          {errors.email && (
            <p style={{ color: "#dc2626", fontSize: "0.78rem", marginTop: 4 }}>{errors.email}</p>
          )}
        </div>

        {/* Password */}
        <div style={{ marginBottom: "var(--spacing-md)" }}>
          <label style={labelStyle}>Password</label>
          <div style={{ position: "relative" }}>
            <input
              name="password"
              type={showPass ? "text" : "password"}
              value={form.password}
              onChange={handleChange}
              onFocus={onFocus}
              onBlur={onBlur}
              onKeyDown={onKeyDown}
              placeholder="Min. 8 characters"
              disabled={loading}
              autoComplete="new-password"
              style={{
                ...inputStyle,
                borderColor:  errors.password ? "#dc2626" : "var(--color-border)",
                paddingRight: 44,
              }}
            />
            <button
              type="button"
              onClick={() => setShowPass((p) => !p)}
              style={{
                position: "absolute", right: 12, top: "50%",
                transform: "translateY(-50%)", background: "none",
                border: "none", cursor: "pointer",
                color: "var(--color-text-light)", padding: 4,
              }}
              tabIndex={-1}
            >
              {showPass ? (
                <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                </svg>
              ) : (
                <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
              )}
            </button>
          </div>
          <PasswordStrength password={form.password} />
          {errors.password && (
            <p style={{ color: "#dc2626", fontSize: "0.78rem", marginTop: 4 }}>{errors.password}</p>
          )}
        </div>

        {/* Confirm password */}
        <div style={{ marginBottom: "var(--spacing-xl)" }}>
          <label style={labelStyle}>Confirm password</label>
          <input
            name="confirm"
            type={showPass ? "text" : "password"}
            value={form.confirm}
            onChange={handleChange}
            onFocus={onFocus}
            onBlur={onBlur}
            onKeyDown={onKeyDown}
            placeholder="Repeat your password"
            disabled={loading}
            autoComplete="new-password"
            style={{ ...inputStyle, borderColor: errors.confirm ? "#dc2626" : "var(--color-border)" }}
          />
          {errors.confirm && (
            <p style={{ color: "#dc2626", fontSize: "0.78rem", marginTop: 4 }}>{errors.confirm}</p>
          )}
        </div>

        {/* Submit */}
        <button
          onClick={handleSubmit}
          disabled={loading}
          className={`btn ${loading ? "btn-disabled" : "btn-primary"}`}
          style={{ width: "100%", justifyContent: "center", fontSize: "1rem", padding: "13px" }}
        >
          {loading ? (
            <span style={{ display: "flex", alignItems: "center", gap: 8, justifyContent: "center" }}>
              <svg className="spinning" width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Creating account...
            </span>
          ) : "Create Account"}
        </button>
      </div>

      {/* Footer */}
      <p style={{ textAlign: "center", marginTop: "var(--spacing-lg)", fontSize: "0.88rem", color: "var(--color-text-light)" }}>
        Already have an account?{" "}
        <Link href="/login" style={{ color: "var(--color-primary)", fontWeight: 700, textDecoration: "none" }}>
          Sign in
        </Link>
      </p>
    </div>
  );
};

export default RegisterForm;