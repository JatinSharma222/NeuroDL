// ─── ROLE ADDITION — paste these changes into your existing RegisterForm.jsx ──
//
// 1. Add to state (after existing useState declarations):
//
//   const [role,        setRole]        = useState("patient");
//   const [doctorCode,  setDoctorCode]  = useState("");
//
// 2. Add to validate():
//
//   if (role === "doctor" && !doctorCode.trim())
//     errs.doctorCode = "Doctor invite code is required";
//
// 3. Add to handleSubmit body (JSON.stringify):
//
//   body: JSON.stringify({
//     full_name:    form.full_name.trim(),
//     email:        form.email.trim(),
//     password:     form.password,
//     role,                          // ← add this
//     doctor_code:  doctorCode,      // ← add this
//   }),
//
// 4. Add this Role Toggle UI block just before the Full Name field:

const RoleToggle = ({ role, setRole }) => (
  <div style={{ marginBottom: "var(--spacing-lg)" }}>
    <label style={{ display: "block", fontWeight: 700, fontSize: "0.85rem", marginBottom: 8, color: "var(--color-text-primary)" }}>
      I am registering as
    </label>
    <div style={{ display: "flex", gap: 8 }}>
      {[
        { value: "patient", label: "🧑‍⚕️ Patient",  desc: "Upload & track my own MRI scans"         },
        { value: "doctor",  label: "👨‍⚕️ Doctor",   desc: "Review patients & add clinical notes"    },
      ].map(({ value, label, desc }) => {
        const active = role === value;
        return (
          <button
            key={value}
            type="button"
            onClick={() => setRole(value)}
            style={{
              flex: 1, padding: "10px 12px", borderRadius: "var(--radius-md)",
              border: `2px solid ${active ? "var(--color-primary)" : "var(--color-border-light)"}`,
              background: active ? "rgba(230,0,35,0.05)" : "white",
              cursor: "pointer", textAlign: "left",
              boxShadow: active ? "0 0 0 3px rgba(230,0,35,0.1)" : "none",
              transition: "all 0.15s",
            }}
          >
            <p style={{ margin: "0 0 2px", fontWeight: 700, fontSize: "0.85rem",
                        color: active ? "var(--color-primary)" : "var(--color-text-primary)" }}>
              {label}
            </p>
            <p style={{ margin: 0, fontSize: "0.72rem", color: "var(--color-text-light)" }}>{desc}</p>
          </button>
        );
      })}
    </div>
  </div>
);

// 5. Add Doctor Code field (show only when role === "doctor"),
//    paste this block just before the Password field:

const DoctorCodeField = ({ value, onChange, error, loading, inputStyle, labelStyle }) => (
  <div style={{ marginBottom: "var(--spacing-md)" }}>
    <label style={labelStyle}>
      Doctor Invite Code
      <span style={{ color: "var(--color-primary)", marginLeft: 2 }}>*</span>
    </label>
    <input
      type="password"
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder="Enter your invite code"
      disabled={loading}
      style={{ ...inputStyle, borderColor: error ? "#dc2626" : "var(--color-border)" }}
    />
    {error && <p style={{ color: "#dc2626", fontSize: "0.78rem", marginTop: 4 }}>{error}</p>}
    <p style={{ fontSize: "0.72rem", color: "var(--color-text-light)", marginTop: 4 }}>
      Contact your NeuroDL administrator for a doctor invite code.
      Default dev code: <code style={{ background: "var(--color-bg-tertiary)", padding: "1px 5px", borderRadius: 3 }}>NEURODL-DOCTOR-2026</code>
    </p>
  </div>
);