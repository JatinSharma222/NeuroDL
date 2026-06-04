"""
app.py
──────
NeuroDL v2.0 — Flask API with JWT authentication.

Public endpoints:
  GET  /                     — health check
  POST /auth/register        — create account
  POST /auth/login           — get JWT token
  GET  /auth/me              — get current user (requires auth)

Protected endpoints (require Authorization: Bearer <token>):
  POST   /patients           — register patient profile
  GET    /patients           — list own patients
  GET    /patients/<id>      — single patient + scan
  DELETE /patients/<id>      — delete patient
  POST   /predict            — MRI analysis
  GET    /history            — own scan history
  GET    /history/<id>       — single scan
  DELETE /history/<id>       — delete scan
"""

import base64
import os
import traceback
from io import BytesIO

import numpy as np
from dotenv import load_dotenv
from flask import Flask, jsonify, request
from flask_cors import CORS

from src.auth import create_token, hash_password, require_auth, verify_password
from src.config import RESNET50_MODEL_PATH
from src.database import (
    create_patient,
    create_user,
    delete_patient,
    delete_scan,
    get_patient_by_id,
    get_patients,
    get_scan_by_id,
    get_scans,
    get_user_by_email,
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
CORS(app, resources={r"/*": {"origins": "*"}})

CLASS_NAMES = {
    0: "Glioma Tumor",
    1: "Meningioma Tumor",
    2: "No Tumor",
    3: "Pituitary Tumor",
}

classification_model = None
app_initialized      = False


# ─── Startup ──────────────────────────────────────────────────────────────────

def load_models():
    global classification_model
    print("\n" + "=" * 60)
    print("NEURODL v2.0 — STARTUP")
    print("=" * 60)
    print("\n[DB] Initialising PostgreSQL database...")
    init_db()
    print(f"\n[Model] Loading classification model...")
    classification_model = load_local_model(RESNET50_MODEL_PATH)
    print(f"✓ Classification model loaded  ({RESNET50_MODEL_PATH})")
    print("\n" + "=" * 60)
    print("ALL SYSTEMS READY")
    print("=" * 60 + "\n")


@app.before_request
def initialize():
    global app_initialized
    if not app_initialized:
        load_models()
        app_initialized = True


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

    full_name = data.get("full_name", "").strip()
    email     = data.get("email",     "").strip()
    password  = data.get("password",  "")

    errors = []
    if not full_name:
        errors.append("Full name is required")
    if not email or "@" not in email:
        errors.append("Valid email is required")
    if not password or len(password) < 8:
        errors.append("Password must be at least 8 characters")
    if errors:
        return jsonify({"error": "Validation failed", "details": errors}), 400

    try:
        hashed = hash_password(password)
        user   = create_user(
            email         = email,
            password_hash = hashed,
            full_name     = full_name,
        )
        token = create_token(
            user_id   = user.id,
            email     = user.email,
            full_name = user.full_name,
        )
        print(f"[AUTH] Registered — {email}")
        return jsonify({
            "token": token,
            "user":  user.to_dict(),
        }), 201

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

        token = create_token(
            user_id   = user.id,
            email     = user.email,
            full_name = user.full_name,
        )
        print(f"[AUTH] Login — {email}")
        return jsonify({
            "token": token,
            "user":  user.to_dict(),
        }), 200

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
    }), 200


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
    if not name:
        errors.append("name is required")
    if age is None:
        errors.append("age is required")
    elif not str(age).isdigit() or not (0 < int(age) < 130):
        errors.append("age must be between 1 and 129")
    if not gender:
        errors.append("gender is required")
    if errors:
        return jsonify({"error": "Validation failed", "details": errors}), 400

    try:
        patient_id = create_patient(
            name     = name,
            age      = int(age),
            gender   = gender,
            phone    = data.get("phone"),
            symptoms = data.get("symptoms"),
            user_id  = int(current_user["sub"]),   # ← sub is now string, cast to int
        )
        print(f"[PATIENT] Registered — id={patient_id}, user={current_user['email']}")
        return jsonify({
            "patient_id": patient_id,
            "message":    f"Patient '{name}' registered successfully",
        }), 201
    except Exception:
        print(f"[PATIENT] Error: {traceback.format_exc()}")
        return jsonify({"error": "Failed to register patient"}), 500


@app.route("/patients", methods=["GET"])
@require_auth
def list_patients(current_user):
    try:
        page     = max(1, int(request.args.get("page",     1)))
        per_page = max(1, min(int(request.args.get("per_page", 20)), 100))
        search   = request.args.get("search")
        result   = get_patients(
            page     = page,
            per_page = per_page,
            search   = search,
            user_id  = int(current_user["sub"]),   # ← cast to int
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
        if patient.get("user_id") != int(current_user["sub"]):   # ← cast to int
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
        if patient.get("user_id") != int(current_user["sub"]):   # ← cast to int
            return jsonify({"error": "Forbidden"}), 403
        delete_patient(patient_id)
        return jsonify({"message": f"Patient {patient_id} deleted"}), 200
    except Exception:
        return jsonify({"error": "Failed to delete patient"}), 500


# ─── Predict Route ────────────────────────────────────────────────────────────

@app.route("/predict", methods=["POST"])
@require_auth
def predict(current_user):
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
    print(f"{'='*55}")

    try:
        # ── Step 1: Load + classify ───────────────────────────────
        image_np     = load_image(file)
        preprocessed = preprocess_classification(image_np)

        predictions     = classification_model.predict(preprocessed, verbose=0)
        predicted_class = int(np.argmax(predictions[0]))
        confidence      = float(predictions[0][predicted_class])
        class_name      = CLASS_NAMES.get(predicted_class, "Unknown")

        # Full softmax distribution across all 4 classes
        class_probabilities = {
            CLASS_NAMES[i]: float(predictions[0][i])
            for i in range(len(predictions[0]))
        }

        # ── MC Dropout uncertainty (T=20 stochastic forward passes) ──
        MC_SAMPLES = 20
        try:
            mc_preds = np.array([
                classification_model(preprocessed, training=True).numpy()
                for _ in range(MC_SAMPLES)
            ])                           # (T, 1, 4)
            mc_preds = mc_preds[:, 0, :] # (T, 4)
            mc_mean  = mc_preds.mean(axis=0)
            mc_std   = mc_preds.std(axis=0)
            eps      = 1e-8
            entropy  = float(-np.sum(mc_mean * np.log(mc_mean + eps)))
            pred_std = float(mc_std[predicted_class])
            is_uncertain = bool(pred_std > 0.08)
            uncertainty = {
                "mc_samples":   MC_SAMPLES,
                "pred_std":     round(pred_std, 4),
                "pred_entropy": round(entropy, 4),
                "is_uncertain": is_uncertain,
                "class_std":  {CLASS_NAMES[i]: round(float(mc_std[i]),  4) for i in range(len(mc_std))},
                "class_mean": {CLASS_NAMES[i]: round(float(mc_mean[i]), 4) for i in range(len(mc_mean))},
            }
            print(f"[PREDICT] MC Dropout — pred_std={pred_std:.4f}, entropy={entropy:.4f}, uncertain={is_uncertain}")
        except Exception as mc_err:
            print(f"[PREDICT] MC Dropout skipped: {mc_err}")
            uncertainty = None

        print(f"[PREDICT] Result: {class_name}  ({confidence:.2%})")
        print(f"[PREDICT] Probs : { {k: f'{v:.3f}' for k, v in class_probabilities.items()} }")

        response = {
            "final_class":             predicted_class,
            "class_name":              class_name,
            "confidence":              f"{confidence:.2%}",
            "class_probabilities":     class_probabilities,
            "uncertainty":             uncertainty,
            "model_used":              "ResNet50V2",
            "model_accuracy":          "94.92%",
            "segmentation_performed":  False,
            "gradcam_performed":       False,
            "segment_image":           None,
            "gradcam_image":           None,
            "report":                  None,
            "scan_id":                 None,
            "patient_id":              patient_id,
        }

        # ── Step 2: Visual analysis (tumour only) ─────────────────
        if predicted_class != 2:
            print("[PREDICT] Tumour detected — running visual analysis...")

            raw_heatmap = None
            try:
                raw_heatmap = get_gradcam_heatmap(
                    model     = classification_model,
                    img_array = preprocessed,
                    class_idx = predicted_class,
                )
            except Exception as e:
                print(f"[PREDICT] ✗ Raw heatmap: {e}")

            try:
                gradcam_b64 = generate_gradcam(
                    model          = classification_model,
                    img_array      = preprocessed,
                    class_idx      = predicted_class,
                    original_image = image_np,
                )
                if gradcam_b64:
                    response["gradcam_image"]     = gradcam_b64
                    response["gradcam_performed"] = True
                    print("[PREDICT] ✓ Grad-CAM complete")
            except Exception as e:
                print(f"[PREDICT] ✗ Grad-CAM: {e}")

            if raw_heatmap is not None:
                try:
                    buf = gradcam_pseudo_segmentation(
                        image   = image_np,
                        heatmap = raw_heatmap,
                    )
                    buf.seek(0)
                    response["segment_image"]          = base64.b64encode(buf.getvalue()).decode()
                    response["segmentation_performed"] = True
                    print("[PREDICT] ✓ Pseudo-segmentation complete")
                except Exception as e:
                    print(f"[PREDICT] ✗ Segmentation: {e}")
        else:
            print("[PREDICT] No tumour — skipping visual analysis")

        # ── Step 3: LLM Report ────────────────────────────────────
        try:
            patient_record = get_patient_by_id(patient_id) if patient_id else None
            report_text    = generate_report(
                class_name             = class_name,
                confidence             = confidence,
                segmentation_performed = response["segmentation_performed"],
                gradcam_performed      = response["gradcam_performed"],
                model_accuracy         = "94.92%",
                patient_id             = patient_id,
                patient_name           = patient_record.get("name")     if patient_record else current_user.get("full_name"),
                patient_age            = patient_record.get("age")      if patient_record else None,
                patient_gender         = patient_record.get("gender")   if patient_record else None,
                patient_symptoms       = patient_record.get("symptoms") if patient_record else None,
            )
            response["report"] = report_text
            if report_text:
                print(f"[PREDICT] ✓ Report generated ({len(report_text)} chars)")
        except Exception as e:
            print(f"[PREDICT] ✗ Report: {e}")

        # ── Step 4: Save to database ──────────────────────────────
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
        return jsonify({"error": "Invalid file", "message": str(ve)}), 400
    except Exception:
        print(f"[PREDICT] Unexpected error:\n{traceback.format_exc()}")
        return jsonify({"error": "Prediction failed"}), 500


# ─── Scan History Routes ──────────────────────────────────────────────────────

@app.route("/history", methods=["GET"])
@require_auth
def history(current_user):
    try:
        result = get_scans(
            page       = max(1, int(request.args.get("page",     1))),
            per_page   = max(1, min(int(request.args.get("per_page", 20)), 100)),
            class_name = request.args.get("class_name"),
            date_from  = request.args.get("date_from"),
            date_to    = request.args.get("date_to"),
            user_id    = int(current_user["sub"]),   # ← cast to int
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
    print(f"\n NeuroDL v2.0  |  port={port}  |  PostgreSQL  |  JWT auth\n")
    app.run(host="0.0.0.0", port=port, debug=False)