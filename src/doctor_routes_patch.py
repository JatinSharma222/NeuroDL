"""
doctor_routes_patch.py
───────────────────────
Add these three things to your app.py:

1. Update imports at the top
2. Update /auth/register to accept role
3. Add the doctor routes block at the bottom (before error handlers)
"""

# ════════════════════════════════════════════════════════
# 1. UPDATE IMPORTS — replace the existing import lines
# ════════════════════════════════════════════════════════

from src.auth import create_token, hash_password, require_auth, verify_password, require_doctor  # add require_doctor

from src.database import (
    # ... keep everything you already have, then ADD:
    add_clinical_note,
    get_notes_for_scan,
    get_all_patients,
    get_doctor_stats,
)


# ════════════════════════════════════════════════════════
# 2. UPDATE /auth/register — add role support
#    Replace your existing register() function with this:
# ════════════════════════════════════════════════════════

DOCTOR_INVITE_CODE = os.environ.get("DOCTOR_INVITE_CODE", "NEURODL-DOCTOR-2026")

@app.route("/auth/register", methods=["POST"])
def register():
    data = request.get_json(silent=True)
    if not data:
        return jsonify({"error": "JSON body required"}), 400

    full_name    = data.get("full_name", "").strip()
    email        = data.get("email",     "").strip()
    password     = data.get("password",  "")
    role         = data.get("role",      "patient")        # NEW
    doctor_code  = data.get("doctor_code", "").strip()     # NEW

    errors = []
    if not full_name:                       errors.append("Full name is required")
    if not email or "@" not in email:       errors.append("Valid email is required")
    if not password or len(password) < 8:  errors.append("Password must be at least 8 characters")
    if role not in ("patient", "doctor"):  errors.append("Invalid role")

    # Doctor registration requires invite code
    if role == "doctor" and doctor_code != DOCTOR_INVITE_CODE:
        errors.append("Invalid doctor invite code")

    if errors:
        return jsonify({"error": "Validation failed", "details": errors}), 400

    try:
        hashed = hash_password(password)
        user   = create_user(
            email         = email,
            password_hash = hashed,
            full_name     = full_name,
            role          = role,           # NEW
        )
        token = create_token(
            user_id   = user.id,
            email     = user.email,
            full_name = user.full_name,
            role      = user.role,          # NEW
        )
        print(f"[AUTH] Registered — {email} ({role})")
        return jsonify({"token": token, "user": user.to_dict()}), 201
    except ValueError as ve:
        return jsonify({"error": str(ve)}), 409
    except Exception:
        print(f"[AUTH] Register error: {traceback.format_exc()}")
        return jsonify({"error": "Registration failed"}), 500


# Also update /auth/login to include role in token:
# Find this line in your login() function:
#   token = create_token(user_id=user.id, email=user.email, full_name=user.full_name)
# Replace with:
#   token = create_token(user_id=user.id, email=user.email, full_name=user.full_name, role=user.role)


# ════════════════════════════════════════════════════════
# 3. ADD DOCTOR ROUTES — paste this block into app.py
#    just before the # ─── Error Handlers line
# ════════════════════════════════════════════════════════

# ─── Doctor Routes ────────────────────────────────────────────────────────────

@app.route("/doctor/stats", methods=["GET"])
@require_auth
@require_doctor
def doctor_stats(current_user):
    """Aggregate numbers for the doctor dashboard header."""
    try:
        return jsonify(get_doctor_stats()), 200
    except Exception:
        return jsonify({"error": "Failed to fetch stats"}), 500


@app.route("/doctor/patients", methods=["GET"])
@require_auth
@require_doctor
def doctor_patients(current_user):
    """List ALL patients across all users (doctor view)."""
    try:
        result = get_all_patients(
            page     = max(1, int(request.args.get("page",     1))),
            per_page = max(1, min(int(request.args.get("per_page", 20)), 100)),
            search   = request.args.get("search"),
        )
        return jsonify(result), 200
    except Exception:
        return jsonify({"error": "Failed to fetch patients"}), 500


@app.route("/doctor/patients/<int:patient_id>", methods=["GET"])
@require_auth
@require_doctor
def doctor_patient_detail(current_user, patient_id):
    """Single patient record + scan + clinical notes (doctor view)."""
    try:
        patient = get_patient_by_id(patient_id)
        if not patient:
            return jsonify({"error": f"Patient {patient_id} not found"}), 404
        # Attach notes to the scan dict
        if patient.get("scan") and patient["scan"].get("id"):
            patient["scan"]["notes"] = get_notes_for_scan(patient["scan"]["id"])
        return jsonify(patient), 200
    except Exception:
        return jsonify({"error": "Failed to fetch patient"}), 500


@app.route("/doctor/scans/<int:scan_id>/notes", methods=["GET"])
@require_auth
@require_doctor
def doctor_get_notes(current_user, scan_id):
    """All clinical notes for a specific scan."""
    try:
        return jsonify({"notes": get_notes_for_scan(scan_id)}), 200
    except Exception:
        return jsonify({"error": "Failed to fetch notes"}), 500


@app.route("/doctor/scans/<int:scan_id>/notes", methods=["POST"])
@require_auth
@require_doctor
def doctor_add_note(current_user, scan_id):
    """
    Add a clinical note + verdict to a scan.
    Body: { "note_text": "...", "verdict": "approved" | "flagged" | "pending" }
    """
    data = request.get_json(silent=True)
    if not data or not data.get("note_text", "").strip():
        return jsonify({"error": "note_text is required"}), 400

    verdict = data.get("verdict", "pending")
    if verdict not in ("pending", "approved", "flagged"):
        return jsonify({"error": "verdict must be pending | approved | flagged"}), 400

    try:
        note = add_clinical_note(
            scan_id   = scan_id,
            doctor_id = int(current_user["sub"]),
            note_text = data["note_text"],
            verdict   = verdict,
        )
        return jsonify({"note": note, "message": "Note added successfully"}), 201
    except Exception:
        print(f"[DOCTOR] Note error: {traceback.format_exc()}")
        return jsonify({"error": "Failed to add note"}), 500