"""
gradcam_compare_patch.py
─────────────────────────
Add this endpoint to app.py.

Requires:
  models/checkpoints/ResNet50V2_best.keras   ← frozen backbone checkpoint
                                               (saved by train_all_models.py)
  models/ResNet50V2.keras                    ← fine-tuned model
                                               (saved by finetune_resnet.py)

STEP 1 — Add to load_models() in app.py, after loading classification_model:

    global frozen_model
    frozen_ckpt = "models/checkpoints/ResNet50V2_best.keras"
    if os.path.exists(frozen_ckpt):
        frozen_model = load_local_model(frozen_ckpt)
        print(f"✓ Frozen checkpoint loaded  ({frozen_ckpt})")
    else:
        frozen_model = None
        print(f"⚠ Frozen checkpoint not found — comparison will use single model")

STEP 2 — Add global at top of file (after classification_model = None):

    frozen_model = None

STEP 3 — Paste this route into app.py before the error handlers:
"""

# ─── Grad-CAM Comparison Route ────────────────────────────────────────────────

@app.route("/compare-gradcam", methods=["POST"])
@require_auth
def compare_gradcam(current_user):
    """
    Generate two Grad-CAM heatmaps for the same image:
      1. Frozen ResNet50V2   — ImageNet weights, backbone never trained on MRI
      2. Fine-tuned ResNet50V2 — backbone trained on brain MRI dataset

    Returns:
      {
        "frozen":    "<base64 PNG>",   // may be null if checkpoint missing
        "finetuned": "<base64 PNG>",
        "class_name": "Glioma Tumor",
        "confidence": "99.53%",
        "frozen_available": true/false
      }
    """
    if "image" not in request.files:
        return jsonify({"error": "No image provided"}), 400

    file = request.files["image"]
    if file.filename == "":
        return jsonify({"error": "Empty filename"}), 400

    try:
        # ── Preprocess ────────────────────────────────────────────
        image_np     = load_image(file)
        preprocessed = preprocess_classification(image_np)

        # ── Predict with fine-tuned model (main model) ────────────
        predictions     = classification_model.predict(preprocessed, verbose=0)
        predicted_class = int(np.argmax(predictions[0]))
        confidence      = float(predictions[0][predicted_class])
        class_name      = CLASS_NAMES.get(predicted_class, "Unknown")

        print(f"[COMPARE] Prediction: {class_name} ({confidence:.2%})")

        # ── Fine-tuned Grad-CAM ───────────────────────────────────
        finetuned_b64 = generate_gradcam(
            model          = classification_model,
            img_array      = preprocessed,
            class_idx      = predicted_class,
            original_image = image_np,
        )
        print("[COMPARE] ✓ Fine-tuned Grad-CAM generated")

        # ── Frozen Grad-CAM ───────────────────────────────────────
        frozen_b64       = None
        frozen_available = frozen_model is not None

        if frozen_model is not None:
            try:
                frozen_b64 = generate_gradcam(
                    model          = frozen_model,
                    img_array      = preprocessed,
                    class_idx      = predicted_class,
                    original_image = image_np,
                )
                print("[COMPARE] ✓ Frozen Grad-CAM generated")
            except Exception as e:
                print(f"[COMPARE] ✗ Frozen Grad-CAM failed: {e}")
        else:
            print("[COMPARE] ⚠ Frozen model not loaded — skipping frozen Grad-CAM")

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