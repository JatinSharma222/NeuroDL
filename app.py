"""
app.py
──────
NeuroDL v2.0 — Flask API with JWT authentication + Flask-SocketIO.

Public endpoints:
  GET  /                     — health check
  POST /auth/register        — create account (patient or doctor)
  POST /auth/login           — get JWT token
  GET  /auth/me              — get current user
  GET  /model-performance    — pre-computed evaluation metrics (public)

Protected endpoints (require Authorization: Bearer <token>):
  POST   /patients           — register patient profile
  GET    /patients           — list own patients
  GET    /patients/<id>      — single patient + scan
  DELETE /patients/<id>      — delete patient
  POST   /predict            — MRI analysis (emits socket progress)
  POST   /compare-gradcam    — frozen vs fine-tuned Grad-CAM comparison
  GET    /history            — own scan history
  GET    /history/<id>       — single scan
  DELETE /history/<id>       — delete scan
  GET    /stats              — analytics for current user
  POST   /auth/refresh       — refresh JWT token

Doctor-only endpoints (require role=doctor in JWT):
  GET  /doctor/stats                    — aggregate dashboard numbers
  GET  /doctor/patients                 — all patients across all users
  GET  /doctor/patients/<id>            — patient + scan + notes
  GET  /doctor/scans/<id>/notes         — all notes for a scan
  POST /doctor/scans/<id>/notes         — add clinical note + verdict
"""

import base64
import json as _json       # renamed to avoid conflict with flask.json
import os
import time
import traceback
from io import BytesIO

import numpy as np
from dotenv import load_dotenv
from flask import Flask, jsonify, request
from flask_cors import CORS
from flask_socketio import SocketIO

from src.auth import (
    create_token, hash_password, require_auth,
    require_doctor, verify_password,            # require_doctor added
)
from src.config import RESNET50_MODEL_PATH
from src.database import (
    SessionLocal,
    Patient,
    Scan,
    add_clinical_note,       # new
    create_patient,
    create_user,
    delete_patient,
    delete_scan,
    get_all_patients,        # new
    get_doctor_stats,        # new
    get_notes_for_scan,      # new
    get_patient_by_id,
    get_patients,
    get_scan_by_id,
    get_scans,
    get_user_by_email,
    get_user_by_id,
    init_db,
    save_scan,
)
from src.gradcam import generate_gradcam, get_gradcam_heatmap
from src.inference import gradcam_pseudo_segmentation
from src.preprocess import load_image, preprocess_classification
from src.report import generate_report
from src.utils import load_local_model

# ─── Initialisation ───────────────────────────────────────────────────────────

load_dotenv()

app = Flask(__name__)
socketio = SocketIO(
    app,
    cors_allowed_origins="*",
    async_mode="threading",
    logger=False,
    engineio_logger=False,
)
CORS(app, resources={r"/*": {"origins": "*"}}, supports_credentials=True)

CLASS_NAMES = {
    0: "Glioma Tumor",
    1: "Meningioma Tumor",
    2: "No Tumor",
    3: "Pituitary Tumor",
}

DOCTOR_INVITE_CODE = os.environ.get("DOCTOR_INVITE_CODE", "NEURODL-DOCTOR-2026")

classification_model = None
frozen_model         = None     # pre-fine-tuning checkpoint for Grad-CAM comparison
app_initialized      = False


# ─── CORS preflight ───────────────────────────────────────────────────────────

@app.before_request
def handle_options():
    if request.method == "OPTIONS":
        from flask import make_response
        resp = make_response("", 200)
        resp.headers["Access-Control-Allow-Origin"]  = "*"
        resp.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization"
        resp.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, DELETE, OPTIONS"
        return resp


# ─── Startup ──────────────────────────────────────────────────────────────────

def load_models():
    global classification_model, frozen_model
    print("\n" + "=" * 60)
    print("NEURODL v2.0 — STARTUP")
    print("=" * 60)
    print("\n[DB] Initialising PostgreSQL database...")
    init_db()

    print(f"\n[Model] Loading classification model...")
    classification_model = load_local_model(RESNET50_MODEL_PATH)
    print(f"✓ Classification model loaded  ({RESNET50_MODEL_PATH})")

    # Load frozen checkpoint for Grad-CAM comparison (optional)
    frozen_ckpt = "models/checkpoints/ResNet50V2_best.keras"
    if os.path.exists(frozen_ckpt):
        frozen_model = load_local_model(frozen_ckpt)
        print(f"✓ Frozen checkpoint loaded  ({frozen_ckpt})")
    else:
        frozen_model = None
        print(f"⚠ Frozen checkpoint not found at {frozen_ckpt} — compare-gradcam will use single model")

    print("\n" + "=" * 60)
    print("ALL SYSTEMS READY")
    print("=" * 60 + "\n")


@app.before_request
def initialize():
    global app_initialized
    if not app_initialized:
        load_models()
        app_initialized = True


# ─── Socket progress helper ───────────────────────────────────────────────────

def emit_progress(socket_id: str, step: str, status: str,
                  message: str = "", duration: float = None):
    if not socket_id:
        return
    socketio.emit(
        "progress",
        {"step": step, "status": status, "message": message, "duration": duration},
        room=socket_id,
        namespace="/",
    )


# ─── Health Check ─────────────────────────────────────────────────────────────

@app.route("/", methods=["GET"])
def home():
    return jsonify({
        "status":   "online",
        "service":  "NeuroDL Brain Tumor Detection API",
        "version":  "2.0.0",
        "model":    "ResNet50V2",
        "accuracy": "94.92%",
    })


# ─── Auth Routes ──────────────────────────────────────────────────────────────

@app.route("/auth/register", methods=["POST"])
def register():
    data = request.get_json(silent=True)
    if not data:
        return jsonify({"error": "JSON body required"}), 400

    full_name   = data.get("full_name",   "").strip()
    email       = data.get("email",       "").strip()
    password    = data.get("password",    "")
    role        = data.get("role",        "patient")
    doctor_code = data.get("doctor_code", "").strip()

    errors = []
    if not full_name:                       errors.append("Full name is required")
    if not email or "@" not in email:       errors.append("Valid email is required")
    if not password or len(password) < 8:  errors.append("Password must be at least 8 characters")
    if role not in ("patient", "doctor"):  errors.append("Invalid role")
    if role == "doctor" and doctor_code != DOCTOR_INVITE_CODE:
        errors.append("Invalid doctor invite code")
    if errors:
        return jsonify({"error": "Validation failed", "details": errors}), 400

    try:
        hashed = hash_password(password)
        user   = create_user(email=email, password_hash=hashed,
                             full_name=full_name, role=role)
        token  = create_token(user_id=user.id, email=user.email,
                              full_name=user.full_name, role=user.role)
        print(f"[AUTH] Registered — {email} ({role})")
        return jsonify({"token": token, "user": user.to_dict()}), 201
    except ValueError as ve:
        return jsonify({"error": str(ve)}), 409
    except Exception:
        print(f"[AUTH] Register error: {traceback.format_exc()}")
        return jsonify({"error": "Registration failed"}), 500


@app.route("/auth/login", methods=["POST"])
def login():
    data = request.get_json(silent=True)
    if not data:
        return jsonify({"error": "JSON body required"}), 400

    email    = data.get("email",    "").strip()
    password = data.get("password", "")

    if not email or not password:
        return jsonify({"error": "Email and password are required"}), 400

    try:
        user = get_user_by_email(email)
        if not user or not verify_password(password, user.password_hash):
            return jsonify({"error": "Invalid email or password"}), 401

        token = create_token(user_id=user.id, email=user.email,
                             full_name=user.full_name, role=user.role)
        print(f"[AUTH] Login — {email} ({user.role})")
        return jsonify({"token": token, "user": user.to_dict()}), 200
    except Exception:
        print(f"[AUTH] Login error: {traceback.format_exc()}")
        return jsonify({"error": "Login failed"}), 500


@app.route("/auth/me", methods=["GET"])
@require_auth
def me(current_user):
    return jsonify({
        "id":        int(current_user["sub"]),
        "email":     current_user["email"],
        "full_name": current_user["full_name"],
        "role":      current_user.get("role", "patient"),
    }), 200


@app.route("/auth/refresh", methods=["POST"])
@require_auth
def refresh_token(current_user):
    try:
        user = get_user_by_id(int(current_user["sub"]))
        if not user:
            return jsonify({"error": "User not found"}), 404
        new_token = create_token(user.id, user.email, user.full_name, user.role)
        return jsonify({"token": new_token, "user": user.to_dict()}), 200
    except Exception:
        print(f"[Auth] Refresh error:\n{traceback.format_exc()}")
        return jsonify({"error": "Token refresh failed"}), 500


# ─── Patient Routes ───────────────────────────────────────────────────────────

@app.route("/patients", methods=["POST"])
@require_auth
def register_patient(current_user):
    data = request.get_json(silent=True)
    if not data:
        return jsonify({"error": "JSON body required"}), 400

    name   = data.get("name",   "").strip()
    age    = data.get("age")
    gender = data.get("gender", "").strip()

    errors = []
    if not name:    errors.append("name is required")
    if age is None: errors.append("age is required")
    elif not str(age).isdigit() or not (0 < int(age) < 130):
        errors.append("age must be between 1 and 129")
    if not gender: errors.append("gender is required")
    if errors:
        return jsonify({"error": "Validation failed", "details": errors}), 400

    try:
        patient_id = create_patient(
            name=name, age=int(age), gender=gender,
            phone=data.get("phone"), symptoms=data.get("symptoms"),
            user_id=int(current_user["sub"]),
        )
        print(f"[PATIENT] Registered — id={patient_id}, user={current_user['email']}")
        return jsonify({"patient_id": patient_id,
                        "message": f"Patient '{name}' registered successfully"}), 201
    except Exception:
        print(f"[PATIENT] Error: {traceback.format_exc()}")
        return jsonify({"error": "Failed to register patient"}), 500


@app.route("/patients", methods=["GET"])
@require_auth
def list_patients(current_user):
    try:
        result = get_patients(
            page     = max(1, int(request.args.get("page", 1))),
            per_page = max(1, min(int(request.args.get("per_page", 20)), 100)),
            search   = request.args.get("search"),
            user_id  = int(current_user["sub"]),
        )
        return jsonify(result), 200
    except ValueError:
        return jsonify({"error": "Invalid pagination parameters"}), 400
    except Exception:
        return jsonify({"error": "Failed to fetch patients"}), 500


@app.route("/patients/<int:patient_id>", methods=["GET"])
@require_auth
def patient_detail(current_user, patient_id):
    try:
        patient = get_patient_by_id(patient_id)
        if not patient:
            return jsonify({"error": f"Patient {patient_id} not found"}), 404
        if patient.get("user_id") != int(current_user["sub"]):
            return jsonify({"error": "Forbidden"}), 403
        return jsonify(patient), 200
    except Exception:
        return jsonify({"error": "Failed to fetch patient"}), 500


@app.route("/patients/<int:patient_id>", methods=["DELETE"])
@require_auth
def patient_delete(current_user, patient_id):
    try:
        patient = get_patient_by_id(patient_id)
        if not patient:
            return jsonify({"error": f"Patient {patient_id} not found"}), 404
        if patient.get("user_id") != int(current_user["sub"]):
            return jsonify({"error": "Forbidden"}), 403
        delete_patient(patient_id)
        return jsonify({"message": f"Patient {patient_id} deleted"}), 200
    except Exception:
        return jsonify({"error": "Failed to delete patient"}), 500


# ─── Predict Route ────────────────────────────────────────────────────────────

@app.route("/predict", methods=["POST"])
@require_auth
def predict(current_user):
    socket_id = request.form.get("socket_id")

    if "image" not in request.files:
        return jsonify({"error": "No image provided"}), 400

    file = request.files["image"]
    if file.filename == "":
        return jsonify({"error": "Empty filename"}), 400

    raw_pid    = request.form.get("patient_id", "").strip()
    patient_id = int(raw_pid) if raw_pid.isdigit() else None

    print(f"\n{'='*55}")
    print(f"[PREDICT] User      : {current_user['email']}")
    print(f"[PREDICT] File      : {file.filename}")
    print(f"[PREDICT] Patient ID: {patient_id or 'not provided'}")
    print(f"[PREDICT] Socket ID : {socket_id or 'none'}")
    print(f"{'='*55}")

    try:
        # Stage 1: Preprocess
        emit_progress(socket_id, "preprocess", "running")
        t0           = time.time()
        image_np     = load_image(file)
        preprocessed = preprocess_classification(image_np)
        emit_progress(socket_id, "preprocess", "done", duration=round(time.time()-t0, 2))

        # Stage 2: ResNet50V2
        emit_progress(socket_id, "resnet", "running")
        t0              = time.time()
        predictions     = classification_model.predict(preprocessed, verbose=0)
        predicted_class = int(np.argmax(predictions[0]))
        confidence      = float(predictions[0][predicted_class])
        class_name      = CLASS_NAMES.get(predicted_class, "Unknown")
        emit_progress(socket_id, "resnet", "done", duration=round(time.time()-t0, 2))

        class_probabilities = {
            CLASS_NAMES[i]: float(predictions[0][i])
            for i in range(len(predictions[0]))
        }
        print(f"[PREDICT] Result: {class_name}  ({confidence:.2%})")

        response = {
            "final_class":            predicted_class,
            "class_name":             class_name,
            "confidence":             f"{confidence:.2%}",
            "model_used":             "ResNet50V2",
            "model_accuracy":         "94.92%",
            "segmentation_performed": False,
            "gradcam_performed":      False,
            "segment_image":          None,
            "gradcam_image":          None,
            "report":                 None,
            "scan_id":                None,
            "patient_id":             patient_id,
            "class_probabilities":    class_probabilities,
        }

        # Stage 3: Grad-CAM + Segmentation (tumour only)
        if predicted_class != 2:
            print("[PREDICT] Tumour detected — running visual analysis...")
            raw_heatmap = None

            emit_progress(socket_id, "gradcam", "running")
            t0 = time.time()
            try:
                raw_heatmap = get_gradcam_heatmap(
                    model=classification_model, img_array=preprocessed,
                    class_idx=predicted_class,
                )
            except Exception as e:
                print(f"[PREDICT] ✗ Raw heatmap: {e}")

            try:
                gradcam_b64 = generate_gradcam(
                    model=classification_model, img_array=preprocessed,
                    class_idx=predicted_class, original_image=image_np,
                )
                if gradcam_b64:
                    response["gradcam_image"]     = gradcam_b64
                    response["gradcam_performed"] = True
                    print("[PREDICT] ✓ Grad-CAM complete")
            except Exception as e:
                print(f"[PREDICT] ✗ Grad-CAM: {e}")
            emit_progress(socket_id, "gradcam", "done", duration=round(time.time()-t0, 2))

            emit_progress(socket_id, "segmentation", "running")
            t0 = time.time()
            if raw_heatmap is not None:
                try:
                    buf = gradcam_pseudo_segmentation(image=image_np, heatmap=raw_heatmap)
                    buf.seek(0)
                    response["segment_image"]          = base64.b64encode(buf.getvalue()).decode()
                    response["segmentation_performed"] = True
                    print("[PREDICT] ✓ Pseudo-segmentation complete")
                except Exception as e:
                    print(f"[PREDICT] ✗ Segmentation: {e}")
            emit_progress(socket_id, "segmentation", "done", duration=round(time.time()-t0, 2))
        else:
            print("[PREDICT] No tumour — skipping visual analysis")

        # Stage 4: LLM Report
        emit_progress(socket_id, "report", "running")
        t0 = time.time()
        try:
            patient_record = get_patient_by_id(patient_id) if patient_id else None
            report_text    = generate_report(
                class_name             = class_name,
                confidence             = confidence,
                segmentation_performed = response["segmentation_performed"],
                gradcam_performed      = response["gradcam_performed"],
                model_accuracy         = "94.92%",
                patient_id             = patient_id,
                patient_name     = patient_record.get("name")     if patient_record else current_user.get("full_name"),
                patient_age      = patient_record.get("age")      if patient_record else None,
                patient_gender   = patient_record.get("gender")   if patient_record else None,
                patient_symptoms = patient_record.get("symptoms") if patient_record else None,
            )
            response["report"] = report_text
            if report_text:
                print(f"[PREDICT] ✓ Report generated ({len(report_text)} chars)")
        except Exception as e:
            print(f"[PREDICT] ✗ Report: {e}")
        emit_progress(socket_id, "report", "done", duration=round(time.time()-t0, 2))

        # Stage 5: Save to database
        try:
            scan_id = save_scan(
                predicted_class        = class_name,
                confidence_score       = confidence,
                segmentation_performed = response["segmentation_performed"],
                gradcam_performed      = response["gradcam_performed"],
                file_name              = file.filename,
                report_text            = response["report"],
                patient_id             = patient_id,
            )
            response["scan_id"] = scan_id
            print(f"[PREDICT] ✓ Saved — scan_id={scan_id}\n")
        except Exception as e:
            print(f"[PREDICT] ✗ DB save: {e}")

        return jsonify(response), 200

    except ValueError as ve:
        emit_progress(socket_id, "preprocess", "error", message=str(ve))
        return jsonify({"error": "Invalid file", "message": str(ve)}), 400
    except Exception:
        emit_progress(socket_id, "preprocess", "error", message="Unexpected error")
        print(f"[PREDICT] Unexpected error:\n{traceback.format_exc()}")
        return jsonify({"error": "Prediction failed"}), 500


# ─── Grad-CAM Comparison Route ────────────────────────────────────────────────

@app.route("/compare-gradcam", methods=["POST"])
@require_auth
def compare_gradcam(current_user):
    """Frozen vs fine-tuned Grad-CAM for the same image."""
    if "image" not in request.files:
        return jsonify({"error": "No image provided"}), 400

    file = request.files["image"]
    if file.filename == "":
        return jsonify({"error": "Empty filename"}), 400

    try:
        image_np     = load_image(file)
        preprocessed = preprocess_classification(image_np)

        predictions     = classification_model.predict(preprocessed, verbose=0)
        predicted_class = int(np.argmax(predictions[0]))
        confidence      = float(predictions[0][predicted_class])
        class_name      = CLASS_NAMES.get(predicted_class, "Unknown")
        print(f"[COMPARE] Prediction: {class_name} ({confidence:.2%})")

        finetuned_b64 = generate_gradcam(
            model=classification_model, img_array=preprocessed,
            class_idx=predicted_class, original_image=image_np,
        )
        print("[COMPARE] ✓ Fine-tuned Grad-CAM generated")

        frozen_b64       = None
        frozen_available = frozen_model is not None
        if frozen_model is not None:
            try:
                frozen_b64 = generate_gradcam(
                    model=frozen_model, img_array=preprocessed,
                    class_idx=predicted_class, original_image=image_np,
                )
                print("[COMPARE] ✓ Frozen Grad-CAM generated")
            except Exception as e:
                print(f"[COMPARE] ✗ Frozen Grad-CAM failed: {e}")
        else:
            print("[COMPARE] ⚠ Frozen model not loaded")

        return jsonify({
            "frozen":           frozen_b64,
            "finetuned":        finetuned_b64,
            "class_name":       class_name,
            "confidence":       f"{confidence:.2%}",
            "frozen_available": frozen_available,
        }), 200

    except Exception:
        print(f"[COMPARE] Error:\n{traceback.format_exc()}")
        return jsonify({"error": "Comparison failed"}), 500


# ─── Scan History Routes ──────────────────────────────────────────────────────

@app.route("/history", methods=["GET"])
@require_auth
def history(current_user):
    try:
        raw_min_conf   = request.args.get("min_confidence")
        min_confidence = float(raw_min_conf) if raw_min_conf else None
        result = get_scans(
            page           = max(1, int(request.args.get("page",     1))),
            per_page       = max(1, int(request.args.get("per_page", 20))),
            class_name     = request.args.get("class_name"),
            date_from      = request.args.get("date_from"),
            date_to        = request.args.get("date_to"),
            user_id        = int(current_user["sub"]),
            search         = request.args.get("search"),
            min_confidence = min_confidence,
        )
        return jsonify(result), 200
    except ValueError:
        return jsonify({"error": "Invalid parameters"}), 400
    except Exception:
        return jsonify({"error": "Failed to fetch history"}), 500


@app.route("/history/<int:scan_id>", methods=["GET"])
@require_auth
def history_detail(current_user, scan_id):
    try:
        scan = get_scan_by_id(scan_id)
        if not scan:
            return jsonify({"error": f"Scan {scan_id} not found"}), 404
        return jsonify(scan), 200
    except Exception:
        return jsonify({"error": "Failed to fetch scan"}), 500


@app.route("/history/<int:scan_id>", methods=["DELETE"])
@require_auth
def history_delete(current_user, scan_id):
    try:
        deleted = delete_scan(scan_id)
        if not deleted:
            return jsonify({"error": f"Scan {scan_id} not found"}), 404
        return jsonify({"message": f"Scan {scan_id} deleted"}), 200
    except Exception:
        return jsonify({"error": "Failed to delete scan"}), 500


# ─── Stats / Analytics ────────────────────────────────────────────────────────

@app.route("/stats", methods=["GET"])
@require_auth
def stats(current_user):
    try:
        from collections import defaultdict
        from datetime import datetime, timedelta

        db      = SessionLocal()
        user_id = int(current_user["sub"])

        scans = (
            db.query(Scan)
            .join(Patient, Scan.patient_id == Patient.id, isouter=True)
            .filter((Patient.user_id == user_id) | (Scan.patient_id == None))
            .all()
        )
        db.close()

        total = len(scans)
        if total == 0:
            return jsonify({
                "total": 0, "class_distribution": {},
                "avg_confidence": {}, "overall_avg_confidence": 0,
                "scans_per_day": [],
                "feature_usage": {"segmentation": 0, "gradcam": 0, "report": 0},
            }), 200

        class_counts = defaultdict(int)
        class_conf   = defaultdict(list)
        for s in scans:
            class_counts[s.predicted_class] += 1
            class_conf[s.predicted_class].append(s.confidence_score)

        avg_confidence = {
            cls: round(sum(v)/len(v), 4) for cls, v in class_conf.items()
        }

        today   = datetime.utcnow().date()
        day_map = defaultdict(int)
        for s in scans:
            if s.scan_timestamp:
                d = s.scan_timestamp.date()
                if d >= today - timedelta(days=29):
                    day_map[d.isoformat()] += 1

        scans_per_day = [
            {"date":  (today - timedelta(days=i)).isoformat(),
             "count": day_map.get((today - timedelta(days=i)).isoformat(), 0)}
            for i in range(29, -1, -1)
        ]

        all_conf    = [s.confidence_score for s in scans]
        overall_avg = round(sum(all_conf) / len(all_conf), 4)

        return jsonify({
            "total":                  total,
            "class_distribution":     dict(class_counts),
            "avg_confidence":         avg_confidence,
            "overall_avg_confidence": overall_avg,
            "scans_per_day":          scans_per_day,
            "feature_usage": {
                "segmentation": sum(1 for s in scans if s.segmentation_performed),
                "gradcam":      sum(1 for s in scans if s.gradcam_performed),
                "report":       sum(1 for s in scans if s.report_text),
            },
        }), 200

    except Exception:
        print("[STATS] Error: " + traceback.format_exc())
        return jsonify({"error": "Failed to fetch stats"}), 500


# ─── Model Performance Route (public) ────────────────────────────────────────

@app.route("/model-performance", methods=["GET"])
def model_performance():
    """Serve pre-computed evaluation metrics. Run evaluate_models.py first."""
    json_path = "training_outputs/evaluation/model_performance.json"
    if not os.path.exists(json_path):
        return jsonify({
            "error":     "Model performance data not yet computed",
            "message":   "Run evaluate_models.py to generate this data",
            "available": False,
        }), 404
    try:
        with open(json_path, "r") as f:
            data = _json.load(f)
        data["available"] = True
        return jsonify(data), 200
    except Exception:
        print(f"[PERF] Error reading JSON:\n{traceback.format_exc()}")
        return jsonify({"error": "Failed to read performance data"}), 500


# ─── Doctor Routes ────────────────────────────────────────────────────────────

@app.route("/doctor/stats", methods=["GET"])
@require_auth
@require_doctor
def doctor_stats(current_user):
    try:
        return jsonify(get_doctor_stats()), 200
    except Exception:
        return jsonify({"error": "Failed to fetch stats"}), 500


@app.route("/doctor/patients", methods=["GET"])
@require_auth
@require_doctor
def doctor_patients(current_user):
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
    try:
        patient = get_patient_by_id(patient_id)
        if not patient:
            return jsonify({"error": f"Patient {patient_id} not found"}), 404
        if patient.get("scan") and patient["scan"].get("id"):
            patient["scan"]["notes"] = get_notes_for_scan(patient["scan"]["id"])
        return jsonify(patient), 200
    except Exception:
        return jsonify({"error": "Failed to fetch patient"}), 500


@app.route("/doctor/scans/<int:scan_id>/notes", methods=["GET"])
@require_auth
@require_doctor
def doctor_get_notes(current_user, scan_id):
    try:
        return jsonify({"notes": get_notes_for_scan(scan_id)}), 200
    except Exception:
        return jsonify({"error": "Failed to fetch notes"}), 500


@app.route("/doctor/scans/<int:scan_id>/notes", methods=["POST"])
@require_auth
@require_doctor
def doctor_add_note(current_user, scan_id):
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


# ─── Error Handlers ───────────────────────────────────────────────────────────

@app.errorhandler(404)
def not_found(e):
    return jsonify({"error": "Endpoint not found"}), 404

@app.errorhandler(413)
def too_large(e):
    return jsonify({"error": "File too large", "message": "Max 16MB"}), 413

@app.errorhandler(500)
def server_error(e):
    return jsonify({"error": "Internal server error"}), 500


# ─── Entry Point ──────────────────────────────────────────────────────────────

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5001))
    print(f"\n NeuroDL v2.0  |  port={port}  |  PostgreSQL  |  JWT auth  |  SocketIO\n")
    socketio.run(app, debug=True, port=port, allow_unsafe_werkzeug=True)