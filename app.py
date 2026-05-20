"""
app.py
──────
NeuroDL v2.0 — Flask API entry point.

Endpoints:
  GET  /                   — health check
  POST /patients           — register a new patient
  GET  /patients           — list all patients (paginated)
  GET  /patients/<id>      — single patient + their scan
  DELETE /patients/<id>    — delete patient and their scan
  POST /predict            — MRI analysis (JPEG / PNG / DICOM)
  GET  /history            — paginated scan history with filters
  GET  /history/<id>       — single scan record
  DELETE /history/<id>     — delete a scan record
"""

import base64
import os
from io import BytesIO

import numpy as np
from dotenv import load_dotenv
from flask import Flask, jsonify, request
from flask_cors import CORS
from PIL import Image

from src.config import RESNET50_MODEL_PATH
from src.database import (
    create_patient,
    delete_patient,
    delete_scan,
    get_patient_by_id,
    get_patients,
    get_scan_by_id,
    get_scans,
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
CORS(app)

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
    print("\n[DB] Initialising database...")
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


# ─── Patient Routes ───────────────────────────────────────────────────────────

@app.route("/patients", methods=["POST"])
def register_patient():
    """
    Register a new patient before MRI analysis.

    Accepts JSON:
      name     (required) : Full name
      age      (required) : Age in years
      gender   (required) : Male / Female / Other
      phone    (optional) : Contact number
      symptoms (optional) : Free-text symptom description

    Returns:
      { patient_id, message }
    """
    data = request.get_json(silent=True)
    if not data:
        return jsonify({"error": "JSON body required"}), 400

    name    = data.get("name",   "").strip()
    age     = data.get("age")
    gender  = data.get("gender", "").strip()

    # Validation
    errors = []
    if not name:
        errors.append("name is required")
    if age is None:
        errors.append("age is required")
    elif not str(age).isdigit() or not (0 < int(age) < 130):
        errors.append("age must be a valid number between 1 and 129")
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
        )
        print(f"[PATIENT] Registered — id={patient_id}, name='{name}'")
        return jsonify({
            "patient_id": patient_id,
            "message":    f"Patient '{name}' registered successfully",
        }), 201

    except Exception as e:
        print(f"[PATIENT] Registration error: {e}")
        return jsonify({"error": "Failed to register patient"}), 500


@app.route("/patients", methods=["GET"])
def list_patients():
    """
    Return paginated patient list with their linked scan.

    Query params:
      page     (int,    default 1)
      per_page (int,    default 20)
      search   (string, optional)  — partial name match
    """
    try:
        page     = max(1, int(request.args.get("page",     1)))
        per_page = max(1, min(int(request.args.get("per_page", 20)), 100))
        search   = request.args.get("search")

        result = get_patients(page=page, per_page=per_page, search=search)
        return jsonify(result), 200

    except ValueError:
        return jsonify({"error": "Invalid pagination parameters"}), 400
    except Exception as e:
        print(f"[PATIENT] List error: {e}")
        return jsonify({"error": "Failed to fetch patients"}), 500


@app.route("/patients/<int:patient_id>", methods=["GET"])
def patient_detail(patient_id):
    """Return a single patient record (includes their scan if analysed)."""
    try:
        patient = get_patient_by_id(patient_id)
        if not patient:
            return jsonify({"error": f"Patient {patient_id} not found"}), 404
        return jsonify(patient), 200
    except Exception as e:
        print(f"[PATIENT] Detail error: {e}")
        return jsonify({"error": "Failed to fetch patient"}), 500


@app.route("/patients/<int:patient_id>", methods=["DELETE"])
def patient_delete(patient_id):
    """Delete a patient and their linked scan."""
    try:
        deleted = delete_patient(patient_id)
        if not deleted:
            return jsonify({"error": f"Patient {patient_id} not found"}), 404
        return jsonify({"message": f"Patient {patient_id} deleted"}), 200
    except Exception as e:
        print(f"[PATIENT] Delete error: {e}")
        return jsonify({"error": "Failed to delete patient"}), 500


# ─── Predict Route ────────────────────────────────────────────────────────────

@app.route("/predict", methods=["POST"])
def predict():
    """
    Main prediction endpoint.

    Accepts multipart/form-data:
      image      (required) : JPEG, PNG, or DICOM .dcm
      patient_id (optional) : integer patient ID from /patients POST

    Returns JSON with classification, visual analysis, report, and scan_id.
    """
    if "image" not in request.files:
        return jsonify({
            "error":   "No image provided",
            "message": "Please upload a file with field name 'image'",
        }), 400

    file = request.files["image"]
    if file.filename == "":
        return jsonify({"error": "Empty filename"}), 400

    # patient_id is now an integer FK, not a free string
    raw_pid    = request.form.get("patient_id", "").strip()
    patient_id = int(raw_pid) if raw_pid.isdigit() else None

    print(f"\n{'='*50}")
    print(f"[PREDICT] File       : {file.filename}")
    print(f"[PREDICT] Patient ID : {patient_id or 'not provided'}")
    print(f"{'='*50}")

    try:
        # ── Step 1: Load image ────────────────────────────────────
        image_np = load_image(file)

        # ── Step 2: Classify ──────────────────────────────────────
        preprocessed    = preprocess_classification(image_np)
        predictions     = classification_model.predict(preprocessed, verbose=0)
        predicted_class = int(np.argmax(predictions[0]))
        confidence      = float(predictions[0][predicted_class])
        class_name      = CLASS_NAMES.get(predicted_class, "Unknown")

        print(f"[PREDICT] Result     : {class_name}  ({confidence:.2%})")

        response = {
            "final_class":             predicted_class,
            "class_name":              class_name,
            "confidence":              f"{confidence:.2%}",
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

        # ── Step 3: Visual analysis (tumour only) ─────────────────
        if predicted_class != 2:
            print("[PREDICT] Tumour detected — running visual analysis...")

            raw_heatmap = None
            try:
                raw_heatmap = get_gradcam_heatmap(
                    model     = classification_model,
                    img_array = preprocessed,
                    class_idx = predicted_class,
                )
            except Exception as hm_err:
                print(f"[PREDICT] ✗ Raw heatmap failed: {hm_err}")

            # Grad-CAM overlay
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
            except Exception as gcam_err:
                print(f"[PREDICT] ✗ Grad-CAM failed: {gcam_err}")

            # Pseudo-segmentation
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
                except Exception as seg_err:
                    print(f"[PREDICT] ✗ Pseudo-segmentation failed: {seg_err}")
        else:
            print("[PREDICT] No tumour — skipping visual analysis")

        # ── Step 4: LLM Report ────────────────────────────────────
        try:
            report_text = generate_report(
                class_name             = class_name,
                confidence             = confidence,
                segmentation_performed = response["segmentation_performed"],
                gradcam_performed      = response["gradcam_performed"],
                model_accuracy         = "94.92%",
                patient_id             = str(patient_id) if patient_id else None,
            )
            response["report"] = report_text
            if report_text:
                print("[PREDICT] ✓ Report generated")
        except Exception as rep_err:
            print(f"[PREDICT] ✗ Report failed: {rep_err}")

        # ── Step 5: Save scan to database ─────────────────────────
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
            print(f"[PREDICT] ✓ Saved — scan_id={scan_id}")
        except Exception as db_err:
            print(f"[PREDICT] ✗ DB save failed: {db_err}")

        print(f"[PREDICT] Complete\n")
        return jsonify(response), 200

    except ValueError as ve:
        print(f"[PREDICT] Bad file: {ve}")
        return jsonify({"error": "Invalid file", "message": str(ve)}), 400

    except Exception as e:
        import traceback
        print(f"[PREDICT] Unexpected error:\n{traceback.format_exc()}")
        return jsonify({"error": "Prediction failed", "message": str(e)}), 500


# ─── Scan History Routes ──────────────────────────────────────────────────────

@app.route("/history", methods=["GET"])
def history():
    try:
        page       = int(request.args.get("page",     1))
        per_page   = int(request.args.get("per_page", 20))
        class_name = request.args.get("class_name")
        date_from  = request.args.get("date_from")
        date_to    = request.args.get("date_to")

        result = get_scans(
            page       = max(1, page),
            per_page   = max(1, min(per_page, 100)),
            class_name = class_name,
            date_from  = date_from,
            date_to    = date_to,
        )
        return jsonify(result), 200

    except ValueError:
        return jsonify({"error": "Invalid pagination parameters"}), 400
    except Exception as e:
        print(f"[HISTORY] Error: {e}")
        return jsonify({"error": "Failed to fetch history"}), 500


@app.route("/history/<int:scan_id>", methods=["GET"])
def history_detail(scan_id):
    try:
        scan = get_scan_by_id(scan_id)
        if not scan:
            return jsonify({"error": f"Scan {scan_id} not found"}), 404
        return jsonify(scan), 200
    except Exception as e:
        print(f"[HISTORY] Detail error: {e}")
        return jsonify({"error": "Failed to fetch scan"}), 500


@app.route("/history/<int:scan_id>", methods=["DELETE"])
def history_delete(scan_id):
    try:
        deleted = delete_scan(scan_id)
        if not deleted:
            return jsonify({"error": f"Scan {scan_id} not found"}), 404
        return jsonify({"message": f"Scan {scan_id} deleted"}), 200
    except Exception as e:
        print(f"[HISTORY] Delete error: {e}")
        return jsonify({"error": "Failed to delete scan"}), 500


# ─── Error Handlers ───────────────────────────────────────────────────────────

@app.errorhandler(404)
def not_found(error):
    return jsonify({"error": "Endpoint not found"}), 404


@app.errorhandler(413)
def file_too_large(error):
    return jsonify({"error": "File too large", "message": "Max upload size is 16MB"}), 413


@app.errorhandler(500)
def internal_error(error):
    return jsonify({"error": "Internal server error"}), 500


# ─── Entry Point ──────────────────────────────────────────────────────────────

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5001))

    print("\n" + "=" * 60)
    print("NEURODL v2.0 API SERVER")
    print("=" * 60)
    print(f"  Port        : {port}")
    print(f"  Model       : ResNet50V2 (94.92% accuracy)")
    print(f"  Ollama URL  : {os.environ.get('OLLAMA_URL', 'http://localhost:11434')}")
    print(f"  Ollama Model: {os.environ.get('OLLAMA_MODEL', 'llama3.1:8b')}")
    print(f"  Database    : neurodl.db (SQLite)")
    print("=" * 60 + "\n")

    app.run(host="0.0.0.0", port=port, debug=False)