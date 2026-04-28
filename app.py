"""
app.py
──────
NeuroDL v2.0 — Flask API entry point.

Upgrades wired in vs v1.0:
  [1] Grad-CAM heatmap generation        (src/gradcam.py)
  [2] DICOM file format support          (src/preprocess.py)
  [3] LLM radiology report via Ollama   (src/report.py)
  [4] Patient scan history — SQLite DB   (src/database.py)

Endpoints:
  GET  /          — health check
  POST /predict   — MRI analysis (JPEG / PNG / DICOM)
  GET  /history   — paginated scan history with filters
  GET  /history/<id> — single scan record
  DELETE /history/<id> — delete a scan record
"""

import base64
import os
from io import BytesIO

import numpy as np
from dotenv import load_dotenv
from flask import Flask, jsonify, request
from flask_cors import CORS
from PIL import Image

from src.config import RESNET50_MODEL_PATH, SEGMENTATION_MODEL_PATH
from src.database import delete_scan, get_scan_by_id, get_scans, init_db, save_scan
from src.gradcam import generate_gradcam
from src.inference import inference_segmentation_with_overlay
from src.preprocess import load_image, preprocess_classification
from src.report import generate_report
from src.utils import load_local_model

# ─── Initialisation ───────────────────────────────────────────────────────────

load_dotenv()  # Load .env file (OLLAMA_URL, OLLAMA_MODEL, etc.)

app = Flask(__name__)
CORS(app)

# ── Class mapping ─────────────────────────────────────────────────
CLASS_NAMES = {
    0: "Glioma Tumor",
    1: "Meningioma Tumor",
    2: "No Tumor",
    3: "Pituitary Tumor",
}

# ── Global model handles ──────────────────────────────────────────
classification_model = None
segmentation_model   = None
app_initialized      = False


# ─── Startup ──────────────────────────────────────────────────────────────────

def load_models():
    """Load ML models and initialise DB — runs once before first request."""
    global classification_model, segmentation_model

    print("\n" + "=" * 60)
    print("NEURODL v2.0 — STARTUP")
    print("=" * 60)

    # Database
    print("\n[DB] Initialising database...")
    init_db()

    # Classification model
    print(f"\n[Model] Loading classification model...")
    classification_model = load_local_model(RESNET50_MODEL_PATH)
    print(f"✓ Classification model loaded  ({RESNET50_MODEL_PATH})")

    # Segmentation model
    print(f"\n[Model] Loading segmentation model...")
    segmentation_model = load_local_model(SEGMENTATION_MODEL_PATH, custom_loss=True)
    print(f"✓ Segmentation model loaded   ({SEGMENTATION_MODEL_PATH})")

    print("\n" + "=" * 60)
    print("ALL SYSTEMS READY")
    print("=" * 60 + "\n")


@app.before_request
def initialize():
    """Lazy initialisation — load models before the very first request."""
    global app_initialized
    if not app_initialized:
        load_models()
        app_initialized = True


# ─── Routes ───────────────────────────────────────────────────────────────────

@app.route("/", methods=["GET"])
def home():
    """Health check — returns service metadata."""
    return jsonify({
        "status":   "online",
        "service":  "NeuroDL Brain Tumor Detection API",
        "version":  "2.0.0",
        "model":    "ResNet50V2",
        "accuracy": "84.13%",
        "upgrades": [
            "Grad-CAM heatmap",
            "DICOM support",
            "LLM radiology report (Ollama)",
            "Scan history (SQLite)",
        ],
    })


# ── POST /predict ─────────────────────────────────────────────────

@app.route("/predict", methods=["POST"])
def predict():
    """
    Main prediction endpoint.

    Accepts multipart/form-data with:
      image      (required) : JPEG, PNG, or DICOM .dcm file
      patient_id (optional) : string identifier for the patient

    Returns JSON with:
      final_class, class_name, confidence, model_used, model_accuracy,
      segmentation_performed, segment_image (base64),
      gradcam_performed, gradcam_image (base64),
      report, scan_id
    """
    # ── Validate request ──────────────────────────────────────────
    if "image" not in request.files:
        return jsonify({
            "error":   "No image provided",
            "message": "Please upload a file with field name 'image'",
        }), 400

    file = request.files["image"]
    if file.filename == "":
        return jsonify({"error": "Empty filename"}), 400

    patient_id = request.form.get("patient_id", "").strip() or None

    print(f"\n{'='*50}")
    print(f"[PREDICT] File     : {file.filename}")
    print(f"[PREDICT] Patient  : {patient_id or 'not provided'}")
    print(f"{'='*50}")

    try:
        # ── Step 1: Load image (JPEG / PNG / DICOM) ───────────────
        image_np = load_image(file)               # (H, W, 3) uint8

        # ── Step 2: Classify ──────────────────────────────────────
        preprocessed     = preprocess_classification(image_np)
        predictions      = classification_model.predict(preprocessed, verbose=0)
        predicted_class  = int(np.argmax(predictions[0]))
        confidence       = float(predictions[0][predicted_class])
        class_name       = CLASS_NAMES.get(predicted_class, "Unknown")

        print(f"[PREDICT] Result   : {class_name}  ({confidence:.2%})")

        # ── Build base response ───────────────────────────────────
        response = {
            "final_class":             predicted_class,
            "class_name":              class_name,
            "confidence":              f"{confidence:.2%}",
            "model_used":              "ResNet50V2",
            "model_accuracy":          "84.13%",
            "segmentation_performed":  False,
            "gradcam_performed":       False,
            "segment_image":           None,
            "gradcam_image":           None,
            "report":                  None,
            "scan_id":                 None,
        }

        # ── Step 3: Segmentation + Grad-CAM (tumour only) ─────────
        if predicted_class != 2:   # class 2 = No Tumor
            print("[PREDICT] Tumour detected — running segmentation + Grad-CAM...")

            # Segmentation
            try:
                overlay_pil = inference_segmentation_with_overlay(
                    image_np, segmentation_model
                )
                buf = BytesIO()
                overlay_pil.save(buf, format="JPEG", quality=95)
                buf.seek(0)
                response["segment_image"]          = base64.b64encode(buf.getvalue()).decode()
                response["segmentation_performed"] = True
                print("[PREDICT] ✓ Segmentation complete")
            except Exception as seg_err:
                print(f"[PREDICT] ✗ Segmentation failed: {seg_err}")

            # Grad-CAM
            try:
                gradcam_b64 = generate_gradcam(
                    model     = classification_model,
                    img_array = preprocessed,          # (1, 128, 128, 3)
                    class_idx = predicted_class,
                )
                if gradcam_b64:
                    response["gradcam_image"]    = gradcam_b64
                    response["gradcam_performed"] = True
                    print("[PREDICT] ✓ Grad-CAM complete")
            except Exception as gcam_err:
                print(f"[PREDICT] ✗ Grad-CAM failed: {gcam_err}")

        else:
            print("[PREDICT] No tumour — skipping segmentation & Grad-CAM")

        # ── Step 4: LLM Report ────────────────────────────────────
        print("[PREDICT] Generating radiology report...")
        try:
            report_text = generate_report(
                class_name             = class_name,
                confidence             = confidence,
                segmentation_performed = response["segmentation_performed"],
                gradcam_performed      = response["gradcam_performed"],
                model_accuracy         = "84.13%",
                patient_id             = patient_id,
            )
            response["report"] = report_text
            if report_text:
                print("[PREDICT] ✓ Report generated")
            else:
                print("[PREDICT] ⚠ Report skipped (Ollama unavailable)")
        except Exception as rep_err:
            print(f"[PREDICT] ✗ Report failed: {rep_err}")

        # ── Step 5: Save to database ──────────────────────────────
        print("[PREDICT] Saving scan to database...")
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
        # Raised by load_image() for bad/corrupt files
        print(f"[PREDICT] Bad file: {ve}")
        return jsonify({
            "error":   "Invalid file",
            "message": str(ve),
        }), 400

    except Exception as e:
        import traceback
        print(f"[PREDICT] Unexpected error:\n{traceback.format_exc()}")
        return jsonify({
            "error":   "Prediction failed",
            "message": str(e),
        }), 500


# ── GET /history ──────────────────────────────────────────────────

@app.route("/history", methods=["GET"])
def history():
    """
    Return paginated scan history with optional filters.

    Query parameters:
      page       (int,    default 1)  : Page number
      per_page   (int,    default 20) : Records per page (max 100)
      class_name (string, optional)   : Filter by class name (partial match)
      date_from  (string, optional)   : Filter from date YYYY-MM-DD
      date_to    (string, optional)   : Filter to date YYYY-MM-DD
    """
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


# ── GET /history/<id> ─────────────────────────────────────────────

@app.route("/history/<int:scan_id>", methods=["GET"])
def history_detail(scan_id):
    """Return a single scan record by ID."""
    try:
        scan = get_scan_by_id(scan_id)
        if not scan:
            return jsonify({"error": f"Scan {scan_id} not found"}), 404
        return jsonify(scan), 200
    except Exception as e:
        print(f"[HISTORY] Detail error: {e}")
        return jsonify({"error": "Failed to fetch scan"}), 500


# ── DELETE /history/<id> ──────────────────────────────────────────

@app.route("/history/<int:scan_id>", methods=["DELETE"])
def history_delete(scan_id):
    """Delete a scan record by ID."""
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
    print(f"  Model       : ResNet50V2 (84.13% accuracy)")
    print(f"  Ollama URL  : {os.environ.get('OLLAMA_URL', 'http://localhost:11434')}")
    print(f"  Ollama Model: {os.environ.get('OLLAMA_MODEL', 'llama3.1:8b')}")
    print(f"  Database    : neurodl.db (SQLite)")
    print("=" * 60 + "\n")

    app.run(host="0.0.0.0", port=port, debug=False)